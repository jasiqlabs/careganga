import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MAX=10485760;
type Class="PATIENT_PHOTO"|"PATIENT_UPLOADED_PRESCRIPTION"|"PATIENT_MEDICAL_REPORT";
type Mime="application/pdf"|"image/jpeg"|"image/png"|"image/webp";
const CLASSES=new Set<Class>(["PATIENT_PHOTO","PATIENT_UPLOADED_PRESCRIPTION",
 "PATIENT_MEDICAL_REPORT"]);
const MIMES=new Set<Mime>(["application/pdf","image/jpeg","image/png","image/webp"]);
type Intent={realm_id:string;id:string;patient_id:string;requested_by:string;
 request_key:string;request_digest:string;classification:Class;mime:Mime;
 size_bytes:string;sha256:string;object_key:string;reserved_until:Date;
 status:string};
type Stored={id:string;patient_id:string;intent_id:string;classification:Class;
 mime:Mime;size_bytes:string;sha256:string;object_key:string;
 object_version:string;revision:number;revoked_at:Date|null;created_at:Date};
const validId=(s:unknown)=>{if(typeof s!=="string"||!UUID.test(s))
 throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});return s;};
const payload=(x:unknown,allowed:string[])=>{
 if(!x||typeof x!=="object"||Array.isArray(x))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 const v=x as Record<string,unknown>;
 if(Object.keys(v).some(k=>!allowed.includes(k)))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 return v;
};
function parse(raw:unknown){
 const v=payload(raw,["requestKey","classification","mime","sizeBytes","sha256"]);
 const key=validId(v.requestKey);
 if(!CLASSES.has(v.classification as Class)||!MIMES.has(v.mime as Mime)||
   (v.classification==="PATIENT_PHOTO"&&v.mime==="application/pdf")||
   !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||
   Number(v.sizeBytes)>MAX||typeof v.sha256!=="string"||!SHA.test(v.sha256))
  throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
 return {key,classification:v.classification as Class,mime:v.mime as Mime,
  size:Number(v.sizeBytes),sha256:v.sha256 as string};
}
const checksum=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class PatientPrivateFilesService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly objects:PrivateObjectStorage){}
 private async transaction<T>(run:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   const value=await run(c);
   await c.query("COMMIT");open=false;return value;
  }catch(e){if(open)try{await c.query("ROLLBACK");}catch{}throw e;}
  finally{c.release();}
 }
 /** Own verified person only, never patient ID, family phone or staff role.
  * This is a patient-owned file route. Clinic clinical-purpose access is NOT
  * inferred from the patient login or from a CareGanga center affiliation.
  */
 private async own(c:PoolClient,actor:VerifiedFoundationActor,
  requireConsent:boolean,lock=false){
  const row=await c.query<{id:string;consent_granted:boolean|null}>(
   "SELECT p.id,(SELECT x.granted FROM cg15_patient_consent x "+
   "WHERE x.root_realm_id=p.root_realm_id AND x.patient_id=p.id "+
   "AND x.purpose='PATIENT_CARE' ORDER BY x.revision_no DESC LIMIT 1) "+
   "AS consent_granted FROM cg15_patient_account_link l "+
   "JOIN cg15_patient p ON p.root_realm_id=l.root_realm_id AND p.id=l.patient_id "+
   "JOIN account a ON a.realm_id=l.root_realm_id AND a.id=l.account_id "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.revoked_at IS NULL "+
   "AND a.status='ACTIVE' AND p.profile_status='VERIFIED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
   "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
   (lock?"FOR SHARE OF l,p,a":""),
   [actor.realmId,actor.accountId]);
  const found=row.rows[0];
  if(!found||requireConsent&&found.consent_granted!==true)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return found.id;
 }
 private async audit(c:PoolClient,actor:VerifiedFoundationActor,
  patient:string,intent:string,file:string|null,action:string){
  await c.query(
   "INSERT INTO cg19_patient_file_event("+
   "realm_id,patient_id,intent_id,file_id,actor_account_id,action) "+
   "VALUES($1,$2,$3,$4,$5,$6)",
   [actor.realmId,patient,intent,file,actor.accountId,action]);
 }
 async initiate(bearer:string,raw:unknown){
  const actor=await this.sessions.verifySession(bearer),v=parse(raw);
  const digest=checksum([v.classification,v.mime,v.size,v.sha256]);
  const created=await this.transaction(async c=>{
   const patient=await this.own(c,actor,true,true);
   const proposed=randomUUID(),objectKey="careganga/private/cg19/"+
    actor.realmId+"/patient/"+randomUUID();
   const result=await c.query<Intent>(
    "INSERT INTO cg19_patient_file_intent("+
    "realm_id,id,patient_id,requested_by,request_key,request_digest,"+
    "classification,mime,size_bytes,sha256,object_key,reserved_until) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '15 minutes') "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,proposed,patient,actor.accountId,v.key,digest,
     v.classification,v.mime,v.size,v.sha256,objectKey]);
   if(result.rows[0]){
    await this.audit(c,actor,patient,result.rows[0].id,null,"INTENT_CREATED");
    return result.rows[0];
   }
   const old=await c.query<Intent>(
    "SELECT * FROM cg19_patient_file_intent WHERE realm_id=$1 "+
    "AND requested_by=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,v.key]);
   if(!old.rows[0]||old.rows[0].request_digest!==digest||
     old.rows[0].patient_id!==patient)
    throw new ConflictException({code:"CG19_PATIENT_FILE_REQUEST_CONFLICT"});
   return old.rows[0];
  });
  if(created.status==="VALIDATED"||created.status==="REJECTED"||
    created.reserved_until.getTime()<=Date.now())
   return {uploadRef:created.id,status:created.status,uploadReady:false};
  try{
   const reservation=await this.objects.reservePrivateUpload({
    objectKey:created.object_key,requestKey:created.request_key,
    mime:created.mime,sizeBytes:Number(created.size_bytes),sha256:created.sha256,
    expiresAt:created.reserved_until.toISOString()
   });
   const when=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!reservation.reservationRef||
    !Number.isFinite(when)||when<=Date.now()||
    when>created.reserved_until.getTime()||
    reservation.headers?.["Content-Type"]!==created.mime||
    !Object.entries(reservation.headers).every(([k,val])=>
      ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
       "If-None-Match"].includes(k)&&typeof val==="string"&&val.length<=160))
    throw new ServiceUnavailableException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   const applied=await this.db.query(
    "UPDATE cg19_patient_file_intent SET status='INITIATED',"+
    "storage_reservation_ref=$3,updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','UNKNOWN') "+
    "AND reserved_until>now() RETURNING id",
    [actor.realmId,created.id,reservation.reservationRef]);
   if(!applied.rowCount)
    throw new ConflictException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   return {uploadRef:created.id,status:"UPLOAD_READY",uploadReady:true,
    uploadUrl:reservation.url,uploadHeaders:reservation.headers,
    expiresAt:reservation.expiresAt};
  }catch{
   await this.db.query(
    "UPDATE cg19_patient_file_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status='INITIATED'",
    [actor.realmId,created.id]);
   return {uploadRef:created.id,status:"STORAGE_UNAVAILABLE",uploadReady:false,
    message:"Secure patient upload or malware scan is unavailable."};
  }
 }
 private async original(actor:VerifiedFoundationActor,ref:string){
  const row=await this.db.query<Intent>(
   "SELECT * FROM cg19_patient_file_intent WHERE realm_id=$1 AND id=$2 "+
   "AND requested_by=$3",
   [actor.realmId,validId(ref),actor.accountId]);
  if(!row.rows[0])
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return row.rows[0];
 }
 async status(bearer:string,ref:string){
  const actor=await this.sessions.verifySession(bearer);
  const owner=await this.transaction(c=>this.own(c,actor,false,true));
  const row=await this.original(actor,ref);
  if(row.patient_id!==owner)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  const file=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_patient_private_file "+
   "WHERE realm_id=$1 AND intent_id=$2 AND revoked_at IS NULL",
   [actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,
   fileRef:row.status==="VALIDATED"?file.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?file.rows[0]?.revision??null:null,
   cleanVerified:row.status==="VALIDATED"&&!!file.rows[0]};
 }
 async confirm(bearer:string,ref:string){
  const actor=await this.sessions.verifySession(bearer);
  const row=await this.original(actor,ref);
  const patient=await this.transaction(c=>this.own(c,actor,true,true));
  if(row.patient_id!==patient)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  if(row.status==="VALIDATED")return this.status(bearer,ref);
  if(row.status==="REJECTED"||row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   verified=await this.objects.verifyPrivateObject({
    objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
    sha256:row.sha256
   });
  }catch{
   await this.db.query(
    "UPDATE cg19_patient_file_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status='INITIATED'",
    [actor.realmId,row.id]);
   return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const verifiedAt=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&
   verified.sha256===row.sha256&&verified.mime===row.mime&&
   verified.sizeBytes===Number(row.size_bytes)&&
   typeof verified.objectVersion==="string"&&
   verified.objectVersion.length>0&&verified.objectVersion.length<=160&&
   typeof verified.scanProofRef==="string"&&
   verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
   Number.isFinite(verifiedAt)&&verifiedAt<=Date.now()+60000&&
   Date.now()-verifiedAt<900000;
  return this.transaction(async c=>{
   const own=await this.own(c,actor,true,true);
   const current=await c.query<Intent>(
    "SELECT * FROM cg19_patient_file_intent WHERE realm_id=$1 AND id=$2 "+
    "AND requested_by=$3 FOR UPDATE",
    [actor.realmId,row.id,actor.accountId]);
   const locked=current.rows[0];
   if(!locked||locked.patient_id!==own||
    locked.reserved_until.getTime()<=Date.now()||locked.status==="REJECTED")
    throw new ConflictException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   if(locked.status==="VALIDATED"){
    const previously=await c.query<{id:string;revision:number}>(
     "SELECT id,revision FROM cg19_patient_private_file "+
     "WHERE realm_id=$1 AND intent_id=$2 AND patient_id=$3 "+
     "AND revoked_at IS NULL",
     [actor.realmId,row.id,own]);
    return {uploadRef:row.id,status:"VALIDATED",
     fileRef:previously.rows[0]?.id??null,
     fileVersion:previously.rows[0]?.revision??null,
     cleanVerified:!!previously.rows[0]};
   }
   if(!clean){
    await c.query(
     "UPDATE cg19_patient_file_intent SET status='REJECTED',updated_at=now() "+
     "WHERE realm_id=$1 AND id=$2",[actor.realmId,row.id]);
    await this.audit(c,actor,own,row.id,null,"UPLOAD_REJECTED");
    return {uploadRef:row.id,status:"REJECTED",cleanVerified:false};
   }
   await c.query(
    "UPDATE cg19_patient_file_intent SET status='VALIDATED',updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2",[actor.realmId,row.id]);
   const file=await c.query<{id:string;revision:number}>(
    "INSERT INTO cg19_patient_private_file("+
    "realm_id,patient_id,intent_id,classification,mime,size_bytes,sha256,"+
    "object_key,object_version,scan_proof_ref,scan_status,scanned_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CLEAN_VERIFIED',$11) "+
    "ON CONFLICT(realm_id,intent_id) DO NOTHING RETURNING id,revision",
    [actor.realmId,own,row.id,row.classification,row.mime,row.size_bytes,
     row.sha256,row.object_key,verified.objectVersion,verified.scanProofRef,
     new Date(verified.verifiedAt)]);
   if(!file.rows[0])
    throw new ConflictException({code:"CG19_PATIENT_FILE_REQUEST_CONFLICT"});
   await this.audit(c,actor,own,row.id,file.rows[0].id,"UPLOAD_VERIFIED");
   return {uploadRef:row.id,status:"VALIDATED",fileRef:file.rows[0].id,
    fileVersion:file.rows[0].revision,cleanVerified:true};
  });
 }
 async list(bearer:string,after?:string){
  const actor=await this.sessions.verifySession(bearer);
  const patient=await this.transaction(c=>this.own(c,actor,false,true));
  let createdAt:string|null=null,prior:string|null=null;
  if(after!==undefined){
   const match=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)_([0-9a-f-]{36})$/i.exec(after);
   if(!match||!UUID.test(match[2])||!Number.isFinite(Date.parse(match[1])))
    throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
   createdAt=match[1];prior=match[2];
  }
  const rows=await this.db.query<Stored>(
   "SELECT id,patient_id,intent_id,classification,mime,size_bytes,sha256,"+
   "object_key,object_version,revision,revoked_at,created_at "+
   "FROM cg19_patient_private_file WHERE realm_id=$1 AND patient_id=$2 "+
   "AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) "+
   "ORDER BY created_at DESC,id DESC LIMIT 26",
   [actor.realmId,patient,createdAt,prior]);
  const page=rows.rows.slice(0,25);
  return {files:page.map(row=>({fileRef:row.id,classification:row.classification,
   mime:row.mime,sizeBytes:Number(row.size_bytes),version:row.revision,
   revoked:!!row.revoked_at,createdAt:row.created_at.toISOString()})),
   next:rows.rows.length>25&&page.length?
    page[page.length-1].created_at.toISOString()+"_"+page[page.length-1].id:null};
 }
 private async currentFile(actor:VerifiedFoundationActor,ref:string){
  const patient=await this.transaction(c=>this.own(c,actor,false,true));
  const row=await this.db.query<Stored>(
   "SELECT id,patient_id,intent_id,classification,mime,size_bytes,sha256,"+
   "object_key,object_version,revision,revoked_at,created_at "+
   "FROM cg19_patient_private_file WHERE realm_id=$1 AND id=$2 "+
   "AND patient_id=$3",
   [actor.realmId,validId(ref),patient]);
  if(!row.rows[0]||row.rows[0].revoked_at)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return row.rows[0];
 }
 async download(bearer:string,ref:string){
  const actor=await this.sessions.verifySession(bearer);
  const before=await this.currentFile(actor,ref);
  const bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:before.object_key,objectVersion:before.object_version,
   maxBytes:Number(before.size_bytes)});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==before.sha256)
   throw new ServiceUnavailableException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  // Auth/account, person link and file revocation are NOT cached across
  // the remote storage read. No signed GET URL or cross-center shortcut.
  const now=await this.currentFile(actor,ref);
  if(now.revision!==before.revision||now.object_version!==before.object_version)
   throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
  return {bytes,mime:before.mime};
 }
 async revoke(bearer:string,ref:string,raw:unknown){
  const actor=await this.sessions.verifySession(bearer),fileRef=validId(ref);
  const body=payload(raw,["expectedVersion"]);
  const version=body.expectedVersion;
  if(!Number.isSafeInteger(version)||Number(version)<1)
   throw new BadRequestException({code:"CG19_PATIENT_FILE_INVALID"});
  return this.transaction(async c=>{
   const patient=await this.own(c,actor,false,true);
   const r=await c.query<Stored>(
    "SELECT id,patient_id,intent_id,classification,mime,size_bytes,sha256,"+
    "object_key,object_version,revision,revoked_at,created_at "+
    "FROM cg19_patient_private_file WHERE realm_id=$1 AND id=$2 "+
    "AND patient_id=$3 FOR UPDATE",
    [actor.realmId,fileRef,patient]);
   const item=r.rows[0];
   if(!item)throw new NotFoundException({code:"CG19_PATIENT_FILE_UNAVAILABLE"});
   if(item.revoked_at)return {status:"REVOKED",version:item.revision};
   if(item.revision!==version)
    throw new ConflictException({code:"CG19_PATIENT_FILE_CHANGED"});
   await c.query(
    "UPDATE cg19_patient_private_file SET revoked_at=now(),revision=revision+1 "+
    "WHERE realm_id=$1 AND id=$2 AND revision=$3",
    [actor.realmId,fileRef,version]);
   await this.audit(c,actor,patient,item.intent_id,item.id,"FILE_REVOKED");
   return {status:"REVOKED",version:version+1};
  });
 }
}
