import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
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
  private readonly centers:HealthCenterSupportScopeFacade){}
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
  return {centers:r.rows.map(row=>({centerRef:row.center_ref,centerName:row.center_name,timeZone:row.time_zone}))};
 }
 async list(bearer:string,centerRaw:string,dayRaw:unknown){
  const actor=await this.identity.verifySession(bearer),center=param(centerRaw);
  if(typeof dayRaw!=="string"||!DAY.test(dayRaw)||
   !Number.isFinite(Date.parse(dayRaw+"T00:00:00Z"))||
   new Date(dayRaw+"T00:00:00Z").toISOString().slice(0,10)!==dayRaw)
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
   const r=await tx.query<{
    id:string;booking_display_id:string;doctor_id:string;doctor_name:string;booking_state:string;revision:number;
    start_at:Date;time_zone:string;first_name:string;last_name:string;
    visit_id:string|null;queue_token:string|null;queue_state:string|null;visit_version:number|null
   }>(
    "SELECT a.id,a.booking_display_id,a.doctor_id,a.doctor_name,a.booking_state,a.revision,"+
    "a.start_at,a.time_zone,p.first_name,p.last_name,"+
    "q.id AS visit_id,q.queue_token,q.state AS queue_state,q.revision AS visit_version "+
    "FROM cg15_consultation_appointment a "+
    "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id AND p.id=a.patient_id "+
    "LEFT JOIN cg15_visit_queue q ON q.root_realm_id=a.root_realm_id AND q.appointment_id=a.id "+
    "WHERE a.root_realm_id=$1 AND a.center_id=$2 AND "+
    "(a.start_at AT TIME ZONE a.time_zone)::date=$3::date "+
    "ORDER BY a.start_at,a.id LIMIT 201",
    [actor.realmId,center,dayRaw]);
   if(r.rows.length>200)
    throw new ConflictException({code:"CG15_QUEUE_LIMIT"});
   await tx.query("COMMIT");active=false;
   return {day:dayRaw,items:r.rows
    .map(x=>({appointmentRef:x.id,bookingId:x.booking_display_id,
      doctorRef:x.doctor_id,doctorName:x.doctor_name,patientName:x.first_name+" "+x.last_name,
      startAt:x.start_at.toISOString(),bookingStatus:x.booking_state,bookingVersion:x.revision,
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
    "AND d.status='ISSUED' AND d.revoked_at IS NULL "+
    "AND d.source_revision=a.terms_revision "+
    "AND a.booking_state IN('CONFIRMED','ARRIVED','WAITING','IN_CONSULTATION') "+
    "AND a.start_at>now()-interval '12 hours' "+
    "AND a.end_at<now()+interval '30 days' LIMIT 1",
    [actor.realmId,center,tokenHash]);
   const item=r.rows[0];
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
 async transition(bearer:string,centerRaw:string,visitRaw:string,raw:unknown){
  const actor=await this.identity.verifySession(bearer),
   center=param(centerRaw),visitId=param(visitRaw);
  const v=input(raw,["requestKey","expectedVersion","nextState"]);
  const key=param(v.requestKey),expected=number(v.expectedVersion);
  if(!["WAITING","IN_CONSULTATION","COMPLETED","NO_SHOW"].includes(String(v.nextState)))
   throw new BadRequestException({code:"CG15_QUEUE_INVALID"});
  const nextState=String(v.nextState);
  const signature=digest({visitId,expected,nextState});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,center);
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
    ARRIVED:["WAITING","NO_SHOW"],
    WAITING:["IN_CONSULTATION","NO_SHOW"],
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
