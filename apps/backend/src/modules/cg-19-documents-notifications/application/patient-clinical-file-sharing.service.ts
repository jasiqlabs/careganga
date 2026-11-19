import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthClinicianIdentityService}
 from "../../cg-14-healthcare-network/application/health-clinician-identity.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(value:unknown)=>{
 if(typeof value!=="string"||!UUID.test(value))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 return value;
};
const body=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 const data=v as Record<string,unknown>;
 if(Object.keys(data).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 return data;
};
type FileRow={id:string;patient_id:string;classification:string;mime:string;
 size_bytes:string;sha256:string;object_key:string;object_version:string;
 revision:number;revoked_at:Date|null;created_at:Date};
type GrantRow={id:string;patient_id:string;file_id:string;appointment_id:string;
 status:string;revision:number;revoked_at:Date|null};
type ClinicalSource={patient_id:string;doctor_id:string;center_id:string;revision:number};
/** Exact CG19 private file + existing CG15 appointment. A patient gives
 * active explicit permission for one file and one booking. The actual doctor
 * is NOT selected by phone or an unverified staff role; CG14 matches the
 * authenticated professional to the booked clinician in the same DB read.
 */
@Injectable()
export class PatientClinicalFileSharingService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly clinicians:HealthClinicianIdentityService,
  private readonly objects:PrivateObjectStorage){}
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   const value=await fn(c);await c.query("COMMIT");started=false;return value;
  }catch(e){if(started)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }
 private async own(c:PoolClient,actor:VerifiedFoundationActor,consent:boolean){
  const rows=await c.query<{id:string;care_consent:boolean|null}>(
   "SELECT p.id,(SELECT x.granted FROM cg15_patient_consent x "+
   "WHERE x.root_realm_id=p.root_realm_id AND x.patient_id=p.id "+
   "AND x.purpose='PATIENT_CARE' ORDER BY x.revision_no DESC LIMIT 1) "+
   "AS care_consent FROM cg15_patient_account_link link "+
   "JOIN cg15_patient p ON p.root_realm_id=link.root_realm_id "+
   "AND p.id=link.patient_id "+
   "JOIN account a ON a.id=link.account_id AND a.realm_id=link.root_realm_id "+
   "WHERE link.root_realm_id=$1 AND link.account_id=$2 AND link.revoked_at IS NULL "+
   "AND a.status='ACTIVE' AND p.profile_status='VERIFIED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event e "+
   "WHERE e.root_realm_id=p.root_realm_id AND e.patient_id=p.id) "+
   "FOR SHARE OF p,link,a",[actor.realmId,actor.accountId]);
  const own=rows.rows[0];
  if(!own||(consent&&own.care_consent!==true))
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return own.id;
 }
 private async ownFile(c:PoolClient,actor:VerifiedFoundationActor,
  file:string,patient:string,activeOnly=true){
  const result=await c.query<FileRow>(
   "SELECT id,patient_id,classification,mime,size_bytes,sha256,object_key,"+
   "object_version,revision,revoked_at,created_at "+
   "FROM cg19_patient_private_file WHERE realm_id=$1 AND patient_id=$2 "+
   "AND id=$3 AND ($4::boolean=false OR revoked_at IS NULL) "+
   "AND scan_status='CLEAN_VERIFIED' FOR SHARE",
   [actor.realmId,patient,file,activeOnly]);
  if(!result.rows[0])
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return result.rows[0];
 }
 private async ownAppointment(c:PoolClient,actor:VerifiedFoundationActor,
  booking:string,patient:string){
  const result=await c.query<{id:string;booking_display_id:string;
   doctor_name:string;center_name:string;doctor_id:string;center_id:string;revision:number}>(
   "SELECT id,booking_display_id,doctor_name,center_name,doctor_id,center_id,revision "+
   "FROM cg15_consultation_appointment "+
   "WHERE root_realm_id=$1 AND id=$2 AND patient_id=$3 "+
   "AND booking_state IN('CONFIRMED','ARRIVED','WAITING','IN_CONSULTATION','COMPLETED') "+
   "FOR SHARE",[actor.realmId,booking,patient]);
  if(!result.rows[0])
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return result.rows[0];
 }
 async share(bearer:string,fileRaw:string,raw:unknown){
  const actor=await this.sessions.verifySession(bearer);
  const file=id(fileRaw),input=body(raw,["requestKey","bookingRef"]);
  const requestKey=id(input.requestKey),booking=id(input.bookingRef);
  const digest=createHash("sha256").update(JSON.stringify([file,booking]))
   .digest("hex");
  return this.tx(async c=>{
   const patient=await this.own(c,actor,true);
   await this.ownFile(c,actor,file,patient);
   const appointment=await this.ownAppointment(c,actor,booking,patient);
   // A later patient-care withdrawal and re-grant must NOT resurrect an
   // old report share. Pin the exact currently granted consent revision.
   const care=await c.query<{revision_no:number;granted:boolean}>(
    "SELECT revision_no,granted FROM cg15_patient_consent "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND purpose='PATIENT_CARE' "+
    "ORDER BY revision_no DESC LIMIT 1",[actor.realmId,patient]);
   if(!care.rows[0]?.granted)
    throw new ForbiddenException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   const previous=await c.query<{request_digest:string;grant_id:string}>(
    "SELECT request_digest,grant_id FROM cg19_patient_clinical_file_grant_command "+
    "WHERE realm_id=$1 AND actor_account_id=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,requestKey]);
   if(previous.rows[0]){
    if(previous.rows[0].request_digest!==digest)
     throw new ConflictException({code:"CG19_PATIENT_FILE_REQUEST_CONFLICT"});
    const recorded=await c.query<GrantRow>(
     "SELECT id,patient_id,file_id,appointment_id,status,revision,revoked_at "+
     "FROM cg19_patient_clinical_file_grant WHERE realm_id=$1 AND id=$2",
     [actor.realmId,previous.rows[0].grant_id]);
    if(!recorded.rows[0])
     throw new ConflictException({code:"CG19_PATIENT_FILE_CHANGED"});
    return {grantRef:recorded.rows[0].id,status:recorded.rows[0].status,
     version:recorded.rows[0].revision,alreadyRequested:true};
   }
   const proposed=randomUUID();
   const inserted=await c.query<{id:string;revision:number}>(
    "INSERT INTO cg19_patient_clinical_file_grant("+
    "realm_id,id,patient_id,file_id,appointment_id,doctor_id,center_id,"+
    "appointment_revision,care_consent_revision,granted_by_account) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) "+
    "ON CONFLICT DO NOTHING RETURNING id,revision",
    [actor.realmId,proposed,patient,file,booking,appointment.doctor_id,
     appointment.center_id,appointment.revision,care.rows[0].revision_no,
     actor.accountId]);
   let ref=inserted.rows[0]?.id;
   if(!ref){
    const current=await c.query<{id:string;revision:number}>(
     "SELECT id,revision FROM cg19_patient_clinical_file_grant "+
     "WHERE realm_id=$1 AND patient_id=$2 AND file_id=$3 "+
     "AND appointment_id=$4 AND status='ACTIVE' FOR SHARE",
     [actor.realmId,patient,file,booking]);
    if(!current.rows[0])
     throw new ConflictException({code:"CG19_PATIENT_FILE_CHANGED"});
    ref=current.rows[0].id;
   }else{
    await c.query(
     "INSERT INTO cg19_patient_clinical_file_grant_event("+
     "realm_id,grant_id,action,actor_account_id) VALUES($1,$2,'GRANTED',$3)",
     [actor.realmId,ref,actor.accountId]);
   }
   const command=await c.query(
    "INSERT INTO cg19_patient_clinical_file_grant_command("+
    "realm_id,actor_account_id,request_key,request_digest,grant_id) "+
    "VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING request_key",
    [actor.realmId,actor.accountId,requestKey,digest,ref]);
   if(!command.rowCount)
    throw new ConflictException({code:"CG19_PATIENT_FILE_REQUEST_CONFLICT"});
   return {grantRef:ref,status:"ACTIVE",version:1,alreadyRequested:false};
  });
 }
 async myShares(bearer:string,fileRaw:string){
  const actor=await this.sessions.verifySession(bearer),file=id(fileRaw);
  return this.tx(async c=>{
   const patient=await this.own(c,actor,false);
   await this.ownFile(c,actor,file,patient,false);
   const rows=await c.query<{id:string;status:string;revision:number;
    booking_display_id:string;doctor_name:string;center_name:string;
    granted_at:Date;revoked_at:Date|null}>(
    "SELECT g.id,g.status,g.revision,a.booking_display_id,a.doctor_name,"+
    "a.center_name,g.granted_at,g.revoked_at "+
    "FROM cg19_patient_clinical_file_grant g "+
    "JOIN cg15_consultation_appointment a ON a.root_realm_id=g.realm_id "+
    "AND a.id=g.appointment_id AND a.patient_id=g.patient_id "+
    "WHERE g.realm_id=$1 AND g.patient_id=$2 AND g.file_id=$3 "+
    "ORDER BY g.granted_at DESC,g.id DESC LIMIT 30",
    [actor.realmId,patient,file]);
   return {shares:rows.rows.map(x=>({grantRef:x.id,status:x.status,
    version:x.revision,bookingId:x.booking_display_id,
    doctorName:x.doctor_name,centerName:x.center_name,
    grantedAt:x.granted_at.toISOString(),revoked:!!x.revoked_at}))};
  });
 }
 async revoke(bearer:string,grantRaw:string,raw:unknown){
  const actor=await this.sessions.verifySession(bearer),grant=id(grantRaw);
  const input=body(raw,["expectedVersion"]);
  if(!Number.isSafeInteger(input.expectedVersion)||
    Number(input.expectedVersion)<1||Number(input.expectedVersion)>2147483644)
   throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
  return this.tx(async c=>{
   const patient=await this.own(c,actor,false);
   const result=await c.query<GrantRow>(
    "SELECT id,patient_id,file_id,appointment_id,status,revision,revoked_at "+
    "FROM cg19_patient_clinical_file_grant "+
    "WHERE realm_id=$1 AND id=$2 AND patient_id=$3 FOR UPDATE",
    [actor.realmId,grant,patient]);
   const g=result.rows[0];
   if(!g)throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   if(g.status==="REVOKED")
    return {status:"REVOKED",version:g.revision};
   if(g.revision!==input.expectedVersion)
    throw new ConflictException({code:"CG19_PATIENT_FILE_CHANGED"});
   const applied=await c.query(
    "UPDATE cg19_patient_clinical_file_grant SET status='REVOKED',"+
    "revoked_at=now(),revision=revision+1 "+
    "WHERE realm_id=$1 AND id=$2 AND revision=$3 AND status='ACTIVE' RETURNING id",
    [actor.realmId,grant,g.revision]);
   if(!applied.rowCount)
    throw new ConflictException({code:"CG19_PATIENT_FILE_CHANGED"});
   await c.query(
    "INSERT INTO cg19_patient_clinical_file_grant_event("+
    "realm_id,grant_id,action,actor_account_id) VALUES($1,$2,'REVOKED',$3)",
    [actor.realmId,grant,actor.accountId]);
   return {status:"REVOKED",version:g.revision+1};
  });
 }
 private async currentClinicalSource(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,booking:string):Promise<ClinicalSource>{
  await this.centers.assertCurrent(c,actor,center,"health.visits.manage");
  await this.centers.assertCurrent(c,actor,center,"health.visits.clinical.manage");
  const source=await c.query<ClinicalSource>(
   "SELECT a.patient_id,a.doctor_id,a.center_id,a.revision FROM cg15_consultation_appointment a "+
   "JOIN cg15_visit_queue v ON v.root_realm_id=a.root_realm_id "+
   "AND v.appointment_id=a.id AND v.center_id=a.center_id "+
   "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id "+
   "AND p.id=a.patient_id "+
   "WHERE a.root_realm_id=$1 AND a.center_id=$2 AND a.id=$3 "+
   "AND p.profile_status='VERIFIED' "+
   "AND v.state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED') "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
   "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_account_link owner "+
   "JOIN account acct ON acct.id=owner.account_id AND acct.realm_id=owner.root_realm_id "+
   "WHERE owner.root_realm_id=p.root_realm_id AND owner.patient_id=p.id "+
   "AND owner.revoked_at IS NULL AND acct.status='ACTIVE') "+
   "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
   "AND consent.purpose='PATIENT_CARE' ORDER BY consent.revision_no DESC LIMIT 1)=true "+
   "FOR SHARE OF a,v,p",
   [actor.realmId,center,booking]);
  const current=source.rows[0];
  if(!current)throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  await this.clinicians.assertCurrentAppointmentClinician(
   c,actor,center,current.doctor_id);
  return current;
 }
 async availableForClinician(bearer:string,centerRaw:string,bookingRaw:string){
  const actor=await this.sessions.verifySession(bearer);
  const center=id(centerRaw),booking=id(bookingRaw);
  return this.tx(async c=>{
   const source=await this.currentClinicalSource(c,actor,center,booking);
   const docs=await c.query<FileRow>(
    "SELECT f.id,f.patient_id,f.classification,f.mime,f.size_bytes,f.sha256,"+
    "f.object_key,f.object_version,f.revision,f.revoked_at,f.created_at "+
    "FROM cg19_patient_clinical_file_grant g "+
    "JOIN cg19_patient_private_file f ON f.realm_id=g.realm_id "+
    "AND f.patient_id=g.patient_id AND f.id=g.file_id "+
    "WHERE g.realm_id=$1 AND g.appointment_id=$2 AND g.patient_id=$3 "+
    "AND g.doctor_id=$4 AND g.center_id=$5 AND g.appointment_revision=$6 "+
    "AND g.care_consent_revision=(SELECT x.revision_no FROM cg15_patient_consent x "+
    "WHERE x.root_realm_id=g.realm_id AND x.patient_id=g.patient_id "+
    "AND x.purpose='PATIENT_CARE' ORDER BY x.revision_no DESC LIMIT 1) "+
    "AND g.status='ACTIVE' AND g.revoked_at IS NULL "+
    "AND EXISTS(SELECT 1 FROM cg15_patient_account_link live_owner "+
    "WHERE live_owner.root_realm_id=g.realm_id "+
    "AND live_owner.patient_id=g.patient_id "+
    "AND live_owner.account_id=g.granted_by_account "+
    "AND live_owner.revoked_at IS NULL) "+
    "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
    "ORDER BY f.created_at DESC,f.id DESC LIMIT 25",
    [actor.realmId,booking,source.patient_id,source.doctor_id,source.center_id,source.revision]);
   return {bookingRef:booking,files:docs.rows.map(x=>({
    fileRef:x.id,classification:x.classification,
    mime:x.mime,sizeBytes:Number(x.size_bytes),createdAt:x.created_at.toISOString()
   }))};
  });
 }
 private async clinicalFile(actor:VerifiedFoundationActor,
  center:string,booking:string,file:string,audit=false){
  return this.tx(async c=>{
   const source=await this.currentClinicalSource(c,actor,center,booking);
   const rows=await c.query<FileRow>(
    "SELECT f.id,f.patient_id,f.classification,f.mime,f.size_bytes,f.sha256,"+
    "f.object_key,f.object_version,f.revision,f.revoked_at,f.created_at "+
    "FROM cg19_patient_clinical_file_grant g "+
    "JOIN cg19_patient_private_file f ON f.realm_id=g.realm_id "+
    "AND f.patient_id=g.patient_id AND f.id=g.file_id "+
    "WHERE g.realm_id=$1 AND g.patient_id=$2 AND g.appointment_id=$3 "+
    "AND g.file_id=$4 AND g.doctor_id=$5 AND g.center_id=$6 "+
    "AND g.appointment_revision=$7 "+
    "AND g.care_consent_revision=(SELECT x.revision_no FROM cg15_patient_consent x "+
    "WHERE x.root_realm_id=g.realm_id AND x.patient_id=g.patient_id "+
    "AND x.purpose='PATIENT_CARE' ORDER BY x.revision_no DESC LIMIT 1) "+
    "AND g.status='ACTIVE' AND g.revoked_at IS NULL "+
    "AND EXISTS(SELECT 1 FROM cg15_patient_account_link live_owner "+
    "WHERE live_owner.root_realm_id=g.realm_id "+
    "AND live_owner.patient_id=g.patient_id "+
    "AND live_owner.account_id=g.granted_by_account "+
    "AND live_owner.revoked_at IS NULL) "+
    "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
    "FOR SHARE OF f,g",
    [actor.realmId,source.patient_id,booking,file,source.doctor_id,source.center_id,source.revision]);
   if(!rows.rows[0])
    throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   if(audit){
    // Source-verified successful read: only safe root/doctor/file reference
    // metadata is retained, NEVER bytes or patient medical text.
    await c.query(
     "INSERT INTO cg19_patient_clinical_file_read_event("+
     "realm_id,patient_id,appointment_id,file_id,doctor_id,center_id,"+
     "actor_account_id,action) VALUES($1,$2,$3,$4,$5,$6,$7,'AUTHORIZED_READ')",
     [actor.realmId,source.patient_id,booking,file,
      source.doctor_id,center,actor.accountId]);
   }
   return rows.rows[0];
  });
 }
 async clinicianRead(bearer:string,centerRaw:string,
  bookingRaw:string,fileRaw:string){
  const actor=await this.sessions.verifySession(bearer);
  const center=id(centerRaw),booking=id(bookingRaw),file=id(fileRaw);
  const original=await this.clinicalFile(actor,center,booking,file);
  const bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:original.object_key,objectVersion:original.object_version,
   maxBytes:Number(original.size_bytes)});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(original.size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==original.sha256)
   throw new ServiceUnavailableException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  // Disallowed ownership/role/care-consent/explicit share after async object
  // fetch means no bytes are sent to the clinician.
  const current=await this.clinicalFile(actor,center,booking,file,true);
  if(current.revision!==original.revision||
    current.object_version!==original.object_version)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return {bytes,mime:original.mime};
 }
}
