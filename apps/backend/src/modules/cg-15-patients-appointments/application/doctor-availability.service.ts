import {BadRequestException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const MAX_CENTERS=40;
const MAX_SLOTS=144;
const maxAdvanceDays=30;
type DoctorCenter={
 root_realm_id:string;doctor_id:string;doctor_name:string;center_id:string;
 center_name:string;center_slug:string;association_id:string;time_zone:string;
 center_type:string;address_line:string;pin_code:string;
 amount_minor:string|null;fee_from:Date|null;
};
type Schedule={
 schedule_id:string;center_id:string;association_id:string;time_zone:string;
 slot_minutes:number;weekly_start:string;weekly_end:string;
 effective_from:string;effective_until:string|null;
};
type Window={schedule_id:string;weekday:number;open_local:string;close_local:string};
type Block={kind:string;center_id:string;start_at:Date;end_at:Date};
const validId=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CG15_AVAILABILITY_INVALID"});
 return v;
};
function validDate(v:unknown){
 if(typeof v!=="string"||!DAY.test(v)||!Number.isFinite(Date.parse(v+"T00:00:00Z"))||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
  throw new BadRequestException({code:"CG15_AVAILABILITY_INVALID"});
 const today=new Date().toISOString().slice(0,10);
 const limit=new Date(Date.now()+maxAdvanceDays*86400000).toISOString().slice(0,10);
 if(v<today||v>limit)
  throw new BadRequestException({code:"CG15_AVAILABILITY_INVALID"});
 return v;
}
function minute(x:string){return Number(x.slice(0,2))*60+Number(x.slice(3,5));}
function hhmm(m:number){return String(Math.floor(m/60)).padStart(2,"0")+":"+
 String(m%60).padStart(2,"0");}
function localParts(ms:number,format:Intl.DateTimeFormat){
 const f=Object.fromEntries(format.formatToParts(new Date(ms))
  .map(x=>[x.type,x.value]));
 return {year:Number(f.year),month:Number(f.month),day:Number(f.day),
  hour:Number(f.hour),minute:Number(f.minute)};
}
function toUtc(localDay:string,clock:string,zone:string):number|null{
 const fmt=new Intl.DateTimeFormat("en-US",{timeZone:zone,hourCycle:"h23",
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
 const [y,m,d]=localDay.split("-").map(Number);
 const localClock=minute(clock);
 const localMs=Date.UTC(y,m-1,d,Math.floor(localClock/60),localClock%60);
 const offset=(ms:number)=>{
  const parts=localParts(ms,fmt);
  return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute)-
   Math.floor(ms/60000)*60000;
 };
 const offsets=new Set([offset(localMs-18*3600000),offset(localMs),
  offset(localMs+18*3600000)]);
 const exact=[...offsets].map(off=>localMs-off).filter(ms=>{
  const p=localParts(ms,fmt);
  return p.year===y&&p.month===m&&p.day===d&&
   p.hour===Math.floor(localClock/60)&&p.minute===localClock%60;
 });
 // Nonexistent DST times and ambiguous repeated local times fail closed.
 return exact.length===1?exact[0]:null;
}
function rootDay(day:string){return new Date(day+"T12:00:00Z").getUTCDay();}
function bounds(x:string){
 const middle=Date.parse(x+"T00:00:00Z");
 return [new Date(middle-48*3600000),new Date(middle+72*3600000)];
}
const GENERAL_MESSAGE=
 "Working hours are a preview, not a confirmed appointment. Booking is not enabled yet.";
/** Public CG-15 US002 advisory projection ONLY. CG-14 original source remains
 * the only doctor/center/fees eligibility master. No patient, hold, booking,
 * saved history or fake slot count can be created by this service.
 */
@Injectable()
export class DoctorAvailabilityService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 private async centers(doctorRef:string,centerRef?:string){
  const r=await this.db.query<DoctorCenter>(
   "SELECT doc.root_realm_id,doc.id AS doctor_id,doc.full_name AS doctor_name,"+
   "c.id AS center_id,c.display_name AS center_name,"+
   "c.public_slug AS center_slug,assoc.id AS association_id,c.time_zone,"+
   "c.center_type,c.address_line,c.pin_code,"+
   "fee.amount_minor::text AS amount_minor,fee.effective_from AS fee_from "+
   "FROM health_doctor doc "+
   "JOIN health_doctor_center assoc ON assoc.doctor_id=doc.id "+
   "AND assoc.root_realm_id=doc.root_realm_id "+
   "AND assoc.affiliation_state='APPROVED' "+
   "AND assoc.approved_from<=now() AND "+
   "(assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
   "JOIN health_center c ON c.id=assoc.center_id "+
   "AND c.root_realm_id=assoc.root_realm_id "+
   "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
   "JOIN access_realm root ON root.id=c.root_realm_id "+
   "AND root.realm_key='FOUNDATION_ROOT' "+
   "JOIN health_center_publication pub ON pub.center_id=c.id "+
   "AND pub.root_realm_id=c.root_realm_id "+
   "AND pub.generation=c.publication_generation "+
   "JOIN health_center_revision cv ON cv.id=pub.verified_center_revision_id "+
   "AND cv.root_realm_id=c.root_realm_id AND cv.center_id=c.id "+
   "AND cv.provider_id=p.id "+
   "JOIN cg03_case cc ON cc.id=cv.approval_case_ref "+
   "AND cc.realm_id=cv.root_realm_id "+
   "AND cc.case_kind='HEALTH_CENTER_VERIFICATION' "+
   "AND cc.status='OWNER_COMPLETED' AND cc.health_center_id=c.id "+
   "AND cc.health_center_revision_id=cv.id "+
   "AND cc.health_source_digest=cv.source_digest "+
   "JOIN cg03_case_decision cd ON cd.id=pub.original_final_decision_ref "+
   "AND cd.case_id=cc.id AND cd.realm_id=cc.realm_id "+
   "AND cd.action='APPROVE' AND cd.fresh_password_verified_at IS NOT NULL "+
   "AND cd.actor_id<>cc.proposer_id "+
   "JOIN cg19_stored_file cp ON cp.id=cv.proof_file_ref "+
   "AND cp.realm_id=cv.root_realm_id "+
   "AND cp.owner_kind='CG14_DRAFT' AND cp.health_center_id=c.id "+
   "AND cp.health_provider_id=p.id AND cp.scan_status='CLEAN_VERIFIED' "+
   "AND cp.revoked_at IS NULL "+
   "JOIN cg19_upload_intent ci ON ci.id=cp.upload_intent_id "+
   "AND ci.realm_id=cp.realm_id AND ci.status='VALIDATED' "+
   "AND ci.classification='HEALTH_CENTER_LICENSE' "+
   "JOIN health_doctor_revision dv ON dv.root_realm_id=doc.root_realm_id "+
   "AND dv.doctor_id=doc.id "+
   "AND dv.revision_no=(SELECT MAX(x.revision_no) FROM health_doctor_revision x "+
   "WHERE x.root_realm_id=doc.root_realm_id AND x.doctor_id=doc.id) "+
   "JOIN cg03_case dc ON dc.id=dv.approval_case_ref AND dc.realm_id=dv.root_realm_id "+
   "AND dc.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
   "AND dc.health_doctor_id=doc.id AND dc.health_doctor_revision_id=dv.id "+
   "AND dc.health_source_digest=dv.source_digest AND dc.status='OWNER_COMPLETED' "+
   "JOIN cg03_case_decision dd ON dd.case_id=dc.id AND dd.realm_id=dc.realm_id "+
   "AND dd.action='APPROVE' AND dd.fresh_password_verified_at IS NOT NULL "+
   "AND dd.actor_id<>dc.proposer_id "+
   "JOIN cg19_stored_file dl ON dl.id=dv.proof_file_ref "+
   "AND dl.realm_id=dv.root_realm_id AND dl.owner_kind='CG14_DOCTOR' "+
   "AND dl.health_doctor_id=doc.id AND dl.revoked_at IS NULL "+
   "AND dl.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent di ON di.id=dl.upload_intent_id "+
   "AND di.realm_id=dl.realm_id AND di.status='VALIDATED' "+
   "AND di.classification='HEALTH_DOCTOR_LICENSE' "+
   "LEFT JOIN LATERAL (SELECT f.amount_minor,f.effective_from "+
   "FROM health_center_fee f WHERE f.root_realm_id=assoc.root_realm_id "+
   "AND f.doctor_center_id=assoc.id AND f.fee_kind='CONSULTATION' "+
   "AND f.consultation_mode='IN_PERSON' AND f.status='APPROVED' "+
   "AND f.effective_from<=now() "+
   "AND (f.effective_to IS NULL OR f.effective_to>now()) "+
   "ORDER BY f.effective_from DESC LIMIT 1) fee ON true "+
   "WHERE doc.id=$1 AND doc.status='VERIFIED' "+
   "AND c.status='VERIFIED' AND c.access_state='ENABLED' "+
   "AND p.status='VERIFIED' AND c.publication_state='PUBLISHED' "+
   "AND c.public_slug IS NOT NULL "+
   "AND ($2::uuid IS NULL OR c.id=$2) "+
   "ORDER BY c.display_name,c.id LIMIT $3",
   [doctorRef,centerRef??null,MAX_CENTERS]);
  return r.rows;
 }
 private async scheduleFor(source:DoctorCenter,day:string){
  const schedules=await this.db.query<Schedule>(
   "SELECT s.id AS schedule_id,s.center_id,s.association_id,s.time_zone,"+
   "r.slot_minutes,r.effective_from::text,r.effective_until::text "+
   "FROM cg15_doctor_schedule s "+
   "JOIN cg15_schedule_revision r ON r.root_realm_id=s.root_realm_id "+
   "AND r.schedule_id=s.id AND r.id=s.current_revision_id "+
   "WHERE s.root_realm_id=$1 AND s.association_id=$2 "+
   "AND s.consultation_mode='IN_PERSON' AND s.status='ACTIVE' "+
   "AND r.effective_from<=$3::date "+
   "AND (r.effective_until IS NULL OR r.effective_until>$3::date)",
   [source.root_realm_id,source.association_id,day]);
  return schedules.rows[0]??null;
 }
 async centerOptions(doctorRaw:string,dayRaw:unknown){
  const doctorRef=validId(doctorRaw),day=validDate(dayRaw);
  const centers=await this.centers(doctorRef);
  if(!centers.length)throw new NotFoundException({code:"CG15_AVAILABILITY_UNAVAILABLE"});
  const result=await Promise.all(centers.map(async center=>{
   const schedule=await this.scheduleFor(center,day);
   return {centerRef:center.center_id,centerName:center.center_name,
    centerSlug:center.center_slug,timeZone:center.time_zone,
    address: center.address_line,pinCode:center.pin_code,
    consultationFeeMinor:center.amount_minor,consultationCurrency:"INR",
    hasWorkingSchedule:!!schedule,
    doctorName:center.doctor_name,
    bookingEnabled:false};
  }));
  return {day,doctorName:centers[0].doctor_name,bookingEnabled:false,
   status:"SCHEDULE_PREVIEW",message:GENERAL_MESSAGE,centers:result};
 }
 async dayForCenter(doctorRaw:string,centerRaw:string,dayRaw:unknown){
  const doctorRef=validId(doctorRaw),centerRef=validId(centerRaw),
   day=validDate(dayRaw);
  const centers=await this.centers(doctorRef,centerRef);
  const center=centers[0];
  if(!center)throw new NotFoundException({code:"CG15_AVAILABILITY_UNAVAILABLE"});
  const current=await this.scheduleFor(center,day);
  if(!current)return {status:"NO_VERIFIED_SCHEDULE",bookingEnabled:false,
   day,centerRef:center.center_id,centerName:center.center_name,
   doctorName:center.doctor_name,timeZone:center.time_zone,
   slots:[] as unknown[],message:"No verified working schedule for this date."};
  if(current.time_zone!==center.time_zone)
   throw new NotFoundException({code:"CG15_AVAILABILITY_UNAVAILABLE"});
  const weekday=rootDay(day);
  const windows=await this.db.query<Window>(
   "SELECT w.schedule_id,w.weekday,to_char(w.open_local,'HH24:MI') AS open_local,"+
   "to_char(w.close_local,'HH24:MI') AS close_local "+
   "FROM cg15_schedule_weekly_window w WHERE w.root_realm_id=$1 "+
   "AND w.revision_id=(SELECT current_revision_id FROM cg15_doctor_schedule "+
   "WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE') "+
   "AND w.weekday=$3 ORDER BY w.open_local LIMIT 42",
   [center.root_realm_id,current.schedule_id,weekday]);
  const [lo,hi]=bounds(day);
  const blocks=await this.db.query<Block>(
   "SELECT kind,center_id,start_at,end_at FROM cg15_schedule_exception "+
   "WHERE root_realm_id=$1 AND doctor_id=$2 AND state='ACTIVE' "+
   "AND (kind='LEAVE' OR center_id=$3) "+
   "AND start_at<$5 AND end_at>$4 ORDER BY start_at LIMIT 200",
   [center.root_realm_id,center.doctor_id,center.center_id,lo,hi]);
  const slots:{startAt:string;endAt:string;startLocal:string;endLocal:string;
   bookable:false}[]=[];
  const now=Date.now();
  for(const w of windows.rows){
   const duration=Number(current.slot_minutes);
   const first=minute(w.open_local),last=minute(w.close_local);
   if(!Number.isInteger(duration)||duration<5||duration>180||
     first>=last||(last-first)%duration!==0)continue;
   for(let m=first;m+duration<=last;m+=duration){
    if(slots.length>=MAX_SLOTS)break;
    const start=toUtc(day,hhmm(m),center.time_zone);
    const end=toUtc(day,hhmm(m+duration),center.time_zone);
    if(start===null||end===null||start<now||end<=start||
       end-start!==duration*60000)continue;
    if(blocks.rows.some(b=>start<b.end_at.getTime()&&
       end>b.start_at.getTime()))continue;
    slots.push({startAt:new Date(start).toISOString(),
     endAt:new Date(end).toISOString(),startLocal:hhmm(m),
     endLocal:hhmm(m+duration),bookable:false});
   }
  }
  return {status:"SCHEDULE_PREVIEW",bookingEnabled:false,
   day,doctorName:center.doctor_name,centerName:center.center_name,
   centerRef:center.center_id,centerSlug:center.center_slug,
   timeZone:center.time_zone,
   consultationFeeMinor:center.amount_minor,consultationCurrency:"INR",
   slots,message:GENERAL_MESSAGE};
 }
 async slotFirst(doctorRaw:string,dayRaw:unknown,clockRaw:unknown){
  const doctorRef=validId(doctorRaw),day=validDate(dayRaw);
  if(typeof clockRaw!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(clockRaw))
   throw new BadRequestException({code:"CG15_AVAILABILITY_INVALID"});
  const centers=await this.centers(doctorRef);
  if(!centers.length)throw new NotFoundException({code:"CG15_AVAILABILITY_UNAVAILABLE"});
  const matched=[];
  for(const center of centers){
   const calendar=await this.dayForCenter(doctorRef,center.center_id,day);
   const chosen=calendar.slots.find(s=>s.startLocal===clockRaw);
   if(chosen)matched.push({centerRef:center.center_id,centerName:center.center_name,
    centerSlug:center.center_slug,timeZone:center.time_zone,
    consultationFeeMinor:center.amount_minor,consultationCurrency:"INR",
    startAt:chosen.startAt,endAt:chosen.endAt,bookable:false});
  }
  return {day,time:clockRaw,doctorName:centers[0].doctor_name,
   centerChoices:matched,status:"SCHEDULE_PREVIEW",
   bookingEnabled:false,message:GENERAL_MESSAGE};
 }
}
