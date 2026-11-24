import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {PayrollRunService} from "./payroll-run.service";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
import {id} from "../domain/payroll-input";
type Row={lineRef:string;runRef:string;reference:string;period:string;employeeRef:string;name:string;employeeCode:string;designation:string;entitlement:string;baseMinor:string;allowanceMinor:string;bonusMinor:string;arrearsMinor:string;grossMinor:string;deductionMinor:string;netMinor:string;paidMinor:string;employerMinor:string;statutoryMinor:string;components:unknown;reversed:boolean;failed:boolean;pending:boolean};
const projection=`SELECT l.id AS "lineRef",r.id AS "runRef",r.run_number reference,l.period_key period,l.employee_ref AS "employeeRef",l.source_snapshot->>'name' name,l.source_snapshot->>'reference' AS "employeeCode",l.source_snapshot->>'designation' designation,l.entitlement_state entitlement,l.base_minor::text AS "baseMinor",l.allowance_minor::text AS "allowanceMinor",l.bonus_minor::text AS "bonusMinor",l.arrears_minor::text AS "arrearsMinor",l.gross_minor::text AS "grossMinor",l.deduction_minor::text AS "deductionMinor",l.net_minor::text AS "netMinor",l.employer_minor::text AS "employerMinor",l.statutory_minor::text AS "statutoryMinor",coalesce(p.paid,0)::text AS "paidMinor",coalesce(p.reversed,false) reversed,coalesce(p.failed,false) failed,coalesce(p.pending,false) pending,coalesce(l.source_snapshot->'amounts'->'components','[]'::jsonb) components
 FROM payroll_line l JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
 LEFT JOIN LATERAL (SELECT sum(x.paid_minor) paid,bool_or(x.reversed OR (x.attempt_status='POSTED' AND x.paid_minor<>x.amount_minor)) reversed,bool_or(x.attempt_status IN('FAILED_VERIFIED','RETURNED_VERIFIED')) failed,bool_or(x.attempt_status NOT IN('POSTED','REJECTED','FAILED_VERIFIED','RETURNED_VERIFIED')) pending FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true WHERE l.root_realm_id=$1`;
const status=(x:Row)=>x.reversed||BigInt(x.paidMinor)>BigInt(x.netMinor)?"RECONCILIATION_REQUIRED":x.netMinor==="0"?"NO_PAYMENT_DUE":x.netMinor===x.paidMinor?"PAID_VERIFIED":BigInt(x.paidMinor)>0n?"PARTIALLY_PAID":x.entitlement==="HELD"?"HELD":x.pending?"PAYMENT_PENDING":x.failed?"FAILED_TRANSFER_DUE":"PAYMENT_PENDING";
@Injectable()
export class PayrollPayslipSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly runs:PayrollRunService){}
 private async employee(tx:PoolClient,a:Actor){
  const rows=await tx.query<{id:string}>(`SELECT e.id FROM hr_employee e JOIN hr_employment_assignment h ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
  WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION') AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date) FOR SHARE OF e,h,b`,[a.realmId,a.accountId]);
  return rows.rows.length===1?rows.rows[0].id:null;
 }
 private view(r:Row){const v={...r,paymentStatus:status(r)};return {...v,sourceDigest:createHash("sha256").update(JSON.stringify(v)).digest("hex")};}
 async own(token:string){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertRootSelfSessionCurrent(tx,a);const employee=await this.employee(tx,a);
   const rows=employee?(await tx.query<Row>(projection+" AND l.employee_ref=$2 ORDER BY l.period_key DESC,l.id LIMIT 100",[a.realmId,employee])).rows:[];
   await recordPayrollAudit(tx,a,"RUN","READ");await tx.query("COMMIT");return {items:rows.map(x=>this.view(x))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async readSource(tx:PoolClient,a:Actor,lineInput:string,email=false,ownOnly=false){
  await this.identity.assertRootSelfSessionCurrent(tx,a);
  const line=id(lineInput),r=(await tx.query<Row>(projection+" AND l.id=$2",[a.realmId,line])).rows[0];
  if(!r)throw new NotFoundException("Payslip unavailable");
  const own=await this.employee(tx,a);
  if(own!==r.employeeRef){if(ownOnly)throw new NotFoundException("Payslip unavailable");await this.runs.row(tx,a,r.runRef);if(email)await this.identity.assertCurrent(tx,a,"payroll.runs.manage");}
  if(BigInt(r.paidMinor)>BigInt(r.netMinor))throw new ConflictException("Original payroll settlement requires reconciliation");
  await recordPayrollAudit(tx,a,"RUN","READ");return {actor:a,data:this.view(r)};
 }
 /** Internal original approval provenance, not an impersonated staff session. */
 async approvedEventSource(root:string,event:string,claim:string){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");
   const row=(await tx.query<{line_ref:string;issuer_ref:string}>(`SELECT o.line_ref,d.actor_id issuer_ref FROM cg19_payroll_event_outbox o
    JOIN payroll_line l ON l.root_realm_id=o.realm_id AND l.id=o.line_ref
    JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id
    JOIN cg03_case_decision d ON d.realm_id=r.root_realm_id AND d.id=r.approved_decision_ref
    WHERE o.realm_id=$1 AND o.id=$2 AND o.event_kind IN('GENERATED','RESEND') AND o.state='PENDING' AND o.claim_token=$3 AND o.claimed_until>now()
    AND cg19_payroll_event_matches(o.realm_id,o.id,o.recipient_ref) FOR SHARE OF o,d`,[root,event,claim])).rows[0];
   if(!row)throw new NotFoundException("Original payroll event unavailable");
   const data=(await tx.query<Row>(projection+" AND l.id=$2",[root,row.line_ref])).rows[0];
   if(!data||BigInt(data.paidMinor)>BigInt(data.netMinor))throw new ConflictException("Original payroll settlement requires reconciliation");
   await tx.query("COMMIT");return {actor:{realmId:root,accountId:row.issuer_ref},data:this.view(data)};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async resendSource(tx:PoolClient,token:string,lineInput:string){
  const a=await this.sessions.verifySession(token);return this.readSource(tx,a,lineInput,false,true);
 }
 async emailSource(tx:PoolClient,token:string,lineInput:string){
  const a=await this.sessions.verifySession(token);return this.readSource(tx,a,lineInput,true);
 }
 async source(token:string,lineInput:string,email=false){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query("BEGIN");const value=await this.readSource(tx,a,lineInput,email);await tx.query("COMMIT");return value;}
  catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
