import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const HOUR=/^([01]\d|2[0-3]):[0-5]\d$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
type Channel="foundation"|"center";
type Actor=VerifiedFoundationActor;
type Window={weekday:number;startLocal:string;endLocal:string};
type Source={provider_id:string;doctor_id:string;center_id:string;id:string;
 time_zone:string;display_name:string;full_name:string;
 provider_status:string;center_status:string;access_state:string;
 doctor_status:string;affiliation_state:string;approved_from:Date|null;
 approved_to:Date|null};
type Schedule={id:string;version:number;status:string;
 current_revision_id:string;time_zone:string;consultation_mode:string};
type Revision={revision_no:number;slot_minutes:number;effective_from:string;
 effective_until:string|null;source_digest:string};
type Command={id:string;request_digest:string;result_ref:string|null;
 result_version:number|null};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function field(x:unknown):Record<string,unknown>{
 if(!x||typeof x!=="object"||Array.isArray(x))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return x as Record<string,unknown>;
}
function allowed(x:Record<string,unknown>,keys:readonly string[]){
 if(Object.keys(x).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
}
function uuid(x:unknown):string{
 if(typeof x!=="string"||!ID.test(x))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return x;
}
function vnum(x:unknown,zero=false):number{
 if(!Number.isSafeInteger(x)||Number(x)<(zero?0:1)||Number(x)>2147483645)
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return Number(x);
}
function date(x:unknown):string{
 if(typeof x!=="string"||!DATE.test(x)||
  !Number.isFinite(Date.parse(x+"T00:00:00Z"))||
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)!==x)
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return x;
}
function clock(x:unknown):string{
 if(typeof x!=="string"||!HOUR.test(x))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return x;
}
function minute(x:string){return Number(x.slice(0,2))*60+Number(x.slice(3));}
function parseWeek(body:unknown){
 const x=field(body);
 allowed(x,["requestKey","expectedVersion","slotMinutes","consultationMode",
  "effectiveFrom","effectiveUntil","windows"]);
 const key=uuid(x.requestKey),expected=vnum(x.expectedVersion,true);
 const slot=vnum(x.slotMinutes),mode=x.consultationMode;
 if(slot<5||slot>180||slot%5||!["IN_PERSON","VIDEO"].includes(String(mode)))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 const start=date(x.effectiveFrom);
 const end=x.effectiveUntil===null||x.effectiveUntil===undefined?
  null:date(x.effectiveUntil);
 if(end&&end<=start||start<new Date(Date.now()-86400000).toISOString().slice(0,10)||
    start>new Date(Date.now()+366*86400000).toISOString().slice(0,10))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 if(!Array.isArray(x.windows)||x.windows.length<1||x.windows.length>42)
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 const windows:Window[]=x.windows.map(v=>{
  const w=field(v);
  allowed(w,["weekday","startLocal","endLocal"]);
  if(!Number.isInteger(w.weekday)||Number(w.weekday)<0||Number(w.weekday)>6)
   throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
  const from=clock(w.startLocal),to=clock(w.endLocal);
  if(minute(from)>=minute(to)||((minute(to)-minute(from))%slot)!==0)
   throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
  return {weekday:Number(w.weekday),startLocal:from,endLocal:to};
 });
 windows.sort((a,b)=>a.weekday-b.weekday||a.startLocal.localeCompare(b.startLocal));
 for(let n=1;n<windows.length;n++)
  if(windows[n].weekday===windows[n-1].weekday&&
    minute(windows[n].startLocal)<minute(windows[n-1].endLocal))
   throw new BadRequestException({code:"CG15_SCHEDULE_OVERLAP"});
 return {key,expected,slot,mode:mode as "IN_PERSON"|"VIDEO",
  effectiveFrom:start,effectiveUntil:end,windows};
}
function parseException(body:unknown){
 const x=field(body);
 allowed(x,["requestKey","expectedVersion","kind","startAt","endAt","reason"]);
 const key=uuid(x.requestKey),expected=vnum(x.expectedVersion);
 const kind=x.kind;
 if(!["LEAVE","BLOCK","HOLIDAY"].includes(String(kind))||
   typeof x.reason!=="string"||x.reason.trim().length<3||
   x.reason.trim().length>240||/[\u0000-\u001f\u007f<>]/.test(x.reason))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 if(typeof x.startAt!=="string"||typeof x.endAt!=="string"||
   !UTC.test(x.startAt)||!UTC.test(x.endAt))
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 const start=new Date(x.startAt),end=new Date(x.endAt);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
   start.getTime()<Date.now()-86400000||
   end.getTime()<=start.getTime()||end.getTime()-start.getTime()>30*86400000)
  throw new BadRequestException({code:"CG15_SCHEDULE_INVALID"});
 return {key,expected,kind:kind as "LEAVE"|"BLOCK"|"HOLIDAY",
  start,end,reason:x.reason.trim()};
}
/** CG-15's original current weekly doctor-center schedule source.
 * CG-14 is the ONLY doctor, provider, center, affiliation and fee master.
 * No appointment/slot occupancy is published before CG-15 US002/US004.
 */
@Injectable()
export class DoctorScheduleService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly ownCenter:HealthCenterSupportScopeFacade){}
 private async transaction<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let started=false;
  try{
   await tx.query("BEGIN");started=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");started=false;
   return result;
  }catch(e){
   if(started)try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
     ["23P01","23503","23505","23514","40P01","55P03"].includes(String(e.code)))
    throw new ConflictException({code:"CG15_SCHEDULE_CHANGED"});
   throw e;
  }finally{tx.release();}
 }
 private async actor(bearer:string,channel:Channel,write:boolean){
  return this.sessions.requireAction(bearer,
   channel==="foundation"?(write?"health.schedules.manage":"health.schedules.view"):
    "health.centers.draft.edit");
 }
 private async source(tx:PoolClient,actor:Actor,channel:Channel,
  associationRef:string,write:boolean,ownRef?:string):Promise<Source>{
  const found=await tx.query<Source>(
   "SELECT a.id,a.doctor_id,a.center_id,c.provider_id,c.time_zone,"+
   "c.display_name,d.full_name,p.status AS provider_status,"+
   "c.status AS center_status,c.access_state,d.status AS doctor_status,"+
   "a.affiliation_state,a.approved_from,a.approved_to "+
   "FROM health_doctor_center a "+
   "JOIN health_center c ON c.id=a.center_id AND c.root_realm_id=a.root_realm_id "+
   "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=a.root_realm_id "+
   "JOIN health_doctor d ON d.id=a.doctor_id AND d.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND a.id=$2 "+
   "AND ($3::uuid IS NULL OR a.center_id=$3)",
   [actor.realmId,associationRef,ownRef??null]);
  const assoc=found.rows[0];
  if(!assoc)throw new NotFoundException({code:"CG15_SCHEDULE_INELIGIBLE"});
  await this.identity.assertCurrent(tx,actor,
   channel==="foundation"?(write?"health.schedules.manage":"health.schedules.view"):
    "health.centers.draft.edit");
  if(channel==="center")await this.ownCenter.assertCurrent(tx,actor,assoc.center_id);
  // Same lock order as CG-14 protected source mutations.
  const p=await tx.query<{status:string}>(
   "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,assoc.provider_id]);
  const c=await tx.query<{status:string;access_state:string;time_zone:string}>(
   "SELECT status,access_state,time_zone FROM health_center WHERE "+
   "root_realm_id=$1 AND provider_id=$2 AND id=$3 FOR SHARE",
   [actor.realmId,assoc.provider_id,assoc.center_id]);
  const d=await tx.query<{status:string}>(
   "SELECT status FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
   (write?"FOR UPDATE":"FOR SHARE"),[actor.realmId,assoc.doctor_id]);
  const a=await tx.query<{affiliation_state:string;approved_from:Date|null;
   approved_to:Date|null}>(
   "SELECT affiliation_state,approved_from,approved_to FROM health_doctor_center "+
   "WHERE root_realm_id=$1 AND id=$2 AND doctor_id=$3 AND center_id=$4 FOR SHARE",
   [actor.realmId,assoc.id,assoc.doctor_id,assoc.center_id]);
  if(p.rows[0]?.status!=="VERIFIED"||
    c.rows[0]?.status!=="VERIFIED"||c.rows[0]?.access_state!=="ENABLED"||
    d.rows[0]?.status!=="VERIFIED"||
    a.rows[0]?.affiliation_state!=="APPROVED"||
    !a.rows[0].approved_from||
    a.rows[0].approved_from>new Date()||
    a.rows[0].approved_to&&a.rows[0].approved_to<=new Date())
   throw new ConflictException({code:"CG15_SCHEDULE_INELIGIBLE"});
  // A current CG14 verified doctor MUST retain its independent original
  // CG03 decision and CG19 clean/unrevoked professional licence.
  const proof=await tx.query<{eligible:boolean}>(
   "SELECT EXISTS(SELECT 1 FROM health_doctor_revision r "+
   "JOIN cg03_case cg ON cg.realm_id=r.root_realm_id "+
   "AND cg.id=r.approval_case_ref AND cg.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
   "AND cg.status='OWNER_COMPLETED' AND cg.health_doctor_revision_id=r.id "+
   "AND cg.health_doctor_id=r.doctor_id AND cg.health_source_digest=r.source_digest "+
   "JOIN cg03_case_decision decision ON decision.realm_id=cg.realm_id "+
   "AND decision.case_id=cg.id AND decision.action='APPROVE' "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "AND decision.actor_id<>cg.proposer_id "+
   "JOIN cg19_stored_file license ON license.realm_id=r.root_realm_id "+
   "AND license.id=r.proof_file_ref AND license.owner_kind='CG14_DOCTOR' "+
   "AND license.health_doctor_id=r.doctor_id AND license.scan_status='CLEAN_VERIFIED' "+
   "AND license.revoked_at IS NULL "+
   "JOIN cg19_upload_intent intent ON intent.id=license.upload_intent_id "+
   "AND intent.realm_id=license.realm_id AND intent.status='VALIDATED' "+
   "AND intent.classification='HEALTH_DOCTOR_LICENSE' "+
   "WHERE r.root_realm_id=$1 AND r.doctor_id=$2 "+
   "AND r.revision_no=(SELECT MAX(r2.revision_no) FROM health_doctor_revision r2 "+
   "WHERE r2.root_realm_id=r.root_realm_id AND r2.doctor_id=r.doctor_id)) AS eligible",
   [actor.realmId,assoc.doctor_id]);
  if(!proof.rows[0]?.eligible)
   throw new ConflictException({code:"CG15_SCHEDULE_INELIGIBLE"});
  return {...assoc,time_zone:c.rows[0].time_zone};
 }
 private async command(tx:PoolClient,actor:Actor,action:string,
  key:string,data:unknown){
  const hash=digest(data);
  const made=await tx.query<{id:string}>(
   "INSERT INTO cg15_schedule_command(root_realm_id,actor_ref,action_key,"+
   "request_key,request_digest) VALUES($1,$2,$3,$4,$5) "+
   "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING "+
   "RETURNING id",[actor.realmId,actor.accountId,action,key,hash]);
  if(made.rows[0])return {id:made.rows[0].id,replay:null as Command|null,hash};
  const old=await tx.query<Command>(
   "SELECT id,request_digest,result_ref,result_version "+
   "FROM cg15_schedule_command WHERE root_realm_id=$1 AND actor_ref=$2 "+
   "AND action_key=$3 AND request_key=$4 FOR SHARE",
   [actor.realmId,actor.accountId,action,key]);
  if(!old.rows[0]||old.rows[0].request_digest!==hash||!old.rows[0].result_ref)
   throw new ConflictException({code:"CG15_SCHEDULE_CHANGED"});
  return {id:null,replay:old.rows[0],hash};
 }
 private async done(tx:PoolClient,commandId:string|null,ref:string,version:number){
  if(commandId)await tx.query("UPDATE cg15_schedule_command "+
   "SET result_ref=$2,result_version=$3 WHERE id=$1",
   [commandId,ref,version]);
 }
 private async hours(tx:PoolClient,actor:Actor,center:string,windows:Window[]){
  const rows=await tx.query<{weekday:number;from_time:string;to_time:string}>(
   "SELECT weekday,open_local::text AS from_time,close_local::text AS to_time "+
   "FROM health_center_hours WHERE root_realm_id=$1 AND center_id=$2 "+
   "AND service_type IN('GENERAL','CONSULTATION')",
   [actor.realmId,center]);
  if(!rows.rowCount||windows.some(w=>!rows.rows.some(h=>
    h.weekday===w.weekday&&minute(w.startLocal)>=minute(h.from_time)&&
    minute(w.endLocal)<=minute(h.to_time))))
   throw new ConflictException({code:"CG15_SCHEDULE_OUTSIDE_CENTER_HOURS"});
 }
 private async noOtherCenterOverlap(tx:PoolClient,actor:Actor,src:Source,
  mode:string,windows:Window[]){
  if(mode!=="IN_PERSON")return;
  const rows=await tx.query<{time_zone:string;weekday:number;
   open_local:string;close_local:string}>(
   "SELECT other.time_zone,w.weekday,w.open_local::text,"+
   "w.close_local::text FROM cg15_doctor_schedule other "+
   "JOIN cg15_schedule_weekly_window w "+
   "ON w.root_realm_id=other.root_realm_id AND w.schedule_id=other.id "+
   "AND w.revision_id=other.current_revision_id "+
   "WHERE other.root_realm_id=$1 AND other.doctor_id=$2 "+
   "AND other.association_id<>$3 AND other.status='ACTIVE' "+
   "AND other.consultation_mode='IN_PERSON' FOR SHARE OF other",
   [actor.realmId,src.doctor_id,src.id]);
  // Safe V1: cross-timezone weekly recurrence is ambiguous at DST edges,
  // so require one time zone across concurrent in-person center schedules.
  if(rows.rows.some(r=>r.time_zone!==src.time_zone))
   throw new ConflictException({code:"CG15_SCHEDULE_TIMEZONE_CONFLICT"});
  if(rows.rows.some(r=>windows.some(w=>w.weekday===r.weekday&&
    minute(w.startLocal)<minute(r.close_local)&&
    minute(r.open_local)<minute(w.endLocal))))
   throw new ConflictException({code:"CG15_SCHEDULE_DOCTOR_CONFLICT"});
 }
 async roster(bearer:string,channel:Channel,centerRef?:string){
  const ownRef=channel==="center"?uuid(centerRef):null;
  const actor=await this.actor(bearer,channel,false);
  if(channel==="foundation"&&centerRef)uuid(centerRef);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,
    channel==="foundation"?"health.schedules.view":"health.centers.draft.edit");
   if(channel==="center")await this.ownCenter.assertCurrent(tx,actor,ownRef!);
   const rows=await tx.query<{association_id:string;doctor_id:string;center_id:string;
    doctor_name:string;center_name:string;specialties:string[];status:string;
    version:number|null;schedule_mode:string|null}>(
    "SELECT assoc.id AS association_id,assoc.doctor_id,assoc.center_id,"+
    "d.full_name AS doctor_name,c.display_name AS center_name,d.specialties,"+
    "COALESCE(s.status,'NOT_SCHEDULED') AS status,s.version,"+
    "s.consultation_mode AS schedule_mode FROM health_doctor_center assoc "+
    "JOIN health_doctor d ON d.root_realm_id=assoc.root_realm_id "+
    "AND d.id=assoc.doctor_id "+
    "JOIN health_center c ON c.root_realm_id=assoc.root_realm_id "+
    "AND c.id=assoc.center_id "+
    "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
    "LEFT JOIN cg15_doctor_schedule s ON s.root_realm_id=assoc.root_realm_id "+
    "AND s.association_id=assoc.id AND s.consultation_mode='IN_PERSON' "+
    "WHERE assoc.root_realm_id=$1 AND ($2::uuid IS NULL OR assoc.center_id=$2) "+
    "AND p.status='VERIFIED' AND c.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND d.status='VERIFIED' "+
    "AND assoc.affiliation_state='APPROVED' "+
    "AND assoc.approved_from<=now() "+
    "AND (assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
    "ORDER BY d.full_name,c.display_name,assoc.id LIMIT 100",
    [actor.realmId,channel==="center"?ownRef:centerRef??null]);
   return {doctors:rows.rows.map(r=>({associationRef:r.association_id,
    doctorRef:r.doctor_id,centerRef:r.center_id,doctorName:r.doctor_name,
    centerName:r.center_name,specialties:r.specialties,status:r.status,
    version:r.version??0,scheduleMode:r.schedule_mode}))};
  });
 }
 async detail(bearer:string,channel:Channel,associationRef:string,
  centerRef?:string){
  const assoc=uuid(associationRef),ownRef=channel==="center"?uuid(centerRef):undefined;
  const actor=await this.actor(bearer,channel,false);
  return this.transaction(async tx=>{
   const source=await this.source(tx,actor,channel,assoc,false,ownRef);
   const r=await tx.query<Schedule&{slot_minutes:number;effective_from:string;
     effective_until:string|null}>(
    "SELECT s.*,rev.slot_minutes,rev.effective_from::text,rev.effective_until::text "+
    "FROM cg15_doctor_schedule s "+
    "JOIN cg15_schedule_revision rev ON rev.root_realm_id=s.root_realm_id "+
    "AND rev.schedule_id=s.id AND rev.id=s.current_revision_id "+
    "WHERE s.root_realm_id=$1 AND s.association_id=$2 "+
    "AND s.consultation_mode='IN_PERSON' FOR SHARE OF s",
    [actor.realmId,assoc]);
   const schedule=r.rows[0];
   const windows=schedule?await tx.query<{weekday:number;start_local:string;end_local:string}>(
    "SELECT weekday,to_char(open_local,'HH24:MI') AS start_local,"+
    "to_char(close_local,'HH24:MI') AS end_local "+
    "FROM cg15_schedule_weekly_window WHERE root_realm_id=$1 "+
    "AND schedule_id=$2 AND revision_id=$3 "+
    "ORDER BY weekday,open_local",[actor.realmId,schedule.id,schedule.current_revision_id])
    :{rows:[] as {weekday:number;start_local:string;end_local:string}[]};
   const exceptions=schedule?await tx.query<{id:string;kind:string;state:string;
    start_at:Date;end_at:Date;reason:string;version:number}>(
    "SELECT id,kind,state,start_at,end_at,reason,version "+
    "FROM cg15_schedule_exception WHERE root_realm_id=$1 AND schedule_id=$2 "+
    "AND end_at>now()-interval '30 days' "+
    "ORDER BY start_at,id LIMIT 75",[actor.realmId,schedule.id])
    :{rows:[] as {id:string;kind:string;state:string;start_at:Date;
       end_at:Date;reason:string;version:number}[]};
   return {doctorName:source.full_name,centerName:source.display_name,
    associationRef:assoc,doctorRef:source.doctor_id,centerRef:source.center_id,
    timeZone:source.time_zone,status:schedule?.status??"NOT_SCHEDULED",
    version:schedule?.version??0,slotMinutes:schedule?.slot_minutes??30,
    effectiveFrom:schedule?.effective_from??null,
    effectiveUntil:schedule?.effective_until??null,
    windows:windows.rows.map(w=>({weekday:w.weekday,
     startLocal:w.start_local,endLocal:w.end_local})),
    exceptions:exceptions.rows.map(e=>({exceptionRef:e.id,kind:e.kind,state:e.state,
     startAt:e.start_at,endAt:e.end_at,reason:e.reason,version:e.version}))};
  });
 }
 async save(bearer:string,channel:Channel,associationRef:string,raw:unknown,
  centerRef?:string){
  const ref=uuid(associationRef),input=parseWeek(raw);
  const ownRef=channel==="center"?uuid(centerRef):undefined;
  const actor=await this.actor(bearer,channel,true);
  return this.transaction(async tx=>{
   const src=await this.source(tx,actor,channel,ref,true,ownRef);
   try{new Intl.DateTimeFormat("en-US",{timeZone:src.time_zone}).format(new Date());}
   catch{throw new ConflictException({code:"CG15_SCHEDULE_TIMEZONE_CONFLICT"});}
   await this.hours(tx,actor,src.center_id,input.windows);
   await this.noOtherCenterOverlap(tx,actor,src,input.mode,input.windows);
   const cmd=await this.command(tx,actor,"SAVE_WEEK",input.key,
    [ref,input.expected,input.slot,input.mode,input.effectiveFrom,
     input.effectiveUntil,input.windows]);
   if(cmd.replay)return {status:"PREVIOUSLY_CONFIRMED",
    associationRef:ref,version:cmd.replay.result_version,
    message:"This schedule was already saved. Refresh for current details."};
   const found=await tx.query<Schedule>(
    "SELECT id,version,status,current_revision_id,time_zone,consultation_mode "+
    "FROM cg15_doctor_schedule WHERE root_realm_id=$1 AND association_id=$2 "+
    "AND consultation_mode=$3 FOR UPDATE",[actor.realmId,ref,input.mode]);
   const old=found.rows[0],next=old?old.version+1:1;
   if((old?.version??0)!==input.expected)
    throw new ConflictException({code:"CG15_SCHEDULE_CHANGED"});
   if(old&&old.time_zone!==src.time_zone)
    throw new ConflictException({code:"CG15_SCHEDULE_TIMEZONE_CONFLICT"});
   const scheduleRef=old?.id??randomUUID(),revRef=randomUUID();
   if(!old)await tx.query(
    "INSERT INTO cg15_doctor_schedule(id,root_realm_id,doctor_id,center_id,"+
    "association_id,consultation_mode,time_zone,status,version,"+
    "current_revision_id,created_by,updated_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,'ACTIVE',1,$8,$9,$9)",
    [scheduleRef,actor.realmId,src.doctor_id,src.center_id,ref,input.mode,
     src.time_zone,revRef,actor.accountId]);
   const hash=digest([src.id,src.doctor_id,src.center_id,src.time_zone,
    input.mode,input.slot,input.effectiveFrom,input.effectiveUntil,input.windows]);
   await tx.query(
    "INSERT INTO cg15_schedule_revision(id,root_realm_id,schedule_id,"+
    "revision_no,slot_minutes,per_slot_capacity,effective_from,effective_until,"+
    "source_digest,authored_by) VALUES($1,$2,$3,$4,$5,1,$6,$7,$8,$9)",
    [revRef,actor.realmId,scheduleRef,next,input.slot,input.effectiveFrom,
     input.effectiveUntil,hash,actor.accountId]);
   for(const w of input.windows)await tx.query(
    "INSERT INTO cg15_schedule_weekly_window(root_realm_id,schedule_id,"+
    "revision_id,weekday,open_local,close_local) VALUES($1,$2,$3,$4,$5,$6)",
    [actor.realmId,scheduleRef,revRef,w.weekday,w.startLocal,w.endLocal]);
   if(old){
    const moved=await tx.query(
     "UPDATE cg15_doctor_schedule SET current_revision_id=$3,version=$4,"+
     "updated_by=$5,updated_at=now(),status='ACTIVE' "+
     "WHERE root_realm_id=$1 AND id=$2 AND version=$6 RETURNING id",
     [actor.realmId,scheduleRef,revRef,next,actor.accountId,input.expected]);
    if(!moved.rowCount)throw new ConflictException({code:"CG15_SCHEDULE_CHANGED"});
   }
   await tx.query(
    "INSERT INTO cg15_schedule_event(root_realm_id,schedule_id,revision_id,"+
    "actor_ref,action_key,source_digest,request_key) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor.realmId,scheduleRef,revRef,actor.accountId,
     old?"SCHEDULE_CHANGED":"SCHEDULE_CREATED",hash,input.key]);
   await this.done(tx,cmd.id,scheduleRef,next);
   return {status:"CONFIRMED",version:next,associationRef:ref,
    message:"Doctor working hours saved for the verified center."};
  });
 }
 async exception(bearer:string,channel:Channel,associationRef:string,
  raw:unknown,centerRef?:string){
  const ref=uuid(associationRef),input=parseException(raw);
  const ownRef=channel==="center"?uuid(centerRef):undefined;
  const actor=await this.actor(bearer,channel,true);
  return this.transaction(async tx=>{
   const src=await this.source(tx,actor,channel,ref,true,ownRef);
   const schedule=await tx.query<Schedule>(
    "SELECT id,version,status,current_revision_id,time_zone,consultation_mode "+
    "FROM cg15_doctor_schedule WHERE root_realm_id=$1 AND association_id=$2 "+
    "AND consultation_mode='IN_PERSON' FOR UPDATE",[actor.realmId,ref]);
   const curr=schedule.rows[0];
   if(!curr||curr.version!==input.expected||curr.status!=="ACTIVE")
    throw new ConflictException({code:"CG15_SCHEDULE_CHANGED"});
   const cmd=await this.command(tx,actor,"PROPOSE_EXCEPTION",input.key,
    [ref,input.kind,input.start.toISOString(),input.end.toISOString(),
     input.reason,input.expected]);
   if(cmd.replay)return {status:"PREVIOUSLY_CONFIRMED",
    exceptionRef:cmd.replay.result_ref,
    message:"This exception was already recorded. Refresh to see current status."};
   // LEAVE requires the original independent CG03 approval adapter before
   // status ACTIVE. A proposed leave never silently removes booked patients.
   const state=input.kind==="LEAVE"?"PENDING":"ACTIVE";
   const row=await tx.query<{id:string}>(
    "INSERT INTO cg15_schedule_exception(root_realm_id,schedule_id,doctor_id,"+
    "center_id,association_id,kind,state,start_at,end_at,reason,"+
    "version,proposed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11) RETURNING id",
    [actor.realmId,curr.id,src.doctor_id,src.center_id,ref,input.kind,state,
     input.start,input.end,input.reason,actor.accountId]);
   const hash=digest([ref,input.kind,input.start.toISOString(),
    input.end.toISOString(),input.reason]);
   await tx.query(
    "INSERT INTO cg15_schedule_event(root_realm_id,schedule_id,exception_id,"+
    "actor_ref,action_key,source_digest,request_key) "+
    "VALUES($1,$2,$3,$4,'EXCEPTION_PROPOSED',$5,$6)",
    [actor.realmId,curr.id,row.rows[0].id,actor.accountId,hash,input.key]);
   await this.done(tx,cmd.id,row.rows[0].id,1);
   return {status:state,exceptionRef:row.rows[0].id,
    message:state==="PENDING"?
     "Doctor leave requested. It does not block appointments until independent approval.":
     "Center-specific time block recorded. Existing bookings are not cancelled."};
  });
 }
}
