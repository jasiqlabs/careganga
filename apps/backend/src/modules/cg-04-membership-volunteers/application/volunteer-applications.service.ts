import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {object,uuid} from "../domain/tier-input";
import {parseVolunteerCancel,parseVolunteerDraft} from "../domain/volunteer-application-input";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const changed=()=>new ConflictException("This volunteer application changed. Refresh the original draft before continuing.");
const projection=`v.id AS ref,v.application_ref AS "applicationNumber",v.status,v.version,
 v.first_name AS "firstName",v.last_name AS "lastName",v.date_of_birth::text AS "dateOfBirth",v.gender,v.blood_group AS "bloodGroup",
 v.contact_mobile AS mobile,v.contact_email AS email,v.address_text AS address,v.city,v.village,v.pin_code AS "pinCode",
 v.state_ref AS "stateRef",s.display_name AS state,v.district_ref AS "districtRef",d.display_name AS district,
 v.branch_ref AS "branchRef",b.name AS branch,v.department_ref AS "departmentRef",dept.name AS department,
 v.skills,v.availability,v.experience,v.referral_input AS referral,v.consent_version AS "consentVersion",
 v.submitted_at AS "submittedAt",v.updated_at AS "updatedAt",
 review.case_number AS "reviewReference",review.status AS "reviewStatus",review.remarks AS "reviewRemarks"`;
const joins=` FROM volunteer_application v
 JOIN geography_area s ON s.id=v.state_ref AND s.root_realm_id=v.root_realm_id
 JOIN geography_area d ON d.id=v.district_ref AND d.root_realm_id=v.root_realm_id
 JOIN department dept ON dept.id=v.department_ref AND dept.root_realm_id=v.root_realm_id
 LEFT JOIN branch b ON b.id=v.branch_ref AND b.root_realm_id=v.root_realm_id
 LEFT JOIN LATERAL(
  SELECT c.case_number,c.status,(SELECT decision.safe_remarks FROM cg03_case_decision decision
   WHERE decision.realm_id=c.realm_id AND decision.case_id=c.id
   ORDER BY decision.accepted_case_revision DESC LIMIT 1) AS remarks
  FROM cg03_case c WHERE c.realm_id=v.root_realm_id AND c.case_kind='VOLUNTEER_APPLICATION'
   AND c.volunteer_application_id=v.id ORDER BY c.volunteer_application_version DESC LIMIT 1
 ) review ON true`;
@Injectable()
export class VolunteerApplicationsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,fn:(tx:PoolClient,a:Actor,contact:{name:string;mobile:string;email:string|null})=>Promise<T>,read=false){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const contact=await this.identity.verifiedCommunityApplicant(tx,a);
   const result=await fn(tx,a,contact);await tx.query("COMMIT");return result;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="23505")throw new ConflictException("A volunteer draft or command already exists. Open your current application.");
    if(["40001","40P01","55P03","23503","23514","P0001"].includes(String(e.code)))throw changed();
   }throw e;
  }finally{tx.release();}
 }
 private async lock(tx:PoolClient,a:Actor){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:VOLUNTEER:"+a.realmId+":"+a.accountId]);
 }
 private async self(tx:PoolClient,a:Actor,id:string,forUpdate=false){
  const record=(await tx.query(
   "SELECT "+projection+joins+" WHERE v.root_realm_id=$1 AND v.applicant_account_ref=$2 AND v.id=$3"+(forUpdate?" FOR UPDATE OF v":""),
   [a.realmId,a.accountId,id])).rows[0];
  if(!record)throw new NotFoundException("Your original volunteer application is unavailable.");
  return record;
 }
 private async replay(tx:PoolClient,a:Actor,key:string,digest:string,action:string,target:string|null){
  const row=(await tx.query<{actor_ref:string;application_id:string;payload_digest:string;action:string}>(
   "SELECT actor_ref,application_id,payload_digest,action FROM volunteer_application_command WHERE root_realm_id=$1 AND request_key=$2",
   [a.realmId,key])).rows[0];
  if(!row)return null;
  if(row.actor_ref!==a.accountId||row.payload_digest!==digest||row.action!==action||
   (target!==null&&row.application_id!==target))throw changed();
  return {record:await this.self(tx,a,row.application_id),replayed:true};
 }
 private async audit(tx:PoolClient,a:Actor,id:string,version:number,key:string,digest:string,action:string){
  await tx.query(`INSERT INTO volunteer_application_command
   (root_realm_id,request_key,application_id,result_version,actor_ref,action,payload_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7)`,[a.realmId,key,id,version,a.accountId,action,digest]);
 }
 private async eligibleDepartment(tx:PoolClient,a:Actor,department:string,branch:string|null){
  const verified=await tx.query(`SELECT 1 FROM department d
   WHERE d.root_realm_id=$1 AND d.id=$2 AND d.active AND d.kind='DEPARTMENT'
   AND ((d.scope_kind='FOUNDATION' AND ($3::uuid IS NULL OR EXISTS(
     SELECT 1 FROM branch_department_link l WHERE l.root_realm_id=d.root_realm_id
     AND l.branch_id=$3 AND l.foundation_department_id=d.id AND l.ended_at IS NULL)))
    OR (d.scope_kind='BRANCH' AND d.branch_id=$3))
   FOR SHARE OF d`,[a.realmId,department,branch]);
  if(!verified.rowCount)throw new BadRequestException("Select an eligible current volunteer department.");
 }
 async options(token:string,raw:unknown){
  const opts=object(raw,["stateRef","branchRef"]);
  const state=opts.stateRef===undefined||opts.stateRef===""?null:uuid(opts.stateRef);
  const branch=opts.branchRef===undefined||opts.branchRef===""?null:uuid(opts.branchRef);
  return this.run(token,async(tx,a,contact)=>{
   await this.branches.membershipApplicantBranch(tx,a,branch);
   const [branches,states,districts,depts]=await Promise.all([
    this.branches.membershipApplicantBranches(tx,a),
    this.branches.projectGeographyOptions(tx,a,null),
    state?this.branches.projectGeographyOptions(tx,a,state):Promise.resolve([]),
    tx.query<{value:string;label:string}>(`SELECT d.id AS value,d.name AS label FROM department d
     WHERE d.root_realm_id=$1 AND d.active AND d.kind='DEPARTMENT'
      AND ((d.scope_kind='FOUNDATION' AND ($2::uuid IS NULL OR EXISTS(
        SELECT 1 FROM branch_department_link link WHERE link.root_realm_id=d.root_realm_id
        AND link.branch_id=$2 AND link.foundation_department_id=d.id AND link.ended_at IS NULL)))
      OR (d.scope_kind='BRANCH' AND d.branch_id=$2))
     ORDER BY d.name,d.id LIMIT 200`,[a.realmId,branch])
   ]);
   return {contact,branches,states,districts,departments:depts.rows,
    availabilities:["FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const};
  },true);
 }
 async list(token:string){
  return this.run(token,async(tx,a)=>({items:(await tx.query(
   "SELECT "+projection+joins+" WHERE v.root_realm_id=$1 AND v.applicant_account_ref=$2 ORDER BY v.created_at DESC,v.id DESC LIMIT 20",
   [a.realmId,a.accountId])).rows}),true);
 }
 async detail(token:string,ref:string){
  const id=uuid(ref);
  return this.run(token,(tx,a)=>this.self(tx,a,id),true);
 }
 async save(token:string,raw:unknown,target?:string){
  const ref=target===undefined?null:uuid(target);
  const d=parseVolunteerDraft(raw,ref!==null),action=ref?"EDIT":"CREATE",digest=hash([ref,d]);
  return this.run(token,async(tx,a,contact)=>{
   await this.lock(tx,a);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG04:VOLUNTEER_PHONE:"+a.realmId+":"+contact.mobile]);
   const old=await this.replay(tx,a,d.key,digest,action,ref);if(old)return old;
   if(ref){
    const current=await this.self(tx,a,ref,true);
    if(current.version!==d.expected||!["DRAFT","RETURNED"].includes(current.status))throw changed();
   }
   await this.branches.membershipApplicantBranch(tx,a,d.branch);
   await this.branches.projectGeography(tx,a,d.state,d.district);
   await this.eligibleDepartment(tx,a,d.department,d.branch);
   const values=[d.first,d.last,d.dob,d.gender,d.blood,contact.mobile,contact.email,
    d.address,d.city,d.village,d.pin,d.state,d.district,d.branch,d.department,d.availability,
    JSON.stringify(d.skills),d.experience,d.referral,d.consentVersion];
   const row=ref?(await tx.query<{id:string;version:number}>(`UPDATE volunteer_application SET first_name=$4,last_name=$5,date_of_birth=$6,gender=$7,blood_group=$8,
    contact_mobile=$9,contact_email=$10,address_text=$11,city=$12,village=$13,pin_code=$14,state_ref=$15,district_ref=$16,
    branch_ref=$17,department_ref=$18,availability=$19,skills=$20::jsonb,experience=$21,referral_input=$22,consent_version=$23,consented_at=now(),
    status='DRAFT',version=version+1,submitted_at=NULL,submitted_digest=NULL,updated_at=now()
    WHERE root_realm_id=$1 AND applicant_account_ref=$2 AND id=$3 AND status IN('DRAFT','RETURNED') AND version=$24 RETURNING id,version`,
    [a.realmId,a.accountId,ref,...values,d.expected])).rows[0]:
    (await tx.query<{id:string;version:number}>(`INSERT INTO volunteer_application(root_realm_id,applicant_account_ref,first_name,last_name,date_of_birth,gender,
    blood_group,contact_mobile,contact_email,address_text,city,village,pin_code,state_ref,district_ref,branch_ref,department_ref,
    availability,skills,experience,referral_input,consent_version,status,version)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22,'DRAFT',1) RETURNING id,version`,
    [a.realmId,a.accountId,...values])).rows[0];
   if(!row)throw changed();
   // A staff-intake candidate can be linked ONLY after this independently verified,
   // actual CG01 self-registration with explicit VOLUNTEER_V1 consent. Never auto-approve.
   await tx.query(`UPDATE volunteer_staff_intake_draft SET linked_application_id=$3,linked_at=now()
    WHERE root_realm_id=$1 AND contact_mobile=$2 AND linked_application_id IS NULL AND expires_at>now()`,
    [a.realmId,contact.mobile,row.id]);
   await this.audit(tx,a,row.id,row.version,d.key,digest,action);
   return {record:await this.self(tx,a,row.id),replayed:false};
  });
 }
 async cancel(token:string,ref:string,raw:unknown){
  const id=uuid(ref),d=parseVolunteerCancel(raw),digest=hash([id,d]);
  return this.run(token,async(tx,a)=>{
   await this.lock(tx,a);const old=await this.replay(tx,a,d.key,digest,"CANCEL",id);if(old)return old;
   const current=await this.self(tx,a,id,true);
   if(current.version!==d.expected||!["DRAFT","RETURNED"].includes(current.status))throw changed();
   const row=(await tx.query<{version:number}>(`UPDATE volunteer_application SET status='CANCELLED',version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND applicant_account_ref=$2 AND id=$3 AND version=$4 AND status IN('DRAFT','RETURNED') RETURNING version`,
    [a.realmId,a.accountId,id,d.expected])).rows[0];
   if(!row)throw changed();
   await this.audit(tx,a,id,row.version,d.key,digest,"CANCEL");
   return {record:await this.self(tx,a,id),replayed:false};
  });
 }
}
