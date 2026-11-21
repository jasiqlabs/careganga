import {
 BadRequestException,ConflictException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {MisSavedReportService} from "./mis-saved-report.service";
import {MisReportSourceService} from "./mis-report-source.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const HOUR=/^([01]\d|2[0-3]):([0-5]\d)$/;
const parseId=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"MIS_SCHEDULE_INVALID",
   message:"Choose a permitted saved report."});
 return v;
};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const cadenceSet=new Set(["DAILY","WEEKLY","MONTHLY","YEARLY"]);
type Input={savedRef:string;cadence:"DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY";
 timezone:string;localTime:string;firstDate:string;requestKey:string};
type Schedule={
 id:string;owner_account_ref:string;saved_ref:string;saved_report_name?:string;
 saved_revision:number;annual_month:number|null;
 cadence:string;timezone:string;local_time:string;
 weekday:number|null;monthday:number|null;
 next_due_utc:Date;state:string;revision:number;
 request_key:string;payload_digest:string;updated_at:Date;
};
function parse(raw:unknown):Input{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"MIS_SCHEDULE_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["savedRef","cadence","timezone","localTime",
  "firstDate","requestKey"].includes(k)))
  throw new BadRequestException({code:"MIS_SCHEDULE_INVALID"});
 const savedRef=parseId(x.savedRef),requestKey=parseId(x.requestKey);
 const cadence=x.cadence,timezone=x.timezone,
  localTime=x.localTime,firstDate=x.firstDate;
 if(typeof cadence!=="string"||!cadenceSet.has(cadence)||
  typeof timezone!=="string"||timezone.length>64||timezone.length<3||
  typeof localTime!=="string"||!HOUR.test(localTime)||
  typeof firstDate!=="string"||!DATE.test(firstDate)||
  Number.isNaN(new Date(firstDate+"T00:00:00Z").getTime())||
  new Date(firstDate+"T00:00:00Z").toISOString().slice(0,10)!==firstDate)
  throw new BadRequestException({code:"MIS_SCHEDULE_INVALID",
   message:"Choose a valid local date, time, timezone and recurrence."});
 try{new Intl.DateTimeFormat("en-GB",{timeZone:timezone}).format(new Date());}
 catch{throw new BadRequestException({code:"MIS_SCHEDULE_ZONE_INVALID",field:"timezone",
  message:"Choose a recognized timezone."});}
 return {savedRef,requestKey,cadence:cadence as Input["cadence"],
  timezone,localTime,firstDate};
}
/** The current timezone and DST offset are derived from IANA data, not from
 * server timezone or a fixed UTC offset. Nonexistent DST wall times reject.
 */
export function zonedLocalDate(date:string,time:string,zone:string){
 const [y,m,d]=date.split("-").map(Number),
  [h,minute]=time.split(":").map(Number);
 const target=Date.UTC(y,m-1,d,h,minute);
 const fmt=new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 let guess=target;
 const parts=(ms:number)=>{
  const record=Object.fromEntries(
   fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {year:Number(record.year),month:Number(record.month),day:Number(record.day),
   hour:Number(record.hour),minute:Number(record.minute)};
 };
 for(let attempt=0;attempt<4;attempt++){
  const c=parts(guess);
  const actual=Date.UTC(c.year,c.month-1,c.day,c.hour,c.minute);
  if(actual===target)break;
  guess+=target-actual;
 }
 const final=parts(guess);
 if(final.year!==y||final.month!==m||final.day!==d||
  final.hour!==h||final.minute!==minute)
  throw new BadRequestException({code:"MIS_SCHEDULE_DST_INVALID",field:"localTime",
   message:"That local time does not exist on this date. Choose another time."});
 return new Date(guess);
}
/** Recompute future recurrence from the local wall calendar, never by adding
 * 24h UTC (DST) or scanning account data. Existing recurrence anchor remains
 * exact across restarts/claims; nonexistent DST times are skipped, not shifted
 * to a different hour. Max 24 candidates and no unbounded iteration.
 */
export function nextScheduleOccurrence(input:{
 cadence:string;timezone:string;local_time:string;
 weekday:number|null;monthday:number|null;annual_month:number|null
},after:Date):Date{
 const zone=input.timezone;
 const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:zone,
  year:"numeric",month:"2-digit",day:"2-digit"});
 const parts=Object.fromEntries(
  fmt.formatToParts(after).map(p=>[p.type,p.value]));
 const y=Number(parts.year),m=Number(parts.month),d=Number(parts.day);
 const time=input.local_time.slice(0,5);
 const base=new Date(Date.UTC(y,m-1,d));
 const possible:(Date|null)[]=[];
 if(input.cadence==="DAILY"){
  for(let n=0;n<4;n++)possible.push(new Date(base.getTime()+n*86400000));
 }else if(input.cadence==="WEEKLY"&&input.weekday!==null){
  for(let n=0;n<22;n++){
   const day=new Date(base.getTime()+n*86400000);
   if(day.getUTCDay()===input.weekday)possible.push(day);
  }
 }else if(input.cadence==="MONTHLY"&&input.monthday!==null){
  for(let n=0;n<15;n++){
   possible.push(new Date(Date.UTC(y,m-1+n,input.monthday)));
  }
 }else if(input.cadence==="YEARLY"&&
   input.monthday!==null&&input.annual_month!==null){
  for(let n=0;n<5;n++){
   possible.push(new Date(Date.UTC(y+n,input.annual_month-1,input.monthday)));
  }
 }
 for(const x of possible){
  if(!x)continue;
  const day=x.toISOString().slice(0,10);
  try{
   const candidate=zonedLocalDate(day,time,zone);
   if(candidate.getTime()>after.getTime()+1000)return candidate;
  }catch(e){
   if(!(e instanceof BadRequestException))throw e;
  }
 }
 throw new ConflictException({code:"MIS_SCHEDULE_DATE_INVALID",
  message:"A future occurrence cannot be calculated. Review the schedule."});
}

const summary=(row:Schedule)=>({
 ref:row.id,state:row.state,cadence:row.cadence,
 savedReportName:row.saved_report_name??"Saved report",
 timezone:row.timezone,localTime:row.local_time,
 nextDueAt:row.next_due_utc,revision:row.revision,
 updatedAt:row.updated_at,canActivate:row.state==="PAUSED"
});
/** US-005 supports only the original CG09 scheduled posted-summary
 * reader and verified CG19 IN_APP delivery. Cross-user or external-channel
 * reports remain unavailable until their source/recipient grants are owned.
 * The due worker never retains user credentials or creates a login session.
 */
@Injectable()
export class MisReportScheduleService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly saved:MisSavedReportService,
  private readonly sources:MisReportSourceService){}
 private async actor(token:string){
  await this.sessions.requireAction(token,"mis.reports.view");
  return this.sessions.requireAction(token,"mis.reports.schedule");
 }
 private async eligible(token:string,savedRef:string){
  await this.sessions.requireAction(token,"mis.reports.export");
  await this.sessions.requireAction(token,"finance.reports.view");
  await this.sessions.requireAction(token,"communications.notifications.view");
  const saved=await this.saved.authorizedRequest(token,savedRef);
  if(saved.request.kind!=="FINANCE_POSTED_SUMMARY"||
     saved.request.view!=="SUMMARY"||saved.request.offset!==0)
   throw new BadRequestException({code:"MIS_SCHEDULE_SOURCE_UNSUPPORTED",
    message:"Scheduled delivery currently supports only your posted finance summary."});
  await this.sources.preview(token,saved.request);
  return saved;
 }
 async list(token:string){
  const actor=await this.actor(token);
  const q=await this.db.query<Schedule>(
   "SELECT s.*,r.display_name AS saved_report_name FROM cg20_report_schedule s "+
   "JOIN cg20_saved_report r ON r.root_realm_id=s.root_realm_id "+
   "AND r.id=s.saved_ref WHERE s.root_realm_id=$1 "+
   "AND s.owner_account_ref=$2 ORDER BY s.updated_at DESC,s.id DESC LIMIT 51",
   [actor.realmId,actor.accountId]);
  return {schedules:q.rows.slice(0,50).map(summary),
   hasMore:q.rows.length>50,
   activationAvailable:true,
   channel:"IN_APP",
   message:"Schedules for your authorized posted-finance summary send a private in-app notice after the original report file is confirmed."};
 }
 async create(token:string,raw:unknown){
  const actor=await this.actor(token),input=parse(raw);
  // Current account is the sole currently supported recipient. All other
  // recipient/source combinations are denied instead of inheriting grants.
  const saved=await this.eligible(token,input.savedRef);
  const next=zonedLocalDate(input.firstDate,input.localTime,input.timezone);
  if(next.getTime()<Date.now()+60000||
    next.getTime()>Date.now()+366*2*86400000)
   throw new BadRequestException({code:"MIS_SCHEDULE_DATE_INVALID",field:"firstDate",
    message:"Choose a future date within the next two years."});
  const base=new Date(input.firstDate+"T00:00:00Z");
  const weekday=input.cadence==="WEEKLY"?base.getUTCDay():null;
  const monthday=input.cadence==="MONTHLY"||input.cadence==="YEARLY"?
   base.getUTCDate():null;
  if(monthday!==null&&monthday>28)
   throw new BadRequestException({code:"MIS_SCHEDULE_DAY_INVALID",field:"firstDate",
    message:"For monthly or annual delivery choose a day from 1 to 28."});
  const annualMonth=input.cadence==="YEARLY"?base.getUTCMonth()+1:null;
  const payload=digest(input);
  const tx=await this.db.connect();let started=false;
  try{
   await tx.query("BEGIN");started=true;
   await tx.query("SET LOCAL statement_timeout='8s'");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":cg20-schedule:"+actor.accountId+":"+input.requestKey]);
   const existing=await tx.query<Schedule>(
    "SELECT * FROM cg20_report_schedule WHERE root_realm_id=$1 "+
    "AND owner_account_ref=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,input.requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].payload_digest!==payload)
     throw new ConflictException({code:"MIS_SCHEDULE_RETRY_CONFLICT",
      message:"This request was already used with different schedule settings."});
    await tx.query("COMMIT");started=false;
    return {...summary(existing.rows[0]),replayed:true,
     message:"Your existing schedule is shown with its original confirmed state."};
   }
   const inserted=await tx.query<Schedule>(
    "INSERT INTO cg20_report_schedule(root_realm_id,owner_account_ref,"+
    "saved_ref,saved_revision,recipient_account_ref,request_key,payload_digest,"+
    "cadence,timezone,local_time,weekday,monthday,annual_month,"+
    "next_due_utc,state,channel) "+
    "VALUES($1,$2,$3,$4,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE','IN_APP') "+
    "RETURNING *",
    [actor.realmId,actor.accountId,input.savedRef,saved.revision,
     input.requestKey,payload,input.cadence,input.timezone,input.localTime,
     weekday,monthday,annualMonth,next]);
   await tx.query("COMMIT");started=false;
   return {...summary(inserted.rows[0]),replayed:false,
    message:"Schedule activated for a private in-app notification after its verified report is ready."};
  }catch(e){if(started)await tx.query("ROLLBACK").catch(()=>undefined);
   throw e;}finally{tx.release();}
 }
 async pause(token:string,refInput:string,raw:unknown){
  const actor=await this.actor(token),ref=parseId(refInput);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=="expectedRevision"))
   throw new BadRequestException({code:"MIS_SCHEDULE_INVALID"});
  const expected=(raw as Record<string,unknown>).expectedRevision;
  if(typeof expected!=="number"||!Number.isInteger(expected)||expected<1)
   throw new BadRequestException({code:"MIS_SCHEDULE_INVALID",
    message:"Refresh the schedule before changing it."});
  const q=await this.db.query<Schedule>(
   "UPDATE cg20_report_schedule SET state='PAUSED',revision=revision+1,"+
   "updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
   "AND owner_account_ref=$3 AND revision=$4 AND state='ACTIVE' RETURNING *",
   [actor.realmId,ref,actor.accountId,expected]);
  if(q.rows[0])return summary(q.rows[0]);
  const prior=await this.db.query<Schedule>(
   "SELECT * FROM cg20_report_schedule WHERE root_realm_id=$1 "+
   "AND id=$2 AND owner_account_ref=$3",
   [actor.realmId,ref,actor.accountId]);
  if(!prior.rows[0])throw new NotFoundException({code:"MIS_SCHEDULE_NOT_FOUND"});
  if(prior.rows[0].revision!==expected)
   throw new ConflictException({code:"MIS_SCHEDULE_CHANGED",
    message:"The schedule changed. Refresh before editing."});
  return summary(prior.rows[0]);
 }
 async resume(token:string,refInput:string){
  await this.actor(token);parseId(refInput);
  throw new ConflictException({code:"MIS_SCHEDULE_DELIVERY_NOT_READY",
   message:"Automatic report delivery is not available until current permission checks are configured."});
 }
 async history(token:string,refInput:string){
  const actor=await this.actor(token),ref=parseId(refInput);
  const own=await this.db.query(
   "SELECT id FROM cg20_report_schedule WHERE root_realm_id=$1 "+
   "AND id=$2 AND owner_account_ref=$3 LIMIT 1",
   [actor.realmId,ref,actor.accountId]);
  if(!own.rowCount)throw new NotFoundException({code:"MIS_SCHEDULE_NOT_FOUND"});
  const runs=await this.db.query<{state:string;created_at:Date;occurrence_due_utc:Date}>(
   "SELECT state,created_at,occurrence_due_utc FROM cg20_report_run "+
   "WHERE root_realm_id=$1 AND schedule_ref=$2 "+
   "ORDER BY created_at DESC,id DESC LIMIT 30",
   [actor.realmId,ref]);
  return {runs:runs.rows.map(r=>({state:r.state,createdAt:r.created_at,
   dueAt:r.occurrence_due_utc})),message:"Only original confirmed report runs appear in history."};
 }
}
