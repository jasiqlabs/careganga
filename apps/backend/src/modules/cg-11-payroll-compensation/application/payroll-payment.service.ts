import {ConflictException,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {FinanceVoucherDraftService} from "../../cg-09-finance-accounting/application/finance-voucher-draft.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {PayrollFinanceSourceFacade} from "../../cg-09-finance-accounting/application/payroll-finance-source.facade";
import {PayrollCompensationService} from "./payroll-compensation.service";
import {PayrollRunService} from "./payroll-run.service";
import {fields,id,minor,option} from "../domain/payroll-input";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
@Injectable()
export class PayrollPaymentService{
 constructor(private readonly comp:PayrollCompensationService,private readonly runs:PayrollRunService,private readonly finance:PayrollFinanceSourceFacade,private readonly vouchers:FinanceVoucherDraftService,private readonly branches:BranchSourceFacade){}
 async approved(tx:PoolClient,a:Actor,ref:string,lock=false){
  const r=await this.runs.row(tx,a,ref,lock);
  if(r.status!=="APPROVED_FROZEN"||!r.approved_decision_ref||!r.snapshot_digest||!r.approval_case_ref)throw new ConflictException("An independently approved frozen payroll run is required");
  const valid=await tx.query(`SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='PAYROLL_RUN_RELEASE' AND c.status='OWNER_COMPLETED' AND d.id=$3 AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>$4 FOR SHARE OF c,d`,[a.realmId,r.approval_case_ref,r.approved_decision_ref,r.creator]);
  if(!valid.rowCount)throw new ConflictException("Original CG03 approval unavailable");
  return {...r,approved_decision_ref:r.approved_decision_ref,snapshot_digest:r.snapshot_digest};
 }
 async options(token:string,ref:string){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const r=await this.approved(tx,a,ref);
  const accounts=await this.finance.options(tx,a,r.branch_ref);
  const accrued=(await tx.query<{journal_ref:string}>(`SELECT journal_ref FROM payroll_accrual WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  const totals=(await tx.query(`SELECT coalesce(sum(gross_minor),0)::text AS "grossMinor",coalesce(sum(net_minor),0)::text AS "netMinor",coalesce(sum(deduction_minor-statutory_minor),0)::text AS "deductionMinor",coalesce(sum(employer_minor),0)::text AS "employerMinor",coalesce(sum(statutory_minor),0)::text AS "statutoryMinor" FROM payroll_line WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  return {...accounts,totals,journalRef:accrued?.journal_ref??null};
 });}
 async accrue(token:string,ref:string,raw:unknown){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const x=fields(raw,["requestKey","expenseRef","payableRef","deductionRef","employerRef","statutoryRef"]);
  const key=id(x.requestKey),optional=(v:unknown)=>v==null||v===""?null:id(v);
  const accounts={expense:id(x.expenseRef),payable:id(x.payableRef),deduction:optional(x.deductionRef),employer:optional(x.employerRef),statutory:optional(x.statutoryRef)};
  const r=await this.approved(tx,a,ref,true);
  await this.finance.options(tx,a,r.branch_ref);
  const digest=createHash("sha256").update(JSON.stringify([r.id,r.snapshot_digest,r.approved_decision_ref,accounts])).digest("hex");
  const prior=(await tx.query<{journal_ref:string;request_digest:string}>(`SELECT journal_ref,request_digest FROM payroll_accrual WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  if(prior){if(prior.request_digest!==digest)throw new ConflictException("Payroll has already accrued with different accounts");return {journalRef:prior.journal_ref,status:"ACCRUED_NOT_PAID",replayed:true};}
  const journal=await this.finance.accrue(tx,a,r,accounts,digest);
  await tx.query(`INSERT INTO payroll_accrual(root_realm_id,run_id,decision_ref,source_digest,request_digest,request_key,journal_ref,expense_ref,payable_ref,deduction_ref,employer_ref,statutory_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[a.realmId,r.id,r.approved_decision_ref,r.snapshot_digest,digest,key,journal,accounts.expense,accounts.payable,accounts.deduction,accounts.employer,accounts.statutory,a.accountId]);
  await recordPayrollAudit(tx,a,"RUN","APPROVED",key);
  return {journalRef:journal,status:"ACCRUED_NOT_PAID",replayed:false};
 });}

 private async financeScope(tx:PoolClient,a:Actor,branch:string|null,action:"finance.vouchers.manage"|"finance.vouchers.view"){
  if(branch)await this.branches.requireFinanceActorBranch(tx,a,branch,action);else await this.branches.requireFinanceRootScope(tx,a,action);
 }
 async batchOptions(token:string,ref:string){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const r=await this.approved(tx,a,ref);await this.financeScope(tx,a,r.branch_ref,"finance.vouchers.manage");
  const accounts=(await tx.query<{value:string;label:string;method:string}>(`SELECT a.id value,b.display_label label,a.account_kind method FROM finance_account a JOIN cash_bank_account b ON b.root_realm_id=a.root_realm_id AND b.account_id=a.id WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND b.status='ACTIVE' AND a.account_kind IN('CASH','BANK') AND (a.branch_id IS NULL OR a.branch_id=$2::uuid) ORDER BY b.display_label,a.id LIMIT 100`,[a.realmId,r.branch_ref])).rows;
  const batch=(await tx.query<{id:string}>(`SELECT id FROM payroll_batch WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  return {accounts,batchRef:batch?.id??null};
 });}
 async prepare(token:string,ref:string,raw:unknown){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const x=fields(raw,["requestKey","paymentAccountRef","method"]),key=id(x.requestKey),payment=id(x.paymentAccountRef),method=option(x.method,["BANK","CASH"] as const);
  const r=await this.approved(tx,a,ref,true);await this.financeScope(tx,a,r.branch_ref,"finance.vouchers.manage");
  const prior=(await tx.query<{id:string;payment_account_ref:string;method:string}>(`SELECT id,payment_account_ref,method FROM payroll_batch WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  if(prior){if(prior.payment_account_ref!==payment||prior.method!==method)throw new ConflictException("Original batch is already pinned to another payment account");return {batchRef:prior.id,replayed:true};}
  const eligible=await tx.query(`SELECT 1 FROM finance_account a JOIN cash_bank_account b ON b.root_realm_id=a.root_realm_id AND b.account_id=a.id WHERE a.root_realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' AND b.status='ACTIVE' AND a.account_kind=$3 AND (a.branch_id IS NULL OR a.branch_id=$4::uuid) FOR SHARE OF a,b`,[a.realmId,payment,method,r.branch_ref]);
  if(!eligible.rowCount)throw new ConflictException("Original payment account unavailable");
  const accrual=await tx.query(`SELECT 1 FROM payroll_accrual WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id]);if(!accrual.rowCount)throw new ConflictException("Post the original salary payable first");
  const batch=(await tx.query<{id:string}>(`INSERT INTO payroll_batch(root_realm_id,run_id,payment_account_ref,method,created_by,request_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[a.realmId,r.id,payment,method,a.accountId,key])).rows[0];
  await tx.query(`SELECT e.id FROM payroll_line l JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref WHERE l.root_realm_id=$1 AND l.run_id=$2 ORDER BY e.id FOR UPDATE OF e`,[a.realmId,r.id]);
  await tx.query(`INSERT INTO payroll_batch_item(root_realm_id,batch_ref,line_ref,destination_ref,destination_revision,destination_fingerprint)
   SELECT l.root_realm_id,$3,l.id,p.id,p.revision,p.destination_fingerprint FROM payroll_line l
   LEFT JOIN LATERAL(SELECT d.id,d.revision,d.destination_fingerprint FROM employee_payout_instruction_effective d WHERE $4='BANK' AND d.root_realm_id=l.root_realm_id AND d.employee_ref=l.employee_ref AND d.status='APPROVED' AND d.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (d.effective_until IS NULL OR d.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date) ORDER BY d.effective_from DESC LIMIT 1)p ON true
   WHERE l.root_realm_id=$1 AND l.run_id=$2 AND l.net_minor>0 AND l.entitlement_state='RELEASE_ELIGIBLE' AND ($4='CASH' OR p.id IS NOT NULL)`,[a.realmId,r.id,batch.id,method]);
  await recordPayrollAudit(tx,a,"RUN","DRAFT_CREATED",key);
  return {batchRef:batch.id,replayed:false};
 });}
 async outcomes(token:string,ref:string,forReport=false){return this.comp.run(token,forReport?"mis.reports.export":"payroll.runs.view",async(tx,a)=>{
  const r=await this.approved(tx,a,ref);
  const batch=(await tx.query<{id:string;method:string}>(`SELECT id,method FROM payroll_batch WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  const items=(await tx.query<{lineRef:string;itemRef:string|null;employeeRef:string;name:string;employeeCode:string;department:string|null;designation:string|null;grossMinor:string;deductionMinor:string;dueMinor:string;paidMinor:string;entitlement:string;attempts:{voucherRef:string;voucherNumber:string;amountMinor:string;paidMinor:string;state:string;reversed:boolean}[]}>(`
   SELECT l.id AS "lineRef",i.id AS "itemRef",l.employee_ref AS "employeeRef",l.source_snapshot->>'name' name,l.source_snapshot->>'reference' AS "employeeCode",l.source_snapshot->>'department' department,l.source_snapshot->>'designation' designation,l.gross_minor::text AS "grossMinor",l.deduction_minor::text AS "deductionMinor",l.net_minor::text AS "dueMinor",l.entitlement_state entitlement,coalesce(o.paid,0)::text AS "paidMinor",coalesce(o.attempts,'[]'::jsonb) attempts
   FROM payroll_line l LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
   LEFT JOIN LATERAL(SELECT sum(p.paid_minor) paid,jsonb_agg(jsonb_build_object('voucherRef',p.voucher_ref,'voucherNumber',p.voucher_number,'amountMinor',p.amount_minor::text,'paidMinor',p.paid_minor::text,'state',p.voucher_status,'reversed',p.reversed) ORDER BY p.created_at,p.id) attempts FROM payroll_attempt_outcome p WHERE p.root_realm_id=i.root_realm_id AND p.item_ref=i.id)o ON true
   WHERE l.root_realm_id=$1 AND l.run_id=$2 ORDER BY l.employee_ref`,[a.realmId,r.id])).rows;
  const due=items.reduce((n,x)=>n+BigInt(x.dueMinor),0n),paid=items.reduce((n,x)=>n+BigInt(x.paidMinor),0n);
  await recordPayrollAudit(tx,a,"RUN","READ");
  return {batchRef:batch?.id??null,method:batch?.method??null,dueMinor:String(due),paidMinor:String(paid),status:paid>due||items.some(x=>BigInt(x.paidMinor)>BigInt(x.dueMinor)||x.attempts.some(t=>t.reversed||(t.state==="POSTED"&&t.paidMinor!==t.amountMinor)))?"RECONCILIATION_REQUIRED":due===0n?"NO_PAYMENT_DUE":due===paid?"PAID_VERIFIED":paid>0n?"PARTIALLY_PAID":items.some(x=>x.attempts.some(t=>!["POSTED","REJECTED"].includes(t.state)))?"PAYMENT_PENDING":"APPROVED_NOT_PAID",items:items.map(x=>({...x,status:BigInt(x.paidMinor)>BigInt(x.dueMinor)||x.attempts.some(t=>t.reversed||(t.state==="POSTED"&&t.paidMinor!==t.amountMinor))?"RECONCILIATION_REQUIRED":BigInt(x.dueMinor)===0n?"NO_PAYMENT_DUE":x.paidMinor===x.dueMinor?"PAID_VERIFIED":BigInt(x.paidMinor)>0n?"PARTIALLY_PAID":x.entitlement==="HELD"?"HELD":x.attempts.some(t=>!["REJECTED","POSTED"].includes(t.state))?"PAYMENT_PENDING":!x.itemRef?"DESTINATION_OR_BATCH_PENDING":"DUE"}))};
 });}
 async report(token:string,ref:string,q="",state=""){
  if(typeof q!=="string"||q.length>100||typeof state!=="string"||state.length>100)throw new ConflictException("Invalid report filters");
  const result=await this.outcomes(token,ref,true),needle=q.toLowerCase();
  const rows=result.items.filter(x=>(!state||x.status===state)&&[x.name,x.employeeCode,x.department??""].some(v=>v.toLowerCase().includes(needle)));
  if(rows.length>5000)throw new ConflictException("Narrow report filters");
  const cell=(value:string)=>'"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
  const rupees=(value:string)=>{const n=BigInt(value);return (n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");};
  const csv=[["Employee reference","Employee","Department","Designation","Gross INR","Deductions INR","Net INR","Verified paid INR","Payment status"],...rows.map(x=>[x.employeeCode,x.name,x.department??"",x.designation??"",rupees(x.grossMinor),rupees(x.deductionMinor),rupees(x.dueMinor),rupees(x.paidMinor),x.status])].map(row=>row.map(cell).join(",")).join("\r\n");
  if(Buffer.byteLength(csv,"utf8")>2097152)throw new ConflictException("Narrow report filters");
  return {csv,filename:"CareGanga-Payroll-History.csv"};
 }
 async requestAttempt(token:string,ref:string,raw:unknown){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const x=fields(raw,["requestKey","itemRef","amountMinor"]),key=id(x.requestKey),item=id(x.itemRef),amount=minor(x.amountMinor);
  const r=await this.approved(tx,a,ref,true);await this.financeScope(tx,a,r.branch_ref,"finance.vouchers.manage");
  const pinned=(await tx.query<{id:string;employee_ref:string;net_minor:string;payment_account_ref:string;payable_ref:string;destination_ref:string|null;destination_revision:number|null;destination_fingerprint:string|null;method:string}>(`SELECT i.id,l.employee_ref,l.net_minor::text,b.payment_account_ref,a.payable_ref,i.destination_ref,i.destination_revision,i.destination_fingerprint,b.method FROM payroll_batch_item i JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref JOIN payroll_accrual a ON a.root_realm_id=b.root_realm_id AND a.run_id=b.run_id JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref WHERE i.root_realm_id=$1 AND i.id=$2 AND b.run_id=$3 FOR UPDATE OF i`,[a.realmId,item,r.id])).rows[0];
  if(!pinned)throw new ConflictException("Original payout item unavailable");
  const prior=(await tx.query<{item_ref:string;amount_minor:string;voucher_ref:string}>(`SELECT item_ref,amount_minor::text,voucher_ref FROM payroll_payout_attempt WHERE root_realm_id=$1 AND request_key=$2`,[a.realmId,key])).rows[0];
  if(prior){if(prior.item_ref!==item||prior.amount_minor!==amount)throw new ConflictException("Original payout request changed");return {voucherRef:prior.voucher_ref,status:"FINANCE_SOURCE_CREATED",replayed:true};}
  await tx.query("SELECT id FROM hr_employee WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,pinned.employee_ref]);
  if(pinned.method==="BANK"){
   const current=await tx.query(`SELECT 1 FROM employee_payout_instruction_effective WHERE root_realm_id=$1 AND employee_ref=$2 AND id=$3 AND revision=$4 AND destination_fingerprint=$5 AND status='APPROVED' AND effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (effective_until IS NULL OR effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date)`,[a.realmId,pinned.employee_ref,pinned.destination_ref,pinned.destination_revision,pinned.destination_fingerprint]);
   if(!current.rowCount)throw new ConflictException("Pinned payout destination changed; independent review required");
  }
  const attempts=(await tx.query<{paid_minor:string;voucher_status:string;reversed:boolean;amount_minor:string}>(`SELECT paid_minor::text,voucher_status,reversed,amount_minor::text FROM payroll_attempt_outcome WHERE root_realm_id=$1 AND item_ref=$2`,[a.realmId,item])).rows;
  const paid=attempts.reduce((n,t)=>n+BigInt(t.paid_minor),0n);
  if(attempts.some(t=>!["POSTED","REJECTED"].includes(t.voucher_status)||t.reversed||(t.voucher_status==="POSTED"&&t.paid_minor!==t.amount_minor))||paid+BigInt(amount)>BigInt(pinned.net_minor))throw new ConflictException("Original payment unresolved or amount exceeds the remaining due");
  const years=(await tx.query<{id:string;day:string}>(`SELECT id,(now() AT TIME ZONE 'Asia/Kolkata')::date::text AS day FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' AND (now() AT TIME ZONE 'Asia/Kolkata')::date BETWEEN start_on AND end_on FOR SHARE`,[a.realmId])).rows;
  if(years.length!==1)throw new ConflictException("Current settlement finance year unavailable");
  const voucher=await this.vouchers.preparePayrollPayment(tx,a,{key,branch:r.branch_ref,year:years[0].id,date:years[0].day,debit:pinned.payable_ref,payment:pinned.payment_account_ref,minor:amount,reference:r.run_number});
  await tx.query(`INSERT INTO payroll_payout_attempt(root_realm_id,item_ref,voucher_ref,amount_minor,request_key,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[a.realmId,item,voucher.voucherRef,amount,key,a.accountId]);
  await recordPayrollAudit(tx,a,"RUN","DRAFT_CREATED",key);
  return {voucherRef:voucher.voucherRef,voucherNumber:voucher.voucherNumber,status:"FINANCE_SOURCE_CREATED",replayed:false};
 });}
}
