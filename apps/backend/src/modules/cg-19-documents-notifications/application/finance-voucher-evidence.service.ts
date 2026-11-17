import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceVoucherSourceFacade} from "../../cg-09-finance-accounting/application/finance-voucher-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const id=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_VOUCHER_SOURCE_INVALID",field:"voucherRef"});
 return v;
};
type Input={voucherRef:string;voucherVersion:number;requestKey:string;mime:string;
 sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;voucher_id:string;voucher_version:number;
 requested_by:string;request_key:string;mime:string;size_bytes:string;
 expected_sha256:string;request_digest:string;object_key:string;
 status:string;reserved_until:Date};
type FileRow={id:string;revision:number;object_key:string;object_version:string;
 original_mime:string;verified_sha256:string;verified_size_bytes:string;revoked_at:Date|null};
const parse=(value:unknown):Input=>{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["voucherRef","voucherVersion","requestKey","mime","sizeBytes","sha256"].includes(k))||
   typeof v.voucherRef!=="string"||!UUID.test(v.voucherRef)||
   !Number.isSafeInteger(v.voucherVersion)||Number(v.voucherVersion)<1||
   typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
   typeof v.mime!=="string"||!MIME.has(v.mime)||
   !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||
   Number(v.sizeBytes)>10485760||typeof v.sha256!=="string"||!SHA.test(v.sha256))
  throw new BadRequestException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
 return v as Input;
};
const digest=(x:Input)=>createHash("sha256").update(JSON.stringify([
 "CG19_FINANCE_VOUCHER_PROOF_V1",x.voucherRef,x.voucherVersion,
 x.mime,x.sizeBytes,x.sha256])).digest("hex");
const scanMatches=(verified:{state:string;sha256:string;sizeBytes:number;mime:string;
 objectVersion:string;scanProofRef:string;verifiedAt:string},source:Intent)=>{
 const at=Date.parse(verified.verifiedAt);
 return verified.state==="CLEAN_VERIFIED"&&verified.sha256===source.expected_sha256&&
  verified.mime===source.mime&&verified.sizeBytes===Number(source.size_bytes)&&
  typeof verified.objectVersion==="string"&&verified.objectVersion.length>0&&
  verified.objectVersion.length<=160&&typeof verified.scanProofRef==="string"&&
  verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
  Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<900000;
};
/** Original CG-19 file ownership for CG-09 version-pinned voucher evidence.
 * Never returns VERIFIED on presigned-upload acknowledgement alone.
 */
@Injectable()
export class FinanceVoucherEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:FinanceVoucherSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async authority(bearer:string,write=false){
  const actor=await this.sessions.requireAction(bearer,
   write?"finance.vouchers.manage":"finance.vouchers.view");
  await this.sessions.requireAction(bearer,write?"documents.files.manage":"documents.files.view");
  return actor;
 }
 async initiate(bearer:string,value:unknown){
  const request=parse(value);
  const actor=await this.authority(bearer,true);
  await this.source.current(bearer,request.voucherRef,request.voucherVersion,true);
  const key="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
  const requestDigest=digest(request);
  let intent:Intent;
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.source.guardDraft(client,actor,request.voucherRef,request.voucherVersion);
   const inserted=await client.query<Intent>(`
    INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,
     request_key,mime,size_bytes,expected_sha256,request_digest,classification,
     object_key,reserved_until,owner_kind,voucher_id,voucher_version)
    VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,'FINANCE_VOUCHER_PROOF',
     $9,now()+interval '15 minutes','CG09_VOUCHER',$10,$11)
    ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *
   `,[actor.realmId,request.voucherVersion,actor.accountId,request.requestKey,
    request.mime,request.sizeBytes,request.sha256,requestDigest,key,
    request.voucherRef,request.voucherVersion]);
   if(inserted.rows[0]){
    intent=inserted.rows[0];
    await client.query(`
     INSERT INTO cg19_document_event(realm_id,voucher_id,actor_id,intent_id,event_key)
     VALUES($1,$2,$3,$4,'UPLOAD_INITIATED')`,
     [actor.realmId,request.voucherRef,actor.accountId,intent.id]);
   }else{
    const earlier=await client.query<Intent>(`
     SELECT * FROM cg19_upload_intent WHERE realm_id=$1
      AND requested_by=$2 AND request_key=$3 AND owner_kind='CG09_VOUCHER' FOR SHARE`,
     [actor.realmId,actor.accountId,request.requestKey]);
    if(!earlier.rows[0]||earlier.rows[0].request_digest!==requestDigest)
     throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_CONFLICT"});
    intent=earlier.rows[0];
   }
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  if(intent.status==="VALIDATED"||intent.status==="REJECTED"||
    intent.status==="EXPIRED"||intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status};
  try{
   const reservation=await this.storage.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()
   });
   const until=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!Number.isFinite(until)||
    until<=Date.now()||until>intent.reserved_until.getTime()||
    !reservation.reservationRef||reservation.reservationRef.length>160||
    !reservation.headers||reservation.headers["Content-Type"]!==intent.mime||
    !Object.entries(reservation.headers).every(([header,val])=>
      ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(header)&&
      typeof val==="string"&&val.length<=160))
    throw new ServiceUnavailableException("Private upload reservation could not be verified");
   const saved=await this.db.query(`
     UPDATE cg19_upload_intent SET status='INITIATED',storage_reservation_ref=$3,updated_at=now()
     WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN')
       AND reserved_until>now() RETURNING id`,
    [intent.id,actor.realmId,reservation.reservationRef]);
   if(!saved.rowCount)throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
   return {uploadRef:intent.id,status:"UPLOAD_READY",
    uploadUrl:reservation.url,uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt};
  }catch{
   await this.db.query(`
     UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
     WHERE id=$1 AND realm_id=$2 AND status='INITIATED'`,
    [intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
    message:"Secure file storage is unavailable. The file has not been verified."};
  }
 }
 private async intent(bearer:string,reference:string,write=false){
  const actor=await this.authority(bearer,write);
  const result=await this.db.query<Intent>(`
   SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2
    AND owner_kind='CG09_VOUCHER'`,[id(reference),actor.realmId]);
  const row=result.rows[0];
  if(!row)throw new NotFoundException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
  await this.source.current(bearer,row.voucher_id,row.voucher_version,write);
  return {actor,row};
 }
 async status(bearer:string,reference:string){
  const {actor,row}=await this.intent(bearer,reference);
  const found=await this.db.query<{id:string;revision:number}>(`
   SELECT id,revision FROM cg19_stored_file
   WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG09_VOUCHER'
    AND revoked_at IS NULL`,[actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,cleanVerified:row.status==="VALIDATED"&&!!found.rows[0],
   fileRef:row.status==="VALIDATED"?found.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?found.rows[0]?.revision??null:null};
 }
 async confirm(bearer:string,reference:string){
  const {actor,row}=await this.intent(bearer,reference,true);
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified;
  try{
   verified=await this.storage.verifyPrivateObject({
    objectKey:row.object_key,mime:row.mime,
    sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256
   });
  }catch{
   await this.db.query(`
    UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
    WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')`,
    [row.id,actor.realmId]);
   return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const clean=scanMatches(verified,row);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.source.guardDraft(client,actor,row.voucher_id,row.voucher_version);
   const locked=await client.query<Intent>(`
    SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2
     AND owner_kind='CG09_VOUCHER' FOR UPDATE`,[row.id,actor.realmId]);
   const now=locked.rows[0];
   if(!now||now.reserved_until.getTime()<=Date.now()||
     ["REJECTED","EXPIRED"].includes(now.status))
    throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
   if(now.status!=="VALIDATED"){
    await client.query(`
     UPDATE cg19_upload_intent SET status=$3,updated_at=now()
     WHERE id=$1 AND realm_id=$2`,[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
    if(clean){
     const result=await client.query<{id:string}>(`
      INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,
       original_mime,verified_sha256,verified_size_bytes,object_key,object_version,
       scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,voucher_id,voucher_version)
      VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,
       'CG09_VOUCHER',$12,$13) RETURNING id`,
      [actor.realmId,row.id,row.voucher_version,row.mime,row.expected_sha256,
       row.size_bytes,row.object_key,verified.objectVersion,verified.scanProofRef,
       verified.verifiedAt,actor.accountId,row.voucher_id,row.voucher_version]);
     await client.query(`
      INSERT INTO cg19_document_event(realm_id,voucher_id,actor_id,intent_id,file_id,event_key)
      VALUES($1,$2,$3,$4,$5,'UPLOAD_VERIFIED')`,
      [actor.realmId,row.voucher_id,actor.accountId,row.id,result.rows[0].id]);
    }else{
     await client.query(`
      INSERT INTO cg19_document_event(realm_id,voucher_id,actor_id,intent_id,event_key)
      VALUES($1,$2,$3,$4,'UPLOAD_REJECTED')`,
      [actor.realmId,row.voucher_id,actor.accountId,row.id]);
    }
   }
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  return this.status(bearer,row.id);
 }
 async list(bearer:string,voucherRef:string,voucherVersion:number){
  const actor=await this.authority(bearer);
  await this.source.current(bearer,id(voucherRef),voucherVersion);
  const found=await this.db.query<{fileRef:string;fileVersion:number;mime:string;sizeBytes:string}>(`
   SELECT f.id AS "fileRef",f.revision AS "fileVersion",
    f.original_mime AS mime,f.verified_size_bytes::text AS "sizeBytes"
   FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id
    AND i.realm_id=f.realm_id AND i.owner_kind='CG09_VOUCHER'
   WHERE f.realm_id=$1 AND f.voucher_id=$2 AND f.voucher_version=$3
    AND f.owner_kind='CG09_VOUCHER' AND f.revoked_at IS NULL
    AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED'
   ORDER BY f.created_at DESC,f.id DESC LIMIT 16`,[actor.realmId,voucherRef,voucherVersion]);
  return {files:found.rows};
 }
 /** Called by CG-09 inside the original submit transaction. */
 async guardVerifiedProof(client:PoolClient,actor:VerifiedFoundationActor,
  voucherRef:string,voucherVersion:number,fileRef:string,fileVersion:number){
  await this.source.guardDraft(client,actor,voucherRef,voucherVersion);
  if(!UUID.test(fileRef)||!Number.isSafeInteger(fileVersion)||fileVersion<1)
   throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
  const row=await client.query<{id:string}>(`
   SELECT f.id FROM cg19_stored_file f
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id
     AND i.realm_id=f.realm_id
   WHERE f.id=$1 AND f.realm_id=$2 AND f.voucher_id=$3 AND f.voucher_version=$4
    AND f.revision=$5 AND f.owner_kind='CG09_VOUCHER'
    AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
    AND i.owner_kind='CG09_VOUCHER' AND i.status='VALIDATED'
   FOR SHARE OF f,i`,[fileRef,actor.realmId,voucherRef,voucherVersion,fileVersion]);
  if(!row.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
  return {fileRef,fileVersion};
 }
 async revoke(bearer:string,fileRef:string,expectedVersion:number){
  const actor=await this.authority(bearer,true);
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)
   throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const initial=await client.query<{voucher_id:string;voucher_version:number}>(`
     SELECT voucher_id,voucher_version FROM cg19_stored_file
     WHERE id=$1 AND realm_id=$2 AND owner_kind='CG09_VOUCHER'`,
     [id(fileRef),actor.realmId]);
   if(!initial.rows[0])throw new NotFoundException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
   // Always lock Finance source before CG-19 file; submit locks in this order too.
   await this.source.guardDraft(client,actor,
     initial.rows[0].voucher_id,initial.rows[0].voucher_version);
   const file=await client.query<{id:string;voucher_id:string;voucher_version:number;
     revision:number;revoked_at:Date|null}>(`
     SELECT id,voucher_id,voucher_version,revision,revoked_at FROM cg19_stored_file
     WHERE id=$1 AND realm_id=$2 AND owner_kind='CG09_VOUCHER' FOR UPDATE`,
     [id(fileRef),actor.realmId]);
   const v=file.rows[0];
   if(!v||v.voucher_id!==initial.rows[0].voucher_id||
      v.voucher_version!==initial.rows[0].voucher_version)
    throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_CONFLICT"});
   if(v.revision!==expectedVersion)
    throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_CONFLICT"});
   if(!v.revoked_at){
    await client.query(`UPDATE cg19_stored_file
     SET revoked_at=now(),revision=revision+1 WHERE id=$1 AND realm_id=$2`,
     [v.id,actor.realmId]);
    await client.query(`
     INSERT INTO cg19_document_event(realm_id,voucher_id,actor_id,file_id,event_key)
     VALUES($1,$2,$3,$4,'FILE_REVOKED')`,
     [actor.realmId,v.voucher_id,actor.accountId,v.id]);
   }
   await client.query("COMMIT");return {revoked:true,revision:v.revoked_at?v.revision:v.revision+1};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async download(bearer:string,fileRef:string){
  const actor=await this.authority(bearer);
  const row=await this.db.query<FileRow&{voucher_id:string;voucher_version:number}>(`
   SELECT f.id,f.revision,f.voucher_id,f.voucher_version,f.object_key,f.object_version,
    f.original_mime,f.verified_sha256,f.verified_size_bytes,f.revoked_at
   FROM cg19_stored_file f JOIN cg19_upload_intent i
    ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG09_VOUCHER'
    AND i.owner_kind='CG09_VOUCHER' AND i.status='VALIDATED'
    AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'`,
   [id(fileRef),actor.realmId]);
  const file=row.rows[0];
  if(!file)throw new NotFoundException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
  await this.source.current(bearer,file.voucher_id,file.voucher_version);
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:file.object_key,objectVersion:file.object_version,
   maxBytes:Number(file.verified_size_bytes)
  });
  if(bytes.length!==Number(file.verified_size_bytes)||
     createHash("sha256").update(bytes).digest("hex")!==file.verified_sha256)
   throw new ServiceUnavailableException("The original private evidence could not be verified.");
  await this.authority(bearer);
  await this.source.current(bearer,file.voucher_id,file.voucher_version);
  const live=await this.db.query<{id:string}>(`
    SELECT id FROM cg19_stored_file
    WHERE id=$1 AND realm_id=$2 AND revision=$3
      AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'`,
   [file.id,actor.realmId,file.revision]);
  if(!live.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_CONFLICT"});
  return {data:bytes,mime:file.original_mime};
 }
}
