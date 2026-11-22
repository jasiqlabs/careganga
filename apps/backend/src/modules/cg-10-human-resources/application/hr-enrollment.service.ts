import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {RolesService} from "../../cg-01-identity-access/application/roles.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrEnrollmentSourceFacade,sourceHash} from "./hr-enrollment-source.facade";
import {HrEmployeeEvidenceService} from "../../cg-19-documents-notifications/application/hr-employee-evidence.service";
import {HrEnrollmentApprovalService} from "../../cg-03-registration-approvals/application/hr-enrollment-approval.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TYPES=["FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"] as const;
type Fields={name:string;designation:string;employmentType:string;branchRef:string;
 departmentRef:string|null;managerRef:string|null;roleRef:string|null;hireDate:string;accountRef:string|null};
type Command=Fields&{requestKey:string;expectedRevision?:number};
type Row={id:string;application_no:string;legal_name:string;designation:string;
 employment_type:string;proposed_branch_ref:string;department_ref:string|null;
 applicant_account_ref:string|null;proposed_manager_employee_ref:string|null;proposed_role_ref:string|null;hire_date:Date|string;state:string;revision_no:number;
 request_digest:string;created_at:Date};
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid=(v:unknown,label:string):string=>{
 if(typeof v!=="string"||!ID.test(v))throw new BadRequestException("Choose a valid "+label);
 return v;
};
const clean=(v:unknown,max:number):string=>{
 if(typeof v!=="string")throw new BadRequestException("Complete the employee details");
 const x=v.trim().replace(/\s+/g," ");
 if(x.length<2||x.length>max||/[\u0000-\u001f\u007f]/.test(x))
  throw new BadRequestException("Check the employee details");
 return x;
};
export function parseHrDraft(value:unknown,update=false):Command{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException("Check the employee application");
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","name","designation",
  "employmentType","branchRef","departmentRef","managerRef","roleRef","hireDate","accountRef"].includes(k)))
  throw new BadRequestException("The employee application contains unsupported fields");
 const employmentType=x.employmentType;
 if(typeof employmentType!=="string"||!TYPES.some(t=>t===employmentType))
  throw new BadRequestException("Choose an employment type");
 if(typeof x.hireDate!=="string"||!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(x.hireDate)||
    Number.isNaN(Date.parse(x.hireDate))||
    new Date(x.hireDate+"T00:00:00Z").toISOString().slice(0,10)!==x.hireDate)
  throw new BadRequestException("Choose a valid joining date");
 if(update?(!Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1):
  x.expectedRevision!==undefined)
  throw new BadRequestException("Refresh the employee draft");
 const optional=(v:unknown,label:string)=>v===undefined||v===null||v===""?
  null:uuid(v,label);
 return {requestKey:uuid(x.requestKey,"request"),
  name:clean(x.name,160),designation:clean(x.designation,120),
  employmentType,branchRef:uuid(x.branchRef,"active branch"),
  departmentRef:optional(x.departmentRef,"department"),
  managerRef:optional(x.managerRef,"reporting manager"),
  roleRef:optional(x.roleRef,"role proposal"),
  accountRef:optional(x.accountRef,"existing account"),hireDate:x.hireDate,
  ...(update?{expectedRevision:Number(x.expectedRevision)}:{})};
}
const iso=(v:Date|string)=>typeof v==="string"?v.slice(0,10):v.toISOString().slice(0,10);
const view=(x:Row)=>({applicationRef:x.id,reference:x.application_no,name:x.legal_name,
 designation:x.designation,employmentType:x.employment_type,
 branchRef:x.proposed_branch_ref,departmentRef:x.department_ref,
 managerRef:x.proposed_manager_employee_ref,roleRef:x.proposed_role_ref,
 accountRef:x.applicant_account_ref,hireDate:iso(x.hire_date),
 status:x.state,revision:Number(x.revision_no)});

@Injectable()
export class HrEnrollmentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly roles:RolesService,
  private readonly source:HrEnrollmentSourceFacade,
  private readonly files:HrEmployeeEvidenceService,
  private readonly approvals:HrEnrollmentApprovalService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private actor(token:string,action:"hr.applications.view"|"hr.applications.manage"){
  return this.sessions.requireAction(token,action);
 }
 private async branch(tx:PoolClient,a:VerifiedFoundationActor,ref:string){
  const q=await tx.query<{name:string;manager_account_ref:string;full_access:boolean}>(
   "SELECT b.name,b.manager_account_ref,EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$3 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL)) AS full_access "+
   "FROM branch b WHERE b.id=$1 AND b.root_realm_id=$3 AND b.status='ACTIVE' "+
   "FOR SHARE OF b",[ref,a.accountId,a.realmId]);
  if(!q.rows[0])throw new ForbiddenException("The selected Foundation branch is unavailable");
  if(!q.rows[0].full_access&&q.rows[0].manager_account_ref!==a.accountId)
   throw new ForbiddenException("Your account cannot manage this branch's staff");
  return q.rows[0];
 }
 private async validSource(tx:PoolClient,a:VerifiedFoundationActor,x:Fields){
  await this.branch(tx,a,x.branchRef);
  if(x.roleRef){
   await this.identity.assertCurrent(tx,a,"roles.select");
   await this.roles.requireHrSelectableRole(tx,a,x.roleRef);
  }
  if(x.departmentRef){
   const department=await tx.query(
    "SELECT 1 FROM department WHERE id=$1 AND root_realm_id=$2 AND active "+
    "AND (branch_id=$3 OR (branch_id IS NULL AND EXISTS("+ 
    "SELECT 1 FROM branch_department_link link WHERE "+ 
    "link.foundation_department_id=department.id AND link.root_realm_id=$2 "+ 
    "AND link.branch_id=$3 AND link.ended_at IS NULL))) FOR SHARE",
    [x.departmentRef,a.realmId,x.branchRef]);
   if(!department.rowCount)throw new BadRequestException("Select an available department");
  }
  if(x.managerRef){
   const manager=await tx.query<{account_ref:string|null}>(
    "SELECT e.account_ref FROM hr_employee e JOIN hr_employment_assignment a "+
    "ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id "+
    "WHERE e.id=$1 AND e.root_realm_id=$2 AND e.status IN('ACTIVE','PROBATION') "+
    "AND a.branch_ref=$3 AND a.valid_from<=CURRENT_DATE "+
    "AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE) FOR SHARE OF e,a",
    [x.managerRef,a.realmId,x.branchRef]);
   if(!manager.rowCount)throw new BadRequestException("Choose an active manager at this branch");
   if(x.accountRef&&manager.rows[0].account_ref===x.accountRef)
    throw new BadRequestException("The applicant cannot report to their own staff account");
  }
  if(x.accountRef){
   // Selecting even a *candidate* identity requires original CG01 authority.
   // HR draft permission alone is never permission to enumerate/link logins.
   await this.identity.assertCurrent(tx,a,"accounts.select");
   const account=await tx.query(
    "SELECT 1 FROM account WHERE id=$1 AND realm_id=$2 AND status='ACTIVE' FOR SHARE",
    [x.accountRef,a.realmId]);
   if(!account.rowCount)throw new BadRequestException("Choose an eligible existing account");
   const linked=await tx.query(
    "SELECT 1 FROM hr_employee WHERE root_realm_id=$1 AND account_ref=$2",
    [a.realmId,x.accountRef]);
   if(linked.rowCount)throw new ConflictException("This account is already linked to an employee");
  }
 }
 async branchOptions(token:string){
  const a=await this.actor(token,"hr.applications.view");
  return this.availableBranches(a);
 }
 async employeeBranchOptions(token:string){
  const a=await this.sessions.requireAction(token,"hr.employees.view");
  return this.availableBranches(a);
 }
 private async availableBranches(a:VerifiedFoundationActor){
  const q=await this.db.query<{id:string;name:string;pin_code:string|null;
    state:string|null;district:string|null;subdivision:string|null;block:string|null}>(
   "SELECT b.id,b.name,b.pin_code,geo.state,geo.district,geo.subdivision,geo.block "+
   "FROM branch b LEFT JOIN LATERAL ("+
   "WITH RECURSIVE path(level,display_name,parent_area_id,root_realm_id,depth) AS ("+
   "SELECT g.level,g.display_name,g.parent_area_id,g.root_realm_id,0 "+
   "FROM geography_area g WHERE g.id=b.geography_area_id AND g.root_realm_id=b.root_realm_id "+
   "UNION ALL SELECT parent.level,parent.display_name,parent.parent_area_id,parent.root_realm_id,p.depth+1 "+
   "FROM path p JOIN geography_area parent ON parent.id=p.parent_area_id "+
   "AND parent.root_realm_id=p.root_realm_id WHERE p.depth<6) "+
   "SELECT MAX(display_name) FILTER(WHERE level='STATE') AS state,"+
   "MAX(display_name) FILTER(WHERE level='DISTRICT') AS district,"+
   "MAX(display_name) FILTER(WHERE level='SUBDIVISION') AS subdivision,"+
   "MAX(display_name) FILTER(WHERE level='BLOCK') AS block FROM path"+
   ") geo ON true "+
   "WHERE b.root_realm_id=$1 AND b.status='ACTIVE' "+
   "AND (b.manager_account_ref=$2 OR EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL))) "+
   "ORDER BY b.name,b.id LIMIT 101",[a.realmId,a.accountId]);
  if(q.rows.length>100)throw new ConflictException("Contact your administrator to narrow branch access");
  return {items:q.rows.map(b=>({branchRef:b.id,label:b.name,
    geography:[b.state,b.district,b.subdivision,b.block,b.pin_code].filter(Boolean).join(", "),
    state:b.state,district:b.district,block:b.block,pinCode:b.pin_code}))};
 }
 async departmentOptions(token:string,branchInput:string){
  const a=await this.actor(token,"hr.applications.view");
  const ref=uuid(branchInput,"branch"),tx=await this.db.connect();
  try{
   await this.branch(tx,a,ref);
   const q=await tx.query<{id:string;name:string}>(
    "SELECT id,name FROM department WHERE root_realm_id=$1 AND active "+
    "AND (branch_id=$2 OR (branch_id IS NULL AND EXISTS("+ 
    "SELECT 1 FROM branch_department_link link WHERE "+ 
    "link.foundation_department_id=department.id AND "+ 
    "link.root_realm_id=department.root_realm_id AND "+ 
    "link.branch_id=$2 AND link.ended_at IS NULL))) "+ 
    "ORDER BY name,id LIMIT 101",
    [a.realmId,ref]);
   if(q.rows.length>100)throw new ConflictException("Ask your administrator to narrow departments");
   return {items:q.rows.map(d=>({departmentRef:d.id,label:d.name}))};
  }finally{tx.release();}
 }
 async managerOptions(token:string,branchInput:string){
  const actor=await this.actor(token,"hr.applications.view");
  const branch=uuid(branchInput,"branch");
  const tx=await this.db.connect();
  try{
   await this.branch(tx,actor,branch);
   const q=await tx.query<{id:string;legal_name:string;designation:string}>(
    "SELECT e.id,app.legal_name,asg.designation "+
    "FROM hr_employee e JOIN hr_employee_application app "+
    "ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id "+
    "JOIN hr_employment_assignment asg ON asg.employee_id=e.id "+
    "AND asg.root_realm_id=e.root_realm_id "+
    "WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION') "+
    "AND asg.branch_ref=$2 AND asg.valid_from<=CURRENT_DATE "+
    "AND (asg.valid_to IS NULL OR asg.valid_to>CURRENT_DATE) "+
    "ORDER BY app.legal_name,e.id LIMIT 101",
    [actor.realmId,branch]);
   if(q.rows.length>100)throw new ConflictException(
    "Choose a more specific manager list");
   return {items:q.rows.map(x=>({
    managerRef:x.id,label:x.legal_name+" — "+x.designation}))};
  }finally{tx.release();}
 }
 /** CG01 owns active account selection and its role grants. Existing accounts
  * are merely *proposed* at HR drafting, never assigned extra HR privileges.
  */
 async accountOptions(token:string,searchInput:string){
  const actor=await this.actor(token,"hr.applications.view");
  await this.sessions.requireAction(token,"accounts.select");
  const search=searchInput.trim();
  if(search.length>80||/[\u0000-\u001f\u007f]/.test(search))
   throw new BadRequestException("Check the staff account search");
  const tx=await this.db.connect();
  try{
   await this.identity.assertCurrent(tx,actor,"accounts.select");
   const options=await this.identity.eligibleOfficeholderOptions(tx,actor,search);
   const ids=options.map(x=>x.value);
   if(!ids.length)return {items:[]};
   const used=await tx.query<{account_ref:string}>(
    "SELECT account_ref FROM hr_employee WHERE root_realm_id=$1 "+
    "AND account_ref=ANY($2::uuid[]) AND account_ref IS NOT NULL",
    [actor.realmId,ids]);
   const linked=new Set(used.rows.map(x=>x.account_ref));
   return {items:options.filter(x=>!linked.has(x.value)).map(x=>({
    accountRef:x.value,label:x.label}))};
  }finally{tx.release();}
 }

 async employeeDepartmentOptions(token:string,branchInput:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.view");
  const branch=uuid(branchInput,"branch"),tx=await this.db.connect();
  try{
   await this.branch(tx,actor,branch);
   const rows=await tx.query<{id:string;name:string}>(
    "SELECT id,name FROM department WHERE root_realm_id=$1 AND active "+
    "AND (branch_id=$2 OR (branch_id IS NULL AND EXISTS("+ 
    "SELECT 1 FROM branch_department_link link WHERE "+ 
    "link.foundation_department_id=department.id AND "+ 
    "link.root_realm_id=department.root_realm_id AND "+ 
    "link.branch_id=$2 AND link.ended_at IS NULL))) "+ 
    "ORDER BY name,id LIMIT 101",
    [actor.realmId,branch]);
   if(rows.rows.length>100)
    throw new ConflictException("Choose a smaller department scope");
   return {items:rows.rows.map(x=>({departmentRef:x.id,label:x.name}))};
  }finally{tx.release();}
 }

 async roleOptions(token:string,search:string){
  await this.actor(token,"hr.applications.view");
  await this.sessions.requireAction(token,"roles.select");
  return this.roles.options(token,search);
 }

 async create(token:string,input:unknown){
  const a=await this.actor(token,"hr.applications.manage"),x=parseHrDraft(input);
  const digest=hash(["CREATE",a.accountId,x]),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   try{
    const existing=await tx.query<Row>(
     "SELECT * FROM hr_employee_application WHERE root_realm_id=$1 AND request_key=$2 FOR UPDATE",
     [a.realmId,x.requestKey]);
    if(existing.rows[0]){
     if(existing.rows[0].request_digest!==digest)
      throw new ConflictException("This save request was already used for a different application");
     await this.branch(tx,a,existing.rows[0].proposed_branch_ref);
     await tx.query("COMMIT");
     return {...view(existing.rows[0]),replayed:true};
    }
    await this.validSource(tx,a,x);
    const result=await tx.query<Row>(
     "INSERT INTO hr_employee_application(root_realm_id,request_key,request_digest,application_no,"+
     "legal_name,designation,employment_type,proposed_branch_ref,department_ref,hire_date,"+
     "applicant_account_ref,proposed_manager_employee_ref,proposed_role_ref,created_by,updated_by) VALUES($1,$2,$3,"+
     "'CG-HR-APP-'||lpad(nextval('hr_application_public_sequence')::text,6,'0'),"+
     "$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) "+
     "ON CONFLICT (root_realm_id,request_key) DO NOTHING RETURNING *",
     [a.realmId,x.requestKey,digest,x.name,x.designation,x.employmentType,x.branchRef,
      x.departmentRef,x.hireDate,x.accountRef,x.managerRef,x.roleRef,a.accountId]);
    // Racing identical requests can both initially see no row. The unique
    // root+request key is authoritative; reconcile only the exact same digest.
    if(!result.rows[0]){
     const concurrent=await tx.query<Row>(
      "SELECT * FROM hr_employee_application WHERE root_realm_id=$1 AND request_key=$2 FOR UPDATE",
      [a.realmId,x.requestKey]);
     const prior=concurrent.rows[0];
     if(!prior||prior.request_digest!==digest)
      throw new ConflictException("This request key belongs to another employee application");
     await this.branch(tx,a,prior.proposed_branch_ref);
     await tx.query("COMMIT");
     return {...view(prior),replayed:true};
    }
    const row=result.rows[0];
    await tx.query(
     "INSERT INTO hr_application_command(root_realm_id,actor_ref,request_key,request_digest,"+
     "application_ref,action,resulting_revision) VALUES($1,$2,$3,$4,$5,'CREATE',1)",
     [a.realmId,a.accountId,x.requestKey,digest,row.id]);
    await tx.query(
     "INSERT INTO hr_audit(root_realm_id,actor_ref,application_ref,event_key,action) "+
     "VALUES($1,$2,$3,$4,'DRAFT_CREATED')",
     [a.realmId,a.accountId,row.id,randomUUID()]);
    await tx.query("COMMIT");
    return {...view(row),replayed:false};
   }catch(e){
    await tx.query("ROLLBACK");
    if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
     throw new ConflictException("An employee draft already uses these details. Refresh first.");
    throw e;
   }
  }finally{tx.release();}
 }
 async update(token:string,applicationInput:string,input:unknown){
  const a=await this.actor(token,"hr.applications.manage");
  const ref=uuid(applicationInput,"application"),x=parseHrDraft(input,true);
  const digest=hash(["UPDATE",a.accountId,ref,x]),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   try{
    const q=await tx.query<Row>(
     "SELECT * FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
     [ref,a.realmId]);
    const previous=q.rows[0];
    if(!previous)throw new NotFoundException("Employee application not found");
    await this.branch(tx,a,previous.proposed_branch_ref);
    const replay=await tx.query<{request_digest:string;application_ref:string;resulting_revision:number}>(
     "SELECT request_digest,application_ref,resulting_revision FROM hr_application_command "+
     "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
     [a.realmId,a.accountId,x.requestKey]);
    if(replay.rows[0]){
     if(replay.rows[0].request_digest!==digest||replay.rows[0].application_ref!==ref)
      throw new ConflictException("This change request was already used");
     await tx.query("COMMIT");
     return {applicationRef:ref,revision:replay.rows[0].resulting_revision,
      status:previous.state,replayed:true};
    }
    if(!["DRAFT","RETURNED"].includes(previous.state))
     throw new ConflictException("Submitted employee applications cannot be edited");
    if(Number(previous.revision_no)!==x.expectedRevision)
     throw new ConflictException("Someone updated this draft. Refresh it before editing.");
    await this.validSource(tx,a,x);
    const updated=await tx.query<Row>(
     "UPDATE hr_employee_application SET legal_name=$3,designation=$4,employment_type=$5,"+
     "proposed_branch_ref=$6,department_ref=$7,hire_date=$8,applicant_account_ref=$9,"+
     "proposed_manager_employee_ref=$10,proposed_role_ref=$11,"+
     "updated_by=$12,updated_at=now(),state='DRAFT',revision_no=revision_no+1, "+
     "cg03_case_ref=NULL,submitted_digest=NULL "+
     "WHERE id=$1 AND root_realm_id=$2 RETURNING *",
     [ref,a.realmId,x.name,x.designation,x.employmentType,x.branchRef,
      x.departmentRef,x.hireDate,x.accountRef,x.managerRef,x.roleRef,a.accountId]);
    await tx.query(
     "INSERT INTO hr_application_command(root_realm_id,actor_ref,request_key,request_digest,"+
     "application_ref,action,resulting_revision) VALUES($1,$2,$3,$4,$5,'UPDATE',$6)",
     [a.realmId,a.accountId,x.requestKey,digest,ref,updated.rows[0].revision_no]);
    await tx.query(
     "INSERT INTO hr_audit(root_realm_id,actor_ref,application_ref,event_key,action) "+
     "VALUES($1,$2,$3,$4,'DRAFT_UPDATED')",
     [a.realmId,a.accountId,ref,randomUUID()]);
    await tx.query("COMMIT");
    return {...view(updated.rows[0]),replayed:false};
   }catch(e){
    await tx.query("ROLLBACK");
    if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
     throw new ConflictException("An employee draft already uses these details. Refresh first.");
    throw e;
   }
  }finally{tx.release();}
 }
 async list(token:string,offsetInput:unknown,branchInput?:unknown){
  const a=await this.actor(token,"hr.applications.view"),offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)
   throw new BadRequestException("Choose a valid employee list page");
  const branch=branchInput===undefined?null:uuid(branchInput,"branch");
  const q=await this.db.query<Row>(
   "SELECT h.* FROM hr_employee_application h "+
   "JOIN branch b ON b.id=h.proposed_branch_ref AND b.root_realm_id=h.root_realm_id "+
   "WHERE h.root_realm_id=$1 AND ($3::uuid IS NULL OR h.proposed_branch_ref=$3) "+
   "AND (b.manager_account_ref=$2 OR EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL))) "+
   "ORDER BY h.created_at DESC,h.id DESC LIMIT 26 OFFSET $4",
   [a.realmId,a.accountId,branch,offset]);
  return {items:q.rows.slice(0,25).map(view),hasMore:q.rows.length>25,offset};
 }
 async detail(token:string,applicationInput:string){
  const a=await this.actor(token,"hr.applications.view"),ref=uuid(applicationInput,"application");
  const tx=await this.db.connect();
  try{
   const q=await tx.query<Row>(
    "SELECT * FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2",
    [ref,a.realmId]);
   if(!q.rows[0])throw new NotFoundException("Employee application not found");
   await this.branch(tx,a,q.rows[0].proposed_branch_ref);
   return view(q.rows[0]);
  }finally{tx.release();}
 }
 async myProfile(token:string){
  const a=await this.sessions.verifySession(token);
  const q=await this.db.query<{
    employee_code:string;status:string;legal_name:string;designation:string;
    branch_name:string;employment_type:string;valid_from:Date|string
  }>(
   "SELECT e.employee_code,e.status,app.legal_name,asg.designation,b.name AS branch_name,"+
   "asg.employment_type,asg.valid_from FROM hr_employee e "+
   "JOIN hr_employee_application app ON app.id=e.application_id "+
   "AND app.root_realm_id=e.root_realm_id "+
   "JOIN LATERAL (SELECT original.* FROM hr_employment_assignment original "+
   "WHERE original.employee_id=e.id AND original.root_realm_id=e.root_realm_id "+
   "ORDER BY CASE WHEN original.valid_from<=CURRENT_DATE AND "+
   "(original.valid_to IS NULL OR original.valid_to>CURRENT_DATE) "+
   "THEN 0 ELSE 1 END,original.valid_from DESC,original.id DESC LIMIT 1) asg ON true "+
   "JOIN branch b ON b.id=asg.branch_ref AND b.root_realm_id=asg.root_realm_id "+
   "WHERE e.root_realm_id=$1 AND e.account_ref=$2 "+
   "AND e.status IN('ACTIVE','PROBATION','ON_HOLD','EXITED') "+
   "ORDER BY asg.valid_from DESC LIMIT 1",[a.realmId,a.accountId]);
  const row=q.rows[0];
  if(!row)return {status:"NOT_LINKED",message:"No approved employee profile is linked to your account."};
  return {status:row.status,employeeReference:row.employee_code,name:row.legal_name,
    designation:row.designation,branch:row.branch_name,
    employmentType:row.employment_type,effectiveFrom:iso(row.valid_from)};
 }

 /** Original reviewer status is read from CG03, not a copied client flag. */
 async reviewStatus(token:string,applicationInput:string){
  const a=await this.actor(token,"hr.applications.view"),
   ref=uuid(applicationInput,"employee application");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const app=await this.source.draft(tx,a,ref,false);
   const q=await tx.query<{cg03_case_ref:string|null}>(
    "SELECT cg03_case_ref FROM hr_employee_application "+
    "WHERE id=$1 AND root_realm_id=$2 FOR SHARE",
    [ref,a.realmId]);
   const original=await this.approvals.currentForSource(tx,a.realmId,
     app.id,q.rows[0]?.cg03_case_ref??null);
   await tx.query("COMMIT");
   return original;
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }

 /** CG-10 uses an original immutable CG19-file snapshot, never client "verified". */
 async submit(token:string,applicationInput:string,body:unknown){
  const actor=await this.actor(token,"hr.applications.manage");
  const applicationRef=uuid(applicationInput,"application");
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException("Check enrollment submission");
  const input=body as Record<string,unknown>;
  if(Object.keys(input).some(k=>!["requestKey","expectedRevision","files"].includes(k))||
    typeof input.requestKey!=="string"||!ID.test(input.requestKey)||
    !Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<1||
    !Array.isArray(input.files)||input.files.length<1||input.files.length>8)
   throw new BadRequestException("Choose verified documents and the current draft");
  const files=input.files.map((f:unknown)=>{
   if(!f||typeof f!=="object"||Array.isArray(f))
    throw new BadRequestException("Check the submitted HR evidence");
   const row=f as Record<string,unknown>;
   if(Object.keys(row).some(k=>!["fileRef","fileVersion","classification"].includes(k))||
     typeof row.fileRef!=="string"||!ID.test(row.fileRef)||
     !Number.isSafeInteger(row.fileVersion)||Number(row.fileVersion)<1||
     !["HR_IDENTITY_PROOF","HR_PAN_PROOF","HR_QUALIFICATION","HR_PORTRAIT"].includes(String(row.classification)))
    throw new BadRequestException("Choose an original clean employee file");
   return {fileRef:row.fileRef as string,fileVersion:Number(row.fileVersion),
    classification:row.classification as "HR_IDENTITY_PROOF"|"HR_PAN_PROOF"|"HR_QUALIFICATION"|"HR_PORTRAIT"};
  });
  if(new Set(files.map(f=>f.fileRef)).size!==files.length||
    files.filter(f=>f.classification==="HR_IDENTITY_PROOF").length!==1)
   throw new BadRequestException("One original identity proof is required");
  files.sort((x,y)=>x.classification.localeCompare(y.classification)||
   x.fileRef.localeCompare(y.fileRef));
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const q=await tx.query<Row&{created_by:string;cg03_case_ref:string|null;
      submitted_digest:string|null}>(
    "SELECT * FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [applicationRef,actor.realmId]);
   const app=q.rows[0];
   if(!app)throw new NotFoundException("Employee application unavailable");
   await this.source.draft(tx,actor,applicationRef);
   if(app.cg03_case_ref){
    const existing=await tx.query<{id:string;case_number:string;request_key:string;
      hr_revision_no:number;status:string;private_file_versions:unknown}>(
     "SELECT c.id,c.case_number,c.request_key,c.hr_revision_no,c.status,rev.private_file_versions FROM cg03_case c "+
     "JOIN hr_application_revision rev ON rev.root_realm_id=c.realm_id AND rev.id=c.hr_revision_id "+
     "AND rev.application_id=c.hr_application_id AND rev.revision_no=c.hr_revision_no AND rev.source_digest=c.hr_source_digest "+
     "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='EMPLOYEE_ENROLLMENT' "+
     "AND c.hr_application_id=$3 FOR SHARE OF c,rev",
     [app.cg03_case_ref,actor.realmId,app.id]);
    const previous=existing.rows[0];
    if(previous&&previous.request_key===input.requestKey&&
      previous.hr_revision_no===Number(input.expectedRevision)){
     if(!Array.isArray(previous.private_file_versions)||sourceHash(previous.private_file_versions)!==sourceHash(files))
      throw new ConflictException({code:"CG10_ENROLLMENT_EVIDENCE_CHANGED"});
     await tx.query("COMMIT");
     return {caseRef:previous.id,reference:previous.case_number,
      status:previous.status,replayed:true};
    }
    throw new ConflictException("An employee enrollment review already exists");
   }
   if(!["DRAFT","RETURNED"].includes(app.state)||
     app.revision_no!==Number(input.expectedRevision))
    throw new ConflictException("Refresh the latest employee draft before submission");
   await this.validSource(tx,actor,{name:app.legal_name,
    designation:app.designation,employmentType:app.employment_type,
    branchRef:app.proposed_branch_ref,departmentRef:app.department_ref,
    managerRef:app.proposed_manager_employee_ref,roleRef:app.proposed_role_ref,
    accountRef:app.applicant_account_ref,hireDate:iso(app.hire_date)});
   for(const item of files)
    await this.files.prove(tx,actor.realmId,app.id,app.revision_no,
     item.fileRef,item.classification,item.fileVersion);
   const frozen={
    id:app.id,root_realm_id:actor.realmId,revision_no:Number(app.revision_no),
    legal_name:app.legal_name,designation:app.designation,
    employment_type:app.employment_type,proposed_branch_ref:app.proposed_branch_ref,
    department_ref:app.department_ref,applicant_account_ref:app.applicant_account_ref,
    proposed_manager_employee_ref:app.proposed_manager_employee_ref,
    proposed_role_ref:app.proposed_role_ref,
    hire_date:iso(app.hire_date),created_by:app.created_by,state:app.state,
    ...await this.source.privatePin(tx,actor.realmId,app.id)
   };
   const sourceDigest=sourceHash(frozen);
   const revision=await tx.query<{id:string}>(
    "INSERT INTO hr_application_revision(root_realm_id,application_id,revision_no,"+
    "source_digest,source_snapshot,private_file_versions,submitted_by) "+
    "VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING id",
    [actor.realmId,app.id,app.revision_no,sourceDigest,JSON.stringify(frozen),
     JSON.stringify(files),actor.accountId]);
   for(const file of files)await tx.query(
    "INSERT INTO hr_application_proof(root_realm_id,application_id,revision_no,"+
    "file_ref,file_version,classification) VALUES($1,$2,$3,$4,$5,$6)",
    [actor.realmId,app.id,app.revision_no,file.fileRef,
     file.fileVersion,file.classification]);
   await tx.query("UPDATE hr_employee_application SET state='SUBMISSION_UNCONFIRMED',"+
    "submitted_digest=$3,updated_at=now() WHERE id=$1 AND root_realm_id=$2",
    [app.id,actor.realmId,sourceDigest]);
   const caseResult=await this.approvals.createCase(tx,actor,{
    applicationRef:app.id,revisionRef:revision.rows[0].id,
    revisionNo:app.revision_no,digest:sourceDigest,requestKey:input.requestKey as string});
   await tx.query("UPDATE hr_application_revision SET cg03_case_ref=$3 "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,revision.rows[0].id,caseResult.caseRef]);
   await tx.query("UPDATE hr_employee_application SET state='SUBMITTED',"+
    "cg03_case_ref=$3,updated_at=now() WHERE id=$1 AND root_realm_id=$2",
    [app.id,actor.realmId,caseResult.caseRef]);
   await tx.query(
    "INSERT INTO hr_audit(root_realm_id,actor_ref,application_ref,event_key,action) "+
    "VALUES($1,$2,$3,$4,'SUBMITTED')",
    [actor.realmId,actor.accountId,app.id,randomUUID()]);
   await tx.query("COMMIT");
   return {caseRef:caseResult.caseRef,reference:caseResult.reference,
    status:"SUBMITTED",replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException("Enrollment changed. Refresh original application.");
   throw e;
  }finally{tx.release();}
 }
 /** Independently approved ORIGINAL CG03 decision and CG19 scan evidence are
  * checked again inside the same transaction that activates an employee.
  */
 async finalize(token:string,applicationInput:string,body:unknown){
  const actor=await this.actor(token,"hr.applications.manage");
  const applicationRef=uuid(applicationInput,"application");
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body as Record<string,unknown>).some(k=>k!=="caseRef")||
   !("caseRef" in body))
   throw new BadRequestException("Choose the original approved enrollment");
  const caseRef=uuid((body as {caseRef:unknown}).caseRef,"approval case");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.applications.manage");
   const q=await tx.query<Row&{cg03_case_ref:string|null;submitted_digest:string|null}>(
    "SELECT * FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [applicationRef,actor.realmId]);
   const app=q.rows[0];
   if(!app)throw new NotFoundException("Original employee application unavailable");
   if(app.cg03_case_ref!==caseRef||!app.submitted_digest)
    throw new ConflictException("This enrollment does not match its original approval");
   await this.source.draft(tx,actor,app.id);
   const existing=await tx.query<{employee_code:string;status:string}>(
    "SELECT e.employee_code,e.status FROM hr_employee e "+
    "WHERE e.root_realm_id=$1 AND e.application_id=$2 FOR SHARE",
    [actor.realmId,app.id]);
   if(existing.rows[0]){
    await tx.query("COMMIT");
    return {reference:existing.rows[0].employee_code,
     status:existing.rows[0].status,replayed:true};
   }
   if(!["SUBMITTED","IN_REVIEW","FINAL_APPROVED_PENDING_ACTIVATION"].includes(app.state))
    throw new ConflictException("This applicant is not awaiting an approved activation");
   // A future joining date is a genuine approved-but-not-yet-effective state.
   // Do not make an employee ACTIVE before the current effective assignment.
   const effective=await tx.query(
    "SELECT 1 FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2 "+
    "AND hire_date<=CURRENT_DATE FOR SHARE",
    [app.id,actor.realmId]);
   if(!effective.rowCount)throw new ConflictException(
    "Enrollment is approved but the joining date has not arrived. "+
    "Complete activation on the effective joining date.");
   const rev=await tx.query<{id:string}>(
    "SELECT id FROM hr_application_revision WHERE application_id=$1 "+
    "AND root_realm_id=$2 AND revision_no=$3 AND source_digest=$4 "+
    "AND cg03_case_ref=$5 FOR SHARE",
    [app.id,actor.realmId,app.revision_no,app.submitted_digest,caseRef]);
   if(!rev.rows[0])throw new ConflictException("Employee evidence revision is unavailable");
   await this.approvals.approved(tx,actor.realmId,app.id,rev.rows[0].id,
    app.revision_no,app.submitted_digest,caseRef);
   // CG01 is the only login/role owner. Existing identity links require an
   // explicit separate account acceptance, not a guessed role grant.
   const linkPending=app.applicant_account_ref!==null;
   const status=linkPending?"PENDING_ACCESS":"ACTIVE";
   const e=await tx.query<{id:string;employee_code:string}>(
    "INSERT INTO hr_employee(root_realm_id,application_id,employee_code,status) "+
    "VALUES($1,$2,'CG-HR-EMP-'||lpad(nextval('hr_employee_public_sequence')::text,6,'0'),"+
    "$3) RETURNING id,employee_code",[actor.realmId,app.id,status]);
   const row=e.rows[0];
   await tx.query(
    "INSERT INTO hr_employment_assignment(root_realm_id,employee_id,branch_ref,"+
    "department_ref,manager_employee_ref,designation,employment_type,valid_from,origin_application_ref) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [actor.realmId,row.id,app.proposed_branch_ref,app.department_ref,
     app.proposed_manager_employee_ref,app.designation,app.employment_type,iso(app.hire_date),app.id]);
   await this.approvals.finish(tx,actor,caseRef);
   await tx.query("UPDATE hr_employee_application SET state=$3,updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2",
    [app.id,actor.realmId,linkPending?"PENDING_ACCESS":"ACTIVE"]);
   await tx.query(
    "INSERT INTO hr_audit(root_realm_id,actor_ref,application_ref,employee_ref,"+
    "event_key,action) VALUES($1,$2,$3,$4,$5,$6)",
    [actor.realmId,actor.accountId,app.id,row.id,randomUUID(),
     linkPending?"PENDING_ACCESS":"ACTIVATED"]);
   await tx.query("COMMIT");
   return {reference:row.employee_code,status,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException("The employee was already enrolled. Refresh the directory.");
   throw e;
  }finally{tx.release();}
 }
 /** Only the actual target CG01 account may accept an approved HR linkage.
  * No account/password creation, new grant, role escalation or impersonation.
  */
 async acceptMyApprovedLink(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body as Record<string,unknown>).some(k=>k!=="applicationRef")||
    !("applicationRef" in body))
   throw new BadRequestException("Choose your original HR enrollment");
  const ref=uuid((body as {applicationRef:unknown}).applicationRef,"enrollment");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertPatientSessionCurrent(tx,actor);
   const q=await tx.query<{id:string;root_realm_id:string;state:string;
     applicant_account_ref:string|null;proposed_role_ref:string|null;
     cg03_case_ref:string|null;submitted_digest:string|null}>(
    "SELECT id,root_realm_id,state,applicant_account_ref,proposed_role_ref,"+
    "cg03_case_ref,submitted_digest FROM hr_employee_application "+
    "WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",[ref,actor.realmId]);
   const app=q.rows[0];
   if(!app||app.applicant_account_ref!==actor.accountId)
    throw new NotFoundException("No approved employment is assigned to this account");
   const e=await tx.query<{id:string;status:string;account_ref:string|null}>(
    "SELECT id,status,account_ref FROM hr_employee "+
    "WHERE root_realm_id=$1 AND application_id=$2 FOR UPDATE",
    [actor.realmId,ref]);
   const emp=e.rows[0];
   if(!emp||!["PENDING_ACCESS","ACTIVE"].includes(emp.status))
    throw new ConflictException("The employee is not ready for account acceptance");
   if(emp.account_ref===actor.accountId){
    await tx.query("COMMIT");
    return {status:"ACTIVE",replayed:true};
   }
   if(emp.account_ref!==null)
    throw new ConflictException("An employment account is already linked");
   const linked=await tx.query(
    "SELECT 1 FROM hr_employee WHERE root_realm_id=$1 AND account_ref=$2",
    [actor.realmId,actor.accountId]);
   if(linked.rowCount)throw new ConflictException("Your account is linked to another employee");
   if(app.proposed_role_ref){
    // The real CG01 grant must have been completed separately. An HR role
    // proposal or applicant consent is never an access grant.
    const granted=await this.roles.currentHrRoleAssigned(
      tx,actor,app.proposed_role_ref);
    if(!granted)throw new ConflictException(
     "Your proposed staff role has not been approved in current account access. "+
     "Ask a Foundation administrator to complete that separate approval.");
   }
   await tx.query("UPDATE hr_employee SET account_ref=$3,status='ACTIVE',"+
    "status_version=status_version+1 WHERE id=$1 AND root_realm_id=$2",
    [emp.id,actor.realmId,actor.accountId]);
   await tx.query("UPDATE hr_employee_application SET state='ACTIVE',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2",[ref,actor.realmId]);
   await tx.query(
    "INSERT INTO hr_audit(root_realm_id,actor_ref,application_ref,employee_ref,"+
    "event_key,action) VALUES($1,$2,$3,$4,$5,'ACCESS_CONFIRMED')",
    [actor.realmId,actor.accountId,ref,emp.id,randomUUID()]);
   await tx.query("COMMIT");
   return {status:"ACTIVE",replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");throw e;
  }finally{tx.release();}
 }
 async myPendingLink(token:string){
  const actor=await this.sessions.verifySession(token);
  const q=await this.db.query<{id:string;legal_name:string;designation:string}>(
   "SELECT a.id,a.legal_name,a.designation FROM hr_employee_application a "+
   "JOIN hr_employee e ON e.application_id=a.id AND e.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND a.applicant_account_ref=$2 "+
   "AND e.status='PENDING_ACCESS' AND e.account_ref IS NULL "+
   "AND a.state='PENDING_ACCESS' ORDER BY a.updated_at DESC LIMIT 1",
   [actor.realmId,actor.accountId]);
  if(!q.rows[0])return {pending:false};
  return {pending:true,applicationRef:q.rows[0].id,
   name:q.rows[0].legal_name,designation:q.rows[0].designation};
 }
 /** Detail is an authorized server projection, never an unsafe numeric ID
  * lookup or a leak of the HR private application / CG19 bytes.
  */
 async employeeDetail(token:string,referenceInput:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.view");
  if(!/^CG-HR-EMP-[0-9]{6,}$/.test(referenceInput))
   throw new BadRequestException("Choose an employee from the current directory");
  const q=await this.db.query<{employee_code:string;status:string;legal_name:string;
   designation:string;employment_type:string;branch_name:string;department_name:string|null;
   manager_name:string|null;valid_from:Date|string;valid_to:Date|string|null;
   approved_at:Date|string}>(
   "SELECT e.employee_code,e.status,source.legal_name,asg.designation,"+
   "asg.employment_type,b.name AS branch_name,dep.name AS department_name,"+
   "manager_source.legal_name AS manager_name,asg.valid_from,asg.valid_to,"+
   "e.confirmed_at AS approved_at "+
   "FROM hr_employee e JOIN hr_employee_application source "+
   "ON source.id=e.application_id AND source.root_realm_id=e.root_realm_id "+
   "JOIN LATERAL (SELECT a.* FROM hr_employment_assignment a "+
   "WHERE a.employee_id=e.id AND a.root_realm_id=e.root_realm_id "+
   "ORDER BY CASE WHEN a.valid_from<=CURRENT_DATE AND "+
   "(a.valid_to IS NULL OR a.valid_to>CURRENT_DATE) "+
   "THEN 0 ELSE 1 END,a.valid_from DESC,a.id DESC LIMIT 1) asg ON true "+
   "JOIN branch b ON b.id=asg.branch_ref AND b.root_realm_id=asg.root_realm_id "+
   "LEFT JOIN department dep ON dep.id=asg.department_ref "+
   "AND dep.root_realm_id=asg.root_realm_id "+
   "LEFT JOIN hr_employee manager ON manager.id=asg.manager_employee_ref "+
   "AND manager.root_realm_id=e.root_realm_id "+
   "LEFT JOIN hr_employee_application manager_source "+
   "ON manager_source.id=manager.application_id "+
   "AND manager_source.root_realm_id=e.root_realm_id "+
   "WHERE e.root_realm_id=$1 AND e.employee_code=$3 "+
   "AND (b.manager_account_ref=$2 OR EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role role_now ON role_now.id=ar.role_id "+
   "AND role_now.realm_id=ar.realm_id AND role_now.active "+
   "LEFT JOIN role_grant g ON g.role_id=role_now.id "+
   "AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL "+
   "AND (role_now.is_protected OR g.capability_key IS NOT NULL))) LIMIT 1",
   [actor.realmId,actor.accountId,referenceInput]);
  const person=q.rows[0];
  if(!person)throw new NotFoundException("This employee is not in your permitted branches");
  return {reference:person.employee_code,name:person.legal_name,
   designation:person.designation,employmentType:person.employment_type,
   branch:person.branch_name,department:person.department_name,
   manager:person.manager_name,status:person.status,
   effectiveFrom:iso(person.valid_from),
   effectiveTo:person.valid_to?iso(person.valid_to):null,
   approvedAt:typeof person.approved_at==="string"?
    person.approved_at:person.approved_at.toISOString()};
 }

 /** Real approved HR headcount only. No CG11 payroll facts or
  * public HR export. Current CG01+branch access is checked in the query.
  */
 async employeeSummary(token:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.view"),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.employees.view");
   let attendanceVisible=true;
   try{await this.identity.assertCurrent(tx,actor,"hr.attendance.view");}catch(e){
    if(!(e instanceof ForbiddenException))throw e;
    attendanceVisible=false;
   }
   const r=await tx.query<{status:string;quantity:string;new_joiners:string;on_leave:string;pending_leave:string;departments:{label:string;count:number}[];joiners:{month:string;count:number}[]}>(
    `WITH scoped AS (
     SELECT e.id,e.root_realm_id,e.status,app.hire_date,assignment.branch_ref,COALESCE(dep.name,'Unassigned') AS department_name,
      (b.status='ACTIVE' AND assignment.valid_from<=CURRENT_DATE AND
       (assignment.valid_to IS NULL OR assignment.valid_to>CURRENT_DATE)) AS current_assignment
     FROM hr_employee e
     JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
     JOIN LATERAL (SELECT a.branch_ref,a.department_ref,a.valid_from,a.valid_to FROM hr_employment_assignment a
      WHERE a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
      ORDER BY CASE WHEN a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
       THEN 0 ELSE 1 END,a.valid_from DESC,a.id DESC LIMIT 1) assignment ON true
     JOIN branch b ON b.id=assignment.branch_ref AND b.root_realm_id=e.root_realm_id
     LEFT JOIN department dep ON dep.id=assignment.department_ref AND dep.root_realm_id=e.root_realm_id
     WHERE e.root_realm_id=$1 AND (b.manager_account_ref=$2 OR EXISTS(
      SELECT 1 FROM account_role ar JOIN role role_now ON role_now.id=ar.role_id
      AND role_now.realm_id=ar.realm_id AND role_now.active
      LEFT JOIN role_grant grant_row ON grant_row.role_id=role_now.id
      AND grant_row.capability_key='foundation.branches.admin'
      WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL
      AND (role_now.is_protected OR grant_row.capability_key IS NOT NULL)))
    ), current_staff AS (
     SELECT * FROM scoped WHERE current_assignment AND status IN('ACTIVE','PROBATION')
    ), dept_counts AS (
     SELECT department_name,COUNT(*)::integer AS quantity FROM current_staff GROUP BY department_name
    ), ranked_departments AS (
     SELECT *,ROW_NUMBER() OVER(ORDER BY quantity DESC,department_name) AS rank FROM dept_counts
    ), dept_display AS (
     SELECT department_name AS label,quantity,rank FROM ranked_departments WHERE rank<=10
     UNION ALL SELECT 'Other departments',SUM(quantity)::integer,11 FROM ranked_departments WHERE rank>10 HAVING COUNT(*)>0
    ), month_counts AS (
     SELECT date_trunc('month',hire_date::timestamp)::date AS month,COUNT(*)::integer AS quantity
      FROM current_staff WHERE hire_date<=CURRENT_DATE AND hire_date>=date_trunc('month',CURRENT_DATE::timestamp)::date-INTERVAL '5 months'
      GROUP BY 1
    ), month_display AS (
     SELECT to_char(m.month,'YYYY-MM') AS month,COALESCE(c.quantity,0) AS quantity
     FROM generate_series(date_trunc('month',CURRENT_DATE::timestamp)-INTERVAL '5 months',date_trunc('month',CURRENT_DATE::timestamp),INTERVAL '1 month') AS m(month)
     LEFT JOIN month_counts c ON c.month=m.month::date
    ), stats AS (
    SELECT e.status,COUNT(*)::text AS quantity,
     COUNT(*) FILTER(WHERE e.current_assignment AND e.status IN('ACTIVE','PROBATION')
      AND e.hire_date>=date_trunc('month',CURRENT_DATE::timestamp)::date AND e.hire_date<=CURRENT_DATE)::text AS new_joiners,
     COUNT(*) FILTER(WHERE $3::boolean AND e.current_assignment AND e.status IN('ACTIVE','PROBATION')
      AND EXISTS(SELECT 1 FROM hr_attendance_day d
       JOIN hr_shift_policy sp ON sp.id=d.policy_id AND sp.root_realm_id=d.root_realm_id AND sp.branch_ref=e.branch_ref
       JOIN hr_leave_request lr ON lr.id=d.leave_request_id AND lr.root_realm_id=d.root_realm_id AND lr.employee_id=e.id AND lr.status='APPROVED'
       WHERE d.root_realm_id=e.root_realm_id AND d.employee_id=e.id AND d.leave_half_days>0
        AND d.local_date=(CURRENT_TIMESTAMP AT TIME ZONE sp.time_zone)::date))::text AS on_leave,
     COUNT(*) FILTER(WHERE $3::boolean AND e.current_assignment AND e.status IN('ACTIVE','PROBATION')
      AND EXISTS(SELECT 1 FROM hr_leave_request lr JOIN hr_employment_assignment a
       ON a.id=lr.assignment_id AND a.root_realm_id=lr.root_realm_id AND a.employee_id=lr.employee_id
       WHERE lr.root_realm_id=e.root_realm_id AND lr.employee_id=e.id AND a.branch_ref=e.branch_ref
        AND lr.status='SUBMITTED'))::text AS pending_leave
    FROM scoped e GROUP BY e.status
    ) SELECT stats.*,
     (SELECT COALESCE(jsonb_agg(jsonb_build_object('label',label,'count',quantity) ORDER BY rank),'[]'::jsonb) FROM dept_display) AS departments,
     (SELECT COALESCE(jsonb_agg(jsonb_build_object('month',month,'count',quantity) ORDER BY month),'[]'::jsonb) FROM month_display) AS joiners
    FROM stats`,
    [actor.realmId,actor.accountId,attendanceVisible]);
   const statuses=["ACTIVE","PROBATION","PENDING_ACCESS","ON_HOLD","EXITED"] as const;
   const counts=Object.fromEntries(statuses.map(k=>[k,0])) as Record<typeof statuses[number],number>;
   let newJoinersThisMonth=0,onApprovedLeaveToday=0,employeesWithPendingLeave=0;
   for(const row of r.rows){
    if(row.status in counts)counts[row.status as keyof typeof counts]=Number(row.quantity);
    newJoinersThisMonth+=Number(row.new_joiners);onApprovedLeaveToday+=Number(row.on_leave);
    employeesWithPendingLeave+=Number(row.pending_leave);
   }
   await tx.query("COMMIT");
   return {total:Object.values(counts).reduce((x,y)=>x+y,0),statuses:counts,newJoinersThisMonth,
    attendance:attendanceVisible?{onApprovedLeaveToday,employeesWithPendingLeave}:null,
    departments:r.rows[0]?.departments??[],joiners:r.rows[0]?.joiners??[]};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }

 async employeeDirectory(token:string,offsetInput:unknown,branchInput?:unknown,
  statusInput?:unknown,queryInput?:unknown,departmentInput?:unknown){
  const actor=await this.sessions.requireAction(token,"hr.employees.view");
  const offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)
   throw new BadRequestException("Check the staff directory page");
  const branch=branchInput===undefined?null:uuid(branchInput,"branch");
  const department=departmentInput===undefined?null:uuid(departmentInput,"department");
  const status=statusInput===undefined?"ALL":statusInput;
  if(typeof status!=="string"||!["ALL","ACTIVE","PROBATION","ON_HOLD","PENDING_ACCESS","EXITED"].includes(status))
   throw new BadRequestException("Choose an employee status filter");
  if(queryInput!==undefined&&(typeof queryInput!=="string"||queryInput.length>80||
    /[\u0000-\u001f\u007f]/.test(queryInput)))
   throw new BadRequestException("Check the staff directory search");
  const query=typeof queryInput==="string"?queryInput.trim().toLowerCase():"";
  const pattern=query?"%"+query.replace(/[\\%_]/g,"\\$&")+"%":"";
  const q=await this.db.query<{employee_code:string;legal_name:string;
    designation:string;status:string;branch_name:string;employment_type:string;
    department_name:string|null;manager_name:string|null;hire_date:string}>(
   "SELECT e.employee_code,a.legal_name,asg.designation,e.status,to_char(a.hire_date,'YYYY-MM-DD') AS hire_date,"+
   "b.name AS branch_name,asg.employment_type,d.name AS department_name,"+
   "manager_app.legal_name AS manager_name FROM hr_employee e "+
   "JOIN hr_employee_application a ON a.id=e.application_id "+
   "AND a.root_realm_id=e.root_realm_id "+
   "JOIN LATERAL (SELECT original.* FROM hr_employment_assignment original "+
   "WHERE original.employee_id=e.id AND original.root_realm_id=e.root_realm_id "+
   "ORDER BY CASE WHEN original.valid_from<=CURRENT_DATE AND "+
   "(original.valid_to IS NULL OR original.valid_to>CURRENT_DATE) "+
   "THEN 0 ELSE 1 END, original.valid_from DESC,original.id DESC LIMIT 1) asg ON true "+
   "JOIN branch b ON b.id=asg.branch_ref AND b.root_realm_id=asg.root_realm_id "+
   "LEFT JOIN department d ON d.id=asg.department_ref AND d.root_realm_id=e.root_realm_id "+
   "LEFT JOIN hr_employee manager ON manager.id=asg.manager_employee_ref "+
   "AND manager.root_realm_id=e.root_realm_id "+
   "LEFT JOIN hr_employee_application manager_app ON manager_app.id=manager.application_id "+
   "AND manager_app.root_realm_id=e.root_realm_id "+
   "WHERE e.root_realm_id=$1 AND ($3::uuid IS NULL OR b.id=$3) "+
   "AND ($5::text='ALL' OR e.status=$5) "+
   "AND ($6::text='' OR lower(a.legal_name) LIKE $6 ESCAPE '\\' OR "+
   "lower(asg.designation) LIKE $6 ESCAPE '\\' OR lower(e.employee_code) LIKE $6 ESCAPE '\\') "+
   "AND ($7::uuid IS NULL OR asg.department_ref=$7) "+
   "AND (b.manager_account_ref=$2 OR EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL))) "+
   "ORDER BY a.legal_name,e.id LIMIT 26 OFFSET $4",
   [actor.realmId,actor.accountId,branch,offset,status,pattern,department]);
  return {items:q.rows.slice(0,25).map(x=>({
   reference:x.employee_code,name:x.legal_name,
   designation:x.designation,branch:x.branch_name,
   department:x.department_name,manager:x.manager_name,
   employmentType:x.employment_type,status:x.status,hireDate:x.hire_date
  })),hasMore:q.rows.length>25,offset};
 }

}
