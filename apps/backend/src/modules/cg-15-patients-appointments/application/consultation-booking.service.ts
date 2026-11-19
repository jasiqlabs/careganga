import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthPublicDirectoryService,type HealthScheduleEligibleSource}
 from "../../cg-14-healthcare-network/application/health-public-directory.service";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const SHA=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const VALID_STATES=["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED","NO_SHOW","CANCELLED"] as const;
type Hold={id:string;patient_id:string;doctor_id:string;center_id:string;association_id:string;
 schedule_id:string;schedule_revision_id:string;start_at:Date;end_at:Date;
 time_zone:string;fee_minor:string;fee_version:number;status:string;
 expires_at:Date;created_by_account:string;request_digest:string};
type Booking={id:string;booking_display_id:string;patient_id:string;doctor_id:string;
 center_id:string;association_id:string;hold_id:string;reservation_id:string;
 start_at:Date;end_at:Date;time_zone:string;doctor_name:string;center_name:string;
 center_address:string;fee_minor:string;fee_version:number;
 booking_state:string;collection_state:string;payment_mode:string;revision:number;terms_revision:number;
 confirmation_digest:string;created_at:Date;updated_at:Date};
type Patient={id:string;profile_status:string;consent_granted:boolean|null;verified:Date|null};
type Slot={scheduleId:string;revisionId:string;minutes:number};
type Accepted={actor:VerifiedFoundationActor;patient:Patient;source:HealthScheduleEligibleSource;
 feeMinor:string;feeVersion:number;slot:Slot};

function body(v:unknown,keys:string[]){
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(key=>!keys.includes(key)))
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 return x;
}
function uuid(v:unknown){
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 return v;
}
function epoch(v:unknown){
 if(typeof v!=="string"||!ISO.test(v)||!Number.isFinite(Date.parse(v))||
  new Date(v).toISOString()!==new Date(Date.parse(v)).toISOString())
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 return new Date(v);
}
function holdMinutes(){
 const value=Number(process.env.CG15_HOLD_MINUTES);
 if(!Number.isInteger(value)||value<5||value>10)
  throw new ServiceUnavailableException({code:"CG15_BOOKING_HOLD_NOT_CONFIGURED"});
 return value;
}
function local(date:Date,zone:string){
 let f:Intl.DateTimeFormat;
 try{
  f=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hourCycle:"h23",
   year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
 }catch{throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});}
 const part=Object.fromEntries(f.formatToParts(date).map(x=>[x.type,x.value]));
 const day=part.year+"-"+part.month+"-"+part.day;
 const clock=Number(part.hour)*60+Number(part.minute);
 return {day,clock,weekday:new Date(day+"T12:00:00Z").getUTCDay()};
}
function clock(t:string){return Number(t.slice(0,2))*60+Number(t.slice(3,5));}
function ms(value:Date){return value.getTime();}
function checkWindow(start:Date,end:Date){
 const now=Date.now(),latest=now+30*86400000;
 if(ms(start)<now+5*60000||ms(start)>latest||ms(end)<=ms(start)||
  ms(end)-ms(start)>180*60000)
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
}
function presentHold(v:Hold){return {
 holdRef:v.id,status:v.status,expiresAt:v.expires_at.toISOString(),
 doctorRef:v.doctor_id,centerRef:v.center_id,
 startAt:v.start_at.toISOString(),endAt:v.end_at.toISOString(),
 consultationFeeMinor:v.fee_minor,feeVersion:v.fee_version,
 consultationCurrency:"INR",paymentMode:"PAY_AT_CENTER" as const
};}
function presentBooking(v:Booking){return {
 bookingRef:v.id,bookingId:v.booking_display_id,
 doctorRef:v.doctor_id,centerRef:v.center_id,
 startAt:v.start_at.toISOString(),endAt:v.end_at.toISOString(),
 timeZone:v.time_zone,doctorName:v.doctor_name,centerName:v.center_name,
 centerAddress:v.center_address,consultationFeeMinor:v.fee_minor,
 feeVersion:v.fee_version,consultationCurrency:"INR" as const,
 bookingStatus:v.booking_state,termsVersion:v.terms_revision,paymentMode:v.payment_mode,
 collectionStatus:v.collection_state,version:v.revision,
 createdAt:v.created_at.toISOString(),updatedAt:v.updated_at.toISOString()
};}
@Injectable()
export class ConsultationBookingService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly identity:SessionService,
  private readonly directory:HealthPublicDirectoryService){}
 private async ownPatient(tx:PoolClient,actor:VerifiedFoundationActor,requireConsent=true){
  const r=await tx.query<Patient>(
   "SELECT p.id,p.profile_status,a.contact_phone_verified_at AS verified,"+
   "(SELECT c.granted FROM cg15_patient_consent c "+
   "WHERE c.root_realm_id=p.root_realm_id AND c.patient_id=p.id "+
   "AND c.purpose='PATIENT_CARE' ORDER BY c.revision_no DESC LIMIT 1) AS consent_granted "+
   "FROM cg15_patient_account_link l "+
   "JOIN cg15_patient p ON p.root_realm_id=l.root_realm_id AND p.id=l.patient_id "+
   "JOIN account a ON a.id=l.account_id AND a.realm_id=l.root_realm_id "+
   "JOIN access_realm root ON root.id=a.realm_id AND root.realm_key='FOUNDATION_ROOT' "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.revoked_at IS NULL "+
   "AND a.status='ACTIVE' FOR SHARE OF p,a,l",
   [actor.realmId,actor.accountId]);
  const patient=r.rows[0];
  if(!patient||!patient.verified||
    !["PROVISIONAL","VERIFIED"].includes(patient.profile_status)||
    (requireConsent&&patient.consent_granted!==true))
   throw new ForbiddenException({code:"CG15_BOOKING_PATIENT_NOT_READY"});
  return patient;
 }
 private async doctorLock(tx:PoolClient,actor:VerifiedFoundationActor,doctorId:string){
  const row=await tx.query(
   "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
   [actor.realmId,doctorId]);
  if(!row.rowCount)throw new NotFoundException({code:"CG15_BOOKING_SLOT_CHANGED"});
  // Doctor row serializes all hold/confirm/reschedule writes across centers.
  await tx.query(
   "UPDATE cg15_doctor_reservation r SET status='EXPIRED' "+
   "FROM cg15_consultation_hold h WHERE r.root_realm_id=$1 AND r.doctor_id=$2 "+
   "AND r.status='HELD' AND h.root_realm_id=r.root_realm_id "+
   "AND h.id=r.hold_id AND h.status='HELD' AND h.expires_at<=now()",
   [actor.realmId,doctorId]);
  await tx.query(
   "UPDATE cg15_consultation_hold SET status='EXPIRED',updated_at=now() "+
   "WHERE root_realm_id=$1 AND doctor_id=$2 AND status='HELD' AND expires_at<=now()",
   [actor.realmId,doctorId]);
 }
 private async eligible(tx:PoolClient,actor:VerifiedFoundationActor,
  doctorId:string,centerId:string,start:Date,end:Date):Promise<Accepted>{
  checkWindow(start,end);
  const source=(await this.directory.eligibleScheduleSource(tx,doctorId))
   .find(v=>v.center_ref===centerId&&v.root_ref===actor.realmId);
  if(!source||source.amount_minor===null)
   throw new NotFoundException({code:"CG15_BOOKING_SLOT_CHANGED"});
  const patient=await this.ownPatient(tx,actor);
  const from=local(start,source.time_zone),to=local(end,source.time_zone);
  if(from.day!==to.day||to.clock<=from.clock)
   throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
  const schedule=await tx.query<{
   schedule_id:string;revision_id:string;slot_minutes:number;
   effective_from:string;effective_until:string|null
  }>(
   "SELECT s.id AS schedule_id,r.id AS revision_id,r.slot_minutes,"+
   "r.effective_from::text,r.effective_until::text "+
   "FROM cg15_doctor_schedule s JOIN cg15_schedule_revision r "+
   "ON r.root_realm_id=s.root_realm_id AND r.schedule_id=s.id "+
   "AND r.id=s.current_revision_id "+
   "WHERE s.root_realm_id=$1 AND s.doctor_id=$2 AND s.center_id=$3 "+
   "AND s.association_id=$4 AND s.consultation_mode='IN_PERSON' "+
   "AND s.status='ACTIVE' AND s.time_zone=$5 AND r.effective_from<=$6::date "+
   "AND (r.effective_until IS NULL OR r.effective_until>$6::date)",
   [actor.realmId,doctorId,centerId,source.association_ref,source.time_zone,from.day]);
  const scheduleRow=schedule.rows[0];
  if(!scheduleRow||!Number.isInteger(scheduleRow.slot_minutes)||
   scheduleRow.slot_minutes<5||scheduleRow.slot_minutes>180||
   ms(end)-ms(start)!==scheduleRow.slot_minutes*60000)
   throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
  const windows=await tx.query<{open_local:string;close_local:string}>(
   "SELECT to_char(open_local,'HH24:MI') AS open_local,"+
   "to_char(close_local,'HH24:MI') AS close_local "+
   "FROM cg15_schedule_weekly_window WHERE root_realm_id=$1 "+
   "AND revision_id=$2 AND weekday=$3 ORDER BY open_local LIMIT 43",
   [actor.realmId,scheduleRow.revision_id,from.weekday]);
  if(windows.rows.length>42||!windows.rows.some(w=>
   from.clock>=clock(w.open_local)&&to.clock<=clock(w.close_local)&&
   (from.clock-clock(w.open_local))%scheduleRow.slot_minutes===0))
   throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
  const blocked=await tx.query(
   "SELECT 1 FROM cg15_schedule_exception WHERE root_realm_id=$1 "+
   "AND doctor_id=$2 AND state='ACTIVE' AND "+
   "(kind='LEAVE' OR center_id=$3) AND start_at<$5 AND end_at>$4 LIMIT 1",
   [actor.realmId,doctorId,centerId,start,end]);
  if(blocked.rowCount)throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
  const fee=await tx.query<{amount_minor:string;version:number}>(
   "SELECT amount_minor::text,version FROM health_center_fee "+
   "WHERE root_realm_id=$1 AND doctor_center_id=$2 "+
   "AND fee_kind='CONSULTATION' AND consultation_mode='IN_PERSON' "+
   "AND status='APPROVED' AND effective_from<=now() "+
   "AND (effective_to IS NULL OR effective_to>now()) "+
   "ORDER BY effective_from DESC LIMIT 1",
   [actor.realmId,source.association_ref]);
  if(!fee.rows[0]||fee.rows[0].amount_minor!==String(source.amount_minor))
   throw new ConflictException({code:"CG15_BOOKING_PRICE_CHANGED"});
  return {actor,patient,source,feeMinor:fee.rows[0].amount_minor,
   feeVersion:fee.rows[0].version,
   slot:{scheduleId:scheduleRow.schedule_id,revisionId:scheduleRow.revision_id,
    minutes:scheduleRow.slot_minutes}};
 }
 async hold(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=body(input,["requestKey","doctorRef","centerRef","startAt","endAt",
   "acceptedFeeMinor","acceptedFeeVersion","paymentMode"]);
  const key=uuid(v.requestKey),doctorId=uuid(v.doctorRef),centerId=uuid(v.centerRef);
  const start=epoch(v.startAt),end=epoch(v.endAt);
  const fee=String(v.acceptedFeeMinor??"");
  if(!/^\d{1,11}$/.test(fee)||!Number.isSafeInteger(v.acceptedFeeVersion)||
   v.paymentMode!=="PAY_AT_CENTER")throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
  const signature=SHA({doctorId,centerId,start:start.toISOString(),end:end.toISOString(),
   fee,feeVersion:v.acceptedFeeVersion,paymentMode:"PAY_AT_CENTER"});
  const minutes=holdMinutes();
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await this.doctorLock(tx,actor,doctorId);
   const existing=await tx.query<Hold>(
    "SELECT * FROM cg15_consultation_hold WHERE root_realm_id=$1 "+
    "AND created_by_account=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,key]);
   if(existing.rows[0]){
    const old=existing.rows[0];
    if(old.request_digest!==signature)
     throw new ConflictException({code:"CG15_BOOKING_REQUEST_CONFLICT"});
    await tx.query("COMMIT");open=false;
    return presentHold(old);
   }
   const eligible=await this.eligible(tx,actor,doctorId,centerId,start,end);
   if(eligible.feeMinor!==fee||eligible.feeVersion!==v.acceptedFeeVersion)
    throw new ConflictException({code:"CG15_BOOKING_PRICE_CHANGED"});
   const id=randomUUID();
   const inserted=await tx.query<Hold>(
    "INSERT INTO cg15_consultation_hold(root_realm_id,id,patient_id,doctor_id,"+
    "center_id,association_id,schedule_id,schedule_revision_id,start_at,end_at,"+
    "time_zone,fee_minor,fee_version,status,expires_at,created_by_account,"+
    "request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,"+
    "'HELD',now()+make_interval(mins=>$14),$15,$16,$17) RETURNING *",
    [actor.realmId,id,eligible.patient.id,doctorId,centerId,
     eligible.source.association_ref,eligible.slot.scheduleId,
     eligible.slot.revisionId,start,end,eligible.source.time_zone,fee,
     eligible.feeVersion,minutes,actor.accountId,key,signature]);
   await tx.query(
    "INSERT INTO cg15_doctor_reservation(root_realm_id,hold_id,doctor_id,center_id,"+
    "association_id,start_at,end_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,'HELD')",
    [actor.realmId,id,doctorId,centerId,eligible.source.association_ref,start,end]);
   await tx.query("COMMIT");open=false;
   return presentHold(inserted.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23P01")
    throw new ConflictException({code:"CG15_BOOKING_SLOT_TAKEN"});
   throw e;
  }finally{tx.release();}
 }
 async holdStatus(bearer:string,ref:string){
  const actor=await this.identity.verifySession(bearer),id=uuid(ref);
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const row=await tx.query<Hold>(
    "SELECT * FROM cg15_consultation_hold WHERE root_realm_id=$1 "+
    "AND id=$2 AND created_by_account=$3",
    [actor.realmId,id,actor.accountId]);
   if(!row.rows[0])throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await this.ownPatient(tx,actor,false);
   await tx.query("COMMIT");open=false;
   return presentHold(row.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async confirm(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=body(input,["requestKey","holdRef","acceptedFeeMinor","acceptedFeeVersion","paymentMode"]);
  const key=uuid(v.requestKey),id=uuid(v.holdRef);
  const fee=String(v.acceptedFeeMinor??"");
  if(!/^\d{1,11}$/.test(fee)||!Number.isSafeInteger(v.acceptedFeeVersion)||
   v.paymentMode!=="PAY_AT_CENTER")
   throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
  const signature=SHA({holdRef:id,fee,feeVersion:v.acceptedFeeVersion,paymentMode:"PAY_AT_CENTER"});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const holdSource=await tx.query<{doctor_id:string}>(
    "SELECT doctor_id FROM cg15_consultation_hold "+
    "WHERE root_realm_id=$1 AND id=$2 AND created_by_account=$3",
    [actor.realmId,id,actor.accountId]);
   if(!holdSource.rows[0])throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await this.doctorLock(tx,actor,holdSource.rows[0].doctor_id);
   const old=await tx.query<Booking>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND created_by_account=$2 AND confirmation_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,key]);
   if(old.rows[0]){
    if(old.rows[0].confirmation_digest!==signature)
     throw new ConflictException({code:"CG15_BOOKING_REQUEST_CONFLICT"});
    await tx.query("COMMIT");open=false;
    return presentBooking(old.rows[0]);
   }
   const h=await tx.query<Hold>(
    "SELECT * FROM cg15_consultation_hold WHERE root_realm_id=$1 AND id=$2 "+
    "AND created_by_account=$3 FOR UPDATE",
    [actor.realmId,id,actor.accountId]);
   const hold=h.rows[0];
   if(!hold)throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   if(hold.status!=="HELD"||ms(hold.expires_at)<=Date.now())
    throw new ConflictException({code:"CG15_BOOKING_HOLD_EXPIRED"});
   const current=await this.eligible(tx,actor,hold.doctor_id,hold.center_id,
    hold.start_at,hold.end_at);
   if(current.patient.id!==hold.patient_id||current.source.association_ref!==hold.association_id||
    current.slot.scheduleId!==hold.schedule_id||
    current.slot.revisionId!==hold.schedule_revision_id)
    throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
   if(current.feeMinor!==fee||hold.fee_minor!==fee||
    current.feeVersion!==v.acceptedFeeVersion||hold.fee_version!==v.acceptedFeeVersion)
    throw new ConflictException({code:"CG15_BOOKING_PRICE_CHANGED"});
   const reservation=await tx.query<{id:string}>(
    "SELECT id FROM cg15_doctor_reservation WHERE root_realm_id=$1 "+
    "AND hold_id=$2 AND status='HELD' FOR UPDATE",
    [actor.realmId,id]);
   if(!reservation.rows[0])
    throw new ConflictException({code:"CG15_BOOKING_HOLD_EXPIRED"});
   const booking=await tx.query<Booking>(
    "INSERT INTO cg15_consultation_appointment("+
    "root_realm_id,booking_display_id,patient_id,doctor_id,center_id,association_id,"+
    "hold_id,reservation_id,start_at,end_at,time_zone,doctor_name,center_name,"+
    "center_address,fee_minor,fee_version,created_by_account,confirmation_key,"+
    "confirmation_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *",
    [actor.realmId,"CGA-"+randomBytes(8).toString("hex").toUpperCase(),
     hold.patient_id,hold.doctor_id,hold.center_id,hold.association_id,hold.id,
     reservation.rows[0].id,hold.start_at,hold.end_at,hold.time_zone,
     current.source.doctor_name,current.source.center_name,current.source.address,
     fee,hold.fee_version,actor.accountId,key,signature]);
   await tx.query(
    "UPDATE cg15_doctor_reservation SET status='CONFIRMED' WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,reservation.rows[0].id]);
   await tx.query(
    "UPDATE cg15_consultation_hold SET status='CONSUMED',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,id]);
   await this.event(tx,actor,booking.rows[0],0,"CONFIRMED",key,null);
   await tx.query("COMMIT");open=false;
   return presentBooking(booking.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async event(tx:PoolClient,actor:VerifiedFoundationActor,booking:Booking,
  prior:number,action:string,key:string,old:Record<string,unknown>|null){
  const snapshot={status:booking.booking_state,startAt:booking.start_at.toISOString(),
   endAt:booking.end_at.toISOString(),centerRef:booking.center_id,
   doctorRef:booking.doctor_id,feeMinor:booking.fee_minor,
   collectionState:booking.collection_state};
  await tx.query(
   "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,"+
   "prior_revision,new_revision,action,prior_snapshot,new_snapshot,actor_account_id,request_key) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
   [actor.realmId,booking.id,prior,booking.revision,action,
    old?JSON.stringify(old):null,JSON.stringify(snapshot),actor.accountId,key]);
 }
 async cancel(bearer:string,idRaw:string,input:unknown){
  const actor=await this.identity.verifySession(bearer),id=uuid(idRaw);
  const v=body(input,["requestKey","expectedVersion","reason"]);
  const key=uuid(v.requestKey),expected=Number(v.expectedVersion);
  if(!Number.isSafeInteger(expected)||expected<1||expected>2147483645||
    typeof v.reason!=="string"||!["PATIENT_REQUEST","OTHER"].includes(v.reason))
   throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
  const requestDigest=SHA({id,expected,reason:v.reason,action:"CANCELLED"});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const doctor=await tx.query<{doctor_id:string}>(
    "SELECT doctor_id FROM cg15_consultation_appointment WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,id]);
   if(!doctor.rows[0])throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await this.doctorLock(tx,actor,doctor.rows[0].doctor_id);
   const patient=await this.ownPatient(tx,actor,false);
   const row=await tx.query<Booking>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND id=$2 AND patient_id=$3 FOR UPDATE",[actor.realmId,id,patient.id]);
   const old=row.rows[0];
   if(!old)throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   const previously=await tx.query<{new_snapshot:{requestDigest?:string}}>(
    "SELECT new_snapshot FROM cg15_appointment_event WHERE root_realm_id=$1 "+
    "AND appointment_id=$2 AND action='CANCELLED' AND request_key=$3",
    [actor.realmId,id,key]);
   if(previously.rows[0]){
    if(previously.rows[0].new_snapshot?.requestDigest!==requestDigest)
     throw new ConflictException({code:"CG15_BOOKING_REQUEST_CONFLICT"});
    await tx.query("COMMIT");open=false;return presentBooking(old);
   }
   if(old.revision!==expected||old.booking_state!=="CONFIRMED"||
     old.start_at.getTime()<=Date.now())
    throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
   await tx.query(
    "UPDATE cg15_doctor_reservation SET status='RELEASED' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='CONFIRMED'",
    [actor.realmId,old.reservation_id]);
   const changed=await tx.query<Booking>(
    "UPDATE cg15_consultation_appointment SET booking_state='CANCELLED',"+
    "revision=revision+1,terms_revision=terms_revision+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 RETURNING *",
    [actor.realmId,id]);
   await tx.query(
    "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,prior_revision,"+
    "new_revision,action,prior_snapshot,new_snapshot,actor_account_id,request_key) "+
    "VALUES($1,$2,$3,$4,'CANCELLED',$5,$6,$7,$8)",
    [actor.realmId,id,old.revision,old.revision+1,
     JSON.stringify({status:old.booking_state,bookingId:old.booking_display_id,
      startAt:old.start_at.toISOString(),endAt:old.end_at.toISOString(),
      centerRef:old.center_id,feeMinor:old.fee_minor,feeVersion:old.fee_version}),
     JSON.stringify({status:"CANCELLED",requestDigest,reason:v.reason,
      collectionState:"DUE_AT_CENTER"}),actor.accountId,key]);
   await tx.query("COMMIT");open=false;return presentBooking(changed.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async reschedule(bearer:string,idRaw:string,input:unknown){
  const actor=await this.identity.verifySession(bearer),id=uuid(idRaw);
  const v=body(input,["requestKey","expectedVersion","centerRef",
   "startAt","endAt","acceptedFeeMinor","acceptedFeeVersion","paymentMode"]);
  const key=uuid(v.requestKey),center=uuid(v.centerRef);
  const expected=Number(v.expectedVersion),start=epoch(v.startAt),end=epoch(v.endAt);
  const fee=String(v.acceptedFeeMinor??"");
  if(!Number.isSafeInteger(expected)||expected<1||expected>2147483645||
   !Number.isSafeInteger(v.acceptedFeeVersion)||!/^\d{1,11}$/.test(fee)||
   v.paymentMode!=="PAY_AT_CENTER")
   throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
  const requestDigest=SHA({id,expected,center,start:start.toISOString(),
   end:end.toISOString(),fee,feeVersion:v.acceptedFeeVersion,paymentMode:"PAY_AT_CENTER"});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const doctor=await tx.query<{doctor_id:string}>(
    "SELECT doctor_id FROM cg15_consultation_appointment WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,id]);
   if(!doctor.rows[0])throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await this.doctorLock(tx,actor,doctor.rows[0].doctor_id);
   const patient=await this.ownPatient(tx,actor,false);
   const booking=await tx.query<Booking>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND id=$2 AND patient_id=$3 FOR UPDATE",[actor.realmId,id,patient.id]);
   const old=booking.rows[0];
   if(!old)throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   const prev=await tx.query<{new_snapshot:{requestDigest?:string}}>(
    "SELECT new_snapshot FROM cg15_appointment_event WHERE root_realm_id=$1 "+
    "AND appointment_id=$2 AND action='RESCHEDULED' AND request_key=$3",
    [actor.realmId,id,key]);
   if(prev.rows[0]){
    if(prev.rows[0].new_snapshot?.requestDigest!==requestDigest)
     throw new ConflictException({code:"CG15_BOOKING_REQUEST_CONFLICT"});
    await tx.query("COMMIT");open=false;return presentBooking(old);
   }
   if(old.revision!==expected||old.booking_state!=="CONFIRMED"||
    old.start_at.getTime()<=Date.now()||
    (old.start_at.getTime()===start.getTime()&&old.center_id===center))
    throw new ConflictException({code:"CG15_BOOKING_SLOT_CHANGED"});
   // Original old slot is released and new slot is acquired in ONE transaction.
   // A failure of exclusion/fee/consent rolls back both changes.
   const current=await this.eligible(tx,actor,old.doctor_id,center,start,end);
   if(current.patient.id!==old.patient_id||current.feeMinor!==fee||
    current.feeVersion!==v.acceptedFeeVersion)
    throw new ConflictException({code:"CG15_BOOKING_PRICE_CHANGED"});
   await tx.query(
    "UPDATE cg15_doctor_reservation SET status='RELEASED' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='CONFIRMED'",
    [actor.realmId,old.reservation_id]);
   const nr=await tx.query<{id:string}>(
    "INSERT INTO cg15_doctor_reservation(root_realm_id,doctor_id,center_id,"+
    "association_id,start_at,end_at,status) "+
    "VALUES($1,$2,$3,$4,$5,$6,'CONFIRMED') RETURNING id",
    [actor.realmId,old.doctor_id,center,current.source.association_ref,start,end]);
   const changed=await tx.query<Booking>(
    "UPDATE cg15_consultation_appointment SET center_id=$3,association_id=$4,"+
    "reservation_id=$5,start_at=$6,end_at=$7,time_zone=$8,"+
    "doctor_name=$9,center_name=$10,center_address=$11,"+
    "fee_minor=$12,fee_version=$13,revision=revision+1,"+
    "terms_revision=terms_revision+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 RETURNING *",
    [actor.realmId,id,center,current.source.association_ref,nr.rows[0].id,
     start,end,current.source.time_zone,current.source.doctor_name,
     current.source.center_name,current.source.address,fee,current.feeVersion]);
   await tx.query(
    "INSERT INTO cg15_appointment_event(root_realm_id,appointment_id,prior_revision,"+
    "new_revision,action,prior_snapshot,new_snapshot,actor_account_id,request_key) "+
    "VALUES($1,$2,$3,$4,'RESCHEDULED',$5,$6,$7,$8)",
    [actor.realmId,id,old.revision,old.revision+1,
     JSON.stringify({status:old.booking_state,reservationRef:old.reservation_id,
      centerRef:old.center_id,associationRef:old.association_id,
      startAt:old.start_at.toISOString(),endAt:old.end_at.toISOString(),
      feeMinor:old.fee_minor,feeVersion:old.fee_version}),
     JSON.stringify({status:"CONFIRMED",requestDigest,
      reservationRef:nr.rows[0].id,centerRef:center,
      startAt:start.toISOString(),endAt:end.toISOString(),
      feeMinor:fee,feeVersion:current.feeVersion,
      collectionState:"DUE_AT_CENTER"}),actor.accountId,key]);
   await tx.query("COMMIT");open=false;return presentBooking(changed.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23P01")
    throw new ConflictException({code:"CG15_BOOKING_SLOT_TAKEN"});
   throw e;
  }finally{tx.release();}
 }
 async calendar(bearer:string,idRaw:string){
  const value=await this.myOne(bearer,idRaw);
  if(!["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION"].includes(value.bookingStatus))
   throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
  // RFC 5545 VCALENDAR holds only the real appointment source snapshot.
  // Never include symptoms, DOB, contact, protected report URLs, or receipt.
  const esc=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r|\n/g," ")
   .replace(/;/g,"\\;").replace(/,/g,"\\,").slice(0,400);
  const stamp=(v:string)=>new Date(v).toISOString().replace(/[-:]/g,"")
   .replace(/\.\d{3}Z$/,"Z");
  const lines=[
   "BEGIN:VCALENDAR","VERSION:2.0",
   "PRODID:-//CareGanga Foundation//Consultations//EN",
   "CALSCALE:GREGORIAN","METHOD:PUBLISH",
   "BEGIN:VEVENT","UID:"+value.bookingId+"@careganga.com",
   "DTSTAMP:"+stamp(value.createdAt),
   "DTSTART:"+stamp(value.startAt),"DTEND:"+stamp(value.endAt),
   "SUMMARY:"+esc("Consultation with "+value.doctorName),
   "LOCATION:"+esc(value.centerName+", "+value.centerAddress),
   "DESCRIPTION:Pay at center. This calendar event is not a payment receipt.",
   "STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"
  ];
  return lines.join("\r\n")+"\r\n";
 }
 async mine(bearer:string,limitRaw:unknown=20){
  const actor=await this.identity.verifySession(bearer);
  const limit=Number(limitRaw);
  if(!Number.isInteger(limit)||limit<1||limit>50)
   throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const patient=await this.ownPatient(tx,actor,false);
   const row=await tx.query<Booking>(
    "SELECT * FROM cg15_consultation_appointment WHERE root_realm_id=$1 "+
    "AND patient_id=$2 ORDER BY created_at DESC,id DESC LIMIT $3",
    [actor.realmId,patient.id,limit]);
   await tx.query("COMMIT");open=false;
   return {items:row.rows.map(presentBooking),next:null};
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async myOne(bearer:string,idRaw:string){
  const actor=await this.identity.verifySession(bearer);
  const id=uuid(idRaw);
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const patient=await this.ownPatient(tx,actor,false);
   const r=await tx.query<Booking>(
    "SELECT * FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND id=$2 AND patient_id=$3",
    [actor.realmId,id,patient.id]);
   if(!r.rows[0])throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await tx.query("COMMIT");open=false;
   return presentBooking(r.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
}
