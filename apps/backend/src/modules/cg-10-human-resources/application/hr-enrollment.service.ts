import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TYPES=["FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"] as const;
type Fields={name:string;designation:string;employmentType:string;branchRef:string;
 departmentRef:string|null;hireDate:string;accountRef:string|null};
type Command=Fields&{requestKey:string;expectedRevision?:number};
type Row={id:string;application_no:string;legal_name:string;designation:string;
 employment_type:string;proposed_branch_ref:string;department_ref:string|null;
 applicant_account_ref:string|null;hire_date:Date|string;state:string;revision_no:number;
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
  "employmentType","branchRef","departmentRef","hireDate","accountRef"].includes(k)))
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
  accountRef:optional(x.accountRef,"existing account"),hireDate:x.hireDate,
  ...(update?{expectedRevision:Number(x.expectedRevision)}:{})};
}
const iso=(v:Date|string)=>typeof v==="string"?v.slice(0,10):v.toISOString().slice(0,10);
const view=(x:Row)=>({applicationRef:x.id,reference:x.application_no,name:x.legal_name,
 designation:x.designation,employmentType:x.employment_type,
 branchRef:x.proposed_branch_ref,departmentRef:x.department_ref,
 accountRef:x.applicant_account_ref,hireDate:iso(x.hire_date),
 status:x.state,revision:Number(x.revision_no)});

@Injectable()
export class HrEnrollmentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService){}
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
  if(x.departmentRef){
   const department=await tx.query(
    "SELECT 1 FROM department WHERE id=$1 AND root_realm_id=$2 AND active "+
    "AND (branch_id=$3 OR branch_id IS NULL) FOR SHARE",
    [x.departmentRef,a.realmId,x.branchRef]);
   if(!department.rowCount)throw new BadRequestException("Select an available department");
  }
  if(x.accountRef){
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
  const q=await this.db.query<{id:string;name:string}>(
   "SELECT b.id,b.name FROM branch b WHERE b.root_realm_id=$1 AND b.status='ACTIVE' "+
   "AND (b.manager_account_ref=$2 OR EXISTS("+
   "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL))) "+
   "ORDER BY b.name,b.id LIMIT 101",[a.realmId,a.accountId]);
  if(q.rows.length>100)throw new ConflictException("Contact your administrator to narrow branch access");
  return {items:q.rows.map(b=>({branchRef:b.id,label:b.name}))};
 }
 async departmentOptions(token:string,branchInput:string){
  const a=await this.actor(token,"hr.applications.view");
  const ref=uuid(branchInput,"branch"),tx=await this.db.connect();
  try{
   await this.branch(tx,a,ref);
   const q=await tx.query<{id:string;name:string}>(
    "SELECT id,name FROM department WHERE root_realm_id=$1 AND active "+
    "AND (branch_id=$2 OR branch_id IS NULL) ORDER BY name,id LIMIT 101",
    [a.realmId,ref]);
   if(q.rows.length>100)throw new ConflictException("Ask your administrator to narrow departments");
   return {items:q.rows.map(d=>({departmentRef:d.id,label:d.name}))};
  }finally{tx.release();}
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
     "applicant_account_ref,created_by,updated_by) VALUES($1,$2,$3,"+
     "'CG-HR-APP-'||lpad(nextval('hr_application_public_sequence')::text,6,'0'),"+
     "$4,$5,$6,$7,$8,$9,$10,$11,$11) "+
     "ON CONFLICT (root_realm_id,request_key) DO NOTHING RETURNING *",
     [a.realmId,x.requestKey,digest,x.name,x.designation,x.employmentType,x.branchRef,
      x.departmentRef,x.hireDate,x.accountRef,a.accountId]);
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
     "updated_by=$10,updated_at=now(),state='DRAFT',revision_no=revision_no+1 "+
     "WHERE id=$1 AND root_realm_id=$2 RETURNING *",
     [ref,a.realmId,x.name,x.designation,x.employmentType,x.branchRef,
      x.departmentRef,x.hireDate,x.accountRef,a.accountId]);
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
   "JOIN hr_employment_assignment asg ON asg.employee_id=e.id "+
   "AND asg.root_realm_id=e.root_realm_id AND asg.valid_from<=CURRENT_DATE "+
   "AND (asg.valid_to IS NULL OR asg.valid_to>CURRENT_DATE) "+
   "JOIN branch b ON b.id=asg.branch_ref AND b.root_realm_id=asg.root_realm_id "+
   "WHERE e.root_realm_id=$1 AND e.account_ref=$2 "+
   "AND e.status IN('ACTIVE','PROBATION','ON_HOLD') "+
   "ORDER BY asg.valid_from DESC LIMIT 1",[a.realmId,a.accountId]);
  const row=q.rows[0];
  if(!row)return {status:"NOT_LINKED",message:"No approved employee profile is linked to your account."};
  return {status:row.status,employeeReference:row.employee_code,name:row.legal_name,
    designation:row.designation,branch:row.branch_name,
    employmentType:row.employment_type,effectiveFrom:iso(row.valid_from)};
 }
}
