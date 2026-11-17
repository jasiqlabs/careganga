import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIME=new Set(["image/jpeg","image/png","image/webp"]);
type Intent={id:string;realm_id:string;page_id:string;page_revision_id:string;
 owner_id:string;request_digest:string;request_key:string;original_mime:string;
 size_bytes:string;expected_sha256:string;object_key:string;reserved_until:Date;
 status:string};
export type CmsMediaProof={fileRef:string;fileVersion:number;mime:string;pageRevisionRef:string};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function parse(v:unknown){
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"CMS_MEDIA_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["pageRef","revisionRef","requestKey","mime","sizeBytes",
    "sha256","rightsConfirmed"].includes(k))||
    typeof x.pageRef!=="string"||!UUID.test(x.pageRef)||
    typeof x.revisionRef!=="string"||!UUID.test(x.revisionRef)||
    typeof x.requestKey!=="string"||!UUID.test(x.requestKey)||
    typeof x.mime!=="string"||!MIME.has(x.mime)||
    !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
    Number(x.sizeBytes)>10*1024*1024||typeof x.sha256!=="string"||
    !SHA.test(x.sha256)||x.rightsConfirmed!==true)
   throw new BadRequestException({code:"CMS_MEDIA_INVALID"});
 return x as {pageRef:string;revisionRef:string;requestKey:string;mime:string;
  sizeBytes:number;sha256:string;rightsConfirmed:true};
}
@Injectable()
export class CmsDraftMediaService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly objects:PrivateObjectStorage){}
 private async editable(tx:PoolClient,actor:VerifiedFoundationActor,
  pageRef:string,revisionRef:string){
  const found=await tx.query(
   "SELECT v.id FROM cms_page_revision v JOIN cms_page p "+
   "ON p.id=v.page_id AND p.foundation_root_id=v.foundation_root_id "+
   "WHERE p.id=$1 AND p.foundation_root_id=$2 "+
   "AND p.draft_revision_no=v.revision_no AND v.id=$3 AND v.status='DRAFT' "+
   "AND p.archived_at IS NULL FOR SHARE OF v,p",
   [pageRef,actor.realmId,revisionRef]);
  if(!found.rowCount)throw new ConflictException({code:"CMS_MEDIA_REVISION_CHANGED"});
 }
 async initiate(bearer:string,body:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  const input=parse(body);
  const digest=hash(["CG19_CMS_MEDIA_V1",input.pageRef,input.revisionRef,
   input.mime,input.sizeBytes,input.sha256,input.rightsConfirmed]);
  const tx=await this.db.connect();let intent:Intent;
  try{
   await tx.query("BEGIN");
   await this.editable(tx,actor,input.pageRef,input.revisionRef);
   const existing=await tx.query<Intent>(
    "SELECT * FROM cg19_cms_upload_intent "+
    "WHERE realm_id=$1 AND owner_id=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,input.requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==digest)
     throw new ConflictException({code:"CMS_MEDIA_REPLAY_CONFLICT"});
    intent=existing.rows[0];
   }else{
    const ref=randomUUID(),objectKey="careganga/private/cg19/cms/"+
     actor.realmId+"/"+randomUUID();
    const created=await tx.query<Intent>(
     "INSERT INTO cg19_cms_upload_intent(id,realm_id,page_id,page_revision_id,"+
     "owner_id,request_key,request_digest,original_mime,size_bytes,"+
     "expected_sha256,object_key,reserved_until,rights_confirmed) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '15 minutes',true) "+
     "RETURNING *",[ref,actor.realmId,input.pageRef,input.revisionRef,
      actor.accountId,input.requestKey,digest,input.mime,input.sizeBytes,input.sha256,
      objectKey]);
    intent=created.rows[0];
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(intent.status==="VALIDATED")return this.status(bearer,intent.id);
  if(!["INITIATED","UNKNOWN"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const reservation=await this.objects.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.original_mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()});
   if(!reservation.url.startsWith("https://")||!reservation.reservationRef||
      !Number.isFinite(Date.parse(reservation.expiresAt))||
      Date.parse(reservation.expiresAt)>intent.reserved_until.getTime()||
      reservation.headers["Content-Type"]!==intent.original_mime)
    throw new ServiceUnavailableException("Secure media upload is not available");
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:reservation.url,
    uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt};
  }catch{
   await this.db.query(
    "UPDATE cg19_cms_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status='INITIATED'",
    [intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 private async original(bearer:string,ref:string){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  if(!UUID.test(ref))throw new BadRequestException({code:"CMS_MEDIA_INVALID"});
  const rows=await this.db.query<Intent>(
   "SELECT * FROM cg19_cms_upload_intent WHERE id=$1 AND realm_id=$2 AND owner_id=$3",
   [ref,actor.realmId,actor.accountId]);
  if(!rows.rows[0])throw new NotFoundException({code:"CMS_MEDIA_NOT_FOUND"});
  return {actor,row:rows.rows[0]};
 }
 async status(bearer:string,ref:string){
  const {actor,row}=await this.original(bearer,ref);
  const files=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_cms_media_file "+
   "WHERE upload_intent_id=$1 AND realm_id=$2 AND revoked_at IS NULL",
   [row.id,actor.realmId]);
  return {uploadRef:row.id,status:row.status,
   cleanVerified:row.status==="VALIDATED"&&files.rows.length===1,
   fileRef:row.status==="VALIDATED"?files.rows[0]?.id??null:null,
   validatedVersion:row.status==="VALIDATED"?files.rows[0]?.revision??null:null};
 }
 async confirm(bearer:string,ref:string){
  const {actor,row}=await this.original(bearer,ref);
  if(row.status==="VALIDATED")return this.status(bearer,ref);
  if(!["INITIATED","UNKNOWN"].includes(row.status)||
     row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified;
  try{
   verified=await this.objects.verifyPrivateObject({
    objectKey:row.object_key,mime:row.original_mime,
    sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});
  }catch{return {uploadRef:ref,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const scanned=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&
   verified.sha256===row.expected_sha256&&
   verified.mime===row.original_mime&&
   verified.sizeBytes===Number(row.size_bytes)&&
   !!verified.objectVersion&&verified.objectVersion.length<=160&&
   !!verified.scanProofRef&&verified.scanProofRef.length>=8&&
   Number.isFinite(scanned)&&Math.abs(Date.now()-scanned)<15*60*1000;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.editable(tx,actor,row.page_id,row.page_revision_id);
   const current=await tx.query<Intent>(
    "SELECT * FROM cg19_cms_upload_intent WHERE realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,row.id]);
   if(!current.rows[0]||current.rows[0].reserved_until.getTime()<=Date.now()||
      !["INITIATED","UNKNOWN","VALIDATED"].includes(current.rows[0].status))
    throw new ConflictException({code:"CMS_MEDIA_REVISION_CHANGED"});
   if(current.rows[0].status!=="VALIDATED"){
    await tx.query("UPDATE cg19_cms_upload_intent SET status=$3,updated_at=now() "+
     "WHERE id=$1 AND realm_id=$2",[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
    if(clean)await tx.query(
     "INSERT INTO cg19_cms_media_file(realm_id,upload_intent_id,page_id,"+
     "page_revision_id,original_mime,verified_sha256,verified_size_bytes,"+
     "object_key,object_version,scan_proof_ref,scan_status,scanned_at,"+
     "public_rights_confirmed,created_by) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CLEAN_VERIFIED',$11,true,$12) "+
     "ON CONFLICT(upload_intent_id) DO NOTHING",
     [actor.realmId,row.id,row.page_id,row.page_revision_id,row.original_mime,
      row.expected_sha256,row.size_bytes,row.object_key,verified.objectVersion,
      verified.scanProofRef,new Date(scanned),actor.accountId]);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  return this.status(bearer,ref);
 }
 /** Same transaction source guard: CG18 may reference only CURRENT clean,
  * rights-attested original CG19 media pinned to its original file version.
  * Verified photos may be reused by a later revision of that SAME page and root.
  */
 async validatePlacement(tx:PoolClient,actor:VerifiedFoundationActor,
  revisionRef:string,fileRef:string,version:number):Promise<CmsMediaProof>{
  if(!UUID.test(fileRef)||!Number.isSafeInteger(version)||version<1)
   throw new BadRequestException({code:"CMS_MEDIA_INVALID"});
  const rows=await tx.query<{id:string;revision:number;original_mime:string}>(
   "SELECT f.id,f.revision,f.original_mime FROM cg19_cms_media_file f "+
   "JOIN cg19_cms_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "JOIN cms_page_revision target ON target.id=$3 AND target.foundation_root_id=f.realm_id "+
   "AND target.page_id=f.page_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 "+
   "AND f.revision=$4 AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.public_rights_confirmed=true AND i.status='VALIDATED' "+
   "AND i.rights_confirmed=true AND i.reserved_until>i.created_at "+
   "FOR SHARE OF f,i",[fileRef,actor.realmId,revisionRef,version]);
  if(!rows.rows[0])throw new ConflictException({code:"CMS_MEDIA_NOT_VALIDATED"});
  return {fileRef, fileVersion:rows.rows[0].revision,
   mime:rows.rows[0].original_mime,pageRevisionRef:revisionRef};
 }
 /** Private, source-authorized scheduled activation recheck. The due
  * worker has no bearer token and cannot forge a human-upload proof.
  * All checks use original current CG19 evidence under the due transaction.
  */
 async validateScheduledPlacements(tx:PoolClient,realm:string,rev:string):Promise<boolean>{
  const files=await tx.query<{id:string;actual_id:string|null;intent_id:string|null;
   revision:number;expected_version:number}>(
   'SELECT a.id,f.id AS actual_id,i.id AS intent_id,f.revision,'+
   'a.cg19_validated_version AS expected_version FROM cms_asset_placement a '+
   'LEFT JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref AND '+
   'f.realm_id=a.foundation_root_id AND f.page_id=(SELECT target.page_id '+
   'FROM cms_page_revision target WHERE target.id=a.page_revision_id '+
   'AND target.foundation_root_id=a.foundation_root_id) '+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   'AND f.public_rights_confirmed=true '+
   'LEFT JOIN cg19_cms_upload_intent i ON i.id=f.upload_intent_id '+
   "AND i.realm_id=f.realm_id AND i.status='VALIDATED' "+
   'WHERE a.foundation_root_id=$1 AND a.page_revision_id=$2 '+
   "AND a.public_rights_status='VALIDATED' ORDER BY a.id",
   [realm,rev]);
  const all=await tx.query<{count:string}>(
   "SELECT count(*)::text AS count FROM cms_asset_placement "+
   "WHERE foundation_root_id=$1 AND page_revision_id=$2",[realm,rev]);
  if(files.rows.length!==Number(all.rows[0]?.count??"0"))return false;
  return files.rows.every(f=>f.actual_id!==null&&f.intent_id!==null&&
   f.revision===f.expected_version);
 }
 /** Public bytes only from current approved live publication, not a signed
  * private object URL. This origin read revalidates rights EVERY request.
  */
 async previewBytes(bearer:string,ref:string):Promise<{mime:string;bytes:Buffer}>{
  const actor=await this.sessions.requireAction(bearer,"cms.content.view");
  if(!UUID.test(ref))throw new NotFoundException();
  const sql="SELECT f.object_key,f.object_version,f.original_mime,"+
   "f.verified_sha256,f.verified_size_bytes FROM cg19_cms_media_file f "+
   "JOIN cms_page p ON p.id=f.page_id AND p.foundation_root_id=f.realm_id "+
   "JOIN cg19_cms_upload_intent u ON u.id=f.upload_intent_id AND u.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND p.archived_at IS NULL "+
   "AND EXISTS(SELECT 1 FROM cms_page_revision v WHERE v.id=f.page_revision_id "+
   "AND v.foundation_root_id=f.realm_id) "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.public_rights_confirmed=true AND u.status='VALIDATED' "+
   "AND u.rights_confirmed=true LIMIT 1";
  const found=await this.db.query<{object_key:string;object_version:string;
   original_mime:string;verified_sha256:string;verified_size_bytes:string}>(
   sql,[ref,actor.realmId]);
  const item=found.rows[0];if(!item)throw new NotFoundException();
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:item.object_key,objectVersion:item.object_version,maxBytes:10*1024*1024});}
  catch{throw new ServiceUnavailableException("Preview temporarily unavailable");}
  if(bytes.length!==Number(item.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==item.verified_sha256)
   throw new ServiceUnavailableException("Preview verification failed");
  await this.sessions.requireAction(bearer,"cms.content.view");
  const current=await this.db.query<{object_version:string;verified_sha256:string;
   verified_size_bytes:string}>(sql,[ref,actor.realmId]);
  if(!current.rows[0]||
     current.rows[0].object_version!==item.object_version||
     current.rows[0].verified_sha256!==item.verified_sha256||
     current.rows[0].verified_size_bytes!==item.verified_size_bytes)
   throw new NotFoundException();
  return {mime:item.original_mime,bytes};
 }
 async publicBytes(ref:string):Promise<{mime:string;bytes:Buffer}>{
  if(!UUID.test(ref))throw new NotFoundException();
  const result=await this.db.query<{object_key:string;object_version:string;
   original_mime:string;verified_sha256:string;verified_size_bytes:string}>(
   "SELECT f.object_key,f.object_version,f.original_mime,f.verified_sha256,"+
   "f.verified_size_bytes FROM cg19_cms_media_file f "+
   "JOIN cms_asset_placement a ON a.cg19_file_ref=f.id "+
   "AND a.foundation_root_id=f.realm_id "+
   "JOIN cms_page_revision target ON target.id=a.page_revision_id "+
   "AND target.foundation_root_id=a.foundation_root_id AND target.page_id=f.page_id "+
   "JOIN cms_publication pub ON pub.page_revision_id=a.page_revision_id "+
   "AND pub.foundation_root_id=a.foundation_root_id "+
   "JOIN cms_page_effective active ON active.publication_id=pub.id "+
   "AND active.foundation_root_id=pub.foundation_root_id "+
   "AND active.page_id=pub.page_id "+
   "WHERE f.id=$1 AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.public_rights_confirmed=true AND a.public_rights_status='VALIDATED' "+
   "AND a.cg19_validated_version=f.revision AND pub.state='EFFECTIVE' "+
   "AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now()) "+
   "LIMIT 1",[ref]);
  const x=result.rows[0];if(!x)throw new NotFoundException();
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:x.object_key,objectVersion:x.object_version,maxBytes:10*1024*1024});
  }catch{throw new ServiceUnavailableException("The published image is temporarily unavailable");}
  if(bytes.length!==Number(x.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==x.verified_sha256)
   throw new ServiceUnavailableException("The approved image could not be verified");
  // Publication could have been withdrawn while the object store was read.
  const latest=await this.db.query(
   "SELECT 1 FROM cg19_cms_media_file f JOIN cms_asset_placement a "+
   "ON a.cg19_file_ref=f.id "+
   "AND a.foundation_root_id=f.realm_id "+
   "JOIN cms_page_revision target ON target.id=a.page_revision_id "+
   "AND target.foundation_root_id=a.foundation_root_id AND target.page_id=f.page_id "+
   "JOIN cms_publication pub ON pub.page_revision_id=a.page_revision_id "+
   "AND pub.foundation_root_id=a.foundation_root_id "+
   "JOIN cms_page_effective active ON active.publication_id=pub.id "+
   "AND active.foundation_root_id=pub.foundation_root_id "+
   "WHERE f.id=$1 AND f.revoked_at IS NULL AND "+
   "f.scan_status='CLEAN_VERIFIED' AND f.public_rights_confirmed=true "+
   "AND a.cg19_validated_version=f.revision "+
   "AND a.public_rights_status='VALIDATED' AND pub.state='EFFECTIVE' "+
   "AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now())",
   [ref]);
  if(!latest.rowCount)throw new NotFoundException();
  return {mime:x.original_mime,bytes};
 }
}
