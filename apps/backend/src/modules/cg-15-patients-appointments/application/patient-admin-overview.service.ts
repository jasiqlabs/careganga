import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool} from "pg";
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
  private readonly sessions:SessionService){}

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
