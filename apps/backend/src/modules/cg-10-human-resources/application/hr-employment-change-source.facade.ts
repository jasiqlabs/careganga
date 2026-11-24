import {payrollExitDues} from "../../cg-11-payroll-compensation/application/payroll-exit-dues-source";
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {HrEmploymentAccessOwnerService} from "../../cg-01-identity-access/application/hr-employment-access-owner.service";
import {leaveDate,leaveId} from "./hr-leave-source.facade";
const EMP=/^CG-HR-EMP-[0-9]{6,}$/;
const REF=/^CG-HR-CHG-[0-9]{6,}$/;
const KINDS=["TRANSFER","PROMOTION","DEPUTATION","RESIGNATION","EXIT"] as const;
type Kind=typeof KINDS[number];
export const exitKind=(kind:string)=>kind==="RESIGNATION"||kind==="EXIT";
export const changeCaseKind=(kind:string)=>exitKind(kind)?"HR_EXIT_REVIEW":"HR_TRANSFER_PROMOTION";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function input(body:unknown,keys:string[]){
 if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 return body as Record<string,unknown>;
}
function safeText(v:unknown,max:number,minimum=2){
 if(typeof v!=="string"||v.trim().length<minimum||v.length>max||/[\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 return v.trim();
}
function optionalId(v:unknown){return v===undefined||v===null||v===""?null:leaveId(v);}
function salary(v:unknown){
 if(v===undefined||v===null||v==="")return null;
 if(!Number.isSafeInteger(v)||Number(v)<=0)throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 return Number(v);
}
export function parseEmploymentChangeDraft(body:unknown,edit=false){
 const x=input(body,["requestKey","employeeReference","kind","effectiveDate","lastWorkingDate","branchRef","departmentRef","managerRef","designation","roleRef","proposedSalaryMinor","reason",...(edit?["expectedRevision"]:[])]);
 if(typeof x.kind!=="string"||!KINDS.some(k=>k===x.kind))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 const kind=x.kind as Kind,exiting=exitKind(kind);
 const employeeReference=x.employeeReference===undefined||x.employeeReference===""?null:x.employeeReference;
 if(employeeReference!==null&&(typeof employeeReference!=="string"||!EMP.test(employeeReference)))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 if(employeeReference===null&&kind!=="RESIGNATION")throw new ForbiddenException("Employees may initiate only their own resignation request");
 const effectiveDate=leaveDate(x.effectiveDate),lastWorkingDate=exiting?leaveDate(x.lastWorkingDate):null;
 const branchRef=optionalId(x.branchRef),departmentRef=optionalId(x.departmentRef),managerRef=optionalId(x.managerRef),roleRef=optionalId(x.roleRef);
 const proposedSalaryMinor=salary(x.proposedSalaryMinor);
 if(exiting?(branchRef!==null||departmentRef!==null||managerRef!==null||roleRef!==null||proposedSalaryMinor!==null||
  (x.designation!==undefined&&x.designation!==null&&x.designation!=="")||lastWorkingDate===null||lastWorkingDate>=effectiveDate):
  (branchRef===null||(x.lastWorkingDate!==undefined&&x.lastWorkingDate!==null&&x.lastWorkingDate!=="")))
  throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 if(edit&&(!Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1))throw new BadRequestException({code:"CG10_CHANGE_STALE"});
 return {requestKey:leaveId(x.requestKey),employeeReference:employeeReference as string|null,kind,effectiveDate,lastWorkingDate,
  branchRef,departmentRef,managerRef,roleRef,designation:exiting?null:safeText(x.designation,120),proposedSalaryMinor,
  reason:safeText(x.reason,1000),...(edit?{expectedRevision:Number(x.expectedRevision)}:{})};
}
export function parseEmploymentChangeAction(body:unknown){
 const x=input(body,["requestKey","expectedRevision"]);
 if(!Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1)throw new BadRequestException({code:"CG10_CHANGE_STALE"});
 return {requestKey:leaveId(x.requestKey),expectedRevision:Number(x.expectedRevision)};
}
export function parseExitClearance(body:unknown){
 const x=input(body,["requestKey","kind","evidenceNote"]);
 if(typeof x.kind!=="string"||!["HR","ASSETS","HANDOVER"].includes(x.kind))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 return {requestKey:leaveId(x.requestKey),kind:x.kind,evidenceNote:safeText(x.evidenceNote,1000)};
}
type Plan=ReturnType<typeof parseEmploymentChangeDraft>;
type Target={id:string;employee_code:string;employee_name:string;account_ref:string|null;status:string;status_version:number;
 assignment_id:string;assignment_version:number;branch_ref:string;branch_name:string;department_ref:string|null;department_name:string|null;
 manager_employee_ref:string|null;manager_name:string|null;designation:string;employment_type:string;origin_application_ref:string;valid_from:string;today:string};
export type ChangeRow={id:string;reference:string;employee_id:string;employee_code:string;employee_name:string;employee_account_ref:string|null;
 kind:Kind;prior_assignment_id:string;prior_assignment_version:number;prior_employee_version:number;prior_branch_ref:string;
 prior_branch_name:string;prior_designation:string;prior_department_ref:string|null;prior_department_name:string|null;
 prior_manager_ref:string|null;prior_manager_name:string|null;prior_employment_type:string;
 proposed_branch_ref:string|null;proposed_branch_name:string|null;proposed_department_ref:string|null;proposed_department_name:string|null;
 proposed_manager_ref:string|null;proposed_manager_name:string|null;proposed_designation:string|null;proposed_role_ref:string|null;proposed_role_name:string|null;
 effective_date:string;last_working_date:string|null;target_account_ref:string|null;expected_access_version:string|null;expected_role_revision:number|null;
 private_ciphertext:string;private_nonce:string;private_tag:string;created_by:string;request_key:string;request_digest:string;
 source_digest:string;revision:number;last_command_key:string;last_command_digest:string;status:string;case_ref:string|null;
 decision_ref:string|null;cancel_event_ref:string|null;effect_attempt_count:number;case_number:string|null;case_status:string|null};
export type ChangeSubmission={requestRef:string;sourceDigest:string;requestKey:string;revision:number;kind:Kind;employeeName:string};
const currentSql=`SELECT e.id,e.employee_code,app.legal_name AS employee_name,e.account_ref,e.status,e.status_version,
 a.id AS assignment_id,a.assignment_version,a.branch_ref,b.name AS branch_name,a.department_ref,dp.name AS department_name,
 a.manager_employee_ref,mp.legal_name AS manager_name,a.designation,a.employment_type,a.origin_application_ref,
 to_char(a.valid_from,'YYYY-MM-DD') AS valid_from,to_char(CURRENT_DATE,'YYYY-MM-DD') AS today
 FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
 JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
 JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
 LEFT JOIN department dp ON dp.id=a.department_ref AND dp.root_realm_id=e.root_realm_id
 LEFT JOIN hr_employee manager ON manager.id=a.manager_employee_ref AND manager.root_realm_id=e.root_realm_id
 LEFT JOIN hr_employee_application mp ON mp.id=manager.application_id AND mp.root_realm_id=e.root_realm_id
 WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL`;
const actorScope=(branchParam:number)=>`(b.manager_account_ref=$2 OR b.id=ANY($${branchParam}::uuid[]) OR EXISTS(SELECT 1 FROM hr_employee supervisor
 JOIN hr_employment_assignment sa ON sa.employee_id=supervisor.id AND sa.root_realm_id=supervisor.root_realm_id
 WHERE supervisor.id=a.manager_employee_ref AND supervisor.root_realm_id=e.root_realm_id AND supervisor.account_ref=$2
 AND supervisor.status IN('ACTIVE','PROBATION') AND sa.branch_ref=a.branch_ref AND sa.valid_from<=CURRENT_DATE AND sa.valid_to IS NULL)
 OR EXISTS(SELECT 1 FROM account_role ar JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active
 LEFT JOIN role_grant g ON g.role_id=rr.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.realm_id=e.root_realm_id AND ar.account_id=$2 AND ar.revoked_at IS NULL AND (rr.is_protected OR g.capability_key IS NOT NULL)))`;
const originalSql=`SELECT h.*,to_char(h.effective_date,'YYYY-MM-DD') AS effective_date,
 to_char(h.last_working_date,'YYYY-MM-DD') AS last_working_date,h.expected_access_version::text AS expected_access_version,
 e.employee_code,e.account_ref AS employee_account_ref,app.legal_name AS employee_name,
 pa.branch_ref AS prior_branch_ref,pb.name AS prior_branch_name,pa.designation AS prior_designation,
 pa.department_ref AS prior_department_ref,pd.name AS prior_department_name,pa.manager_employee_ref AS prior_manager_ref,
 pmapp.legal_name AS prior_manager_name,pa.employment_type AS prior_employment_type,
 nb.name AS proposed_branch_name,nd.name AS proposed_department_name,nmapp.legal_name AS proposed_manager_name,
 nr.name AS proposed_role_name,c.case_number,c.status AS case_status
 FROM hr_employment_change h JOIN hr_employee e ON e.id=h.employee_id AND e.root_realm_id=h.root_realm_id
 JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
 JOIN hr_employment_assignment pa ON pa.id=h.prior_assignment_id AND pa.root_realm_id=h.root_realm_id AND pa.employee_id=h.employee_id
 JOIN branch pb ON pb.id=pa.branch_ref AND pb.root_realm_id=h.root_realm_id
 LEFT JOIN department pd ON pd.id=pa.department_ref AND pd.root_realm_id=h.root_realm_id
 LEFT JOIN hr_employee pm ON pm.id=pa.manager_employee_ref AND pm.root_realm_id=h.root_realm_id
 LEFT JOIN hr_employee_application pmapp ON pmapp.id=pm.application_id AND pmapp.root_realm_id=h.root_realm_id
 LEFT JOIN branch nb ON nb.id=h.proposed_branch_ref AND nb.root_realm_id=h.root_realm_id
 LEFT JOIN department nd ON nd.id=h.proposed_department_ref AND nd.root_realm_id=h.root_realm_id
 LEFT JOIN hr_employee nm ON nm.id=h.proposed_manager_ref AND nm.root_realm_id=h.root_realm_id
 LEFT JOIN hr_employee_application nmapp ON nmapp.id=nm.application_id AND nmapp.root_realm_id=h.root_realm_id
 LEFT JOIN role nr ON nr.id=h.proposed_role_ref AND nr.realm_id=h.root_realm_id
 LEFT JOIN cg03_case c ON c.id=h.case_ref AND c.realm_id=h.root_realm_id AND c.hr_employment_change_id=h.id AND c.hr_employment_change_digest=h.source_digest`;
function encryptionKey(){
 const key=Buffer.from(process.env.CG10_PII_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Private employment change information is unavailable");
 return key;
}
function seal(realm:string,ref:string,value:unknown){
 const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),nonce);
 cipher.setAAD(Buffer.from(realm+"|employment-change|"+ref));
 const out=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
 return {ciphertext:out.toString("base64url"),nonce:nonce.toString("base64url"),tag:cipher.getAuthTag().toString("base64url")};
}
function unseal(realm:string,row:ChangeRow){
 try{const cipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(row.private_nonce,"base64url"));
  cipher.setAAD(Buffer.from(realm+"|employment-change|"+row.id));
  cipher.setAuthTag(Buffer.from(row.private_tag,"base64url"));
  const v=JSON.parse(Buffer.concat([cipher.update(Buffer.from(row.private_ciphertext,"base64url")),cipher.final()]).toString("utf8"));
  return {reason:safeText(v.reason,1000),proposedSalaryMinor:salary(v.proposedSalaryMinor)};
 }catch{throw new ServiceUnavailableException("Private employment change information is unavailable");}
}
@Injectable()
export class HrEmploymentChangeSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,
  private readonly access:HrEmploymentAccessOwnerService,
  private readonly branches:BranchSourceFacade){}
 async target(tx:PoolClient,actor:VerifiedFoundationActor,reference:string|null,write=false){
  if(reference!==null){
   if(!EMP.test(reference))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
   await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  }else await this.identity.assertPatientSessionCurrent(tx,actor);
  const lock=write?" FOR UPDATE OF e,a FOR SHARE OF b":" FOR SHARE OF e,a,b";
  const scope=reference?await this.branches.projectBranchScope(tx,actor):null;
  const q=await tx.query<Target>(currentSql+" AND (($3::text IS NULL AND e.account_ref=$2) OR ($3::text IS NOT NULL AND e.employee_code=$3 AND "+actorScope(4)+"))"+lock,
   [actor.realmId,actor.accountId,reference,scope?.branches.map(x=>x.value)??[]]);
  if(q.rows.length!==1)throw new ForbiddenException("The employee is not available for your current HR scope");
  return q.rows[0];
 }
 private async lockedTarget(tx:PoolClient,realm:string,id:string){
  const q=await tx.query<Target>(currentSql+" AND e.id=$2 FOR UPDATE OF e,a FOR SHARE OF b",[realm,id]);
  if(q.rows.length!==1)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  return q.rows[0];
 }
 private async currentProposer(tx:PoolClient,realm:string,row:ChangeRow,target:Target){
  if(row.kind==="RESIGNATION"&&row.created_by===target.account_ref)return;
  const assigned=await this.branches.currentStaffBranchRefs(tx,realm,row.created_by);
  const q=await tx.query(currentSql+" AND e.id=$3 AND "+actorScope(4)+
   " AND EXISTS(SELECT 1 FROM account ac JOIN account_role ar ON ar.account_id=ac.id AND ar.realm_id=ac.realm_id AND ar.revoked_at IS NULL"+
   " JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active WHERE ac.realm_id=$1 AND ac.id=$2 AND ac.status='ACTIVE'"+
   " AND (rr.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=rr.id AND g.capability_key='hr.changes.manage'))) FOR SHARE OF e,a,b",
   [realm,row.created_by,row.employee_id,assigned]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
 }
 private async validatePlan(tx:PoolClient,realm:string,target:Target,x:Pick<Plan,"kind"|"effectiveDate"|"lastWorkingDate"|"branchRef"|"departmentRef"|"managerRef"|"roleRef">,due=false){
  const exit=exitKind(x.kind);
  if(x.effectiveDate<=target.valid_from||(!due&&x.effectiveDate<target.today)||(x.lastWorkingDate&&x.lastWorkingDate<target.valid_from))
   throw new ConflictException({code:"CG10_CHANGE_DATE"});
  if(target.account_ref&&(exit||x.branchRef!==target.branch_ref)){
   const branchOffice=await tx.query("SELECT 1 FROM branch WHERE root_realm_id=$1 AND manager_account_ref=$2 AND status='ACTIVE' LIMIT 1 FOR SHARE",
    [realm,target.account_ref]);
   if(branchOffice.rowCount)throw new ConflictException({code:"CG10_CHANGE_BRANCH_MANAGER"});
  }
  if(!exit){
   if(!(await tx.query("SELECT id FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[realm,x.branchRef])).rowCount)
    throw new ConflictException({code:"CG10_CHANGE_DESTINATION"});
   if(x.departmentRef){
    const dept=await tx.query(`SELECT id FROM department d WHERE d.root_realm_id=$1 AND d.id=$2 AND d.active
     AND (d.branch_id=$3 OR (d.branch_id IS NULL AND EXISTS(SELECT 1 FROM branch_department_link l
      WHERE l.root_realm_id=d.root_realm_id AND l.foundation_department_id=d.id AND l.branch_id=$3 AND l.ended_at IS NULL))) FOR SHARE OF d`,
     [realm,x.departmentRef,x.branchRef]);
    if(!dept.rowCount)throw new ConflictException({code:"CG10_CHANGE_DESTINATION"});
   }
   if(x.managerRef){
    if(x.managerRef===target.id)throw new BadRequestException({code:"CG10_CHANGE_MANAGER"});
    const manager=await tx.query(`SELECT e.id FROM hr_employee e JOIN hr_employment_assignment a
     ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id WHERE e.root_realm_id=$1 AND e.id=$2
     AND e.status IN('ACTIVE','PROBATION') AND a.branch_ref=$3 AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL FOR SHARE OF e,a`,
     [realm,x.managerRef,x.branchRef]);
    if(!manager.rowCount)throw new BadRequestException({code:"CG10_CHANGE_MANAGER"});
    const cycle=await tx.query(`WITH RECURSIVE chain(id,next,path,depth,cycle) AS (
     SELECT a.employee_id,a.manager_employee_ref,ARRAY[a.employee_id],1,false
      FROM hr_employment_assignment a WHERE a.root_realm_id=$1 AND a.employee_id=$2 AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL
     UNION ALL SELECT a.employee_id,a.manager_employee_ref,c.path||a.employee_id,c.depth+1,a.employee_id=ANY(c.path)
      FROM chain c JOIN hr_employment_assignment a ON a.employee_id=c.next AND a.root_realm_id=$1
       AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL WHERE c.depth<100 AND NOT c.cycle
     ) SELECT 1 FROM chain WHERE id=$3 OR cycle OR (depth=100 AND next IS NOT NULL) LIMIT 1`,
     [realm,x.managerRef,target.id]);
    if(cycle.rowCount)throw new BadRequestException({code:"CG10_CHANGE_MANAGER"});
   }
  }
  return this.access.snapshot(tx,realm,target.account_ref,x.roleRef,exit);
 }
 private async audit(tx:PoolClient,realm:string,actor:string,employee:string,action:string){
  await tx.query("INSERT INTO hr_audit(root_realm_id,actor_ref,employee_ref,event_key,action) VALUES($1,$2,$3,$4,$5)",
   [realm,actor,employee,randomUUID(),action]);
 }
 /** Payroll reads only an original applied, approved HR salary proposal; no HR mutation. */
 async payrollProposal(tx:PoolClient,actor:VerifiedFoundationActor,employee:string,ref:string,branch:string,assignment:string){
  await this.identity.assertCurrent(tx,actor,"payroll.compensation.view");
  await this.branches.projectBranch(tx,actor,branch);
  const exact=(await tx.query("SELECT h.id FROM hr_employment_change h JOIN cg03_case c ON c.realm_id=h.root_realm_id AND c.id=h.case_ref AND c.hr_employment_change_id=h.id AND c.hr_employment_change_digest=h.source_digest AND c.proposal_revision=h.revision AND c.case_kind='HR_TRANSFER_PROMOTION' AND c.status='OWNER_COMPLETED' JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=h.decision_ref AND d.action='APPROVE' WHERE h.root_realm_id=$1 AND h.id=$2 AND h.employee_id=$3 AND h.proposed_branch_ref=$4 AND h.new_assignment_ref=$5 AND h.kind IN('TRANSFER','PROMOTION','DEPUTATION') AND h.status='APPLIED' FOR SHARE OF h,c,d",[actor.realmId,ref,employee,branch,assignment])).rows[0];
  if(!exact)throw new ConflictException("Original approved HR proposal unavailable for this assignment");
  const row=await this.original(tx,actor.realmId,ref);
  const value=unseal(actor.realmId,row);
  if(value.proposedSalaryMinor===null)throw new ConflictException("Original HR change has no salary proposal");
  await this.audit(tx,actor.realmId,actor.accountId,row.employee_id,"EMPLOYMENT_CHANGE_PRIVATE_READ");
  return {ref:row.id,reference:row.reference,kind:row.kind,effectiveFrom:row.effective_date,baseMinor:value.proposedSalaryMinor,revision:row.revision,digest:row.source_digest};
 }
 async payrollProposals(tx:PoolClient,actor:VerifiedFoundationActor,employee:string,branch:string,assignment:string){
  await this.identity.assertCurrent(tx,actor,"payroll.compensation.view");await this.branches.projectBranch(tx,actor,branch);
  const rows=(await tx.query<{id:string}>("SELECT id FROM hr_employment_change WHERE root_realm_id=$1 AND employee_id=$2 AND proposed_branch_ref=$3 AND new_assignment_ref=$4 AND status='APPLIED' AND kind IN('TRANSFER','PROMOTION','DEPUTATION') ORDER BY effective_date DESC,id DESC LIMIT 10",[actor.realmId,employee,branch,assignment])).rows;
  const items=[];for(const row of rows){try{items.push(await this.payrollProposal(tx,actor,employee,row.id,branch,assignment));}catch(e){if(!(e instanceof ConflictException))throw e;}}return items;
 }
 async original(tx:PoolClient,realm:string,id:string,lock=false){
  const q=await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND h.id=$2"+(lock?" FOR UPDATE OF h":""),[realm,id]);
  if(!q.rows[0])throw new NotFoundException("The original employment request is unavailable");
  return q.rows[0];
 }
 private async byRef(tx:PoolClient,realm:string,ref:string,creator:string,lock=false){
  if(!REF.test(ref))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  const q=await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND h.reference=$2 AND h.created_by=$3"+(lock?" FOR UPDATE OF h":""),[realm,ref,creator]);
  if(!q.rows[0])throw new NotFoundException("The original employment request is unavailable");
  return q.rows[0];
 }
 summary(row:ChangeRow){
  return {reference:row.reference,employeeName:row.employee_name,kind:row.kind,effectiveDate:row.effective_date,lastWorkingDate:row.last_working_date,
   status:row.status,revision:row.revision,caseReference:row.case_number,caseStatus:row.case_status,
   current:{branch:row.prior_branch_name,department:row.prior_department_name,designation:row.prior_designation,manager:row.prior_manager_name},
   proposed:exitKind(row.kind)?null:{branch:row.proposed_branch_name,department:row.proposed_department_name,designation:row.proposed_designation,manager:row.proposed_manager_name,role:row.proposed_role_name},
   effectIssue:row.status==="APPROVED_PENDING_EFFECT"&&row.effect_attempt_count>0?"Application not confirmed; HR review or retry required":null,
   salaryStatus:"HR_PROPOSAL_NOT_APPLIED" as const};
 }
 async privateDetail(tx:PoolClient,realm:string,row:ChangeRow,actor:string){
  const v=unseal(realm,row);
  await this.audit(tx,realm,actor,row.employee_id,"EMPLOYMENT_CHANGE_PRIVATE_READ");
  return {...this.summary(row),reason:v.reason,proposedSalaryMinor:v.proposedSalaryMinor};
 }
 private fields(row:ChangeRow){
  return {kind:row.kind,effectiveDate:row.effective_date,lastWorkingDate:row.last_working_date,branchRef:row.proposed_branch_ref,
   departmentRef:row.proposed_department_ref,managerRef:row.proposed_manager_ref,roleRef:row.proposed_role_ref};
 }
 private digest(target:Target,x:Plan,access:{accountRef:string|null;accessVersion:string|null;roleRef:string|null;roleRevision:number|null},
   privateValue:{ciphertext:string;nonce:string;tag:string},rev:number){
  return hash([target.id,target.assignment_id,target.assignment_version,target.status_version,x.kind,x.effectiveDate,x.lastWorkingDate,
   x.branchRef,x.departmentRef,x.managerRef,x.designation,access,privateValue,rev]);
 }
 async create(tx:PoolClient,actor:VerifiedFoundationActor,body:unknown){
  const x=parseEmploymentChangeDraft(body),target=await this.target(tx,actor,x.employeeReference,true);
  const d=hash(["CREATE",x]);
  const old=(await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND h.created_by=$2 AND h.request_key=$3 FOR SHARE OF h",[actor.realmId,actor.accountId,x.requestKey])).rows[0];
  if(old){
   if(old.request_digest!==d||old.employee_id!==target.id)throw new ConflictException({code:"CG10_CHANGE_STALE"});
   return {...this.summary(old),replayed:true};
  }
  if(x.roleRef)await this.identity.assertCurrent(tx,actor,"roles.select");
  if(x.branchRef!==null)await this.branches.projectBranch(tx,actor,x.branchRef);
  const access=await this.validatePlan(tx,actor.realmId,target,x),id=randomUUID();
  const secret=seal(actor.realmId,id,{reason:x.reason,proposedSalaryMinor:x.proposedSalaryMinor});
  const source=this.digest(target,x,access,secret,1);
  const q=await tx.query<{id:string}>(`INSERT INTO hr_employment_change(id,root_realm_id,employee_id,kind,prior_assignment_id,prior_assignment_version,prior_employee_version,
   proposed_branch_ref,proposed_department_ref,proposed_manager_ref,proposed_designation,target_account_ref,expected_access_version,proposed_role_ref,expected_role_revision,
   effective_date,last_working_date,private_ciphertext,private_nonce,private_tag,created_by,request_key,request_digest,last_command_key,last_command_digest,source_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$22,$23,$24)
   ON CONFLICT DO NOTHING RETURNING id`,[id,actor.realmId,target.id,x.kind,target.assignment_id,target.assignment_version,target.status_version,
   x.branchRef,x.departmentRef,x.managerRef,x.designation,access.accountRef,access.accessVersion,access.roleRef,access.roleRevision,
   x.effectiveDate,x.lastWorkingDate,secret.ciphertext,secret.nonce,secret.tag,actor.accountId,x.requestKey,d,source]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,actor.realmId,actor.accountId,target.id,"EMPLOYMENT_CHANGE_DRAFT");
  return {...this.summary(await this.original(tx,actor.realmId,id)),replayed:false};
 }
 async edit(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,body:unknown){
  const x=parseEmploymentChangeDraft(body,true),target=await this.target(tx,actor,x.employeeReference,true);
  const row=await this.byRef(tx,actor.realmId,ref,actor.accountId,true),d=hash(["EDIT",ref,x]);
  if(row.employee_id!==target.id||row.kind!==x.kind)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  if(row.last_command_key===x.requestKey){
   if(row.last_command_digest!==d)throw new ConflictException({code:"CG10_CHANGE_STALE"});
   return {...this.summary(row),replayed:true};
  }
  if(row.status!=="DRAFT"||row.revision!==x.expectedRevision)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  if(x.roleRef)await this.identity.assertCurrent(tx,actor,"roles.select");
  if(x.branchRef!==null)await this.branches.projectBranch(tx,actor,x.branchRef);
  const access=await this.validatePlan(tx,actor.realmId,target,x),secret=seal(actor.realmId,row.id,{reason:x.reason,proposedSalaryMinor:x.proposedSalaryMinor});
  const source=this.digest(target,x,access,secret,row.revision+1);
  const q=await tx.query(`UPDATE hr_employment_change SET prior_assignment_id=$3,prior_assignment_version=$4,prior_employee_version=$5,
   proposed_branch_ref=$6,proposed_department_ref=$7,proposed_manager_ref=$8,proposed_designation=$9,target_account_ref=$10,
   expected_access_version=$11,proposed_role_ref=$12,expected_role_revision=$13,effective_date=$14,last_working_date=$15,
   private_ciphertext=$16,private_nonce=$17,private_tag=$18,last_command_key=$19,last_command_digest=$20,source_digest=$21,revision=revision+1,updated_at=now()
   WHERE root_realm_id=$1 AND id=$2 AND revision=$22 AND status='DRAFT' RETURNING id`,
   [actor.realmId,row.id,target.assignment_id,target.assignment_version,target.status_version,x.branchRef,x.departmentRef,x.managerRef,x.designation,
    access.accountRef,access.accessVersion,access.roleRef,access.roleRevision,x.effectiveDate,x.lastWorkingDate,secret.ciphertext,secret.nonce,secret.tag,
    x.requestKey,d,source,x.expectedRevision]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,actor.realmId,actor.accountId,target.id,"EMPLOYMENT_CHANGE_EDITED");
  return {...this.summary(await this.original(tx,actor.realmId,row.id)),replayed:false};
 }
 private async validateExact(tx:PoolClient,realm:string,row:ChangeRow,due=false){
  const target=await this.lockedTarget(tx,realm,row.employee_id);
  if(target.assignment_id!==row.prior_assignment_id||target.assignment_version!==row.prior_assignment_version||
   target.status_version!==row.prior_employee_version||target.account_ref!==row.target_account_ref)
   throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.currentProposer(tx,realm,row,target);
  if(row.proposed_branch_ref!==null){
   const assigned=await this.branches.currentStaffBranchRefs(tx,realm,row.created_by);
   if(!assigned.includes(row.proposed_branch_ref)){
    const root=await tx.query(
     "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
     "AND r.realm_id=ar.realm_id AND r.active=true "+
     "LEFT JOIN role_grant g ON g.role_id=r.id "+
     "AND g.capability_key='foundation.branches.admin' "+
     "WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL "+
     "AND (r.is_protected OR g.capability_key IS NOT NULL) LIMIT 1 FOR SHARE OF ar,r",
     [realm,row.created_by]);
    if(!root.rowCount)throw new ConflictException({code:"CG10_CHANGE_DESTINATION_ACCESS_CHANGED"});
   }
  }
  const pin=await this.validatePlan(tx,realm,target,this.fields(row),due);
  if(pin.accessVersion!==row.expected_access_version||pin.roleRevision!==row.expected_role_revision)
   throw new ConflictException({code:"CG10_CHANGE_ACCESS_CHANGED"});
  return target;
 }
 async prepareSubmit(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,body:unknown){
  const x=parseEmploymentChangeAction(body),initial=await this.byRef(tx,actor.realmId,ref,actor.accountId);
  await this.target(tx,actor,initial.kind==="RESIGNATION"&&initial.target_account_ref===actor.accountId?null:initial.employee_code,true);
  const row=await this.byRef(tx,actor.realmId,ref,actor.accountId,true),d=hash(["SUBMIT",ref,x]);
  if(row.last_command_key===x.requestKey&&row.case_ref){
   if(row.last_command_digest!==d)throw new ConflictException({code:"CG10_CHANGE_STALE"});
   return {replay:true as const,row};
  }
  if(row.status!=="DRAFT"||row.revision!==x.expectedRevision)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.validateExact(tx,actor.realmId,row);
  if((await tx.query("SELECT 1 FROM hr_employment_change WHERE root_realm_id=$1 AND employee_id=$2 AND status IN('SUBMITTED','APPROVED_PENDING_EFFECT') LIMIT 1",
    [actor.realmId,row.employee_id])).rowCount)throw new ConflictException({code:"CG10_CHANGE_INFLIGHT"});
  return {replay:false as const,row,submission:{requestRef:row.id,sourceDigest:row.source_digest,requestKey:x.requestKey,revision:row.revision,kind:row.kind,employeeName:row.employee_name},commandDigest:d};
 }
 async link(tx:PoolClient,actor:VerifiedFoundationActor,row:ChangeRow,submission:ChangeSubmission,caseRef:string,commandDigest:string){
  const q=await tx.query(`UPDATE hr_employment_change SET status='SUBMITTED',case_ref=$3,last_command_key=$4,last_command_digest=$5,updated_at=now()
   WHERE root_realm_id=$1 AND id=$2 AND revision=$6 AND status='DRAFT' RETURNING id`,
   [actor.realmId,row.id,caseRef,submission.requestKey,commandDigest,submission.revision]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,actor.realmId,actor.accountId,row.employee_id,"EMPLOYMENT_CHANGE_SUBMITTED");
 }
 async validateApproval(tx:PoolClient,realm:string,row:ChangeRow){
  if(row.status!=="SUBMITTED")throw new ConflictException({code:"CG10_CHANGE_STALE"});
  const target=await this.validateExact(tx,realm,row);
  const incompatible=await tx.query("SELECT 1 FROM hr_attendance_day WHERE root_realm_id=$1 AND employee_id=$2 AND assignment_id=$3 AND local_date >= $4::date LIMIT 1",[realm,row.employee_id,row.prior_assignment_id,row.effective_date]);
  if(incompatible.rowCount)throw new ConflictException({code:"CG10_CHANGE_ATTENDANCE_CONFLICT"});
  return target;
 }
 async applyDecision(tx:PoolClient,realm:string,row:ChangeRow,decisionRef:string,actor:string,action:"APPROVE"|"RETURN"|"REJECT"){
  const status=action==="APPROVE"?"APPROVED_PENDING_EFFECT":action==="RETURN"?"RETURNED":"REJECTED";
  const q=await tx.query("UPDATE hr_employment_change SET status=$3,decision_ref=$4,decided_at=now(),updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id",
   [realm,row.id,status,decisionRef]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,realm,actor,row.employee_id,action==="APPROVE"?"EMPLOYMENT_CHANGE_APPROVED":action==="RETURN"?"EMPLOYMENT_CHANGE_RETURNED":"EMPLOYMENT_CHANGE_REJECTED");
 }
 async withdraw(tx:PoolClient,actor:VerifiedFoundationActor,row:ChangeRow,eventRef:string,requestKey:string,commandDigest:string){
  await this.target(tx,actor,row.kind==="RESIGNATION"&&row.target_account_ref===actor.accountId?null:row.employee_code,true);
  if(row.created_by!==actor.accountId)throw new ForbiddenException("Only the original requester may withdraw");
  const q=await tx.query(`UPDATE hr_employment_change SET status='WITHDRAWN',cancel_event_ref=$3,decided_at=now(),updated_at=now(),
   last_command_key=$4,last_command_digest=$5 WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id`,
   [actor.realmId,row.id,eventRef,requestKey,commandDigest]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,actor.realmId,actor.accountId,row.employee_id,"EMPLOYMENT_CHANGE_WITHDRAWN");
 }
 /** Only current permitted HR may record genuine nonfinancial clearance. */
 async recordClearance(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,body:unknown){
  const x=parseExitClearance(body);await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  if(!REF.test(ref))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  const read=(await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND h.reference=$2",[actor.realmId,ref])).rows[0];
  if(!read)throw new NotFoundException("The original exit request is unavailable");
  const target=await this.target(tx,actor,read.employee_code,true);
  const row=await this.original(tx,actor.realmId,read.id,true);
  if(!exitKind(row.kind)||row.employee_id!==target.id||row.status!=="APPROVED_PENDING_EFFECT"||target.account_ref===actor.accountId)
   throw new ConflictException({code:"CG10_CLEARANCE_UNAVAILABLE"});
  const digest=hash([row.id,x.kind,x.evidenceNote]);
  const previous=(await tx.query<{request_digest:string;verified_by:string;request_key:string;clearance_kind:string}>(`SELECT request_digest,verified_by,request_key,clearance_kind
   FROM hr_exit_clearance WHERE root_realm_id=$1 AND change_id=$2 AND clearance_kind=$3 FOR SHARE`,[actor.realmId,row.id,x.kind])).rows[0];
  if(previous){
   if(previous.verified_by===actor.accountId&&previous.request_digest===digest&&previous.request_key===x.requestKey)
    return {recorded:true,kind:x.kind,replayed:true};
   throw new ConflictException({code:"CG10_CLEARANCE_UNAVAILABLE"});
  }
  const encrypted=seal(actor.realmId,row.id+"|clearance|"+x.kind,{evidenceNote:x.evidenceNote});
  const q=await tx.query(`INSERT INTO hr_exit_clearance(root_realm_id,change_id,clearance_kind,verified_by,request_key,request_digest,
   evidence_note_ciphertext,evidence_note_nonce,evidence_note_tag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING change_id`,
   [actor.realmId,row.id,x.kind,actor.accountId,x.requestKey,digest,encrypted.ciphertext,encrypted.nonce,encrypted.tag]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CLEARANCE_UNAVAILABLE"});
  await this.audit(tx,actor.realmId,actor.accountId,row.employee_id,"EXIT_CLEARANCE_RECORDED");
  return {recorded:true,kind:x.kind,replayed:false};
 }
 async changeTimeline(tx:PoolClient,realm:string,row:ChangeRow){
  const q=await tx.query<{action:string;step_ordinal:number;occurred_at:Date}>(`
    SELECT ev.action,ev.step_ordinal,ev.occurred_at FROM cg03_case_event ev
    JOIN cg03_case c ON c.id=ev.case_id AND c.realm_id=ev.realm_id
    WHERE c.realm_id=$1 AND c.case_number=$2 ORDER BY ev.occurred_at DESC,ev.id DESC LIMIT 50`,[realm,row.case_number]);
  return q.rows.map(e=>({action:e.action,step:e.step_ordinal,occurredAt:e.occurred_at}));
 }
 async clearanceSummary(tx:PoolClient,realm:string,row:ChangeRow,includeSalary=false){
  if(!exitKind(row.kind))return null;
  const q=await tx.query<{clearance_kind:string;verified_at:Date}>(`SELECT clearance_kind,verified_at FROM hr_exit_clearance
   WHERE root_realm_id=$1 AND change_id=$2 ORDER BY clearance_kind`,[realm,row.id]);
  return {items:["HR","ASSETS","HANDOVER"].map(kind=>{const actual=q.rows.find(x=>x.clearance_kind===kind);return {kind,status:actual?"CONFIRMED":"PENDING",verifiedAt:actual?.verified_at??null};}),
   financeStatus:"NOT_VERIFIED",salaryAndDuesStatus:includeSalary&&["APPROVED_PENDING_EFFECT","APPLIED"].includes(row.status)?await payrollExitDues(tx,realm,row.employee_id,row.last_working_date):"NOT_AVAILABLE"};
 }
 /** Due-only worker and protected manual apply use the same original CG03 transaction.
  * HR changes and CG01 account/session effects either all commit or all roll back. */
 async applyDue(tx:PoolClient,realm:string,row:ChangeRow,reviewer:string){
  if(row.status==="APPLIED")return {applied:true,replayed:true};
  if(row.status!=="APPROVED_PENDING_EFFECT")throw new ConflictException({code:"CG10_CHANGE_STALE"});
  const target=await this.validateExact(tx,realm,row,true);
  if(row.effective_date>target.today)throw new ConflictException({code:"CG10_CHANGE_NOT_DUE"});
  if(exitKind(row.kind)){
   const clear=await this.clearanceSummary(tx,realm,row);
   if(!clear||clear.items.some(x=>x.status!=="CONFIRMED"))
    throw new ConflictException({code:"CG10_CLEARANCE_UNAVAILABLE"});
  }
  // Never rewrite an already verified/approved attendance day into another branch.
  // A new effective date must be reviewed if recorded future attendance conflicts.
  const incompatible=await tx.query(`SELECT 1 FROM hr_attendance_day d WHERE d.root_realm_id=$1 AND d.employee_id=$2
   AND d.assignment_id=$3 AND d.local_date >= $4::date LIMIT 1 FOR SHARE`,[realm,row.employee_id,row.prior_assignment_id,row.effective_date]);
  if(incompatible.rowCount)throw new ConflictException({code:"CG10_CHANGE_ATTENDANCE_CONFLICT"});
  await this.access.apply(tx,realm,row.id);
  const prior=await tx.query(`UPDATE hr_employment_assignment SET valid_to=$4,assignment_version=assignment_version+1
   WHERE root_realm_id=$1 AND id=$2 AND employee_id=$3 AND valid_to IS NULL AND assignment_version=$5 RETURNING id`,
   [realm,target.assignment_id,target.id,row.effective_date,row.prior_assignment_version]);
  if(!prior.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  let nextAssignment:string|null=null;
  const exit=exitKind(row.kind);
  if(!exit){
   const newRow=await tx.query<{id:string}>(`INSERT INTO hr_employment_assignment(root_realm_id,employee_id,branch_ref,department_ref,
    manager_employee_ref,designation,employment_type,valid_from,origin_application_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [realm,target.id,row.proposed_branch_ref,row.proposed_department_ref,row.proposed_manager_ref,row.proposed_designation,
     target.employment_type,row.effective_date,target.origin_application_ref]);
   nextAssignment=newRow.rows[0].id;
  }
  const emp=await tx.query(`UPDATE hr_employee SET status=CASE WHEN $3::boolean THEN 'EXITED' ELSE status END,status_version=status_version+1
   WHERE root_realm_id=$1 AND id=$2 AND status_version=$4 AND status IN('ACTIVE','PROBATION') RETURNING id`,
   [realm,target.id,exit,row.prior_employee_version]);
  if(!emp.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  // A new assignment or exit changes the original approved public professional identity.
  // Consent is revoked immediately; CG18 still owns editorial publication.
  const consent=await tx.query<{account_ref:string;consent_version:number}>(`UPDATE hr_public_bio_consent SET consent_status='REVOKED',
   consent_version=consent_version+1,revoked_at=now(),updated_at=now()
   WHERE root_realm_id=$1 AND employee_id=$2 AND consent_status='GRANTED' RETURNING account_ref,consent_version`,[realm,target.id]);
  for(const c of consent.rows)await tx.query(`INSERT INTO hr_public_bio_consent_event(root_realm_id,employee_id,account_ref,action,consent_version)
   VALUES($1,$2,$3,'REVOKED',$4)`,[realm,target.id,c.account_ref,c.consent_version]);
  const completed=await tx.query(`UPDATE hr_employment_change SET status='APPLIED',new_assignment_ref=$3,applied_at=now(),updated_at=now()
   WHERE root_realm_id=$1 AND id=$2 AND status='APPROVED_PENDING_EFFECT' RETURNING id`,[realm,row.id,nextAssignment]);
  if(!completed.rowCount)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  await this.audit(tx,realm,reviewer,target.id,"EMPLOYMENT_CHANGE_APPLIED");
  return {applied:true,replayed:false};
 }
 async ownDetail(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  await this.identity.assertPatientSessionCurrent(tx,actor);
  if(!REF.test(ref))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  const row=(await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND h.reference=$2 AND e.account_ref=$3 AND e.status IN('ACTIVE','PROBATION') AND (h.status<>'DRAFT' OR h.created_by=$3)",[actor.realmId,ref,actor.accountId])).rows[0];
  if(!row)throw new NotFoundException("Employment request unavailable");
  const own=row.created_by===actor.accountId&&row.kind==="RESIGNATION";
  const reason=own?(await this.privateDetail(tx,actor.realmId,row,actor.accountId)).reason:undefined;
  return {reference:row.reference,kind:row.kind,effectiveDate:row.effective_date,lastWorkingDate:row.last_working_date,status:row.status,
   revision:row.revision,caseReference:row.case_number,caseStatus:row.case_status,reason,current:{branch:row.prior_branch_name,designation:row.prior_designation},
   proposed:exitKind(row.kind)?null:{branch:row.proposed_branch_name,designation:row.proposed_designation},
   timeline:await this.changeTimeline(tx,actor.realmId,row),clearance:await this.clearanceSummary(tx,actor.realmId,row,true),canEdit:own&&row.status==="DRAFT",canWithdraw:own&&row.status==="SUBMITTED"};
 }
 async myHistory(tx:PoolClient,actor:VerifiedFoundationActor){
  await this.identity.assertPatientSessionCurrent(tx,actor);
  const q=await tx.query<ChangeRow>(originalSql+" WHERE h.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION') AND (h.status<>'DRAFT' OR h.created_by=$2) ORDER BY h.created_at DESC,h.id DESC LIMIT 50",
   [actor.realmId,actor.accountId]);
  const linked=(await tx.query("SELECT 1 FROM hr_employee e JOIN hr_employment_assignment a ON a.root_realm_id=e.root_realm_id AND a.employee_id=e.id WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL",[actor.realmId,actor.accountId])).rowCount!==0;
  return {linked,items:q.rows.filter(row=>row.status!=="DRAFT"||row.created_by===actor.accountId)
   .map(row=>({reference:row.reference,kind:row.kind,effectiveDate:row.effective_date,lastWorkingDate:row.last_working_date,status:row.status,
     revision:row.revision,caseReference:row.case_number,caseStatus:row.case_status,current:{branch:row.prior_branch_name,designation:row.prior_designation},
     proposed:exitKind(row.kind)?null:{branch:row.proposed_branch_name,designation:row.proposed_designation},canEdit:row.created_by===actor.accountId&&row.status==="DRAFT",
     canWithdraw:row.created_by===actor.accountId&&row.status==="SUBMITTED"}))};
 }
 async requesterRow(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  const row=await this.byRef(tx,actor.realmId,ref,actor.accountId);
  await this.target(tx,actor,row.kind==="RESIGNATION"&&row.target_account_ref===actor.accountId?null:row.employee_code);
  return row;
 }
 async staffHistory(tx:PoolClient,actor:VerifiedFoundationActor,offset:number,status="ALL",family="ALL"){
  await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  const scope=await this.branches.projectBranchScope(tx,actor);
  const sql=`WITH permitted AS (
   SELECT e.id FROM hr_employee e JOIN LATERAL(
    SELECT a.* FROM hr_employment_assignment a WHERE a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
    ORDER BY CASE WHEN a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL THEN 0 ELSE 1 END,a.valid_from DESC,a.id DESC LIMIT 1
   ) a ON true JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id
   WHERE e.root_realm_id=$1 AND ${actorScope(6)}
  ) `;
  const q=await tx.query<ChangeRow>(sql+originalSql+" WHERE h.root_realm_id=$1 AND EXISTS(SELECT 1 FROM permitted p WHERE p.id=h.employee_id) AND (h.status<>'DRAFT' OR h.created_by=$2) AND ($4='ALL' OR h.status=$4) AND ($5='ALL' OR ($5='EXIT' AND h.kind IN('RESIGNATION','EXIT')) OR ($5='TRANSFER' AND h.kind IN('TRANSFER','PROMOTION','DEPUTATION'))) ORDER BY h.created_at DESC,h.id DESC LIMIT 26 OFFSET $3",
   [actor.realmId,actor.accountId,offset,status,family,scope.branches.map(x=>x.value)]);
  return {items:q.rows.slice(0,25).map(row=>({...this.summary(row),canEdit:row.created_by===actor.accountId&&row.status==="DRAFT",canWithdraw:row.created_by===actor.accountId&&row.status==="SUBMITTED"})),hasMore:q.rows.length>25,offset};
 }
 async staffDetail(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  if(!REF.test(ref))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  const scope=await this.branches.projectBranchScope(tx,actor);
  const sql=`WITH permitted AS (
   SELECT e.id FROM hr_employee e JOIN LATERAL(
    SELECT a.* FROM hr_employment_assignment a WHERE a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
    ORDER BY CASE WHEN a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL THEN 0 ELSE 1 END,a.valid_from DESC,a.id DESC LIMIT 1
   ) a ON true JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id
   WHERE e.root_realm_id=$1 AND ${actorScope(4)}
  ) `;
  const row=(await tx.query<ChangeRow>(sql+originalSql+" WHERE h.root_realm_id=$1 AND h.reference=$3 AND EXISTS(SELECT 1 FROM permitted p WHERE p.id=h.employee_id) AND (h.status<>'DRAFT' OR h.created_by=$2)",
   [actor.realmId,actor.accountId,ref,scope.branches.map(x=>x.value)])).rows[0];
  if(!row)throw new NotFoundException("The original employment request is unavailable");
  const detail=row.created_by===actor.accountId?await this.privateDetail(tx,actor.realmId,row,actor.accountId):this.summary(row);
  return {...detail,employeeReference:row.employee_code,canEdit:row.created_by===actor.accountId&&row.status==="DRAFT",
   canWithdraw:row.created_by===actor.accountId&&row.status==="SUBMITTED",timeline:await this.changeTimeline(tx,actor.realmId,row),clearance:await this.clearanceSummary(tx,actor.realmId,row,true),
   canRecordClearance:exitKind(row.kind)&&row.status==="APPROVED_PENDING_EFFECT"&&row.employee_account_ref!==actor.accountId,
   ...(row.created_by===actor.accountId&&row.status==="DRAFT"?{form:{kind:row.kind,effectiveDate:row.effective_date,lastWorkingDate:row.last_working_date,
    branchRef:row.proposed_branch_ref,departmentRef:row.proposed_department_ref,managerRef:row.proposed_manager_ref,designation:row.proposed_designation,roleRef:row.proposed_role_ref}}:{})};
 }
 async employeeOptions(tx:PoolClient,actor:VerifiedFoundationActor,search:string){
  await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  const scope=await this.branches.projectBranchScope(tx,actor);
  const q=await tx.query<Target>(currentSql+" AND "+actorScope(4)+" AND ($3='' OR strpos(lower(app.legal_name),$3)>0) ORDER BY app.legal_name,e.id LIMIT 51",
   [actor.realmId,actor.accountId,search,scope.branches.map(x=>x.value)]);
  return {items:q.rows.slice(0,50).map(row=>({employeeReference:row.employee_code,name:row.employee_name,current:{branch:row.branch_name,department:row.department_name,designation:row.designation,manager:row.manager_name},hasStaffAccount:row.account_ref!==null})),hasMore:q.rows.length>50};
 }
 async branchOptions(tx:PoolClient,actor:VerifiedFoundationActor){
  await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  const scope=await this.branches.projectBranchScope(tx,actor);
  const q=await tx.query<{id:string;name:string}>(`
   SELECT id,name FROM branch WHERE root_realm_id=$1 AND status='ACTIVE'
    AND ($2::boolean OR id=ANY($3::uuid[]))
   ORDER BY name,id LIMIT 101`,
   [actor.realmId,scope.all,scope.branches.map(x=>x.value)]);
  if(q.rows.length>100)throw new ConflictException("Select a smaller authorized destination region");
  return {items:q.rows.map(x=>({branchRef:x.id,label:x.name}))};
 }
 async destinationOptions(tx:PoolClient,actor:VerifiedFoundationActor,branch:string){
  await this.identity.assertCurrent(tx,actor,"hr.changes.manage");
  // Do not offer another branch's employees or departments as valid transfer
  // destinations just because the branch UUID belongs to this Foundation.
  await this.branches.projectBranch(tx,actor,leaveId(branch));
  const dept=await tx.query<{id:string;name:string}>(`SELECT d.id,d.name FROM department d WHERE d.root_realm_id=$1 AND d.active
   AND (d.branch_id=$2 OR (d.branch_id IS NULL AND EXISTS(SELECT 1 FROM branch_department_link l
    WHERE l.root_realm_id=d.root_realm_id AND l.foundation_department_id=d.id AND l.branch_id=$2 AND l.ended_at IS NULL)))
   ORDER BY d.name,d.id LIMIT 101`,[actor.realmId,branch]);
  const managers=await tx.query<Target>(currentSql+" AND a.branch_ref=$2 ORDER BY app.legal_name,e.id LIMIT 101",[actor.realmId,branch]);
  if(dept.rows.length>100||managers.rows.length>100)throw new ConflictException("Use a smaller authorized destination scope");
  return {departments:dept.rows.map(x=>({departmentRef:x.id,label:x.name})),managers:managers.rows.map(x=>({managerRef:x.id,label:x.employee_name+" — "+x.designation}))};
 }
}
