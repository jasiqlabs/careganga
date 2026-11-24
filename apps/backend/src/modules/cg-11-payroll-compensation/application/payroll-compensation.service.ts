import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceVoucherDraftService} from "../../cg-09-finance-accounting/application/finance-voucher-draft.service";
import {HrEmploymentChangeSourceFacade} from "../../cg-10-human-resources/application/hr-employment-change-source.facade";
import {HrPayrollEmployeeSourceFacade,payrollEmployeeDirectorySql} from "../../cg-10-human-resources/application/hr-payroll-employee-source.facade";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
import {parsePayout,protectPayout} from "../domain/payout-instruction";
import {id,parsePolicy,parseSalary,componentMinor,fiscalYearFor} from "../domain/payroll-input";
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const conflict=()=>new ConflictException("Payroll source changed. Refresh and review the current version.");
type Policy={id:string;branch_ref:string|null;label:string;effective_from:string;effective_to:string|null;supersedes_ref:string|null;status:string;revision:number;request_digest:string};
type Salary={id:string;employee_ref:string;branch_ref:string;policy_id:string;effective_from:string;effective_to:string|null;supersedes_ref:string|null;base_salary_minor:string;status:string;revision:number;request_digest:string};
@Injectable()
export class PayrollCompensationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,private readonly hr:HrPayrollEmployeeSourceFacade,private readonly hrChange:HrEmploymentChangeSourceFacade,private readonly finance:FinanceVoucherDraftService){}
 private async auditFailure(a:Actor,e:unknown){
  const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";
  const result=e instanceof ForbiddenException||e instanceof NotFoundException?"DENIED":e instanceof BadRequestException?"INVALID":e instanceof ConflictException||["23503","23505","23514","23P01","40001","40P01","55P03"].includes(code)?"CONFLICT":null;
  if(result){try{await recordPayrollAudit(this.db,a,"ACCESS",result);}catch{ /* Preserve the denial even if the audit store is unavailable. No private fields in telemetry. */ console.warn("CG11 protected audit unavailable");}}
 }
 async run<T>(token:string,action:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,before?:(a:Actor)=>Promise<void>):Promise<T>{
  let a:Actor;
  try{a=await this.sessions.requireAction(token,action);if(before)await before(a);}catch(e){try{const verified=await this.sessions.verifySession(token);await this.auditFailure(verified,e);}catch{/* Unauthenticated or expired sessions have no verified actor to audit. */}throw e;}
  const tx=await this.db.connect();let released=false;
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);const v=await fn(tx,a);await tx.query("COMMIT");return v;}
  catch(e){try{await tx.query("ROLLBACK");}finally{tx.release();released=true;}await this.auditFailure(a,e);const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";if(["23503","23505","23514","23P01","40001","40P01","55P03"].includes(code))throw conflict();throw e;}finally{if(!released)tx.release();}
 }
 async audit(tx:PoolClient,a:Actor,kind:"POLICY"|"COMPENSATION"|"PAYOUT",ref:string,result:"DRAFT_CREATED"|"SUBMITTED"|"APPROVED"|"RETURNED"|"REJECTED"|"READ"){
  const correlation=randomUUID();
  await tx.query("INSERT INTO payroll_source_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,result_class) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,a.accountId,kind,ref,correlation,result]);
  await recordPayrollAudit(tx,a,kind,result,correlation);
 }
 private policyView(p:Policy){return {ref:p.id,branchRef:p.branch_ref,label:p.label,fiscalYear:fiscalYearFor(p.effective_from).label,effectiveFrom:p.effective_from,effectiveTo:p.effective_to,supersedesRef:p.supersedes_ref,status:p.status,revision:p.revision};}
 private salaryView(p:Salary){return {ref:p.id,employeeRef:p.employee_ref,branchRef:p.branch_ref,policyRef:p.policy_id,effectiveFrom:p.effective_from,effectiveTo:p.effective_to,supersedesRef:p.supersedes_ref,baseMinor:p.base_salary_minor,status:p.status,revision:p.revision};}
 async employee(tx:PoolClient,a:Actor,employee:string,forDate:string|null=null){return this.hr.employee(tx,a,employee,forDate);}
 async options(token:string,branchInput:unknown,qInput:unknown,offsetInput:unknown=0,filters:{department?:unknown;employmentType?:unknown;employmentStatus?:unknown;salaryStatus?:unknown}={}){return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   const offset=Number(offsetInput),salaryStatus=filters.salaryStatus??"";
   if(!Number.isSafeInteger(offset)||offset<0||offset>100000||typeof salaryStatus!=="string"||!["","CONFIGURED","NOT_CONFIGURED","PENDING"].includes(salaryStatus))throw new BadRequestException("Invalid payroll filter");
   const scope=await this.hr.directoryScope(tx,a,branchInput,qInput,filters);
   const result=(await tx.query<{items:unknown[];total:number;active:number;configured:number;gross:string;pending:number;documents_pending:number|null}>(
    `WITH employees AS (${payrollEmployeeDirectorySql}), enriched AS (
      SELECT e.*,c.salary,COALESCE(p.pending,0)::int AS pending
      FROM employees e LEFT JOIN LATERAL (
       SELECT jsonb_build_object('base',c.base_salary_minor::text,'gross',(c.base_salary_minor+COALESCE(x.allowance,0))::text,'deductions',COALESCE(x.deduction,0)::text,'net',(c.base_salary_minor+COALESCE(x.allowance,0)-COALESCE(x.deduction,0))::text) AS salary
       FROM employee_compensation_effective c LEFT JOIN LATERAL(
        SELECT sum(CASE WHEN p.calc_mode='FIXED' THEN p.amount_minor ELSE round(c.base_salary_minor::numeric*p.rate_bp/10000) END) FILTER(WHERE p.kind='ALLOWANCE') AS allowance,
        sum(CASE WHEN p.calc_mode='FIXED' THEN p.amount_minor ELSE round(c.base_salary_minor::numeric*p.rate_bp/10000) END) FILTER(WHERE p.kind='DEDUCTION') AS deduction
        FROM payroll_component p WHERE p.root_realm_id=c.root_realm_id AND p.policy_id=c.policy_id
       )x ON true WHERE c.root_realm_id=$1 AND c.employee_ref=e.ref AND c.branch_ref=e."branchRef" AND c.status='APPROVED'
       AND c.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (c.effective_until IS NULL OR c.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date)
       AND e.status IN('ACTIVE','PROBATION','ON_HOLD') LIMIT 1
      )c ON true LEFT JOIN LATERAL (
       SELECT (SELECT count(*) FROM employee_compensation s WHERE s.root_realm_id=$1 AND s.employee_ref=e.ref AND s.branch_ref=e."branchRef" AND s.status='SUBMITTED')+
       (SELECT count(*) FROM employee_payout_instruction s WHERE s.root_realm_id=$1 AND s.employee_ref=e.ref AND s.branch_ref=e."branchRef" AND s.status='SUBMITTED') AS pending
      )p ON true
    ), filtered AS (SELECT * FROM enriched WHERE $8='' OR ($8='CONFIGURED' AND salary IS NOT NULL) OR ($8='NOT_CONFIGURED' AND salary IS NULL) OR ($8='PENDING' AND pending>0)),
    page AS (SELECT * FROM filtered ORDER BY name,ref LIMIT 30 OFFSET $9)
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.name,p.ref) FROM page p),'[]'::jsonb) AS items,
    count(*)::int AS total,count(*) FILTER(WHERE status IN('ACTIVE','PROBATION'))::int AS active,
    count(*) FILTER(WHERE salary IS NOT NULL)::int AS configured,COALESCE(sum((salary->>'gross')::numeric),0)::text AS gross,COALESCE(sum(pending),0)::int AS pending,
    CASE WHEN $10::boolean THEN (SELECT count(*)::int FROM hr_document_request h JOIN filtered f ON f.ref=h.employee_id AND f."branchRef"=h.source_branch_ref WHERE h.root_realm_id=$1 AND h.status IN('DRAFT','SUBMITTED','RETURNED')) ELSE NULL END AS documents_pending FROM filtered`,[...scope.params,salaryStatus,offset,scope.canViewDocuments])).rows[0];
   const {params,...options}=scope;
   await recordPayrollAudit(tx,a,"COMPENSATION","READ");
   return {...options,items:result.items,hasMore:offset+30<result.total,offset,summary:{total:result.total,active:result.active,configured:result.configured,gross:result.gross,pending:result.pending,documentsPending:result.documents_pending}};
  });}
 async bankOptions(token:string,branchInput:unknown){
  const branch=branchInput==="FOUNDATION"?null:id(branchInput);
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   await this.branches.projectBranch(tx,a,branch);
   return this.finance.payrollBankOptions(tx,a,branch);
  });
 }
 async policies(token:string,branchInput:unknown){
  const branch=branchInput==="FOUNDATION"?null:id(branchInput);
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   await this.branches.projectBranch(tx,a,branch);
   const rows=(await tx.query<Policy>("SELECT id,branch_ref,label,effective_from::text,effective_until::text AS effective_to,supersedes_ref,status,revision,request_digest FROM payroll_policy_effective WHERE root_realm_id=$1 AND (branch_ref IS NOT DISTINCT FROM $2::uuid OR ($2::uuid IS NOT NULL AND branch_ref IS NULL AND status='APPROVED')) ORDER BY effective_from DESC,id DESC LIMIT 100",[a.realmId,branch])).rows;
   const components=(await tx.query("SELECT policy_id,code,label,kind,calc_mode,amount_minor::text,rate_bp,tax_class FROM payroll_component WHERE root_realm_id=$1 AND policy_id=ANY($2::uuid[]) ORDER BY code",[a.realmId,rows.map(r=>r.id)])).rows;
   await recordPayrollAudit(tx,a,"POLICY","READ");
   return {items:rows.map(p=>({...this.policyView(p),components:components.filter(c=>c.policy_id===p.id).map(({policy_id,...c})=>c)})),statutoryStatus:"NOT_CONFIGURED"};
  });
 }
 async createPolicy(token:string,raw:unknown){
  return this.run(token,"payroll.policy.manage",async(tx,a)=>{
   const v=parsePolicy(raw),digest=hash(v);
   await this.identity.assertCurrent(tx,a,"payroll.compensation.view");await this.branches.projectBranch(tx,a,v.branch);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-POLICY:"+a.realmId+":"+a.accountId+":"+v.key]);
   const previous=(await tx.query<Policy>("SELECT *,effective_from::text,effective_to::text FROM payroll_policy WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(previous){if(previous.request_digest!==digest||previous.branch_ref!==v.branch)throw conflict();return {...this.policyView(previous),replayed:true};}
   const p=(await tx.query<Policy>("INSERT INTO payroll_policy(root_realm_id,branch_ref,cycle,label,effective_from,effective_to,created_by,request_key,request_digest,supersedes_ref) VALUES($1,$2,'MONTHLY',$3,$4,$5,$6,$7,$8,$9) RETURNING *,effective_from::text,effective_to::text",[a.realmId,v.branch,v.label,v.from,v.to,a.accountId,v.key,digest,v.supersedes])).rows[0];
   for(const c of v.components)await tx.query("INSERT INTO payroll_component(root_realm_id,policy_id,code,label,kind,calc_mode,amount_minor,rate_bp,percent_basis,tax_class) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[a.realmId,p.id,c.code,c.label,c.kind,c.mode,c.minor,c.bp,c.mode==="PERCENT"?"BASIC":null,c.taxClass]);
   await this.audit(tx,a,"POLICY",p.id,"DRAFT_CREATED");return {...this.policyView(p),replayed:false};
  });
 }
 async hrProposals(token:string,employee:string){
  return this.run(token,"payroll.compensation.edit",async(tx,a)=>{
   const e=await this.employee(tx,a,employee);
   return {items:await this.hrChange.payrollProposals(tx,a,e.id,e.branch_ref,e.assignment_ref)};
  });
 }
 async history(token:string,employee:string){
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   const e=await this.hr.employeeForHistory(tx,a,employee);
   const scope=await this.branches.projectBranchScope(tx,a);
   const rows=(await tx.query<Salary>("SELECT *,effective_from::text,effective_until::text AS effective_to,base_salary_minor::text FROM employee_compensation_effective WHERE root_realm_id=$1 AND employee_ref=$2 AND branch_ref=ANY($3::uuid[]) ORDER BY effective_from DESC,id DESC LIMIT 100",[a.realmId,e.id,scope.branches.map(b=>b.value)])).rows;
   await this.audit(tx,a,"COMPENSATION",e.id,"READ");return {employee:{ref:e.id,reference:e.employee_code,name:e.name,designation:e.designation,status:e.status,branchRef:e.branch_ref},items:rows.map(r=>this.salaryView(r))};
  });
 }
 async createSalary(token:string,employee:string,raw:unknown){
  return this.run(token,"payroll.compensation.edit",async(tx,a)=>{
   const v=parseSalary(raw),digest=hash([id(employee),v]);
   await this.identity.assertCurrent(tx,a,"payroll.compensation.view");const current=await this.employee(tx,a,employee),e=await this.employee(tx,a,employee,v.from);
   if(!["ACTIVE","PROBATION"].includes(e.status)||current.branch_ref!==e.branch_ref)throw conflict();
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-SALARY:"+a.realmId+":"+a.accountId+":"+v.key]);
   const previous=(await tx.query<Salary>("SELECT *,effective_from::text,effective_to::text,base_salary_minor::text FROM employee_compensation WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(previous){if(previous.request_digest!==digest||previous.branch_ref!==e.branch_ref)throw conflict();return {...this.salaryView(previous),replayed:true};}
   const p=(await tx.query<Policy>("SELECT * FROM payroll_policy WHERE root_realm_id=$1 AND id=$2 AND (branch_ref=$3 OR branch_ref IS NULL) AND revision=$4 AND status='APPROVED' AND effective_from<=$5::date AND (LEAST(effective_to,(SELECT n.effective_from FROM payroll_policy n WHERE n.root_realm_id=payroll_policy.root_realm_id AND n.supersedes_ref=payroll_policy.id AND n.status='APPROVED')) IS NULL OR ($6::date IS NOT NULL AND LEAST(effective_to,(SELECT n.effective_from FROM payroll_policy n WHERE n.root_realm_id=payroll_policy.root_realm_id AND n.supersedes_ref=payroll_policy.id AND n.status='APPROVED'))>=$6::date)) FOR SHARE",[a.realmId,v.policy,e.branch_ref,v.policyRevision,v.from,v.to])).rows[0];
   if(!p)throw new ConflictException("Choose an approved effective payroll policy");
   const hrProposal=v.hrProposal?await this.hrChange.payrollProposal(tx,a,e.id,v.hrProposal,e.branch_ref,e.assignment_ref):null;
   if(hrProposal&&(hrProposal.baseMinor!==v.baseMinor||hrProposal.effectiveFrom!==v.from))throw new ConflictException("HR proposal amount or effective date changed");
   const components=(await tx.query<{kind:string;mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null}>("SELECT kind,calc_mode AS mode,amount_minor::text AS minor,rate_bp AS bp FROM payroll_component WHERE root_realm_id=$1 AND policy_id=$2",[a.realmId,p.id])).rows;
   let gross=BigInt(v.baseMinor),deduct=0n;for(const c of components){const amount=componentMinor(v.baseMinor,c);if(c.kind==="ALLOWANCE")gross+=amount;if(c.kind==="DEDUCTION")deduct+=amount;}
   if(gross<deduct||gross>99999999999999n)throw new ConflictException("Deductions or allowances exceed valid salary limits");
   const row=(await tx.query<Salary>(`INSERT INTO employee_compensation(root_realm_id,employee_ref,branch_ref,assignment_ref,assignment_version,employee_status_version,policy_id,policy_revision,effective_from,effective_to,base_salary_minor,created_by,request_key,request_digest,supersedes_ref,source_hr_proposal_ref,source_hr_proposal_revision,source_hr_proposal_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *,effective_from::text,effective_to::text,base_salary_minor::text`,[a.realmId,e.id,e.branch_ref,e.assignment_ref,e.assignment_version,e.status_version,p.id,v.policyRevision,v.from,v.to,v.baseMinor,a.accountId,v.key,digest,v.supersedes,hrProposal?.ref??null,hrProposal?.revision??null,hrProposal?.digest??null])).rows[0];
   await this.audit(tx,a,"COMPENSATION",row.id,"DRAFT_CREATED");return {...this.salaryView(row),replayed:false};
  });
 }
 async payoutHistory(token:string,employee:string){
  return this.run(token,"payroll.bank.edit",async(tx,a)=>{
   const e=await this.employee(tx,a,employee);
   const rows=(await tx.query<{id:string;effective_from:string;effective_to:string|null;masked_digits:string;masked_ifsc:string;status:string;revision:number}>("SELECT id,effective_from::text,effective_until::text AS effective_to,masked_digits,masked_ifsc,status,revision FROM employee_payout_instruction_effective WHERE root_realm_id=$1 AND employee_ref=$2 AND branch_ref=$3 ORDER BY effective_from DESC,id DESC LIMIT 100",[a.realmId,e.id,e.branch_ref])).rows;
   await this.audit(tx,a,"PAYOUT",e.id,"READ");
   return {items:rows.map(r=>({ref:r.id,effectiveFrom:r.effective_from,effectiveTo:r.effective_to,maskedAccount:"•••• "+r.masked_digits,maskedIfsc:r.masked_ifsc,status:r.status,revision:r.revision}))};
  });
 }
 async createPayout(token:string,employee:string,raw:unknown){
  return this.run(token,"payroll.bank.edit",async(tx,a)=>{
   const v=parsePayout(raw);
   const e=await this.employee(tx,a,employee),effective=await this.employee(tx,a,employee,v.from);
   if(e.branch_ref!==effective.branch_ref||!["ACTIVE","PROBATION"].includes(e.status))throw conflict();
   const ref=randomUUID(),enc=protectPayout(a.realmId,e.id,ref,v);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-PAYOUT:"+a.realmId+":"+a.accountId+":"+v.key]);
   const prior=(await tx.query<{id:string;employee_ref:string;branch_ref:string;request_digest:string;status:string}>("SELECT id,employee_ref,branch_ref,request_digest,status FROM employee_payout_instruction WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(prior){if(prior.employee_ref!==e.id||prior.branch_ref!==e.branch_ref||prior.request_digest!==enc.requestDigest)throw conflict();return {ref:prior.id,status:prior.status,replayed:true};}
   await tx.query(`INSERT INTO employee_payout_instruction(id,root_realm_id,employee_ref,branch_ref,assignment_ref,assignment_version,employee_status_version,effective_from,effective_to,destination_ciphertext,destination_nonce,destination_tag,destination_fingerprint,masked_digits,masked_ifsc,created_by,request_key,request_digest,supersedes_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,[ref,a.realmId,e.id,e.branch_ref,effective.assignment_ref,effective.assignment_version,effective.status_version,v.from,v.to,enc.ciphertext,enc.nonce,enc.tag,enc.fingerprint,enc.maskedDigits,enc.maskedIfsc,a.accountId,v.key,enc.requestDigest,v.supersedes]);
   await this.audit(tx,a,"PAYOUT",ref,"DRAFT_CREATED");return {ref,status:"DRAFT",replayed:false};
  });
 }
 /** Self-only read. No employee selector, no draft, no payout destination. */
 async ownPay(token:string){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertRootSelfSessionCurrent(tx,a);
   const row=(await tx.query<{id:string;employee_code:string;name:string;designation:string;branch_ref:string}>(
    `SELECT e.id,e.employee_code,app.legal_name AS name,h.designation,h.branch_ref FROM hr_employee e
     JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
     JOIN hr_employment_assignment h ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id
     JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
     WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION') AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date) FOR SHARE OF e,h,b`,[a.realmId,a.accountId])).rows[0];
   if(!row){await recordPayrollAudit(tx,a,"ACCESS","READ");await tx.query("COMMIT");return {employee:null,salary:null};}
   const c=(await tx.query<Salary>("SELECT *,base_salary_minor::text,effective_from::text,effective_until::text AS effective_to FROM employee_compensation_effective WHERE root_realm_id=$1 AND employee_ref=$2 AND branch_ref=$3 AND status='APPROVED' AND effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (effective_until IS NULL OR effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date)",[a.realmId,row.id,row.branch_ref])).rows[0];
   let salary:{effectiveFrom:string;effectiveTo:string|null;baseMinor:string;grossMinor:string;deductionMinor:string;netMinor:string;status:string}|null=null;
   if(c){
    const cs=(await tx.query<{kind:string;mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null}>("SELECT kind,calc_mode AS mode,amount_minor::text AS minor,rate_bp AS bp FROM payroll_component WHERE root_realm_id=$1 AND policy_id=$2",[a.realmId,c.policy_id])).rows;
    let gross=BigInt(c.base_salary_minor),deductions=0n;for(const x of cs){const value=componentMinor(c.base_salary_minor,x);if(x.kind==="ALLOWANCE")gross+=value;if(x.kind==="DEDUCTION")deductions+=value;}
    salary={effectiveFrom:c.effective_from,effectiveTo:c.effective_to,baseMinor:c.base_salary_minor,grossMinor:gross.toString(),deductionMinor:deductions.toString(),netMinor:(gross-deductions).toString(),status:"APPROVED_STRUCTURE"};
    await this.audit(tx,a,"COMPENSATION",c.id,"READ");
   }
   if(!c)await recordPayrollAudit(tx,a,"COMPENSATION","READ");
   await tx.query("COMMIT");return {employee:{reference:row.employee_code,name:row.name,designation:row.designation},salary};
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 /** Re-read the exact authorized source for CG03; no private banking fields or arbitrary table input. */
 async reviewSource(tx:PoolClient,a:Actor,kind:"POLICY"|"COMPENSATION"|"PAYOUT",ref:string,write=false){
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const table=kind==="POLICY"?"payroll_policy":kind==="PAYOUT"?"employee_payout_instruction":"employee_compensation";
  const initial=(await tx.query<{branch_ref:string|null}>("SELECT branch_ref FROM "+table+" WHERE root_realm_id=$1 AND id=$2",[a.realmId,id(ref)])).rows[0];
  if(!initial)throw new NotFoundException("Payroll source unavailable");
  const scope=await this.branches.projectBranchScope(tx,a);
  if(initial.branch_ref===null?!scope.all:!scope.branches.some(b=>b.value===initial.branch_ref))throw new NotFoundException("Payroll source unavailable");
  await this.branches.projectBranch(tx,a,initial.branch_ref);
  type Source=Policy&Omit<Salary,"branch_ref">&{created_by:string;approval_case_ref:string|null;assignment_ref:string;assignment_version:number;employee_status_version:number;policy_revision:number;source_hr_proposal_ref:string|null;source_hr_proposal_revision:number|null;source_hr_proposal_digest:string|null;destination_ciphertext:string;destination_nonce:string;destination_tag:string;destination_fingerprint:string;masked_digits:string;masked_ifsc:string};
  const row=(await tx.query<Source>("SELECT *,effective_from::text,effective_to::text"+(kind==="COMPENSATION"?",base_salary_minor::text":"")+" FROM "+table+" WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref])).rows[0];
  if(!row||row.branch_ref!==initial.branch_ref)throw conflict();
  let previous:Record<string,unknown>|null=null;
  if(row.supersedes_ref){
   const prior=(await tx.query<Source>("SELECT *,effective_from::text,effective_to::text"+(kind==="COMPENSATION"?",base_salary_minor::text":"")+" FROM "+table+" WHERE root_realm_id=$1 AND id=$2 AND status='APPROVED' FOR SHARE",[a.realmId,row.supersedes_ref])).rows[0];
   if(prior&&(prior.branch_ref===null?scope.all:scope.branches.some(b=>b.value===prior.branch_ref))&&(kind==="POLICY"?prior.branch_ref===row.branch_ref:prior.employee_ref===row.employee_ref)){
    previous={effectiveFrom:prior.effective_from,effectiveTo:prior.effective_to,...(kind==="POLICY"?{label:prior.label}:kind==="PAYOUT"?{maskedAccount:"•••• "+prior.masked_digits,maskedIfsc:prior.masked_ifsc}:{baseMinor:prior.base_salary_minor})};
   }
  }
  let preview:Record<string,unknown>,digest:string;
  if(kind==="POLICY"){
   const components=(await tx.query("SELECT code,label,kind,calc_mode,amount_minor::text,rate_bp,percent_basis,tax_class FROM payroll_component WHERE root_realm_id=$1 AND policy_id=$2 ORDER BY code",[a.realmId,row.id])).rows;
   preview={...this.policyView(row),components};digest=hash([kind,row.id,row.branch_ref,row.label,row.effective_from,row.effective_to,row.supersedes_ref,components,row.request_digest]);
  }else{
   if(row.branch_ref===null)throw conflict();
   const current=write?await this.employee(tx,a,row.employee_ref):await this.hr.employeeForHistory(tx,a,row.employee_ref),effective=write?await this.employee(tx,a,row.employee_ref,row.effective_from):null;
   if(write&&(!effective||current.branch_ref!==row.branch_ref||effective.assignment_ref!==row.assignment_ref||effective.assignment_version!==row.assignment_version||effective.status_version!==row.employee_status_version||!["ACTIVE","PROBATION"].includes(current.status)))throw conflict();
   if(kind==="PAYOUT"){
    preview={ref:row.id,employeeName:current.name,employeeReference:current.employee_code,effectiveFrom:row.effective_from,effectiveTo:row.effective_to,status:row.status,revision:row.revision,maskedAccount:"•••• "+row.masked_digits,maskedIfsc:row.masked_ifsc};
    digest=hash([kind,row.id,row.employee_ref,row.branch_ref,row.assignment_ref,row.assignment_version,row.employee_status_version,row.effective_from,row.effective_to,row.supersedes_ref,row.destination_ciphertext,row.destination_nonce,row.destination_tag,row.destination_fingerprint,row.masked_digits,row.masked_ifsc,row.request_digest]);
    if(!write)await recordPayrollAudit(tx,a,kind,"READ");
    return {row,preview:{...preview,previous},digest};
   }
   const policy=(await tx.query("SELECT revision,status FROM payroll_policy WHERE root_realm_id=$1 AND id=$2 AND (branch_ref=$3 OR branch_ref IS NULL) FOR SHARE",[a.realmId,row.policy_id,row.branch_ref])).rows[0];
   if(write&&(!policy||policy.status!=="APPROVED"||policy.revision!==row.policy_revision))throw conflict();
   if(write&&row.source_hr_proposal_ref){
    const original=await this.hrChange.payrollProposal(tx,a,row.employee_ref,row.source_hr_proposal_ref,row.branch_ref!,row.assignment_ref);
    if(original.revision!==row.source_hr_proposal_revision||original.digest!==row.source_hr_proposal_digest||original.baseMinor!==row.base_salary_minor||original.effectiveFrom!==row.effective_from)throw conflict();
   }
   preview={...this.salaryView({...row,branch_ref:row.branch_ref}),employeeName:current.name,employeeReference:current.employee_code,hasOriginalHrProposal:!!row.source_hr_proposal_ref};digest=hash([kind,row.id,row.employee_ref,row.branch_ref,row.assignment_ref,row.assignment_version,row.employee_status_version,row.policy_id,row.policy_revision,row.source_hr_proposal_ref,row.source_hr_proposal_revision,row.source_hr_proposal_digest,row.effective_from,row.effective_to,row.supersedes_ref,row.base_salary_minor,row.request_digest]);
  }
  if(!write)await recordPayrollAudit(tx,a,kind,"READ");
  return {row,preview:{...preview,previous},digest};
 }
 async applyReview(tx:PoolClient,a:Actor,kind:"POLICY"|"COMPENSATION"|"PAYOUT",ref:string,status:"SUBMITTED"|"APPROVED"|"RETURNED"|"REJECTED",expected:number,caseRef:string){
  const table=kind==="POLICY"?"payroll_policy":kind==="PAYOUT"?"employee_payout_instruction":"employee_compensation";
  const result=await tx.query("UPDATE "+table+" SET status=$3,revision=revision+1,approval_case_ref=$4 WHERE root_realm_id=$1 AND id=$2 AND revision=$5 RETURNING id",[a.realmId,ref,status,caseRef,expected]);
  if(!result.rowCount)throw conflict();
  await this.audit(tx,a,kind,ref,status);
 }
}
