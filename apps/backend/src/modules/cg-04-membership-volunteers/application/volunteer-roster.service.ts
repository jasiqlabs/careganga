import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {object,pick,plain,uuid} from "../domain/tier-input";
import {requireCurrentVolunteer} from "./current-volunteer-source";
import {rosterCsvCell} from "../domain/roster-csv-cell";
import {parseVolunteerStaffIntake} from "../domain/volunteer-staff-intake-input";
const states=["ALL","ACTIVE","INACTIVE","SUSPENDED"] as const;
const windows=["ALL","FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const;
type Filter={q:string;status:string;availability:string;branch:string|null;department:string|null};
type Row={ref:string;volunteerNumber:string;name:string;mobile:string;email:string|null;branch:string|null;department:string;availability:string;
 joinedOn:string;status:string;city:string;district:string;skills:string[]};
function parse(raw:unknown):Filter{
 const x=object(raw,["q","status","availability","branch","department"]);
 return {q:plain(x.q??"",0,100,"search").toLowerCase(),
  status:pick(x.status??"ALL",states,"volunteer status"),
  availability:pick(x.availability??"ALL",windows,"availability"),
  branch:x.branch?uuid(x.branch):null,department:x.department?uuid(x.department):null};
}
@Injectable()
export class VolunteerRosterService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,capability:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,read=true){
  const a=await this.sessions.requireAction(token,capability),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,a,capability);
   const value=await fn(tx,a);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async listRows(tx:PoolClient,a:Actor,filter:Filter,max:number,offset:number){
  const scope=await this.branches.projectBranchScope(tx,a),branches=scope.branches.map(x=>x.value);
  if(filter.branch&&!scope.all&&!branches.includes(filter.branch))
   throw new ForbiddenException("The selected volunteer branch is outside your permitted scope.");
  const rows=await tx.query<Row>(`SELECT v.id AS ref,v.volunteer_no AS "volunteerNumber",v.display_name AS name,
    applicant.contact_phone AS mobile,applicant.normalized_email AS email,b.name AS branch,
    d.name AS department,v.availability,v.status,v.skills,
    (v.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS "joinedOn",
    app.city,area.display_name AS district
   FROM volunteer v
   JOIN volunteer_application app ON app.root_realm_id=v.root_realm_id AND app.id=v.original_application_id
   JOIN geography_area area ON area.root_realm_id=app.root_realm_id AND area.id=app.district_ref
   JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref
   JOIN account applicant ON applicant.realm_id=v.root_realm_id AND applicant.id=v.account_ref
   LEFT JOIN branch b ON b.root_realm_id=v.root_realm_id AND b.id=v.branch_ref
   WHERE v.root_realm_id=$1 AND ($2::boolean OR v.branch_ref=ANY($3::uuid[]))
    AND ($4::uuid IS NULL OR v.branch_ref=$4)
    AND ($5::uuid IS NULL OR v.department_ref=$5)
    AND ($6='ALL' OR v.status=$6)
    AND ($7='ALL' OR v.availability=$7)
    AND ($8='' OR strpos(lower(v.volunteer_no),$8)>0 OR strpos(lower(v.display_name),$8)>0
      OR strpos(lower(applicant.contact_phone),$8)>0 OR strpos(lower(coalesce(applicant.normalized_email,'')),$8)>0)
   ORDER BY v.created_at DESC,v.id DESC LIMIT $9 OFFSET $10`,
   [a.realmId,scope.all,branches,filter.branch,filter.department,filter.status,filter.availability,filter.q,max,offset]);
  return {items:rows.rows,branchOptions:scope.branches};
 }
 private async overview(tx:PoolClient,a:Actor){
   const scope=await this.branches.projectBranchScope(tx,a);
   const overview=(await tx.query<{total:string;active:string;inactive:string;suspended:string}>(`SELECT count(*)::text AS total,
     count(*) FILTER(WHERE status='ACTIVE')::text AS active,
     count(*) FILTER(WHERE status='INACTIVE')::text AS inactive,
     count(*) FILTER(WHERE status='SUSPENDED')::text AS suspended
     FROM volunteer WHERE root_realm_id=$1 AND ($2::boolean OR branch_ref=ANY($3::uuid[]))`,
     [a.realmId,scope.all,scope.branches.map(x=>x.value)])).rows[0];
   return {total:Number(overview?.total??0),active:Number(overview?.active??0),inactive:Number(overview?.inactive??0),suspended:Number(overview?.suspended??0)};
 }
 async misOptions(token:string){
  return this.run(token,"volunteers.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   return {branches:scope.branches.map(({value,label})=>({ref:value,name:label}))};
  });
 }
 /** Approved enrollment and consent, current actor scope, no private roster fields. */
 async misCounts(token:string,branch?:string,from?:string,to?:string){
  const f=parse({branch});
  const date=(v?:string)=>{
   if(v===undefined)return null;
   const d=new Date(v+"T00:00:00Z");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw new BadRequestException("Choose a valid enrollment date.");
   return v;
  };
  const start=date(from),end=date(to);
  if(Boolean(start)!==Boolean(end)||start&&end&&(start>end||Date.parse(end)-Date.parse(start)>366*86400000))throw new BadRequestException("Choose a bounded enrollment date range.");
  return this.run(token,"volunteers.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   if(f.branch)await this.branches.projectBranch(tx,a,f.branch);
   const row=(await tx.query<{total:number;active:number;inactive:number;suspended:number}>(`
    SELECT count(*)::int total,count(*) FILTER(WHERE v.status='ACTIVE')::int active,
     count(*) FILTER(WHERE v.status='INACTIVE')::int inactive,count(*) FILTER(WHERE v.status='SUSPENDED')::int suspended
    FROM volunteer v JOIN volunteer_application app ON app.root_realm_id=v.root_realm_id AND app.id=v.original_application_id
     AND app.applicant_account_ref=v.account_ref AND app.status='APPROVED'
     AND app.consent_version='VOLUNTEER_V1' AND app.consented_at IS NOT NULL
    WHERE v.root_realm_id=$1 AND (($2::boolean AND v.branch_ref IS NULL) OR v.branch_ref=ANY($3::uuid[]))
     AND ($4::uuid IS NULL OR v.branch_ref=$4)
     AND ($5::date IS NULL OR v.created_at>=($5::date::timestamp AT TIME ZONE 'Asia/Kolkata'))
     AND ($6::date IS NULL OR v.created_at<(($6::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))`,
    [a.realmId,scope.all,scope.branches.map(x=>x.value),f.branch,start,end])).rows[0];
   if(!row)throw Error("Volunteer summary unavailable");
   return {...row,sourceAsOf:(await tx.query<{at:Date}>("SELECT transaction_timestamp() AS at")).rows[0].at.toISOString()};
  });
 }
 async list(token:string,raw:unknown){
  const x=object(raw,["q","status","availability","branch","department","offset"]);
  const filter=parse(Object.fromEntries(Object.entries(x).filter(([k])=>k!=="offset")));
  const offset=x.offset===undefined?0:Number(x.offset);
  if(!Number.isSafeInteger(offset)||offset<0||offset>5000)throw new BadRequestException("Choose a valid volunteer roster page.");
  return this.run(token,"volunteers.view",async(tx,a)=>{
   const page=await this.listRows(tx,a,filter,26,offset);
   const overview=await this.overview(tx,a);
   return {items:page.items.slice(0,25),hasMore:page.items.length>25,offset,
    branchOptions:page.branchOptions,overview
   };
  });
 }
 /** Original U14 staff intake is never a verified application or volunteer master. */
 private async intakeAuthority(tx:PoolClient,a:Actor){
  await this.identity.assertCurrent(tx,a,"volunteers.view");
  if(!(await tx.query("SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",[a.realmId])).rowCount)
   throw new ForbiddenException("Only current Foundation authority may intake volunteer drafts.");
 }
 private async knownIntakeContacts(tx:PoolClient,realm:string,contacts:string[]){
  const found=await tx.query<{contact_mobile:string}>(`SELECT contact_mobile FROM volunteer_staff_intake_draft
    WHERE root_realm_id=$1 AND contact_mobile=ANY($2::text[])
    UNION SELECT contact_mobile FROM volunteer_application
    WHERE root_realm_id=$1 AND contact_mobile=ANY($2::text[])`,[realm,contacts]);
  return new Set(found.rows.map(r=>r.contact_mobile));
 }
 async previewImport(token:string,raw:unknown){
  const rows=parseVolunteerStaffIntake(raw);
  return this.run(token,"volunteers.applications.review",async(tx,a)=>{
   await this.intakeAuthority(tx,a);
   const known=await this.knownIntakeContacts(tx,a.realmId,rows.map(r=>r.mobile));
   return {rows:rows.map(r=>({...r,alreadyImported:known.has(r.mobile)})),
    rowCount:rows.length,newCount:rows.length-known.size,alreadyImported:known.size,
    message:"Preview only. Candidates are unverified and cannot receive approval, a role or a card."};
  });
 }
 async importDrafts(token:string,raw:unknown){
  const rows=parseVolunteerStaffIntake(raw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BadRequestException("Check original import request.");
  const requestKey=uuid((raw as Record<string,unknown>).requestKey);
  const digest=createHash("sha256").update(JSON.stringify(["CG04_STAFF_DRAFT_V1",rows])).digest("hex");
  return this.run(token,"volunteers.applications.review",async(tx,a)=>{
   await this.intakeAuthority(tx,a);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:STAFF_INTAKE:"+a.realmId]);
   // Serialize same-contact self-registration versus staff import; sort to prevent deadlock.
   for(const mobile of rows.map(r=>r.mobile).sort())await tx.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:VOLUNTEER_PHONE:"+a.realmId+":"+mobile]);
   const prior=(await tx.query<{payload_digest:string;row_count:number;imported_count:number}>(
    "SELECT payload_digest,row_count,imported_count FROM volunteer_staff_import_batch WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
    [a.realmId,a.accountId,requestKey])).rows[0];
   if(prior){
    if(prior.payload_digest!==digest)throw new ConflictException("The original import request was used for different candidates. Refresh first.");
    return {confirmed:true,replayed:true,rowCount:prior.row_count,importedCount:prior.imported_count,skippedCount:prior.row_count-prior.imported_count};
   }
   // A previously consented application is never replaced by an unverified staff draft.
   // Reclaim expired unlinked intake contacts only; immutable batch history is retained.
   await tx.query(`DELETE FROM volunteer_staff_intake_draft WHERE root_realm_id=$1
    AND linked_application_id IS NULL AND expires_at<=now()`,[a.realmId]);
   const known=await this.knownIntakeContacts(tx,a.realmId,rows.map(r=>r.mobile));
   const fresh=rows.filter(r=>!known.has(r.mobile));
   const batch=(await tx.query<{id:string}>(`INSERT INTO volunteer_staff_import_batch
    (root_realm_id,actor_ref,request_key,payload_digest,row_count,imported_count)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [a.realmId,a.accountId,requestKey,digest,rows.length,fresh.length])).rows[0];
   for(const candidate of fresh)await tx.query(`INSERT INTO volunteer_staff_intake_draft
    (root_realm_id,batch_id,first_name,last_name,contact_mobile,city)
    VALUES($1,$2,$3,$4,$5,$6)`,[a.realmId,batch.id,candidate.firstName,candidate.lastName,candidate.mobile,candidate.city]);
   return {confirmed:true,replayed:false,rowCount:rows.length,importedCount:fresh.length,skippedCount:rows.length-fresh.length};
  },false);
 }
 async intakeDrafts(token:string){
  return this.run(token,"volunteers.applications.review",async(tx,a)=>{
   await this.intakeAuthority(tx,a);
   const rows=(await tx.query<{ref:string;firstName:string;lastName:string;mobile:string;city:string;createdAt:Date}>(`
    SELECT id AS ref,first_name AS "firstName",last_name AS "lastName",
     contact_mobile AS mobile,city,created_at AS "createdAt"
    FROM volunteer_staff_intake_draft
    WHERE root_realm_id=$1 AND linked_application_id IS NULL AND expires_at>now()
    ORDER BY created_at DESC,id DESC LIMIT 100`,[a.realmId])).rows;
   return {items:rows,status:"UNVERIFIED_DRAFT",hasMore:rows.length===100};
  });
 }
 async reimbursementOptions(token:string,ref:string){
  const volunteerRef=uuid(ref);
  return this.run(token,"finance.claims.create",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"volunteers.view");
   const scope=await this.branches.projectBranchScope(tx,a);
   const candidate=(await tx.query<{branch_ref:string|null}>(
    "SELECT branch_ref FROM volunteer WHERE root_realm_id=$1 AND id=$2",
    [a.realmId,volunteerRef])).rows[0];
   if(!candidate||candidate.branch_ref&&!scope.all&&!scope.branches.some(b=>b.value===candidate.branch_ref))
    throw new ForbiddenException("Volunteer reimbursement source unavailable for your Foundation scope.");
   const volunteer=await requireCurrentVolunteer(tx,a.realmId,volunteerRef,candidate.branch_ref);
   const projects=(await tx.query<{value:string;label:string}>(`SELECT id AS value,title AS label FROM project
    WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid
     AND status NOT IN('COMPLETED','CANCELLED') ORDER BY title,id LIMIT 100`,
    [a.realmId,volunteer.branch_ref])).rows;
   return {volunteerName:volunteer.display_name,projects};
  });
 }
 async export(token:string,raw:unknown){
  const filter=parse(raw);
  await this.sessions.requireAction(token,"volunteers.view");
  return this.run(token,"volunteers.export",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"volunteers.view");
   const page=await this.listRows(tx,a,filter,501,0);
   if(page.items.length>500)throw new BadRequestException("Narrow the volunteer filters before exporting more than 500 records.");
   const header=["Volunteer number","Name","Mobile","Email","Branch","Department","Availability","Status","Joined","City","District"];
   const rows=page.items.map(row=>[row.volunteerNumber,row.name,row.mobile,row.email,row.branch,row.department,row.availability,row.status,row.joinedOn,row.city,row.district].map(rosterCsvCell).join(","));
   const digest=createHash("sha256").update(JSON.stringify([a.realmId,a.accountId,filter])).digest("hex");
   await tx.query("INSERT INTO volunteer_roster_export_audit(root_realm_id,actor_ref,exported_rows,scope_digest) VALUES($1,$2,$3,$4)",
    [a.realmId,a.accountId,page.items.length,digest]);
   return {csv:[header.map(rosterCsvCell).join(","),...rows].join("\r\n"),rows:page.items.length};
  },false);
 }
}
