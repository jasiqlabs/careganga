import {
  BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade} from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_INVALID"});
 return v;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Input={centerRef:string;sourceVersion:number;requestKey:string;
 classification:"HEALTH_CENTER_PHOTO"|"HEALTH_CENTER_LOGO";
 mime:"image/jpeg"|"image/png";sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;health_provider_id:string;health_center_id:string;
 health_source_version:number;requested_by:string;request_key:string;
 request_digest:string;mime:string;size_bytes:string;expected_sha256:string;
 status:string;object_key:string;reserved_until:Date;classification:string};
type File={id:string;realm_id:string;health_provider_id:string;health_center_id:string;
 health_source_version:number;revision:number;original_mime:string;object_key:string;
 object_version:string;verified_size_bytes:string;verified_sha256:string;
 revoked_at:Date|null;scan_status:string;intent_status:string;classification:string;
 rights_version:number|null;rights_revoked_at:Date|null;alt_text:string|null};
function parse(raw:unknown):Input{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["centerRef","sourceVersion","requestKey","classification",
  "mime","sizeBytes","sha256"].includes(k))||
  !Number.isSafeInteger(x.sourceVersion)||Number(x.sourceVersion)<1||
  !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
  Number(x.sizeBytes)>3*1024*1024||
  !["HEALTH_CENTER_PHOTO","HEALTH_CENTER_LOGO"].includes(String(x.classification))||
  !["image/jpeg","image/png"].includes(String(x.mime))||
  typeof x.sha256!=="string"||!SHA.test(x.sha256))
  throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_INVALID"});
 return {centerRef:id(x.centerRef),sourceVersion:Number(x.sourceVersion),
  requestKey:id(x.requestKey),classification:x.classification as Input["classification"],
  mime:x.mime as Input["mime"],sizeBytes:Number(x.sizeBytes),sha256:x.sha256};
}
function attestation(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_RIGHTS_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["rightsBasis","rightsHolder","altText"].includes(k))||
  !["OWNED_ORIGINAL","DOCUMENTED_CONSENT"].includes(String(x.rightsBasis))||
  typeof x.rightsHolder!=="string"||x.rightsHolder.trim().length<3||
  x.rightsHolder.length>120||typeof x.altText!=="string"||
  x.altText.trim().length<5||x.altText.length>180||
  /[\u0000-\u001f\u007f<>]/.test(x.rightsHolder+x.altText))
  throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_RIGHTS_INVALID"});
 return {basis:x.rightsBasis as string,holder:x.rightsHolder.trim(),
  alt:x.altText.trim()};
}
/** Tiny bounded metadata-stripping derivative, no third-party decoder needed.
 * PNG: preserve only image-critical chunks; JPEG: remove all APP/COM segments.
 * Never return the raw scanned private file as-is to an anonymous user.
 */
function derivative(bytes:Buffer,mime:string):Buffer{
 if(bytes.length<40||bytes.length>3*1024*1024)
  throw new ServiceUnavailableException("Verified image is not available");
 if(mime==="image/png"){
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   throw new ServiceUnavailableException("Verified image is not available");
  let offset=8,hasHeader=false,hasData=false,ended=false;
  const allowed=new Set(["IHDR","PLTE","tRNS","IDAT","IEND"]);
  const parts=[bytes.subarray(0,8)];
  while(offset+12<=bytes.length){
   const size=bytes.readUInt32BE(offset),end=offset+12+size;
   if(size>3*1024*1024||end>bytes.length)
    throw new ServiceUnavailableException("Verified image is not available");
   const kind=bytes.toString("ascii",offset+4,offset+8);
   if(!/^[a-zA-Z]{4}$/.test(kind))
    throw new ServiceUnavailableException("Verified image is not available");
   if(kind==="IHDR"){
    if(hasHeader||offset!==8||size!==13)throw new ServiceUnavailableException("Invalid photo");
    const w=bytes.readUInt32BE(offset+8),h=bytes.readUInt32BE(offset+12);
    if(!w||!h||w>4096||h>4096||w*h>10000000)
     throw new ServiceUnavailableException("Photo dimensions unsupported");
    hasHeader=true;
   }
   if(kind==="IDAT")hasData=true;
   if(kind==="IEND"){ended=true;if(size!==0||end!==bytes.length)throw new ServiceUnavailableException("Invalid photo");}
   if(allowed.has(kind))parts.push(bytes.subarray(offset,end));
   else if(kind[0]===kind[0].toUpperCase())
    throw new ServiceUnavailableException("Unsupported critical photo format");
   offset=end;
   if(ended)break;
  }
  if(!hasHeader||!hasData||!ended)throw new ServiceUnavailableException("Invalid photo");
  return Buffer.concat(parts);
 }
 if(mime==="image/jpeg"){
  if(bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||
    bytes[bytes.length-1]!==217)
   throw new ServiceUnavailableException("Invalid photo");
  let i=2,sawDimensions=false,sawImage=false;
  const parts=[bytes.subarray(0,2)];
  while(i<bytes.length-2){
   if(bytes[i]!==255)throw new ServiceUnavailableException("Invalid photo");
   const start=i;
   while(i<bytes.length&&bytes[i]===255)i++;
   const tag=bytes[i++];
   if(tag===0xda){
    if(i+2>bytes.length)throw new ServiceUnavailableException("Invalid photo");
    const size=bytes.readUInt16BE(i),end=i+size;
    if(size<2||end>bytes.length-2||!sawDimensions)
     throw new ServiceUnavailableException("Invalid photo");
    // From SOS onward, byte stuffing and restart markers are image payload.
    parts.push(bytes.subarray(start));sawImage=true;break;
   }
   if(tag===0xd9){parts.push(bytes.subarray(start));break;}
   if(tag===0x01||(tag>=0xd0&&tag<=0xd7))continue;
   if(i+2>bytes.length)throw new ServiceUnavailableException("Invalid photo");
   const size=bytes.readUInt16BE(i),end=i+size;
   if(size<2||end>bytes.length-2)throw new ServiceUnavailableException("Invalid photo");
   if([0xc0,0xc1,0xc2,0xc3].includes(tag)){
    if(size<8)throw new ServiceUnavailableException("Invalid photo");
    const h=bytes.readUInt16BE(i+3),w=bytes.readUInt16BE(i+5);
    if(!w||!h||w>4096||h>4096||w*h>10000000)
     throw new ServiceUnavailableException("Photo dimensions unsupported");
    sawDimensions=true;
   }
   // APP0..APP15/COM are stripped (EXIF, GPS, IPTC, ICC, comments).
   if(!(tag>=0xe0&&tag<=0xef)&&tag!==0xfe)
    parts.push(bytes.subarray(start,end));
   i=end;
  }
  if(!sawDimensions||!sawImage)throw new ServiceUnavailableException("Invalid photo");
  return Buffer.concat(parts);
 }
 throw new ServiceUnavailableException("Unsupported public image format");
}
/** All photo ownership, scanner evidence, consent and private storage remain
 * CG-19, while center eligibility belongs to the CG-14 source facade.
 */
@Injectable()
export class HealthCenterContentMediaService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly scope:HealthCenterSupportScopeFacade,
  private readonly objects:PrivateObjectStorage,
  private readonly protectedOwner:ProtectedAccessOwnerService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");active=false;
   return result;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 private async own(tx:PoolClient,actor:VerifiedFoundationActor,center:string,
  expected:number|null=null,editing=true){
  await this.scope.assertCurrent(tx,actor,center);
  const res=await tx.query<{provider_id:string}>(
   "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
   [actor.realmId,center]);
  const current=await tx.query<{version:number;state:string}>(
   "SELECT version,state FROM health_center_content_draft "+
   "WHERE root_realm_id=$1 AND center_id=$2 FOR SHARE",[actor.realmId,center]);
  if(!res.rows[0]||!current.rows[0]||
    (editing&&!["DRAFT","RETURNED"].includes(current.rows[0].state))||
    expected!==null&&current.rows[0].version!==expected)
   throw new ConflictException({code:"HEALTH_CENTER_MEDIA_SOURCE_CHANGED"});
  return {provider:res.rows[0].provider_id,version:current.rows[0].version};
 }
 async initiate(bearer:string,body:unknown){
  const input=parse(body),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  const signature=sha(["CG14_CENTER_CONTENT",input]);
  const storageKey="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
  const intent=await this.run(async tx=>{
   const own=await this.own(tx,actor,input.centerRef,input.sourceVersion);
   const r=await tx.query<Intent>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
    "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
    "object_key,reserved_until,owner_kind,health_provider_id,health_center_id,"+
    "health_source_version) "+
    "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,"+
    "now()+interval '15 minutes','CG14_CENTER_CONTENT',$11,$12,$13) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,input.sourceVersion,actor.accountId,input.requestKey,input.mime,
     input.sizeBytes,input.sha256,signature,input.classification,storageKey,
     own.provider,input.centerRef,input.sourceVersion]);
   if(r.rows[0])return r.rows[0];
   const old=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 "+
    "AND request_key=$3 AND owner_kind='CG14_CENTER_CONTENT' FOR SHARE",
    [actor.realmId,actor.accountId,input.requestKey]);
   if(!old.rows[0]||old.rows[0].request_digest!==signature)
    throw new ConflictException({code:"HEALTH_CENTER_MEDIA_REQUEST_CONFLICT"});
   return old.rows[0];
  });
  if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
    intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status};
  try{
   const result=await this.objects.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,
    mime:intent.mime,sizeBytes:Number(intent.size_bytes),
    sha256:intent.expected_sha256,expiresAt:intent.reserved_until.toISOString()
   });
   const expiry=Date.parse(result.expiresAt);
   if(!result.url.startsWith("https://")||!Number.isFinite(expiry)||
     expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
     !result.reservationRef||result.reservationRef.length>160||
     result.headers?.["Content-Type"]!==intent.mime||
     !Object.entries(result.headers).every(([name,value])=>
      ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
       "If-None-Match"].includes(name)&&typeof value==="string"&&value.length<=160))
    throw new ServiceUnavailableException("Secure photo upload unavailable");
   await this.db.query(
    "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,"+
    "status='INITIATED',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_CENTER_CONTENT' "+
    "AND status IN('INITIATED','UNKNOWN') AND reserved_until>now()",
    [intent.id,actor.realmId,result.reservationRef]);
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:result.url,
    uploadHeaders:result.headers,expiresAt:result.expiresAt};
  }catch{
   await this.db.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_CENTER_CONTENT' "+
    "AND status='INITIATED'",[intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
    message:"Secure photo storage or scanning is unavailable. No photo was verified."};
  }
 }
 private async intent(bearer:string,intentRef:string){
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  const r=await this.db.query<Intent>(
   "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 "+
   "AND owner_kind='CG14_CENTER_CONTENT'",[actor.realmId,id(intentRef)]);
  const row=r.rows[0];
  if(!row||row.requested_by!==actor.accountId)
   throw new NotFoundException("Original center photo upload unavailable");
  await this.run(tx=>this.own(tx,actor,row.health_center_id,row.health_source_version));
  return {actor,row};
 }
 async status(bearer:string,intentRef:string){
  const {actor,row}=await this.intent(bearer,intentRef);
  const stored=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_stored_file "+
   "WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG14_CENTER_CONTENT' "+
   "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
   [actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,
   fileRef:row.status==="VALIDATED"?stored.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?stored.rows[0]?.revision??null:null,
   cleanVerified:row.status==="VALIDATED"&&!!stored.rows[0]};
 }
 async confirm(bearer:string,intentRef:string){
  const {actor,row}=await this.intent(bearer,intentRef);
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["EXPIRED","REJECTED"].includes(row.status)||
    row.reserved_until.getTime()<=Date.now())
   return {status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   verified=await this.objects.verifyPrivateObject({
    objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
    sha256:row.expected_sha256
   });
  }catch{
   return {status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const at=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&verified.sha256===row.expected_sha256&&
   verified.sizeBytes===Number(row.size_bytes)&&verified.mime===row.mime&&
   typeof verified.objectVersion==="string"&&verified.objectVersion.length>=1&&
   verified.objectVersion.length<=160&&typeof verified.scanProofRef==="string"&&
   verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
   Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<900000;
  await this.run(async tx=>{
   await this.own(tx,actor,row.health_center_id,row.health_source_version);
   const current=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 "+
    "AND owner_kind='CG14_CENTER_CONTENT' FOR UPDATE",[actor.realmId,row.id]);
   if(!current.rows[0]||current.rows[0].reserved_until.getTime()<=Date.now())
    throw new ConflictException({code:"HEALTH_CENTER_MEDIA_SOURCE_CHANGED"});
   if(current.rows[0].status!=="VALIDATED"){
    await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
     "WHERE realm_id=$1 AND id=$2",[actor.realmId,row.id,
      clean?"VALIDATED":"REJECTED"]);
    if(clean)await tx.query(
     "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
     "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
     "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,"+
     "health_provider_id,health_center_id,health_source_version) "+
     "VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,"+
     "'CG14_CENTER_CONTENT',$12,$13,$14) ON CONFLICT(upload_intent_id) DO NOTHING",
     [actor.realmId,row.id,row.health_source_version,row.mime,row.expected_sha256,
      row.size_bytes,row.object_key,verified.objectVersion,verified.scanProofRef,
      new Date(verified.verifiedAt),actor.accountId,
      row.health_provider_id,row.health_center_id,row.health_source_version]);
   }
  });
  return this.status(bearer,row.id);
 }
 async attest(bearer:string,fileRef:string,body:unknown){
  const file=id(fileRef),input=attestation(body);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   const current=await tx.query<{center_id:string;source_version:number}>(
    "SELECT health_center_id AS center_id,health_source_version AS source_version "+
    "FROM cg19_stored_file WHERE realm_id=$1 AND id=$2 "+
    "AND owner_kind='CG14_CENTER_CONTENT'",[actor.realmId,file]);
   const f=current.rows[0];
   if(!f)throw new NotFoundException("Original center photo unavailable");
   await this.own(tx,actor,f.center_id,f.source_version);
   await this.prove(tx,actor,f.center_id,f.source_version,file);
   const prior=await tx.query<{rights_basis:string;rights_holder:string;alt_text:string;
     revoked_at:Date|null}>(
    "SELECT rights_basis,rights_holder,alt_text,revoked_at "+
    "FROM cg19_center_content_media_rights WHERE root_realm_id=$1 "+
    "AND center_id=$2 AND file_ref=$3 FOR SHARE",
    [actor.realmId,f.center_id,file]);
   if(prior.rows[0]){
    const old=prior.rows[0];
    if(old.revoked_at||old.rights_basis!==input.basis||
      old.rights_holder!==input.holder||old.alt_text!==input.alt)
     throw new ConflictException({code:"HEALTH_CENTER_MEDIA_RIGHTS_CHANGED"});
    return {fileRef:file,rightsState:"CONFIRMED",replayed:true};
   }
   await tx.query(
    "INSERT INTO cg19_center_content_media_rights(file_ref,root_realm_id,"+
    "center_id,rights_basis,rights_holder,alt_text,attested_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [file,actor.realmId,f.center_id,input.basis,input.holder,input.alt,actor.accountId]);
   return {fileRef:file,rightsState:"CONFIRMED",replayed:false};
  });
 }
 async list(bearer:string,centerRef:string){
  const center=id(centerRef),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.own(tx,actor,center,null,false);
   const r=await tx.query<{id:string;health_source_version:number;
    classification:string;revision:number;revoked_at:Date|null;
    scan_status:string;status:string;alt_text:string|null;rights_revoked_at:Date|null;rights_version:number|null}>(
    "SELECT f.id,f.health_source_version,i.classification,f.revision,f.revoked_at,"+
    "f.scan_status,i.status,rights.alt_text,rights.version AS rights_version,"+
    "rights.revoked_at AS rights_revoked_at "+
    "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
    "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
    "LEFT JOIN cg19_center_content_media_rights rights ON rights.file_ref=f.id "+
    "WHERE f.realm_id=$1 AND f.health_center_id=$2 "+
    "AND f.owner_kind='CG14_CENTER_CONTENT' "+
    "ORDER BY f.created_at DESC,f.id DESC LIMIT 30",[actor.realmId,center]);
   return {files:r.rows.map(f=>({fileRef:f.id,fileVersion:f.revision,
    classification:f.classification,sourceVersion:f.health_source_version,
    rights:!f.revoked_at&&!f.rights_revoked_at&&!!f.alt_text?"CONFIRMED":"NONE",
    rightsVersion:f.rights_version,altText:f.alt_text,status:f.revoked_at?"REVOKED":f.status}))};
  });
 }
 /** Original CG19 proof in SAME CG14 content save/submission/approval transaction. */
 async prove(tx:PoolClient,actor:VerifiedFoundationActor,center:string,
  version:number,file:string){
  const r=await tx.query<{id:string;alt_text:string|null;rights:string|null}>(
   "SELECT f.id,rights.alt_text,rights.file_ref AS rights "+
   "FROM cg19_stored_file f "+
   "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "LEFT JOIN cg19_center_content_media_rights rights ON rights.file_ref=f.id "+
   "AND rights.root_realm_id=f.realm_id AND rights.center_id=f.health_center_id "+
   "AND rights.revoked_at IS NULL "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.health_center_id=$3 "+
   "AND f.health_source_version<=$4 AND f.owner_kind='CG14_CENTER_CONTENT' "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "AND i.status='VALIDATED' AND "+
   "i.classification IN('HEALTH_CENTER_PHOTO','HEALTH_CENTER_LOGO') "+
   "FOR SHARE OF f,i",[id(file),actor.realmId,id(center),version]);
  if(!r.rows[0])throw new ConflictException({code:"HEALTH_CENTER_MEDIA_NOT_VERIFIED"});
  return r.rows[0];
 }
 async revoke(bearer:string,fileRef:string,expected:unknown){
  const file=id(fileRef);
  if(!Number.isSafeInteger(expected)||Number(expected)<1)
   throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   const current=await tx.query<{health_center_id:string}>(
    "SELECT health_center_id FROM cg19_stored_file "+
    "WHERE realm_id=$1 AND id=$2 AND owner_kind='CG14_CENTER_CONTENT'",
    [actor.realmId,file]);
   if(!current.rows[0])throw new NotFoundException("Center photo unavailable");
   await this.own(tx,actor,current.rows[0].health_center_id,null,false);
   const media=await tx.query<{revision:number;revoked_at:Date|null}>(
    "SELECT revision,revoked_at FROM cg19_stored_file WHERE realm_id=$1 "+
    "AND id=$2 AND owner_kind='CG14_CENTER_CONTENT' FOR UPDATE",
    [actor.realmId,file]);
   if(media.rows[0]?.revision!==Number(expected))
    throw new ConflictException({code:"HEALTH_CENTER_MEDIA_SOURCE_CHANGED"});
   if(!media.rows[0].revoked_at)await tx.query(
    "UPDATE cg19_stored_file SET revoked_at=now(),revision=revision+1 "+
    "WHERE realm_id=$1 AND id=$2",[actor.realmId,file]);
   return {revoked:true,version:media.rows[0].revoked_at?Number(expected):
    Number(expected)+1};
  });
 }
 async revokeRights(bearer:string,fileRef:string,expected:unknown){
  const file=id(fileRef);
  if(!Number.isSafeInteger(expected)||Number(expected)<1)
   throw new BadRequestException({code:"HEALTH_CENTER_MEDIA_RIGHTS_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   const source=await tx.query<{center_id:string}>(
    "SELECT center_id FROM cg19_center_content_media_rights "+
    "WHERE root_realm_id=$1 AND file_ref=$2",[actor.realmId,file]);
   if(!source.rows[0])throw new NotFoundException("Photo consent unavailable");
   await this.own(tx,actor,source.rows[0].center_id,null,false);
   const result=await tx.query<{version:number;revoked_at:Date|null}>(
    "SELECT version,revoked_at FROM cg19_center_content_media_rights "+
    "WHERE root_realm_id=$1 AND file_ref=$2 FOR UPDATE",[actor.realmId,file]);
   if(result.rows[0]?.version!==Number(expected))
    throw new ConflictException({code:"HEALTH_CENTER_MEDIA_RIGHTS_CHANGED"});
   if(!result.rows[0].revoked_at)await tx.query(
    "UPDATE cg19_center_content_media_rights SET revoked_at=now(),version=version+1 "+
    "WHERE root_realm_id=$1 AND file_ref=$2",[actor.realmId,file]);
   return {revoked:true,version:result.rows[0].revoked_at?Number(expected):
    Number(expected)+1};
  });
 }
 /** Original CG-19 approved-case reviewer image, not an anonymous public URL.
  * Secure fetch and second live source/consent check before returning bytes.
  */
 private async reviewerSource(bearer:string,caseRef:string,fileRef:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"health.providers.verify");
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const verified=await tx.query<{id:string;revision:number;original_mime:string;
     object_key:string;object_version:string;verified_size_bytes:string;
     verified_sha256:string;rights_version:number}>(
    "SELECT f.id,f.revision,f.original_mime,f.object_key,f.object_version,"+
    "f.verified_size_bytes,f.verified_sha256,rights.version AS rights_version "+
    "FROM cg03_case cg "+
    "JOIN health_center_content_revision rev ON rev.id=cg.health_content_revision_id "+
    "AND rev.root_realm_id=cg.realm_id AND rev.center_id=cg.health_center_id "+
    "AND rev.revision_no=cg.health_revision_no AND rev.source_digest=cg.health_source_digest "+
    "AND rev.approval_case_ref=cg.id "+
    "JOIN health_center center ON center.id=rev.center_id "+
    "AND center.root_realm_id=rev.root_realm_id AND center.status='VERIFIED' "+
    "AND center.access_state='ENABLED' "+
    "JOIN health_provider provider ON provider.id=center.provider_id "+
    "AND provider.root_realm_id=center.root_realm_id AND provider.status='VERIFIED' "+
    "JOIN health_center_content_draft draft ON draft.root_realm_id=rev.root_realm_id "+
    "AND draft.center_id=rev.center_id AND draft.state='SUBMITTED' "+
    "AND draft.version=rev.revision_no+1 "+
    "JOIN cg19_stored_file f ON f.realm_id=rev.root_realm_id "+
    "AND f.health_center_id=rev.center_id AND f.id=$3 "+
    "AND f.owner_kind='CG14_CENTER_CONTENT' AND f.revoked_at IS NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent intent ON intent.id=f.upload_intent_id "+
    "AND intent.realm_id=f.realm_id AND intent.status='VALIDATED' "+
    "AND intent.classification IN('HEALTH_CENTER_PHOTO','HEALTH_CENTER_LOGO') "+
    "JOIN cg19_center_content_media_rights rights ON rights.file_ref=f.id "+
    "AND rights.root_realm_id=f.realm_id AND rights.center_id=f.health_center_id "+
    "AND rights.revoked_at IS NULL "+
    "WHERE cg.realm_id=$1 AND cg.id=$2 "+
    "AND cg.case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
    "AND cg.status IN('SUBMITTED','IN_REVIEW','PENDING_OWNER') "+
    "AND rev.source_snapshot->'media' @> to_jsonb(ARRAY[f.id::text]) "+
    "LIMIT 1 FOR SHARE OF cg,rev,center,provider,draft,f,intent,rights",
    [actor.realmId,caseRef,fileRef]);
   await tx.query("COMMIT");active=false;
   return verified.rows[0]??null;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async reviewImage(bearer:string,caseRef:string,fileRef:string){
  id(caseRef);id(fileRef);
  const original=await this.reviewerSource(bearer,caseRef,fileRef);
  if(!original)throw new NotFoundException("Original review photo unavailable");
  let bytes:Buffer;
  try{
   bytes=await this.objects.readVerifiedPrivateObject({
    objectKey:original.object_key,objectVersion:original.object_version,
    maxBytes:Math.min(Number(original.verified_size_bytes),3*1024*1024)
   });
  }catch{throw new ServiceUnavailableException("Original review image could not be confirmed");}
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(original.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==original.verified_sha256)
   throw new ServiceUnavailableException("Original review image could not be confirmed");
  const safe=derivative(bytes,original.original_mime);
  const now=await this.reviewerSource(bearer,caseRef,fileRef);
  if(!now||now.revision!==original.revision||
    now.object_version!==original.object_version||
    now.rights_version!==original.rights_version)
   throw new NotFoundException("Original review image changed or was revoked");
  return {data:safe,mime:original.original_mime};
 }
 /** Public images are rechecked against current original CG03 center +
  * content publication and CG19 scanner+rights before AND after private
  * object read. Only stripped image bytes can be returned.
  */
 private async publicSource(slug:string,fileRef:string){
  const r=await this.db.query<File>(
   "SELECT f.id,f.realm_id,f.health_provider_id,f.health_center_id,"+
   "f.health_source_version,f.revision,f.original_mime,f.object_key,"+
   "f.object_version,f.verified_size_bytes,f.verified_sha256,f.revoked_at,"+
   "f.scan_status,i.status AS intent_status,i.classification,"+
   "rights.version AS rights_version,rights.revoked_at AS rights_revoked_at,"+
   "rights.alt_text FROM health_center c "+
   "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
   "JOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT' "+
   "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
   "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
   "JOIN health_center_revision cv ON cv.id=pub.verified_center_revision_id "+
   "AND cv.root_realm_id=c.root_realm_id AND cv.center_id=c.id "+
   "JOIN cg03_case cc ON cc.id=cv.approval_case_ref AND cc.realm_id=c.root_realm_id "+
   "AND cc.case_kind='HEALTH_CENTER_VERIFICATION' AND cc.status='OWNER_COMPLETED' "+
   "AND cc.health_center_id=c.id AND cc.health_center_revision_id=cv.id "+
   "AND cc.health_source_digest=cv.source_digest "+
   "JOIN cg03_case_decision cd ON cd.id=pub.original_final_decision_ref "+
   "AND cd.realm_id=cc.realm_id AND cd.case_id=cc.id AND cd.action='APPROVE' "+
   "AND cd.fresh_password_verified_at IS NOT NULL AND cd.actor_id<>cc.proposer_id "+
   "JOIN cg19_stored_file center_proof ON center_proof.id=cv.proof_file_ref "+
   "AND center_proof.realm_id=c.root_realm_id "+
   "AND center_proof.owner_kind='CG14_DRAFT' "+
   "AND center_proof.health_provider_id=p.id AND center_proof.health_center_id=c.id "+
   "AND center_proof.revoked_at IS NULL AND center_proof.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent center_intent ON center_intent.id=center_proof.upload_intent_id "+
   "AND center_intent.realm_id=center_proof.realm_id "+
   "AND center_intent.status='VALIDATED' AND center_intent.classification='HEALTH_CENTER_LICENSE' "+
   "JOIN health_center_content_publication cp ON cp.center_id=c.id "+
   "AND cp.root_realm_id=c.root_realm_id AND cp.withdrawn_at IS NULL "+
   "JOIN health_center_content_revision rev ON rev.id=cp.approved_revision_id "+
   "AND rev.root_realm_id=cp.root_realm_id AND rev.center_id=c.id "+
   "JOIN cg03_case cg ON cg.id=rev.approval_case_ref AND cg.realm_id=rev.root_realm_id "+
   "AND cg.case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
   "AND cg.health_content_revision_id=rev.id AND cg.health_source_digest=rev.source_digest "+
   "AND cg.status='OWNER_COMPLETED' "+
   "JOIN cg03_case_decision d ON d.id=cp.original_decision_ref AND d.case_id=cg.id "+
   "AND d.realm_id=cg.realm_id AND d.action='APPROVE' "+
   "AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>cg.proposer_id "+
   "JOIN cg19_stored_file f ON f.realm_id=c.root_realm_id AND "+
   "f.health_center_id=c.id AND f.id=$2 AND f.owner_kind='CG14_CENTER_CONTENT' "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "AND i.status='VALIDATED' AND i.classification IN('HEALTH_CENTER_PHOTO','HEALTH_CENTER_LOGO') "+
   "JOIN cg19_center_content_media_rights rights ON rights.file_ref=f.id "+
   "AND rights.root_realm_id=f.realm_id AND rights.center_id=c.id "+
   "AND rights.revoked_at IS NULL "+
   "WHERE c.public_slug=$1 AND c.status='VERIFIED' AND p.status='VERIFIED' "+
   "AND c.access_state='ENABLED' AND c.publication_state='PUBLISHED' "+
   "AND rev.source_snapshot->'media' @> to_jsonb(ARRAY[f.id::text]) "+
   "LIMIT 1",[slug,fileRef]);
  return r.rows[0]??null;
 }
 async publicImage(slug:string,fileRef:string){
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)||!ID.test(fileRef))
   throw new NotFoundException("Published image unavailable");
  const before=await this.publicSource(slug,fileRef);
  if(!before)throw new NotFoundException("Published image unavailable");
  let bytes:Buffer;
  try{
   bytes=await this.objects.readVerifiedPrivateObject({
    objectKey:before.object_key,objectVersion:before.object_version,
    maxBytes:Math.min(Number(before.verified_size_bytes),3*1024*1024)
   });
  }catch{throw new ServiceUnavailableException("Published photo cannot be verified");}
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==before.verified_sha256)
   throw new ServiceUnavailableException("Published photo cannot be verified");
  const safe=derivative(bytes,before.original_mime);
  const after=await this.publicSource(slug,fileRef);
  if(!after||after.revision!==before.revision||
    after.object_version!==before.object_version||
    after.rights_version!==before.rights_version)
   throw new NotFoundException("Published image was withdrawn");
  return {data:safe,mime:before.original_mime};
 }
}
