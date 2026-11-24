import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {id,parsePolicy,parseSalary,componentMinor} from "../domain/payroll-input";
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const conflict=()=>new ConflictException("Payroll source changed. Refresh and review the current version.");
type Policy={id:string;branch_ref:string;label:string;effective_from:string;effective_to:string|null;status:string;revision:number;request_digest:string};
type Salary={id:string;employee_ref:string;branch_ref:string;policy_id:string;effective_from:string;effective_to:string|null;base_salary_minor:string;status:string;revision:number;request_digest:string};
type Employee={id:string;name:string;employee_code:string;designation:string;branch_ref:string;assignment_ref:string;assignment_version:number;status_version:number;status:string};
@Injectable()
export class PayrollCompensationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 async run<T>(token:string,action:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>):Promise<T>{
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);const v=await fn(tx,a);await tx.query("COMMIT");return v;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";if(["23503","23505","23514","23P01","40001","40P01","55P03"].includes(code))throw conflict();throw e;}finally{tx.release();}
 }
 async audit(tx:PoolClient,a:Actor,kind:"POLICY"|"COMPENSATION",ref:string,result:string){
  await tx.query("INSERT INTO payroll_source_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,result_class) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,a.accountId,kind,ref,randomUUID(),result]);
 }
 private policyView(p:Policy){return {ref:p.id,branchRef:p.branch_ref,label:p.label,effectiveFrom:p.effective_from,effectiveTo:p.effective_to,status:p.status,revision:p.revision};}
 private salaryView(p:Salary){return {ref:p.id,employeeRef:p.employee_ref,branchRef:p.branch_ref,policyRef:p.policy_id,effectiveFrom:p.effective_from,effectiveTo:p.effective_to,baseMinor:p.base_salary_minor,status:p.status,revision:p.revision};}
 async employee(tx:PoolClient,a:Actor,employee:string,forDate:string|null=null){
  const e=(await tx.query<Employee>(`SELECT e.id,e.employee_code,app.legal_name AS name,a.designation,a.branch_ref,a.id AS assignment_ref,a.assignment_version,e.status_version,e.status
   FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
   JOIN hr_employment_assignment a ON a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
   WHERE e.root_realm_id=$1 AND e.id=$2 AND a.valid_from<=COALESCE($3::date,(now() AT TIME ZONE 'Asia/Kolkata')::date)
   AND (a.valid_to IS NULL OR a.valid_to>COALESCE($3::date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) FOR SHARE OF e,a`,[a.realmId,id(employee),forDate])).rows;
  if(e.length!==1)throw new NotFoundException("Employee not available");
  const current=await this.branches.projectBranchScope(tx,a);
  if(!current.branches.some(b=>b.value===e[0].branch_ref))throw new NotFoundException("Employee not available");
  await this.branches.projectBranch(tx,a,e[0].branch_ref);
  return e[0];
 }
 async options(token:string,branchInput:unknown,qInput:unknown){
  const branch=branchInput?id(branchInput):null,q=typeof qInput==="string"?qInput.trim().toLowerCase().slice(0,80):"";
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   if(branch&&!scope.branches.some(b=>b.value===branch))throw new ForbiddenException("Branch unavailable");
   const rows=(await tx.query(`SELECT e.id AS ref,e.employee_code AS reference,app.legal_name AS name,h.designation,h.branch_ref AS "branchRef",e.status
    FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
    JOIN hr_employment_assignment h ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id
    WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION') AND h.branch_ref=ANY($2::uuid[])
    AND ($3::uuid IS NULL OR h.branch_ref=$3) AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date
    AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date)
    AND ($4='' OR strpos(lower(app.legal_name),$4)>0 OR strpos(lower(e.employee_code),$4)>0)
    ORDER BY app.legal_name,e.id LIMIT 101`,[a.realmId,scope.branches.map(b=>b.value),branch,q])).rows;
   return {branches:scope.branches.map(({value,label})=>({value,label})),items:rows.slice(0,100),hasMore:rows.length>100};
  });
 }
 async policies(token:string,branchInput:unknown){
  const branch=id(branchInput);
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   await this.branches.projectBranch(tx,a,branch);
   const rows=(await tx.query<Policy>("SELECT id,branch_ref,label,effective_from::text,effective_to::text,status,revision,request_digest FROM payroll_policy WHERE root_realm_id=$1 AND branch_ref=$2 ORDER BY effective_from DESC,id DESC LIMIT 100",[a.realmId,branch])).rows;
   const components=(await tx.query("SELECT policy_id,code,label,kind,calc_mode,amount_minor::text,rate_bp,tax_class FROM payroll_component WHERE root_realm_id=$1 AND policy_id=ANY($2::uuid[]) ORDER BY code",[a.realmId,rows.map(r=>r.id)])).rows;
   return {items:rows.map(p=>({...this.policyView(p),components:components.filter(c=>c.policy_id===p.id).map(({policy_id,...c})=>c)})),statutoryStatus:"NOT_CONFIGURED"};
  });
 }
 async createPolicy(token:string,raw:unknown){
  const v=parsePolicy(raw),digest=hash(v);
  return this.run(token,"payroll.policy.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"payroll.compensation.view");await this.branches.projectBranch(tx,a,v.branch);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-POLICY:"+a.realmId+":"+a.accountId+":"+v.key]);
   const previous=(await tx.query<Policy>("SELECT *,effective_from::text,effective_to::text FROM payroll_policy WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(previous){if(previous.request_digest!==digest||previous.branch_ref!==v.branch)throw conflict();return {...this.policyView(previous),replayed:true};}
   const p=(await tx.query<Policy>("INSERT INTO payroll_policy(root_realm_id,branch_ref,cycle,label,effective_from,effective_to,created_by,request_key,request_digest) VALUES($1,$2,'MONTHLY',$3,$4,$5,$6,$7,$8) RETURNING *,effective_from::text,effective_to::text",[a.realmId,v.branch,v.label,v.from,v.to,a.accountId,v.key,digest])).rows[0];
   for(const c of v.components)await tx.query("INSERT INTO payroll_component(root_realm_id,policy_id,code,label,kind,calc_mode,amount_minor,rate_bp,percent_basis,tax_class) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[a.realmId,p.id,c.code,c.label,c.kind,c.mode,c.minor,c.bp,c.mode==="PERCENT"?"BASIC":null,c.taxClass]);
   await this.audit(tx,a,"POLICY",p.id,"DRAFT_CREATED");return {...this.policyView(p),replayed:false};
  });
 }
 async history(token:string,employee:string){
  return this.run(token,"payroll.compensation.view",async(tx,a)=>{
   const e=await this.employee(tx,a,employee);
   const scope=await this.branches.projectBranchScope(tx,a);
   const rows=(await tx.query<Salary>("SELECT *,effective_from::text,effective_to::text,base_salary_minor::text FROM employee_compensation WHERE root_realm_id=$1 AND employee_ref=$2 AND branch_ref=ANY($3::uuid[]) ORDER BY effective_from DESC,id DESC LIMIT 100",[a.realmId,e.id,scope.branches.map(b=>b.value)])).rows;
   await this.audit(tx,a,"COMPENSATION",e.id,"READ");return {employee:{ref:e.id,reference:e.employee_code,name:e.name,designation:e.designation,status:e.status,branchRef:e.branch_ref},items:rows.map(r=>this.salaryView(r))};
  });
 }
 async createSalary(token:string,employee:string,raw:unknown){
  const v=parseSalary(raw),digest=hash([id(employee),v]);
  return this.run(token,"payroll.compensation.edit",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"payroll.compensation.view");const current=await this.employee(tx,a,employee),e=await this.employee(tx,a,employee,v.from);
   if(!["ACTIVE","PROBATION"].includes(e.status)||current.branch_ref!==e.branch_ref)throw conflict();
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-SALARY:"+a.realmId+":"+a.accountId+":"+v.key]);
   const previous=(await tx.query<Salary>("SELECT *,effective_from::text,effective_to::text,base_salary_minor::text FROM employee_compensation WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(previous){if(previous.request_digest!==digest||previous.branch_ref!==e.branch_ref)throw conflict();return {...this.salaryView(previous),replayed:true};}
   const p=(await tx.query<Policy>("SELECT * FROM payroll_policy WHERE root_realm_id=$1 AND id=$2 AND branch_ref=$3 AND revision=$4 AND status='APPROVED' AND effective_from<=$5::date AND (effective_to IS NULL OR ($6::date IS NOT NULL AND effective_to>=$6::date)) FOR SHARE",[a.realmId,v.policy,e.branch_ref,v.policyRevision,v.from,v.to])).rows[0];
   if(!p)throw new ConflictException("Choose an approved effective payroll policy");
   const components=(await tx.query<{kind:string;mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null}>("SELECT kind,calc_mode AS mode,amount_minor::text AS minor,rate_bp AS bp FROM payroll_component WHERE root_realm_id=$1 AND policy_id=$2",[a.realmId,p.id])).rows;
   let gross=BigInt(v.baseMinor),deduct=0n;for(const c of components){const amount=componentMinor(v.baseMinor,c);if(c.kind==="ALLOWANCE")gross+=amount;if(c.kind==="DEDUCTION")deduct+=amount;}
   if(gross<deduct||gross>99999999999999n)throw new ConflictException("Deductions or allowances exceed valid salary limits");
   const row=(await tx.query<Salary>(`INSERT INTO employee_compensation(root_realm_id,employee_ref,branch_ref,assignment_ref,assignment_version,employee_status_version,policy_id,policy_revision,effective_from,effective_to,base_salary_minor,created_by,request_key,request_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *,effective_from::text,effective_to::text,base_salary_minor::text`,[a.realmId,e.id,e.branch_ref,e.assignment_ref,e.assignment_version,e.status_version,p.id,v.policyRevision,v.from,v.to,v.baseMinor,a.accountId,v.key,digest])).rows[0];
   await this.audit(tx,a,"COMPENSATION",row.id,"DRAFT_CREATED");return {...this.salaryView(row),replayed:false};
  });
 }
}
