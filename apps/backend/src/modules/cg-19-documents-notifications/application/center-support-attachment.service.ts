import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterSupportScopeFacade} from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const valid=(x:unknown)=>{if(typeof x!=="string"||!UUID.test(x))
 throw new BadRequestException({code:"CENTER_SUPPORT_FILE_INVALID"});return x;};
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Source={id:string;realm_id:string;support_case_id:string;health_center_id:string;
 health_source_version:number;requested_by:string;request_key:string;
 request_digest:string;mime:string;size_bytes:string;expected_sha256:string;
 status:string;object_key:string;reserved_until:Date};
type Saved={id:string;revision:number;object_key:string;object_version:string;
 verified_size_bytes:string;verified_sha256:string;original_mime:string;
 revoked_at:Date|null;scan_status:string;status:string};
function payload(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"CENTER_SUPPORT_FILE_INVALID"});
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","mime","sizeBytes","sha256"].includes(k))||
  !Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1||
  !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
  Number(x.sizeBytes)>10*1024*1024||!MIME.has(String(x.mime))||
  typeof x.sha256!=="string"||!SHA.test(x.sha256))
  throw new BadRequestException({code:"CENTER_SUPPORT_FILE_INVALID"});
 return {key:valid(x.requestKey),version:Number(x.expectedRevision),
  mime:String(x.mime),size:Number(x.sizeBytes),sha256:x.sha256};
}
@Injectable()
export class CenterSupportAttachmentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly scope:HealthCenterSupportScopeFacade,
  private readonly objects:PrivateObjectStorage){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let started=false;
  try{
   await tx.query("BEGIN");started=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");started=false;return result;
  }catch(e){if(started)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 private async own(tx:PoolClient,actor:VerifiedFoundationActor,
   center:string,caseRef:string,expected:number|null=null,editable=false){
  await this.scope.assertCurrent(tx,actor,center);
  const original=await tx.query<{id:string;revision:number;status:string}>(
   "SELECT id,revision,status FROM cg19_support_case "+
   "WHERE realm_id=$1 AND center_id=$2 AND id=$3 AND "+
   "source_channel='CENTER_PORTAL' FOR SHARE",
   [actor.realmId,center,caseRef]);
  const c=original.rows[0];
  if(!c||editable&&(c.status==="CLOSED"||
    (expected!==null&&expected!==c.revision)))
   throw new ConflictException({code:"CENTER_SUPPORT_FILE_CHANGED"});
  return c;
 }
 private async event(tx:PoolClient,actor:VerifiedFoundationActor,
   center:string,caseRef:string,action:string,intent:string|null,file:string|null){
  await tx.query(
   "INSERT INTO cg19_support_attachment_event(realm_id,support_case_id,center_id,"+
   "actor_ref,action,intent_ref,file_ref) VALUES($1,$2,$3,$4,$5,$6,$7)",
   [actor.realmId,caseRef,center,actor.accountId,action,intent,file]);
 }
 async initiate(bearer:string,centerRef:string,caseRef:string,body:unknown){
  const center=valid(centerRef),ref=valid(caseRef),input=payload(body);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  const digest=sha(["CG19_SUPPORT",center,ref,input]);
  const objectKey="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
  const intent=await this.run(async tx=>{
   await this.own(tx,actor,center,ref,input.version,true);
   const created=await tx.query<Source>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
    "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
    "object_key,reserved_until,owner_kind,health_center_id,health_source_version,"+
    "support_case_id) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,'SUPPORT_CASE_ATTACHMENT',"+
    "$9,now()+interval '15 minutes','CG19_SUPPORT',$10,$2,$11) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,input.version,actor.accountId,input.key,input.mime,input.size,
     input.sha256,digest,objectKey,center,ref]);
   if(created.rows[0]){
    await this.event(tx,actor,center,ref,"UPLOAD_INITIATED",created.rows[0].id,null);
    return created.rows[0];
   }
   const earlier=await tx.query<Source>(
    "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND "+
    "requested_by=$2 AND request_key=$3 AND owner_kind='CG19_SUPPORT' "+
    "FOR SHARE",[actor.realmId,actor.accountId,input.key]);
   if(!earlier.rows[0]||earlier.rows[0].request_digest!==digest||
      earlier.rows[0].support_case_id!==ref||earlier.rows[0].health_center_id!==center)
    throw new ConflictException({code:"CENTER_SUPPORT_FILE_CHANGED"});
   return earlier.rows[0];
  });
  if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
    intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status};
  try{
   const grant=await this.objects.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()
   });
   const end=Date.parse(grant.expiresAt);
   if(!grant.url.startsWith("https://")||!grant.reservationRef||
     grant.reservationRef.length>160||!Number.isFinite(end)||end<=Date.now()||
     end>intent.reserved_until.getTime()||
     grant.headers?.["Content-Type"]!==intent.mime||
     !Object.entries(grant.headers).every(([k,v])=>
       ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
        "If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))
    throw new ServiceUnavailableException("Private file upload is unavailable");
   const r=await this.db.query(
    "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',"+
    "updated_at=now() WHERE id=$1 AND realm_id=$2 AND owner_kind='CG19_SUPPORT' "+
    "AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
    [intent.id,actor.realmId,grant.reservationRef]);
   if(!r.rowCount)throw new ConflictException("Upload expired");
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:grant.url,
    uploadHeaders:grant.headers,expiresAt:grant.expiresAt};
  }catch{
   await this.db.query("UPDATE cg19_upload_intent SET status='UNKNOWN',"+
    "updated_at=now() WHERE id=$1 AND realm_id=$2 AND owner_kind='CG19_SUPPORT' "+
    "AND status='INITIATED'",[intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
    message:"The original support attachment could not be verified."};
  }
 }
 private async source(bearer:string,centerRef:string,caseRef:string,intentRef:string){
  const center=valid(centerRef),ref=valid(caseRef),upload=valid(intentRef);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.own(tx,actor,center,ref);
   const found=await tx.query<Source>(
    "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND "+
    "owner_kind='CG19_SUPPORT' AND health_center_id=$2 "+
    "AND support_case_id=$3 AND id=$4 FOR SHARE",
    [actor.realmId,center,ref,upload]);
   const original=found.rows[0];
   if(!original||original.requested_by!==actor.accountId)
    throw new NotFoundException("Original support upload unavailable");
   return {actor,row:original};
  });
 }
 async status(bearer:string,centerRef:string,caseRef:string,intentRef:string){
  const {actor,row}=await this.source(bearer,centerRef,caseRef,intentRef);
  const found=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_stored_file WHERE realm_id=$1 "+
   "AND owner_kind='CG19_SUPPORT' AND upload_intent_id=$2 "+
   "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
   [actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,
   cleanVerified:row.status==="VALIDATED"&&!!found.rows[0],
   fileRef:row.status==="VALIDATED"?found.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?found.rows[0]?.revision??null:null};
 }
 async confirm(bearer:string,centerRef:string,caseRef:string,intentRef:string){
  const {actor,row}=await this.source(bearer,centerRef,caseRef,intentRef);
  if(row.status==="VALIDATED")return this.status(bearer,centerRef,caseRef,row.id);
  if(["EXPIRED","REJECTED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())
   return {status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let scanned:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   scanned=await this.objects.verifyPrivateObject({objectKey:row.object_key,
    mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});
  }catch{return {status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const at=Date.parse(scanned.verifiedAt);
  const clean=scanned.state==="CLEAN_VERIFIED"&&
   scanned.sha256===row.expected_sha256&&scanned.sizeBytes===Number(row.size_bytes)&&
   scanned.mime===row.mime&&typeof scanned.objectVersion==="string"&&
   scanned.objectVersion.length>0&&scanned.objectVersion.length<=160&&
   typeof scanned.scanProofRef==="string"&&scanned.scanProofRef.length>=8&&
   scanned.scanProofRef.length<=160&&Number.isFinite(at)&&
   at<=Date.now()+60000&&Date.now()-at<900000;
  await this.run(async tx=>{
   await this.own(tx,actor,valid(centerRef),valid(caseRef),
     row.health_source_version,true);
   const locked=await tx.query<Source>(
    "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
    "AND owner_kind='CG19_SUPPORT' FOR UPDATE",[row.id,actor.realmId]);
   if(!locked.rows[0]||locked.rows[0].reserved_until.getTime()<=Date.now())
    throw new ConflictException({code:"CENTER_SUPPORT_FILE_CHANGED"});
   if(locked.rows[0].status!=="VALIDATED"){
    await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
     "WHERE realm_id=$1 AND id=$2",[actor.realmId,row.id,clean?"VALIDATED":"REJECTED"]);
    let file:string|null=null;
    if(clean){
     const inserted=await tx.query<{id:string}>(
      "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
      "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
      "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,"+
      "health_center_id,health_source_version,support_case_id) "+
      "VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,"+
      "'CG19_SUPPORT',$12,$3,$13) ON CONFLICT(upload_intent_id) "+
      "DO NOTHING RETURNING id",
      [actor.realmId,row.id,row.health_source_version,row.mime,row.expected_sha256,
       row.size_bytes,row.object_key,scanned.objectVersion,scanned.scanProofRef,
       new Date(scanned.verifiedAt),actor.accountId,row.health_center_id,
       row.support_case_id]);
     file=inserted.rows[0]?.id??null;
    }
    await this.event(tx,actor,row.health_center_id,row.support_case_id,
     clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",file?null:row.id,file);
   }
  });
  return this.status(bearer,centerRef,caseRef,row.id);
 }
 async list(bearer:string,centerRef:string,caseRef:string){
  const center=valid(centerRef),ref=valid(caseRef);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.own(tx,actor,center,ref);
   const r=await tx.query<{id:string;revision:number;original_mime:string;
      verified_size_bytes:string;created_at:Date}>(
    "SELECT id,revision,original_mime,verified_size_bytes,created_at "+
    "FROM cg19_stored_file WHERE realm_id=$1 AND support_case_id=$2 "+
    "AND health_center_id=$3 AND owner_kind='CG19_SUPPORT' "+
    "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED' "+
    "ORDER BY created_at DESC,id DESC LIMIT 20",[actor.realmId,ref,center]);
   return {files:r.rows.map(f=>({fileRef:f.id,fileVersion:f.revision,
    mime:f.original_mime,sizeBytes:Number(f.verified_size_bytes),
    createdAt:f.created_at.toISOString()}))};
  });
 }
 private async originalFile(bearer:string,centerRef:string,caseRef:string,fileRef:string){
  const center=valid(centerRef),ref=valid(caseRef),file=valid(fileRef);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.own(tx,actor,center,ref);
   const row=await tx.query<Saved>(
    "SELECT f.id,f.revision,f.object_key,f.object_version,f.verified_size_bytes,"+
    "f.verified_sha256,f.original_mime,f.revoked_at,f.scan_status,"+
    "i.status FROM cg19_stored_file f JOIN cg19_upload_intent i "+
    "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
    "WHERE f.realm_id=$1 AND f.support_case_id=$2 AND f.health_center_id=$3 "+
    "AND f.id=$4 AND f.owner_kind='CG19_SUPPORT' AND f.revoked_at IS NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED' "+
    "FOR SHARE OF f,i",[actor.realmId,ref,center,file]);
   if(!row.rows[0])throw new NotFoundException("This support attachment is unavailable");
   return row.rows[0];
  });
 }
 async download(bearer:string,centerRef:string,caseRef:string,fileRef:string){
  const before=await this.originalFile(bearer,centerRef,caseRef,fileRef);
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:before.object_key,objectVersion:before.object_version,
   maxBytes:Math.min(Number(before.verified_size_bytes),10*1024*1024)
  });}catch{throw new ServiceUnavailableException("The support attachment cannot be verified");}
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==before.verified_sha256)
   throw new ServiceUnavailableException("The support attachment cannot be verified");
  const after=await this.originalFile(bearer,centerRef,caseRef,fileRef);
  if(after.revision!==before.revision||after.object_version!==before.object_version)
   throw new NotFoundException("This support attachment was withdrawn");
  return {bytes,mime:before.original_mime};
 }
 /** Original CG-19 Foundation support agent view of center attachments, without
  * acquiring or impersonating a representative's current center affiliation.
  */
 async agentFiles(bearer:string,caseRef:string){
  const ref=valid(caseRef),actor=await this.sessions.requireAction(
   bearer,"support.cases.view");
  const rows=await this.db.query<{id:string;revision:number;
     original_mime:string;verified_size_bytes:string;created_at:Date}>(
   "SELECT f.id,f.revision,f.original_mime,f.verified_size_bytes,f.created_at "+
   "FROM cg19_support_case support "+
   "JOIN cg19_stored_file f ON f.support_case_id=support.id "+
   "AND f.realm_id=support.realm_id AND f.health_center_id=support.center_id "+
   "AND f.owner_kind='CG19_SUPPORT' AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.revoked_at IS NULL "+
   "JOIN cg19_upload_intent intent ON intent.id=f.upload_intent_id "+
   "AND intent.realm_id=f.realm_id AND intent.status='VALIDATED' "+
   "WHERE support.realm_id=$1 AND support.id=$2 "+
   "AND support.source_channel='CENTER_PORTAL' "+
   "ORDER BY f.created_at DESC,f.id DESC LIMIT 20",
   [actor.realmId,ref]);
  return {files:rows.rows.map(f=>({fileRef:f.id,fileVersion:f.revision,
   mime:f.original_mime,sizeBytes:Number(f.verified_size_bytes),
   createdAt:f.created_at.toISOString()}))};
 }
 private async agentOriginal(bearer:string,caseRef:string,fileRef:string){
  const actor=await this.sessions.requireAction(bearer,"support.cases.view"),
    ref=valid(caseRef),file=valid(fileRef);
  const row=await this.db.query<Saved>(
   "SELECT f.id,f.revision,f.object_key,f.object_version,f.verified_size_bytes,"+
   "f.verified_sha256,f.original_mime,f.revoked_at,f.scan_status,"+
   "intent.status FROM cg19_support_case support "+
   "JOIN cg19_stored_file f ON f.realm_id=support.realm_id "+
   "AND f.support_case_id=support.id AND f.health_center_id=support.center_id "+
   "AND f.owner_kind='CG19_SUPPORT' AND f.id=$3 "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent intent ON intent.id=f.upload_intent_id "+
   "AND intent.realm_id=f.realm_id AND intent.status='VALIDATED' "+
   "WHERE support.realm_id=$1 AND support.id=$2 "+
   "AND support.source_channel='CENTER_PORTAL'",
   [actor.realmId,ref,file]);
  if(!row.rows[0])throw new NotFoundException("Original private support attachment unavailable");
  return row.rows[0];
 }
 async agentDownload(bearer:string,caseRef:string,fileRef:string){
  const before=await this.agentOriginal(bearer,caseRef,fileRef);
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:before.object_key,objectVersion:before.object_version,
   maxBytes:Math.min(Number(before.verified_size_bytes),10*1024*1024)
  });}catch{throw new ServiceUnavailableException("Original support attachment unavailable");}
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==before.verified_sha256)
   throw new ServiceUnavailableException("Original support attachment unavailable");
  const after=await this.agentOriginal(bearer,caseRef,fileRef);
  if(after.revision!==before.revision||after.object_version!==before.object_version)
   throw new NotFoundException("Original private attachment was revoked");
  return {bytes,mime:before.original_mime};
 }
 async revoke(bearer:string,centerRef:string,caseRef:string,fileRef:string,version:unknown){
  const center=valid(centerRef),ref=valid(caseRef),file=valid(fileRef);
  if(!Number.isSafeInteger(version)||Number(version)<1)
   throw new BadRequestException({code:"CENTER_SUPPORT_FILE_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.own(tx,actor,center,ref);
   const result=await tx.query<{revision:number;revoked_at:Date|null}>(
    "SELECT revision,revoked_at FROM cg19_stored_file WHERE realm_id=$1 "+
    "AND support_case_id=$2 AND health_center_id=$3 AND id=$4 "+
    "AND owner_kind='CG19_SUPPORT' FOR UPDATE",[actor.realmId,ref,center,file]);
   const f=result.rows[0];
   if(!f||f.revision!==Number(version))
    throw new ConflictException({code:"CENTER_SUPPORT_FILE_CHANGED"});
   if(!f.revoked_at){
    await tx.query("UPDATE cg19_stored_file SET revoked_at=now(),"+
      "revision=revision+1 WHERE realm_id=$1 AND id=$2",[actor.realmId,file]);
    await this.event(tx,actor,center,ref,"FILE_REVOKED",null,file);
   }
   return {revoked:true,version:f.revoked_at?f.revision:f.revision+1};
  });
 }
}
