import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const validDay=(v:unknown)=>typeof v==="string"&&(v===""||
 DAY.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&
 new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v);
const STATE=new Set(["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION",
 "COMPLETED","NO_SHOW","CANCELLED"]);
type Summary={patients:string;active_patients:string;bookings:string;
 today_bookings:string;completed:string;pending:string};
type BookingRow={id:string;booking_display_id:string;virtual_display_id:string;
 first_name:string;last_name:string;profile_status:string;
 consent_granted:boolean|null;doctor_name:string;center_name:string;
 center_id:string;booking_state:string;revision:number;start_at:Date;time_zone:string;created_at:Date;
 collection_state:string;fee_minor:string};
@Injectable()
export class PatientAdminOverviewService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly centers:HealthCenterSupportScopeFacade){}

 /** A request to print H15 data must be a fresh, exact selected-source
  * authorization, not an unscoped report/export or public bearer URL.
  * CG19 still exclusively owns private PDF/document releases.
  */
 async authorizePrint(bearer:string,rawRef:string,body:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!ID.test(rawRef)||!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const v=body as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["expectedVersion","purpose"].includes(k))||
   v.purpose!=="BOOKING_HISTORY"||!Number.isSafeInteger(v.expectedVersion)||
   Number(v.expectedVersion)<1||Number(v.expectedVersion)>2147483645)
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   const row=await c.query<{booking_display_id:string;revision:number}>(
    "SELECT booking_display_id,revision FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,rawRef]);
   if(!row.rows[0])throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   if(row.rows[0].revision!==v.expectedVersion)
    throw new ConflictException({code:"CG15_PATIENT_CHANGED"});
   // No personal health fields, phone, payment or clinical notes in audit.
   await c.query(
    "INSERT INTO access_audit(realm_id,actor_account_id,action_key,"+
    "outcome,safe_context,correlation_ref) "+
    "VALUES($1,$2,'health.patients.booking-report.print','SUCCESS',$3::jsonb,$4)",
    [actor.realmId,actor.accountId,JSON.stringify({
     source:"CG15",purpose:"BOOKING_HISTORY",
     bookingRef:rawRef,version:row.rows[0].revision}),randomUUID()]);
   await c.query("COMMIT");started=false;
   return {authorized:true,bookingId:row.rows[0].booking_display_id,
    bookingVersion:row.rows[0].revision,scope:"ONE_BOOKING",
    message:"Protected source version verified. Only this booking and the loaded original history may be printed."};
  }catch(e){if(started)await c.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{c.release();}
 }

 /** Original CG-15 Foundation MIS filter catalogue. No patient row,
  * medical detail, contact or center DB key is exposed as a metric.
  * CG-14 alone authorizes currently eligible center choices.
  */
 async readMisOptions(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  await this.sessions.requireAction(bearer,"foundation.branches.admin");
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query("SET LOCAL statement_timeout='8s'");
   const eligible=await this.centers.eligibleFoundationCenters(
    tx,actor,"health.patients.admin.view");
   await tx.query("COMMIT");open=false;
   return eligible;
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
 }

 /** Current authenticated Foundation-only status aggregate. Center/date/status
  * filters are applied inside original CG-15 SQL, after CG-14 and current
  * identity verification. No patient row or clinically identifying group.
  */
 async readMisTotals(bearer:string,filters:{
  centerRef?:string;fromDay?:string;untilDay?:string;status?:string}={}){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  await this.sessions.requireAction(bearer,"foundation.branches.admin");
  const center=filters.centerRef??"",from=filters.fromDay??"",
   until=filters.untilDay??"",status=filters.status??"";
  const fromMillis=from?Date.parse(from+"T00:00:00Z"):0,
   untilMillis=until?Date.parse(until+"T00:00:00Z"):0;
  if(center!==""&&!ID.test(center)||!validDay(from)||!validDay(until)||
     Boolean(from)!==Boolean(until)||
     from!==""&&(from>until||untilMillis-fromMillis>366*86400000)||
     status!==""&&!STATE.has(status))
   throw new BadRequestException({code:"CG15_MIS_FILTER_INVALID",
    message:"Choose a permitted center, valid date range and appointment status."});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");open=true;
   await tx.query("SET LOCAL statement_timeout='8s'");
   if(center)await this.centers.assertFoundationCenter(
    tx,actor,center,"health.patients.admin.view",true);
   const cutoff=await tx.query<{asOf:Date}>(
    'SELECT transaction_timestamp() AS "asOf"');
   const q=await tx.query<{
    bookings:string;completed:string;waiting:string;cancelled:string
   }>(
    "SELECT count(*)::text AS bookings,"+
    "count(*) FILTER (WHERE booking_state='COMPLETED')::text AS completed,"+
    "count(*) FILTER (WHERE booking_state IN('CONFIRMED','ARRIVED','WAITING',"+
    "'IN_CONSULTATION'))::text AS waiting,"+
    "count(*) FILTER (WHERE booking_state='CANCELLED')::text AS cancelled "+
    "FROM cg15_consultation_appointment a WHERE a.root_realm_id=$1 "+
    "AND ($2::uuid IS NULL OR a.center_id=$2) "+
    "AND ($3::date IS NULL OR (a.start_at AT TIME ZONE a.time_zone)::date >= $3) "+
    "AND ($4::date IS NULL OR (a.start_at AT TIME ZONE a.time_zone)::date <= $4) "+
    "AND ($5::text='' OR a.booking_state=$5)",
    [actor.realmId,center||null,from||null,until||null,status]);
   await tx.query("COMMIT");open=false;
   return {...(q.rows[0]??{bookings:"0",completed:"0",waiting:"0",cancelled:"0"}),
    sourceAsOf:cutoff.rows[0].asOf.toISOString(),
    sourceCutoffKind:"POSTGRES_READ_SNAPSHOT" as const};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
 }
 /** H15 restricted review queue, bounded and rooted; never a public patient
  * search or an authorization to read source clinical files.
  */
 async duplicateReviews(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  const result=await this.db.query<{
   id:string;status:string;revision:number;created_at:Date;
   source_display:string;canonical_display:string;
   proposed_by:string;decided_by:string|null;decision_at:Date|null}>(
   "SELECT d.id,d.status,d.revision,d.created_at,"+
   "source.virtual_display_id AS source_display,"+
   "canonical.virtual_display_id AS canonical_display,"+
   "d.proposed_by_account AS proposed_by,d.decided_by_account AS decided_by,"+
   "d.decision_at FROM cg15_patient_duplicate_review d "+
   "JOIN cg15_patient source ON source.root_realm_id=d.root_realm_id "+
   "AND source.id=d.source_patient_id "+
   "JOIN cg15_patient canonical ON canonical.root_realm_id=d.root_realm_id "+
   "AND canonical.id=d.canonical_patient_id "+
   "WHERE d.root_realm_id=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT 30",
   [actor.realmId]);
  return {items:result.rows.map(r=>({
   reviewRef:r.id,status:r.status,version:r.revision,
   sourceVirtualPatientId:r.source_display,
   canonicalVirtualPatientId:r.canonical_display,
   proposedByCurrentAccount:r.proposed_by===actor.accountId,
   decidedByCurrentAccount:r.decided_by===actor.accountId,
   proposedAt:r.created_at.toISOString(),
   decidedAt:r.decision_at?.toISOString()??null
  })),limit:30,
   message:"Only a protected independent reviewer may approve same-person identity evidence. No private appointments or files are merged into another account."};
 }
 /** Narrow source evidence for an independent restricted reviewer.
  * No documents, raw identity proof, mobile, medical history or CG19 files.
  */
 async duplicateReviewEvidence(bearer:string,rawReview:string){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!ID.test(rawReview))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const rows=await this.db.query<{
   source_patient_id:string;canonical_patient_id:string;status:string;
   proposed_by_account:string;patient_id:string;virtual_display_id:string;
   first_name:string;last_name:string;birth_date:string|null;
   profile_status:string;verified_at:Date|null;verified_center:string|null
  }>(
   "SELECT r.source_patient_id,r.canonical_patient_id,r.status,"+
   "r.proposed_by_account,p.id AS patient_id,p.virtual_display_id,"+
   "p.first_name,p.last_name,p.date_of_birth::text AS birth_date,"+
   "p.profile_status,v.created_at AS verified_at,"+
   "c.display_name AS verified_center "+
   "FROM cg15_patient_duplicate_review r "+
   "JOIN cg15_patient p ON p.root_realm_id=r.root_realm_id "+
   "AND p.id IN(r.source_patient_id,r.canonical_patient_id) "+
   "LEFT JOIN cg15_patient_identity_event v "+
   "ON v.root_realm_id=p.root_realm_id AND v.patient_id=p.id "+
   "LEFT JOIN health_center c "+
   "ON c.root_realm_id=v.root_realm_id AND c.id=v.center_id "+
   "WHERE r.root_realm_id=$1 AND r.id=$2 ORDER BY p.id",
   [actor.realmId,rawReview]);
  if(rows.rows.length!==2)
   throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
  const primary=rows.rows[0];
  if(primary.proposed_by_account===actor.accountId||
   primary.status!=="PENDING")
   throw new ConflictException({code:"CG15_PATIENT_REVIEW_REQUIRES_INDEPENDENT_ACTOR"});
  const snapshot=(id:string)=>{
   const p=rows.rows.find(x=>x.patient_id===id)!;
   return {virtualPatientId:p.virtual_display_id,
    firstName:p.first_name,lastName:p.last_name,dateOfBirth:p.birth_date,
    profileStatus:p.profile_status,identityCheckedInPerson:!!p.verified_at,
    verificationRecordedAt:p.verified_at?.toISOString()??null,
    originalVerificationCenter:p.verified_center};
  };
  return {source:snapshot(primary.source_patient_id),
   proposedCanonical:snapshot(primary.canonical_patient_id),
   purpose:"INDEPENDENT_SAME_PERSON_IDENTITY_REVIEW_ONLY",
   message:"Compare both originals against independently verified identity evidence before deciding. Names, dates and contact numbers alone never prove a duplicate. No clinical record access is granted."};
 }
 async proposeDuplicate(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!input||typeof input!=="object"||Array.isArray(input))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const v=input as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","sourceVirtualPatientId",
   "canonicalVirtualPatientId","possibleDuplicateConfirmed"].includes(k))||
   typeof v.requestKey!=="string"||!ID.test(v.requestKey)||
   typeof v.sourceVirtualPatientId!=="string"||
   typeof v.canonicalVirtualPatientId!=="string"||
   !/^CGP-[A-F0-9]{16}$/.test(v.sourceVirtualPatientId)||
   !/^CGP-[A-F0-9]{16}$/.test(v.canonicalVirtualPatientId)||
   v.sourceVirtualPatientId===v.canonicalVirtualPatientId||
   v.possibleDuplicateConfirmed!==true)
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const key=v.requestKey;
  const digest=createHash("sha256").update(JSON.stringify([
   v.sourceVirtualPatientId,v.canonicalVirtualPatientId,
   "POSSIBLE_SAME_PERSON_REVIEW_ONLY"])).digest("hex");
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const people=await tx.query<{id:string;virtual_display_id:string;profile_status:string}>(
    "SELECT id,virtual_display_id,profile_status FROM cg15_patient "+
    "WHERE root_realm_id=$1 AND virtual_display_id IN($2,$3) "+
    "ORDER BY id FOR SHARE",
    [actor.realmId,v.sourceVirtualPatientId,v.canonicalVirtualPatientId]);
   const source=people.rows.find(p=>p.virtual_display_id===v.sourceVirtualPatientId);
   const canonical=people.rows.find(p=>p.virtual_display_id===v.canonicalVirtualPatientId);
   if(!source||!canonical||["ARCHIVED","RESTRICTED"].includes(source.profile_status)||
    ["ARCHIVED","RESTRICTED"].includes(canonical.profile_status))
    throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   // An already-reviewed alias can never become a new source/target chain.
   const alias=await tx.query(
    "SELECT 1 FROM cg15_patient_reviewed_alias "+
    "WHERE root_realm_id=$1 AND (source_patient_id IN($2,$3) "+
    "OR canonical_patient_id=$2) LIMIT 1",
    [actor.realmId,source.id,canonical.id]);
   if(alias.rowCount)
    throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_ALREADY_REVIEWED"});
   await tx.query(
    "INSERT INTO cg15_patient_duplicate_review(root_realm_id,"+
    "source_patient_id,canonical_patient_id,proposed_by_account,"+
    "request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6) "+
    "ON CONFLICT(root_realm_id,proposed_by_account,request_key) DO NOTHING",
    [actor.realmId,source.id,canonical.id,actor.accountId,key,digest]);
   const review=await tx.query<{id:string;request_digest:string;status:string;revision:number}>(
    "SELECT id,request_digest,status,revision FROM cg15_patient_duplicate_review "+
    "WHERE root_realm_id=$1 AND proposed_by_account=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,key]);
   if(!review.rows[0]||review.rows[0].request_digest!==digest)
    throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_ALREADY_REVIEWED"});
   await tx.query("COMMIT");open=false;
   return {reviewRef:review.rows[0].id,status:review.rows[0].status,
    version:review.rows[0].revision,message:"Possible duplicate submitted for an independent Foundation identity review. No patient records or access rights changed."};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_ALREADY_REVIEWED"});
   throw e;
  }finally{tx.release();}
 }
 /** Approval is an audited non-destructive administrative identity alias.
  * Never re-key old appointments/documents or transfer clinical ACLs.
  */
 async decideDuplicate(bearer:string,reviewRaw:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!ID.test(reviewRaw)||!input||typeof input!=="object"||Array.isArray(input))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const v=input as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["decision","expectedVersion","currentPassword",
   "samePersonEvidenceReviewed"].includes(k))||
   !["APPROVE","REJECT"].includes(String(v.decision))||
   v.expectedVersion!==1||typeof v.currentPassword!=="string"||
   v.currentPassword.length<8||v.currentPassword.length>1024||
   (v.decision==="APPROVE"&&v.samePersonEvidenceReviewed!==true))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await this.sessions.requireFreshFoundationRootProof(tx,actor,v.currentPassword);
   const review=await tx.query<{
    id:string;source_patient_id:string;canonical_patient_id:string;
    proposed_by_account:string;status:string;revision:number;
    decided_by_account:string|null}>(
    "SELECT id,source_patient_id,canonical_patient_id,proposed_by_account,"+
    "status,revision,decided_by_account FROM cg15_patient_duplicate_review "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,reviewRaw]);
   const source=review.rows[0];
   if(!source)throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   if(source.proposed_by_account===actor.accountId)
    throw new ConflictException({code:"CG15_PATIENT_REVIEW_REQUIRES_INDEPENDENT_ACTOR"});
   const targetStatus=v.decision==="APPROVE"?"APPROVED":"REJECTED";
   if(source.status!=="PENDING"||source.revision!==1)
    throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_REVIEW_CHANGED"});
   if(targetStatus==="APPROVED"){
    const people=await tx.query<{id:string;profile_status:string;proven:boolean}>(
     "SELECT p.id,p.profile_status,EXISTS("+
     "SELECT 1 FROM cg15_patient_identity_event proof "+
     "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) AS proven "+
     "FROM cg15_patient p WHERE p.root_realm_id=$1 AND p.id IN($2,$3) "+
     "ORDER BY p.id FOR SHARE",
     [actor.realmId,source.source_patient_id,source.canonical_patient_id]);
    if(people.rows.length!==2||people.rows.some(p=>
     p.profile_status!=="VERIFIED"||p.proven!==true))
     throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
    const chains=await tx.query(
     "SELECT 1 FROM cg15_patient_reviewed_alias "+
     "WHERE root_realm_id=$1 AND (source_patient_id IN($2,$3) "+
     "OR canonical_patient_id=$2) LIMIT 1",
     [actor.realmId,source.source_patient_id,source.canonical_patient_id]);
    if(chains.rowCount)
     throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_ALREADY_REVIEWED"});
   }
   await tx.query(
    "UPDATE cg15_patient_duplicate_review SET status=$3,revision=2,"+
    "decided_by_account=$4,decision_at=now(),decision_basis=$5 "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING' AND revision=1",
    [actor.realmId,source.id,targetStatus,actor.accountId,
     targetStatus==="APPROVED"?"SAME_PERSON_EVIDENCE_REVIEWED":"IDENTITY_NOT_ESTABLISHED"]);
   if(targetStatus==="APPROVED")
    await tx.query(
     "INSERT INTO cg15_patient_reviewed_alias(root_realm_id,"+
     "source_patient_id,canonical_patient_id,review_id,approved_by_account) "+
     "VALUES($1,$2,$3,$4,$5)",
     [actor.realmId,source.source_patient_id,
      source.canonical_patient_id,source.id,actor.accountId]);
   await tx.query(
    "INSERT INTO access_audit(realm_id,actor_account_id,action_key,outcome,"+
    "safe_context,correlation_ref) VALUES($1,$2,$3,'SUCCESS',$4::jsonb,$5)",
    [actor.realmId,actor.accountId,"health.patients.duplicate-review."+
     targetStatus.toLowerCase(),JSON.stringify({reviewRef:source.id,
      status:targetStatus,source:"CG15",preservedOriginalRecords:true}),randomUUID()]);
   await tx.query("COMMIT");open=false;
   return {status:targetStatus,reviewRef:source.id,version:2,
    message:targetStatus==="APPROVED"?
     "Verified same-person administrative alias recorded. Original bookings, files, patient IDs, consents and account permissions remain unchanged.":
     "Possible duplicate rejected. All original patient records remain unchanged."};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG15_PATIENT_DUPLICATE_ALREADY_REVIEWED"});
   throw e;
  }finally{tx.release();}
 }
 async bookingHistory(bearer:string,rawRef:string,beforeRaw?:string){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!ID.test(rawRef)||beforeRaw!==undefined&&
    (!/^\d{1,9}$/.test(beforeRaw)||Number(beforeRaw)<1))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const before=beforeRaw===undefined?null:Number(beforeRaw);
  const appointment=await this.db.query<{booking_display_id:string}>(
   "SELECT booking_display_id FROM cg15_consultation_appointment "+
   "WHERE root_realm_id=$1 AND id=$2",
   [actor.realmId,rawRef]);
  if(!appointment.rows[0])
   return {bookingId:null,items:[],next:null};
  type EventRow={new_revision:number;action:string;occurred_at:Date;
   actor_name:string;prior_snapshot:Record<string,unknown>|null;
   new_snapshot:Record<string,unknown>};
  const events=await this.db.query<EventRow>(
   "SELECT e.new_revision,e.action,e.occurred_at,a.display_name AS actor_name,"+
   "e.prior_snapshot,e.new_snapshot FROM cg15_appointment_event e "+
   "JOIN account a ON a.id=e.actor_account_id AND a.realm_id=e.root_realm_id "+
   "WHERE e.root_realm_id=$1 AND e.appointment_id=$2 "+
   "AND ($3::integer IS NULL OR e.new_revision<$3) "+
   "ORDER BY e.new_revision DESC LIMIT 31",
   [actor.realmId,rawRef,before]);
  const items=events.rows.slice(0,30);
  const pick=(raw:Record<string,unknown>|null)=>{
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
   const field=(name:string)=>typeof raw[name]==="string"&&
    (raw[name] as string).length<=220?raw[name] as string:null;
   const amount=field("feeMinor");
   return {status:field("status"),startAt:field("startAt"),endAt:field("endAt"),
    centerName:field("centerName"),reason:field("reason"),
    consultationFeeMinor:amount&&/^\d{1,11}$/.test(amount)?amount:null};
  };
  return {bookingId:appointment.rows[0].booking_display_id,
   items:items.map(e=>({action:e.action,revision:e.new_revision,
    when:e.occurred_at.toISOString(),by:e.actor_name,
    before:pick(e.prior_snapshot),after:pick(e.new_snapshot)})),
   next:events.rows.length>30?items.at(-1)!.new_revision:null};
 }
 /** Minimal original H15 admin-only view. Never expose CG15 internal IDs as
  * visible labels, medical content, patient files, or center B staff records.
  * This nonassignable capability is reserved to protected Foundation root.
  */
 async overview(bearer:string,query:Record<string,unknown>){
  const actor=await this.sessions.requireAction(bearer,"health.patients.admin.view");
  if(!query||typeof query!=="object"||Array.isArray(query)||
   Object.keys(query).some(k=>!["centerRef","status","after","limit","day","stateRef","districtRef","centerType","search","centerSearch","fromDay","untilDay"].includes(k)))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const center=query.centerRef===undefined?"":query.centerRef;
  const status=query.status===undefined?"":query.status;
  const after=query.after===undefined?"":query.after;
  const limit=query.limit===undefined?20:Number(query.limit);
  const day=query.day===undefined?"":query.day;
  const fromDay=query.fromDay===undefined?"":query.fromDay;
  const untilDay=query.untilDay===undefined?"":query.untilDay;
  const state=query.stateRef===undefined?"":query.stateRef;
  const district=query.districtRef===undefined?"":query.districtRef;
  const centerType=query.centerType===undefined?"":query.centerType;
  const search=query.search===undefined?"":query.search;
  const centerSearch=query.centerSearch===undefined?"":query.centerSearch;
  if(typeof center!=="string"||center!==""&&!ID.test(center)||
   typeof status!=="string"||status!==""&&!STATE.has(status)||
   typeof after!=="string"||after!==""&&!ID.test(after)||
   typeof state!=="string"||state!==""&&!ID.test(state)||
   typeof district!=="string"||district!==""&&!ID.test(district)||
   typeof search!=="string"||search.length>80||
   typeof centerSearch!=="string"||centerSearch.length>60||
   /[\u0000-\u001f\u007f<>]/.test(centerSearch)||
   search!==""&&(search.trim().length<2||/[\u0000-\u001f\u007f<>]/.test(search))||
   typeof centerType!=="string"||centerType.length>40||
   centerType!==""&&!/^[A-Z_]+$/.test(centerType)||
   !Number.isSafeInteger(limit)||limit<1||limit>50||
   !validDay(day)||!validDay(fromDay)||!validDay(untilDay)||
   (typeof fromDay==="string"&&typeof untilDay==="string"&&
    fromDay!==""&&untilDay!==""&&fromDay>untilDay))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN READ ONLY");
   const totals=await tx.query<Summary>(
    "SELECT "+
    "(SELECT count(*) FROM cg15_patient WHERE root_realm_id=$1) AS patients,"+
    "(SELECT count(*) FROM cg15_patient WHERE root_realm_id=$1 "+
    "AND profile_status IN('PROVISIONAL','VERIFIED')) AS active_patients,"+
    "count(*) AS bookings,"+
    "count(*) FILTER (WHERE (start_at AT TIME ZONE time_zone)::date="+
    "(now() AT TIME ZONE time_zone)::date) AS today_bookings,"+
    "count(*) FILTER (WHERE booking_state='COMPLETED') AS completed,"+
    "count(*) FILTER (WHERE booking_state IN('CONFIRMED','ARRIVED','WAITING',"+
    "'IN_CONSULTATION')) AS pending "+
    "FROM cg15_consultation_appointment WHERE root_realm_id=$1",
    [actor.realmId]);
   const rows=await tx.query<BookingRow>(
    "SELECT a.id,a.booking_display_id,p.virtual_display_id,p.first_name,p.last_name,"+
    "p.profile_status,consent.granted AS consent_granted,"+
    "a.doctor_name,a.center_name,a.center_id,a.booking_state,a.revision,a.start_at,a.time_zone,"+
    "a.created_at,a.collection_state,a.fee_minor::text "+
    "FROM cg15_consultation_appointment a "+
    "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id AND p.id=a.patient_id "+
    "JOIN health_center location ON location.root_realm_id=a.root_realm_id "+
    "AND location.id=a.center_id "+
    "LEFT JOIN LATERAL (SELECT pc.granted FROM cg15_patient_consent pc "+
    "WHERE pc.root_realm_id=p.root_realm_id AND pc.patient_id=p.id "+
    "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1) consent ON true "+
    "WHERE a.root_realm_id=$1 "+
    "AND ($2::uuid IS NULL OR a.center_id=$2) "+
    "AND ($3::text='' OR a.booking_state=$3) "+
    "AND ($4::uuid IS NULL OR a.id<$4) "+
    "AND ($6::date IS NULL OR (a.start_at AT TIME ZONE a.time_zone)::date=$6::date) "+
    "AND ($7::uuid IS NULL OR location.state_ref=$7) "+
    "AND ($8::uuid IS NULL OR location.district_ref=$8) "+
    "AND ($9::text='' OR location.center_type=$9) "+
    "AND ($10::text='' OR position(lower($10::text) in "+
    "lower(p.first_name||' '||p.last_name))>0 "+
    "OR position(lower($10::text) in lower(p.virtual_display_id))>0 "+
    "OR position(lower($10::text) in lower(a.booking_display_id))>0) "+
    "AND ($11::date IS NULL OR "+
    "(a.start_at AT TIME ZONE a.time_zone)::date >= $11::date) "+
    "AND ($12::date IS NULL OR "+
    "(a.start_at AT TIME ZONE a.time_zone)::date <= $12::date) "+
    "ORDER BY a.id DESC LIMIT $5",
    [actor.realmId,center||null,status,after||null,limit+1,day||null,state||null,district||null,centerType,search.trim(),fromDay||null,untilDay||null]);
   // Geography is a bounded set of current source categories, independent
   // of the first N centers. Filter large center pickers on the server.
   const regions=await tx.query<{
    state_ref:string;state_name:string;district_ref:string;district_name:string;center_type:string
   }>(
    "SELECT DISTINCT c.state_ref,st.display_name AS state_name,"+
    "c.district_ref,di.display_name AS district_name,c.center_type "+
    "FROM health_center c "+
    "JOIN geography_area st ON st.root_realm_id=c.root_realm_id AND st.id=c.state_ref "+
    "JOIN geography_area di ON di.root_realm_id=c.root_realm_id AND di.id=c.district_ref "+
    "WHERE c.root_realm_id=$1 AND EXISTS("+
    "SELECT 1 FROM cg15_consultation_appointment a "+
    "WHERE a.root_realm_id=c.root_realm_id AND a.center_id=c.id) "+
    "ORDER BY st.display_name,c.state_ref,di.display_name,c.district_ref,c.center_type LIMIT 2001",
    [actor.realmId]);
   const choices=await tx.query<{
    center_id:string;center_name:string;center_type:string;
    state_ref:string;district_ref:string
   }>(
    "SELECT c.id AS center_id,c.display_name AS center_name,c.center_type,"+
    "c.state_ref,c.district_ref FROM health_center c "+
    "WHERE c.root_realm_id=$1 AND EXISTS("+
    "SELECT 1 FROM cg15_consultation_appointment a "+
    "WHERE a.root_realm_id=c.root_realm_id AND a.center_id=c.id) "+
    "AND ($2::uuid IS NULL OR c.state_ref=$2) "+
    "AND ($3::uuid IS NULL OR c.district_ref=$3) "+
    "AND ($4::text='' OR c.center_type=$4) "+
    "AND ($5::text='' OR position(lower($5::text) in lower(c.display_name))>0) "+
    "ORDER BY c.display_name,c.id LIMIT 101",
    [actor.realmId,state||null,district||null,centerType,centerSearch.trim()]);
   await tx.query("COMMIT");
   const item=rows.rows.slice(0,limit);
   const c=totals.rows[0];
   const geographyComplete=regions.rows.length<=2000;
   const centerChoicesComplete=choices.rows.length<=100;
   const validOptions=choices.rows.slice(0,100);
   const validRegions=geographyComplete?regions.rows:[];
   const regionMap=new Map(validRegions.map(x=>
    [x.state_ref,{stateRef:x.state_ref,stateName:x.state_name}]));
   const districtMap=new Map(validRegions.map(x=>
    [x.district_ref,{districtRef:x.district_ref,districtName:x.district_name,
     stateRef:x.state_ref}]));
   const facilityTypes=[...new Set(validRegions.map(x=>x.center_type))].sort();
   return {metrics:{
    totalPatients:Number(c.patients),activePatients:Number(c.active_patients),
    totalBookings:Number(c.bookings),todayBookings:Number(c.today_bookings),
    completed:Number(c.completed),pending:Number(c.pending)
   },centerChoices:validOptions.map(x=>({
    centerRef:x.center_id,centerName:x.center_name,
    stateRef:x.state_ref,districtRef:x.district_ref,centerType:x.center_type
   })),states:[...regionMap.values()].sort((a,b)=>a.stateName.localeCompare(b.stateName)),
   districts:[...districtMap.values()].sort((a,b)=>a.districtName.localeCompare(b.districtName)),
   centerTypes:facilityTypes,geographyComplete,centerChoicesComplete,items:item.map(x=>({
    bookingRef:x.id,bookingId:x.booking_display_id,
    virtualPatientId:x.virtual_display_id,
    patientName:x.first_name+" "+x.last_name,
    patientProfileStatus:x.profile_status,patientConsentGranted:x.consent_granted,
    doctorName:x.doctor_name,centerName:x.center_name,
    bookingStatus:x.booking_state,bookingVersion:x.revision,
    startAt:x.start_at.toISOString(),timeZone:x.time_zone,createdAt:x.created_at.toISOString(),
    collectionStatus:x.collection_state,consultationFeeMinor:x.fee_minor
   })),next:rows.rows.length>limit?item.at(-1)!.id:null};
  }catch(e){await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
 }
}
