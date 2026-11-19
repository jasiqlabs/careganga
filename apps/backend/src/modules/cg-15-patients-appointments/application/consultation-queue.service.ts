import {
 BadRequestException,ConflictException,HttpException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthClinicianIdentityService}
 from "../../cg-14-healthcare-network/application/health-clinician-identity.service";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d\d-\d\d$/;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Visit={id:string;appointment_id:string;center_id:string;queue_local_date:string;
 queue_sequence:number;queue_token:string;state:string;revision:number;
 checked_in_at:Date;updated_at:Date};
type Appointment={id:string;booking_display_id:string;patient_id:string;center_id:string;
 doctor_id:string;start_at:Date;end_at:Date;time_zone:string;booking_state:string;
 revision:number;fee_minor:string};
function param(x:unknown){
 if(typeof x!=="string"||!ID.test(x))
  throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
 return x;
}
function input(raw:unknown,keys:string[]){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
 const o=raw as Record<string,unknown>;
 if(Object.keys(o).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
 return o;
}
function number(v:unknown){
 if(!Number.isSafeInteger(v)||Number(v)<1||Number(v)>2147483645)
  throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
 return Number(v);
}
/** Original center timezone for serialized daily queue token; list filtering is done in SQL. */
function localDay(utc:Date,zone:string){
 let format:Intl.DateTimeFormat;
 try{format=new Intl.DateTimeFormat("en-CA",{timeZone:zone,
  day:"2-digit",month:"2-digit",year:"numeric"});}
 catch{throw new ConflictException({code:"CG15_QUEUE_INVALID"});}
 const obj=Object.fromEntries(format.formatToParts(utc).map(x=>[x.type,x.value]));
 return obj.year+"-"+obj.month+"-"+obj.day;
}
function result(visit:Visit){return {
 visitRef:visit.id,queueToken:visit.queue_token,
 queueDate:visit.queue_local_date,visitStatus:visit.state,
 version:visit.revision,checkedInAt:visit.checked_in_at.toISOString()
};}
@Injectable()
export class ConsultationQueueService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly identity:SessionService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly clinicians:HealthClinicianIdentityService){}
 private async scope(tx:PoolClient,actor:VerifiedFoundationActor,center:string){
  await this.centers.assertCurrent(tx,actor,center,"health.visits.manage");
 }
 async options(bearer:string){
  const actor=await this.identity.requireAction(bearer,"health.visits.manage");
  const r=await this.db.query<{center_ref:string;center_name:string;time_zone:string}>(
   "SELECT DISTINCT c.id AS center_ref,c.display_name AS center_name,c.time_zone "+
   "FROM health_center_account_affiliation a "+
   "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
   "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
   "WHERE a.root_realm_id=$1 AND a.account_ref=$2 AND a.status='ACTIVE' "+
   "AND p.status='VERIFIED' AND c.status='VERIFIED' "+
   "AND c.access_state='ENABLED' ORDER BY c.display_name,c.id LIMIT 40",
   [actor.realmId,actor.accountId]);
  // Role alone is not a doctor identity. Expose only the signed-in
  // clinician's currently accepted, approved doctor-center choices to
  // hide clinical buttons for unrelated appointments on both clients.
  const own=await this.db.query<{doctor_id:string;center_id:string}>(
   "SELECT DISTINCT l.doctor_id,assoc.center_id FROM health_doctor_account_link l "+
   "JOIN health_doctor d ON d.root_realm_id=l.root_realm_id "+
   "AND d.id=l.doctor_id AND d.status='VERIFIED' "+
   "JOIN health_doctor_center assoc ON assoc.root_realm_id=d.root_realm_id "+
   "AND assoc.doctor_id=d.id AND assoc.affiliation_state='APPROVED' "+
   "AND assoc.approved_from<=now() "+
   "AND (assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
   "JOIN health_center_account_affiliation a ON a.root_realm_id=l.root_realm_id "+
   "AND a.center_id=assoc.center_id AND a.account_ref=l.account_id "+
   "AND a.status='ACTIVE' "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 "+
   "AND l.status='ACTIVE' AND l.accepted_at IS NOT NULL LIMIT 40",
   [actor.realmId,actor.accountId]);
  return {centers:r.rows.map(row=>({centerRef:row.center_ref,centerName:row.center_name,timeZone:row.time_zone})),
   clinicianAssignments:own.rows.map(row=>({doctorRef:row.doctor_id,centerRef:row.center_id}))};
 }
 /** Aggregate-only daily attendance for the staff member's ACTUAL center.
  * Unlike page-level UI counts, this covers every recorded booking on the
  * original center-local day, without sending patient details.
  */
 /** Current assigned-center operational audit only: one real original booking,
  * bounded by immutable revision. No clinical notes, consent proof, phone,
  * medical file URLs, diagnostic source, or other-center patient exposure.
  */
 /**
  * Original clinician-only, purpose-limited patient consultation timeline.
  * No receptionist may call this endpoint. The read is anchored to a genuine
  * checked-in consultation with the actual signed-in verified doctor, and
  * returns only that doctor's prior operational visits at this SAME center.
  * No phone, diagnosis, note, unscanned file, or Center B consultation.
  */
 async clinicalHistory(bearer:string,centerRaw:string,bookingRaw:string,beforeRaw?:string){
  const actor=await this.identity.verifySession(bearer);
  const center=param(centerRaw),booking=param(bookingRaw);
  const cursor=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)_([a-f0-9-]{36})$/i;
  let at:string|null=null,prior:string|null=null;
  if(beforeRaw!==undefined){
   const m=cursor.exec(beforeRaw);
   if(!m||!ID.test(m[2])||!Number.isFinite(Date.parse(m[1]))||
     new Date(m[1]).toISOString()!==m[1])
    throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
   at=m[1];prior=m[2];
  }
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   // Both independent CG01 capabilities and a real current CG14 center
   // membership are revalidated inside this exact read transaction.
   await this.scope(tx,actor,center);
   await this.centers.assertCurrent(tx,actor,center,"health.visits.clinical.manage");
   const source=await tx.query<{patient_id:string;doctor_id:string}>(
    "SELECT a.patient_id,a.doctor_id FROM cg15_consultation_appointment a "+
    "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id "+
    "AND p.id=a.patient_id "+
    "JOIN cg15_visit_queue v ON v.root_realm_id=a.root_realm_id "+
    "AND v.appointment_id=a.id AND v.center_id=$2 "+
    "WHERE a.root_realm_id=$1 AND a.center_id=$2 AND a.id=$3 "+
    "AND p.profile_status='VERIFIED' "+
    "AND v.state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED') "+
    "FOR SHARE OF a,p,v",
    [actor.realmId,center,booking]);
   if(!source.rows[0])throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const src=source.rows[0];
   await this.clinicians.assertCurrentAppointmentClinician(
    tx,actor,center,src.doctor_id);
   const allowed=await tx.query(
    "SELECT 1 FROM cg15_patient_identity_event identity "+
    "WHERE identity.root_realm_id=$1 AND identity.patient_id=$2 "+
    "AND (SELECT c.granted FROM cg15_patient_consent c "+
    "WHERE c.root_realm_id=identity.root_realm_id "+
    "AND c.patient_id=identity.patient_id AND c.purpose='PATIENT_CARE' "+
    "ORDER BY c.revision_no DESC LIMIT 1)=true LIMIT 1",
    [actor.realmId,src.patient_id]);
   if(!allowed.rowCount)throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const visitRows=await tx.query<{id:string;booking_display_id:string;
    start_at:Date;booking_state:string}>(
    "SELECT a.id,a.booking_display_id,a.start_at,a.booking_state "+
    "FROM cg15_consultation_appointment a "+
    "WHERE a.root_realm_id=$1 AND a.center_id=$2 "+
    "AND a.patient_id=$3 AND a.doctor_id=$4 "+
    "AND (a.start_at,a.id)<=(SELECT start_at,id FROM "+
    "cg15_consultation_appointment WHERE root_realm_id=$1 AND id=$5) "+
    "AND ($6::timestamptz IS NULL OR "+
    "(a.start_at,a.id)<($6::timestamptz,$7::uuid)) "+
    "ORDER BY a.start_at DESC,a.id DESC LIMIT 26",
    [actor.realmId,center,src.patient_id,src.doctor_id,booking,at,prior]);
   const page=visitRows.rows.slice(0,25);
   await tx.query("COMMIT");open=false;
   return {appointmentRef:booking,items:page.map(x=>({
    bookingId:x.booking_display_id,consultationAt:x.start_at.toISOString(),
    status:x.booking_state})),next:visitRows.rows.length>25&&page.length?
    page[page.length-1].start_at.toISOString()+"_"+page[page.length-1].id:null};
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async bookingHistory(bearer:string,centerRaw:string,bookingRaw:string,beforeRaw?:string){
  const actor=await this.identity.verifySession(bearer),
   center=param(centerRaw),bookingRef=param(bookingRaw);
  if(beforeRaw!==undefined&&
   (!/^\d{1,9}$/.test(beforeRaw)||Number(beforeRaw)<1))
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  const before=beforeRaw===undefined?null:Number(beforeRaw);
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const original=await tx.query<{booking_display_id:string}>(
    "SELECT booking_display_id FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND id=$3",
    [actor.realmId,center,bookingRef]);
   if(!original.rows[0])
    throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const events=await tx.query<{new_revision:number;action:string;
    occurred_at:Date;display_name:string;prior_snapshot:unknown;new_snapshot:unknown}>(
    "SELECT e.new_revision,e.action,e.occurred_at,a.display_name,"+
    "e.prior_snapshot,e.new_snapshot FROM cg15_appointment_event e "+
    "JOIN account a ON a.id=e.actor_account_id AND a.realm_id=e.root_realm_id "+
    "WHERE e.root_realm_id=$1 AND e.appointment_id=$2 "+
    "AND ($3::integer IS NULL OR e.new_revision<$3) "+
    "ORDER BY e.new_revision DESC LIMIT 26",
    [actor.realmId,bookingRef,before]);
   await tx.query("COMMIT");active=false;
   const page=events.rows.slice(0,25);
   // Never return arbitrary original JSON (which may later contain clinical PII).
   const publicStatus=(value:unknown):string|null=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const status=(value as {status?:unknown}).status;
    return typeof status==="string"&&
     ["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION",
      "COMPLETED","NO_SHOW","CANCELLED"].includes(status)?status:null;
   };
   return {bookingId:original.rows[0].booking_display_id,
    events:page.map(e=>({revision:e.new_revision,action:e.action,
     when:e.occurred_at.toISOString(),by:e.display_name,
     beforeStatus:publicStatus(e.prior_snapshot),
     afterStatus:publicStatus(e.new_snapshot)})),
    next:events.rows.length>25?page.at(-1)!.new_revision:null};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async summary(bearer:string,centerRaw:string,dayRaw:unknown){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  if(typeof dayRaw!=="string"||!DAY.test(dayRaw)||
   !Number.isFinite(Date.parse(dayRaw+"T00:00:00Z"))||
   new Date(dayRaw+"T00:00:00Z").toISOString().slice(0,10)!==dayRaw)
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const counts=await tx.query<{booking_state:string;n:number}>(
    "SELECT booking_state,COUNT(*)::integer AS n "+
    "FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND center_id=$2 AND (start_at AT TIME ZONE time_zone)::date=$3::date "+
    "GROUP BY booking_state",
    [actor.realmId,center,dayRaw]);
   await tx.query("COMMIT");active=false;
   const states:Record<string,number>={CONFIRMED:0,ARRIVED:0,WAITING:0,
    IN_CONSULTATION:0,COMPLETED:0,NO_SHOW:0,CANCELLED:0};
   for(const r of counts.rows)if(Object.prototype.hasOwnProperty.call(states,r.booking_state))
    states[r.booking_state]=r.n;
   return {day:dayRaw,centerRef:center,total:Object.values(states).reduce((a,b)=>a+b,0),
    confirmed:states.CONFIRMED,arrived:states.ARRIVED,waiting:states.WAITING,
    inConsultation:states.IN_CONSULTATION,completed:states.COMPLETED,
    noShow:states.NO_SHOW,cancelled:states.CANCELLED};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async list(bearer:string,centerRaw:string,dayRaw:unknown,afterRaw?:string){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  if(typeof dayRaw!=="string"||!DAY.test(dayRaw)||
   !Number.isFinite(Date.parse(dayRaw+"T00:00:00Z"))||
   new Date(dayRaw+"T00:00:00Z").toISOString().slice(0,10)!==dayRaw)
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  let afterAt:string|null=null,afterId:string|null=null;
  if(afterRaw!==undefined&&afterRaw!==""){
   const parts=afterRaw.split("|");
   if(parts.length!==2||!ID.test(parts[1])||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(parts[0])||
    !Number.isFinite(Date.parse(parts[0]))||
    new Date(parts[0]).toISOString()!==parts[0])
    throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
   afterAt=parts[0];afterId=parts[1];
  }
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const r=await tx.query<{
    id:string;booking_display_id:string;doctor_id:string;doctor_name:string;booking_state:string;revision:number;
    start_at:Date;end_at:Date;time_zone:string;first_name:string|null;last_name:string|null;
    consent_granted:boolean;visit_id:string|null;queue_token:string|null;
    queue_state:string|null;visit_version:number|null
   }>(
    "SELECT a.id,a.booking_display_id,a.doctor_id,a.doctor_name,a.booking_state,a.revision,"+
    "a.start_at,a.end_at,a.time_zone,"+
    "CASE WHEN consent.granted IS TRUE THEN p.first_name ELSE NULL END AS first_name,"+
    "CASE WHEN consent.granted IS TRUE THEN p.last_name ELSE NULL END AS last_name,"+
    "COALESCE(consent.granted,false) AS consent_granted,"+
    "q.id AS visit_id,q.queue_token,q.state AS queue_state,q.revision AS visit_version "+
    "FROM cg15_consultation_appointment a "+
    "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id AND p.id=a.patient_id "+
    "LEFT JOIN cg15_visit_queue q ON q.root_realm_id=a.root_realm_id AND q.appointment_id=a.id "+
    "LEFT JOIN LATERAL (SELECT pc.granted FROM cg15_patient_consent pc "+
    "WHERE pc.root_realm_id=a.root_realm_id AND pc.patient_id=a.patient_id "+
    "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1) consent ON true "+
    "WHERE a.root_realm_id=$1 AND a.center_id=$2 AND "+
    "(a.start_at AT TIME ZONE a.time_zone)::date=$3::date "+
    "AND ($4::timestamptz IS NULL OR "+
    "(a.start_at,a.id)>($4::timestamptz,$5::uuid)) "+
    "ORDER BY a.start_at,a.id LIMIT 101",
    [actor.realmId,center,dayRaw,afterAt,afterId]);
   await tx.query("COMMIT");active=false;
   const page=r.rows.slice(0,100),last=page.at(-1);
   return {day:dayRaw,next:r.rows.length>100&&last?
    last.start_at.toISOString()+"|"+last.id:null,items:page
    .map(x=>({appointmentRef:x.id,bookingId:x.booking_display_id,
      doctorRef:x.doctor_id,doctorName:x.doctor_name,
      patientName:x.consent_granted?x.first_name+" "+x.last_name:"Patient consent withdrawn",
      consentGranted:x.consent_granted,
      startAt:x.start_at.toISOString(),endAt:x.end_at.toISOString(),
      timeZone:x.time_zone,bookingStatus:x.booking_state,bookingVersion:x.revision,
      visitRef:x.visit_id,queueToken:x.queue_token,visitStatus:x.queue_state,visitVersion:x.visit_version}))};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async verifySlipAtMyCenter(bearer:string,centerRaw:string,raw:unknown){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  const v=input(raw,["token"]);
  if(typeof v.token!=="string"||!/^CGV-[A-F0-9]{24}$/.test(v.token))
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  // The token is a random HMAC-backed status lookup, not identity or care consent.
  // Only a currently affiliated center receptionist may resolve a booking.
  const tokenHash=createHash("sha256").update(v.token).digest("hex");
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await this.scope(tx,actor,center);
   // Exact assigned-center staff only. Atomic fixed-window account budget is
   // serialized in PostgreSQL across all application instances, not process
   // memory. Invalid scans count too; never store the QR, digest or patient.
   const meter=await tx.query<{attempts:number}>(
    "INSERT INTO cg15_center_qr_verify_budget("+
    "root_realm_id,actor_account_id,center_id,window_started_at,attempts) "+
    "VALUES($1,$2,$3,now(),1) "+
    "ON CONFLICT(root_realm_id,actor_account_id,center_id) DO UPDATE SET "+
    "attempts=CASE WHEN cg15_center_qr_verify_budget.window_started_at "+
    "<=now()-interval '15 minutes' THEN 1 ELSE "+
    "LEAST(cg15_center_qr_verify_budget.attempts+1,2147483645) END,"+
    "limited_requests=CASE WHEN cg15_center_qr_verify_budget.window_started_at "+
    "<=now()-interval '15 minutes' THEN 0 ELSE "+
    "LEAST(cg15_center_qr_verify_budget.limited_requests+"+
    "CASE WHEN cg15_center_qr_verify_budget.attempts>=24 THEN 1 ELSE 0 END,"+
    "2147483645) END,"+
    "last_rejected_at=CASE WHEN cg15_center_qr_verify_budget.window_started_at "+
    "<=now()-interval '15 minutes' THEN NULL "+
    "WHEN cg15_center_qr_verify_budget.attempts>=24 THEN now() ELSE "+
    "cg15_center_qr_verify_budget.last_rejected_at END,"+
    "window_started_at=CASE WHEN cg15_center_qr_verify_budget.window_started_at "+
    "<=now()-interval '15 minutes' THEN now() ELSE "+
    "cg15_center_qr_verify_budget.window_started_at END "+
    "RETURNING attempts",
    [actor.realmId,actor.accountId,center]);
   if((meter.rows[0]?.attempts??25)>24){
    // Commit ONLY the abuse budget; no appointment lookup or patient access.
    await tx.query("COMMIT");open=false;
    throw new HttpException({code:"CG15_QUEUE_RATE_LIMIT"},429);
   }
   const r=await tx.query<{
    id:string;booking_display_id:string;patient_display_name:string;
    doctor_name:string;start_at:Date;end_at:Date;time_zone:string;
    booking_state:string;terms_revision:number
   }>(
    "SELECT a.id,a.booking_display_id,a.patient_display_name,"+
    "a.doctor_name,a.start_at,a.end_at,a.time_zone,a.booking_state,a.terms_revision "+
    "FROM cg19_consultation_slip d "+
    "JOIN cg15_consultation_appointment a "+
    "ON a.root_realm_id=d.root_realm_id AND a.id=d.appointment_id "+
    "WHERE d.root_realm_id=$1 AND a.center_id=$2 AND d.qr_digest=$3 "+
    "AND (SELECT pc.granted FROM cg15_patient_consent pc "+
    "WHERE pc.root_realm_id=a.root_realm_id AND pc.patient_id=a.patient_id "+
    "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1)=true "+
    "AND d.status='ISSUED' AND d.revoked_at IS NULL "+
    "AND d.source_revision=a.terms_revision "+
    "AND a.booking_state IN('CONFIRMED','ARRIVED','WAITING','IN_CONSULTATION') "+
    "AND a.start_at>now()-interval '12 hours' "+
    "AND a.end_at<now()+interval '30 days' LIMIT 1",
    [actor.realmId,center,tokenHash]);
   const item=r.rows[0];
   await tx.query(
    "INSERT INTO cg15_center_qr_verification_audit("+
    "root_realm_id,actor_account_id,center_id,outcome) VALUES($1,$2,$3,$4)",
    [actor.realmId,actor.accountId,center,item?"VALID":"DENIED"]);
   await tx.query("COMMIT");open=false;
   if(!item)return {valid:false};
   return {valid:true,bookingRef:item.id,bookingId:item.booking_display_id,
    patientName:item.patient_display_name,doctorName:item.doctor_name,
    bookingStatus:item.booking_state,startAt:item.start_at.toISOString(),
    timeZone:item.time_zone,
    canCheckIn:item.booking_state==="CONFIRMED"&&
      item.start_at.getTime()<=Date.now()+3*3600000&&
      item.end_at.getTime()>=Date.now()-12*3600000};
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async checkIn(bearer:string,centerRaw:string,raw:unknown){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  const v=input(raw,["appointmentRef","requestKey","expectedVersion"]);
  const appointmentId=param(v.appointmentRef),key=param(v.requestKey),
   expected=number(v.expectedVersion);
  const signature=digest({appointmentId,expected,action:"CHECKED_IN"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const ap=await tx.query<Appointment>(
    "SELECT * FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND id=$2 AND center_id=$3 FOR UPDATE",
    [actor.realmId,appointmentId,center]);
   const booking=ap.rows[0];
   if(!booking)throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const replay=await tx.query<{request_digest:string;visit_id:string}>(
    "SELECT request_digest,visit_id FROM cg15_visit_event "+
    "WHERE root_realm_id=$1 AND appointment_id=$2 AND request_key=$3",
    [actor.realmId,appointmentId,key]);
   if(replay.rows[0]){
    if(replay.rows[0].request_digest!==signature)
     throw new ConflictException({code:"CG15_QUEUE_REQUEST_CONFLICT"});
    const prev=await tx.query<Visit>(
     "SELECT * FROM cg15_visit_queue WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,replay.rows[0].visit_id]);
    await tx.query("COMMIT");active=false;return result(prev.rows[0]);
   }
   if(booking.revision!==expected||booking.booking_state!=="CONFIRMED")
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   if(booking.start_at.getTime()>Date.now()+3*3600000||
    booking.end_at.getTime()<Date.now()-12*3600000)
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   // Serialize current patient-care consent with the patient-owned change.
   // A withdrawn consent blocks new check-in without erasing lawful history.
   const patient=await tx.query(
    "SELECT id FROM cg15_patient WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,booking.patient_id]);
   if(!patient.rowCount)throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   const activeConsent=await tx.query<{granted:boolean}>(
    "SELECT granted FROM cg15_patient_consent WHERE root_realm_id=$1 "+
    "AND patient_id=$2 AND purpose='PATIENT_CARE' "+
    "ORDER BY revision_no DESC LIMIT 1",
    [actor.realmId,booking.patient_id]);
   if(activeConsent.rows[0]?.granted!==true)
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   const day=localDay(booking.start_at,booking.time_zone);
   // A single center/date advisory lock serializes the next token across staff.
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+center+":"+day+":queue"]);
   const next=await tx.query<{n:number}>(
    "SELECT COALESCE(MAX(queue_sequence),0)+1 AS n FROM cg15_visit_queue "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND queue_local_date=$3::date",
    [actor.realmId,center,day]);
   const n=Number(next.rows[0].n);
   if(n>999999)throw new ConflictException({code:"CG15_QUEUE_LIMIT"});
   const q=await tx.query<Visit>(
    "INSERT INTO cg15_visit_queue(root_realm_id,appointment_id,center_id,"+
    "queue_local_date,queue_sequence,queue_token,actor_account_id) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [actor.realmId,appointmentId,center,day,n,"Q"+n,actor.accountId]);
   await tx.query(
    "UPDATE cg15_consultation_appointment SET booking_state='ARRIVED',"+
    "revision=revision+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,appointmentId]);
   await tx.query(
    "INSERT INTO cg15_visit_event(root_realm_id,visit_id,appointment_id,"+
    "prior_revision,next_revision,prior_state,next_state,actor_account_id,request_key,request_digest) "+
    "VALUES($1,$2,$3,0,1,NULL,'ARRIVED',$4,$5,$6)",
    [actor.realmId,q.rows[0].id,appointmentId,actor.accountId,key,signature]);
   await tx.query(
    "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,prior_revision,"+
    "new_revision,action,prior_snapshot,new_snapshot,actor_account_id,request_key) "+
    "VALUES($1,$2,$3,$4,'CHECKED_IN',$5,$6,$7,$8)",
    [actor.realmId,appointmentId,booking.revision,booking.revision+1,
     JSON.stringify({status:booking.booking_state}),
     JSON.stringify({status:"ARRIVED",queueToken:"Q"+n}),actor.accountId,key]);
   await tx.query("COMMIT");active=false;return result(q.rows[0]);
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** A missed consultation is NOT a visit. Preserve the absence of a check-in
  * or queue number; make the original appointment NO_SHOW only after its
  * scheduled end. Booking writers and this action share the doctor-row lock.
  */
 async markNoShow(bearer:string,centerRaw:string,raw:unknown){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  const v=input(raw,["appointmentRef","requestKey","expectedVersion"]);
  const appointmentId=param(v.appointmentRef),key=param(v.requestKey),
   expected=number(v.expectedVersion);
  const signature=digest({appointmentId,expected,action:"NO_SHOW"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const peek=await tx.query<{doctor_id:string}>(
    "SELECT doctor_id FROM cg15_consultation_appointment WHERE "+
    "root_realm_id=$1 AND id=$2 AND center_id=$3",
    [actor.realmId,appointmentId,center]);
   if(!peek.rows[0])throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const lockedDoctor=await tx.query(
    "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,peek.rows[0].doctor_id]);
   if(!lockedDoctor.rowCount)throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const source=await tx.query<Appointment>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND id=$2 AND center_id=$3 FOR UPDATE",
    [actor.realmId,appointmentId,center]);
   const booking=source.rows[0];
   if(!booking||booking.doctor_id!==peek.rows[0].doctor_id)
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   const previous=await tx.query<{new_snapshot:{requestDigest?:string}}>(
    "SELECT new_snapshot FROM cg15_appointment_event WHERE root_realm_id=$1 "+
    "AND appointment_id=$2 AND action='NO_SHOW' AND request_key=$3",
    [actor.realmId,appointmentId,key]);
   if(previous.rows[0]){
    if(previous.rows[0].new_snapshot?.requestDigest!==signature)
     throw new ConflictException({code:"CG15_QUEUE_REQUEST_CONFLICT"});
    await tx.query("COMMIT");active=false;
    return {appointmentRef:appointmentId,bookingStatus:booking.booking_state,
     version:booking.revision,alreadyRecorded:true};
   }
   if(booking.revision!==expected||booking.booking_state!=="CONFIRMED"||
    booking.end_at.getTime()>Date.now())
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   const hasCheckIn=await tx.query(
    "SELECT 1 FROM cg15_visit_queue WHERE root_realm_id=$1 AND appointment_id=$2",
    [actor.realmId,appointmentId]);
   if(hasCheckIn.rowCount)
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   await tx.query(
    "UPDATE cg15_doctor_reservation SET status='RELEASED' "+
    "WHERE root_realm_id=$1 AND id=(SELECT reservation_id FROM "+
    "cg15_consultation_appointment WHERE root_realm_id=$1 AND id=$2) "+
    "AND status='CONFIRMED'",[actor.realmId,appointmentId]);
   await tx.query(
    "UPDATE cg15_consultation_appointment SET booking_state='NO_SHOW',"+
    "revision=revision+1,terms_revision=terms_revision+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,appointmentId]);
   await tx.query(
    "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,"+
    "prior_revision,new_revision,action,prior_snapshot,new_snapshot,"+
    "actor_account_id,request_key) VALUES($1,$2,$3,$4,'NO_SHOW',$5,$6,$7,$8)",
    [actor.realmId,appointmentId,booking.revision,booking.revision+1,
     JSON.stringify({status:"CONFIRMED",centerRef:center,
      startAt:booking.start_at.toISOString(),endAt:booking.end_at.toISOString()}),
     JSON.stringify({status:"NO_SHOW",requestDigest:signature,
      reason:"PATIENT_DID_NOT_CHECK_IN"}),actor.accountId,key]);
   await tx.query("COMMIT");active=false;
   return {appointmentRef:appointmentId,bookingStatus:"NO_SHOW",
    version:booking.revision+1,alreadyRecorded:false};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async transition(bearer:string,centerRaw:string,visitRaw:string,raw:unknown){
  const actor=await this.identity.verifySession(bearer),
   center=param(centerRaw),visitId=param(visitRaw);
  const v=input(raw,["requestKey","expectedVersion","nextState"]);
  const key=param(v.requestKey),expected=number(v.expectedVersion);
  if(!["WAITING","IN_CONSULTATION","COMPLETED"].includes(String(v.nextState)))
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  const nextState=String(v.nextState);
  const signature=digest({visitId,expected,nextState});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   // Reception may check-in and move ARRIVED to WAITING, but may NOT
   // independently claim the patient is with a clinician or completed.
   // Sensitive clinical queue transitions require a separate explicit CG01
   // grant and the actual currently assigned CG14 center inside this TX.
   if(nextState==="IN_CONSULTATION"||nextState==="COMPLETED")
    await this.centers.assertCurrent(
     tx,actor,center,"health.visits.clinical.manage");
   // No medical content in this operational queue projection.
   const qr=await tx.query<Visit>(
    "SELECT * FROM cg15_visit_queue WHERE root_realm_id=$1 AND id=$2 "+
    "AND center_id=$3 FOR UPDATE",[actor.realmId,visitId,center]);
   const old=qr.rows[0];
   if(!old)throw new NotFoundException({code:"CG15_QUEUE_NOT_FOUND"});
   const replay=await tx.query<{request_digest:string}>(
    "SELECT request_digest FROM cg15_visit_event WHERE root_realm_id=$1 "+
    "AND visit_id=$2 AND request_key=$3",
    [actor.realmId,visitId,key]);
   if(replay.rows[0]){
    if(replay.rows[0].request_digest!==signature)
     throw new ConflictException({code:"CG15_QUEUE_REQUEST_CONFLICT"});
    await tx.query("COMMIT");active=false;return result(old);
   }
   const allowed:Record<string,string[]>={
    ARRIVED:["WAITING"],
    WAITING:["IN_CONSULTATION"],
    IN_CONSULTATION:["COMPLETED"],
    COMPLETED:[],NO_SHOW:[]
   };
   if(old.revision!==expected||!(allowed[old.state]??[]).includes(nextState))
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   const ar=await tx.query<Appointment>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND id=$2 AND center_id=$3 FOR UPDATE",
    [actor.realmId,old.appointment_id,center]);
   const ap=ar.rows[0];
   if(!ap||ap.booking_state!==old.state)
    throw new ConflictException({code:"CG15_QUEUE_CHANGED"});
   if(nextState==="IN_CONSULTATION"||nextState==="COMPLETED")
    await this.clinicians.assertCurrentAppointmentClinician(
     tx,actor,center,ap.doctor_id);
   // No-show is an original booking action, never a transition of a
   // patient already checked in to ARRIVED/WAITING.
   const changed=await tx.query<Visit>(
    "UPDATE cg15_visit_queue SET state=$3,revision=revision+1,"+
    "updated_at=now(),actor_account_id=$4 WHERE root_realm_id=$1 AND id=$2 RETURNING *",
    [actor.realmId,visitId,nextState,actor.accountId]);
   await tx.query(
    "UPDATE cg15_consultation_appointment SET booking_state=$3,"+
    "revision=revision+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,old.appointment_id,nextState]);
   await tx.query(
    "INSERT INTO cg15_visit_event(root_realm_id,visit_id,appointment_id,prior_revision,"+
    "next_revision,prior_state,next_state,actor_account_id,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [actor.realmId,visitId,old.appointment_id,old.revision,old.revision+1,
     old.state,nextState,actor.accountId,key,signature]);
   await tx.query(
    "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,prior_revision,"+
    "new_revision,action,prior_snapshot,new_snapshot,actor_account_id,request_key) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [actor.realmId,old.appointment_id,ap.revision,ap.revision+1,nextState,
     JSON.stringify({status:ap.booking_state}),
     JSON.stringify({status:nextState,queueToken:old.queue_token}),actor.accountId,key]);
   await tx.query("COMMIT");active=false;return result(changed.rows[0]);
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
}
