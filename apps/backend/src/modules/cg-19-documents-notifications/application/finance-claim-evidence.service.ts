import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceExpenseClaimSourceFacade} from "../../cg-09-finance-accounting/application/finance-expense-claim-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const uid=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_CLAIM_SOURCE_INVALID",field:"claimRef"});
 return v;
};
type Request={claimRef:string;claimVersion:number;requestKey:string;mime:string;
 sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;claim_id:string;claim_version:number;
 requested_by:string;request_key:string;mime:string;size_bytes:string;expected_sha256:string;
 request_digest:string;object_key:string;status:string;reserved_until:Date};
type Proof={id:string;claim_id:string;claim_version:number;revision:number;object_key:string;
 object_version:string;original_mime:string;verified_sha256:string;
 verified_size_bytes:string;revoked_at:Date|null};
function parse(input:unknown):Request{
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new BadRequestException({code:"FINANCE_CLAIM_BILL_INVALID"});
 const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["claimRef","claimVersion","requestKey","mime","sizeBytes","sha256"].includes(k))||
   !UUID.test(String(v.claimRef))||!UUID.test(String(v.requestKey))||
   !Number.isSafeInteger(v.claimVersion)||Number(v.claimVersion)<1||
   typeof v.mime!=="string"||!MIME.has(v.mime)||
   !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||Number(v.sizeBytes)>10485760||
   typeof v.sha256!=="string"||!SHA.test(v.sha256))
  throw new BadRequestException({code:"FINANCE_CLAIM_BILL_INVALID"});
 return v as Request;
}
const digest=(v:Request)=>createHash("sha256").update(JSON.stringify([
 "CG19_CLAIM_BILL_V1",v.claimRef,v.claimVersion,v.mime,v.sizeBytes,v.sha256
])).digest("hex");
@Injectable()
export class FinanceClaimEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:FinanceExpenseClaimSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async authority(bearer:string,write:boolean){
  const actor=await this.sessions.requireAction(bearer,
   write?"finance.claims.create":"finance.claims.view");
  await this.sessions.requireAction(bearer,
   write?"documents.files.manage":"documents.files.view");
  return actor;
 }
 async initiate(bearer:string,input:unknown){
  const v=parse(input),actor=await this.authority(bearer,true);
  await this.source.current(bearer,v.claimRef,v.claimVersion,true);
  const fingerprint=digest(v),newObjectKey="careganga/private/cg19/"+
   actor.realmId+"/"+randomUUID();
  let intent:Intent;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.source.guardDraft(tx,actor,v.claimRef,v.claimVersion);
   const inserted=await tx.query<Intent>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
    "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
    "object_key,reserved_until,owner_kind,claim_id,claim_version) "+
    "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,'FINANCE_CLAIM_BILL',$9,"+
    "now()+interval '15 minutes','CG09_CLAIM',$10,$11) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,v.claimVersion,actor.accountId,v.requestKey,v.mime,v.sizeBytes,
     v.sha256,fingerprint,newObjectKey,v.claimRef,v.claimVersion]);
   intent=inserted.rows[0];
   if(!intent){
    const earlier=await tx.query<Intent>(
     "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 "+
     "AND request_key=$3 AND owner_kind='CG09_CLAIM' FOR SHARE",
     [actor.realmId,actor.accountId,v.requestKey]);
    intent=earlier.rows[0];
    if(!intent||intent.request_digest!==fingerprint)
     throw new ConflictException({code:"FINANCE_CLAIM_BILL_CONFLICT"});
   }else{
    await tx.query(
     "INSERT INTO cg19_document_event(realm_id,claim_id,actor_id,intent_id,event_key) "+
     "VALUES($1,$2,$3,$4,'UPLOAD_INITIATED')",
     [actor.realmId,v.claimRef,actor.accountId,intent.id]);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status};
  try{
   const reservation=await this.storage.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()
   });
   const limit=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!Number.isFinite(limit)||
      limit<=Date.now()||limit>intent.reserved_until.getTime()||
      !reservation.reservationRef||reservation.reservationRef.length>160||
      !reservation.headers||reservation.headers["Content-Type"]!==intent.mime||
      !Object.entries(reservation.headers).every(([k,val])=>
       ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
        "If-None-Match"].includes(k)&&typeof val==="string"&&val.length<=160))
    throw new ServiceUnavailableException("Private upload reservation unavailable");
   const applied=await this.db.query(
    "UPDATE cg19_upload_intent SET status='INITIATED',storage_reservation_ref=$3,"+
    "updated_at=now() WHERE id=$1 AND realm_id=$2 AND "+
    "status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
    [intent.id,actor.realmId,reservation.reservationRef]);
   if(!applied.rowCount)throw new ConflictException({code:"FINANCE_CLAIM_BILL_CONFLICT"});
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:reservation.url,
    uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt};
  }catch{
   await this.db.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status='INITIATED'",
    [intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
    cleanVerified:false,message:"Private file upload could not be confirmed."};
  }
 }
 private async intent(bearer:string,reference:string,write=false){
  const actor=await this.authority(bearer,write);
  const rows=await this.db.query<Intent>(
   "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
   "AND owner_kind='CG09_CLAIM'",[uid(reference),actor.realmId]);
  const row=rows.rows[0];
  if(!row)throw new NotFoundException({code:"FINANCE_CLAIM_BILL_INVALID"});
  if(write)await this.source.current(bearer,row.claim_id,row.claim_version,true);
  else await this.source.historical(bearer,row.claim_id,row.claim_version);
  return {actor,row};
 }
 async status(bearer:string,reference:string){
  const {actor,row}=await this.intent(bearer,reference);
  const found=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_stored_file "+
   "WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG09_CLAIM' "+
   "AND revoked_at IS NULL",[actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,
   cleanVerified:row.status==="VALIDATED"&&!!found.rows[0],
   fileRef:row.status==="VALIDATED"?found.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?found.rows[0]?.revision??null:null};
 }
 async confirm(bearer:string,reference:string){
  const {actor,row}=await this.intent(bearer,reference,true);
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||
     row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified;
  try{
   verified=await this.storage.verifyPrivateObject({
    objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
    sha256:row.expected_sha256
   });
  }catch{
   await this.db.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')",
    [row.id,actor.realmId]);
   return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const time=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&
   verified.sha256===row.expected_sha256&&verified.mime===row.mime&&
   verified.sizeBytes===Number(row.size_bytes)&&
   typeof verified.objectVersion==="string"&&verified.objectVersion.length>0&&
   verified.objectVersion.length<=160&&
   typeof verified.scanProofRef==="string"&&verified.scanProofRef.length>=8&&
   verified.scanProofRef.length<=160&&
   Number.isFinite(time)&&time<=Date.now()+60000&&Date.now()-time<900000;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.source.guardDraft(tx,actor,row.claim_id,row.claim_version);
   const current=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
    "AND owner_kind='CG09_CLAIM' FOR UPDATE",[row.id,actor.realmId]);
   const now=current.rows[0];
   if(!now||now.reserved_until.getTime()<=Date.now()||
       ["REJECTED","EXPIRED"].includes(now.status))
    throw new ConflictException({code:"FINANCE_CLAIM_BILL_CONFLICT"});
   if(now.status!=="VALIDATED"){
    await tx.query(
     "UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
     "WHERE id=$1 AND realm_id=$2",[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
    let fileRef:string|null=null;
    if(clean){
     const inserted=await tx.query<{id:string}>(
      "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,"+
      "proposal_revision,original_mime,verified_sha256,verified_size_bytes,"+
      "object_key,object_version,scan_status,scan_proof_ref,scanned_at,created_by,"+
      "owner_kind,claim_id,claim_version) VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,"+
      "'CLEAN_VERIFIED',$9,$10,$11,'CG09_CLAIM',$12,$13) RETURNING id",
      [actor.realmId,row.id,row.claim_version,row.mime,row.expected_sha256,
       row.size_bytes,row.object_key,verified.objectVersion,verified.scanProofRef,
       verified.verifiedAt,actor.accountId,row.claim_id,row.claim_version]);
     fileRef=inserted.rows[0].id;
    }
    await tx.query(
     "INSERT INTO cg19_document_event(realm_id,claim_id,actor_id,intent_id,"+
     "file_id,event_key) VALUES($1,$2,$3,$4,$5,$6)",
     [actor.realmId,row.claim_id,actor.accountId,row.id,fileRef,
      clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED"]);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  return this.status(bearer,row.id);
 }
 async list(bearer:string,claimRef:string,claimVersion:number){
  const actor=await this.authority(bearer,false);
  await this.source.historical(bearer,uid(claimRef),claimVersion);
  const found=await this.db.query<{fileRef:string;fileVersion:number;mime:string;sizeBytes:string}>(
   "SELECT f.id AS \"fileRef\",f.revision AS \"fileVersion\",f.original_mime AS mime,"+
   "f.verified_size_bytes::text AS \"sizeBytes\" "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.realm_id=$1 AND f.claim_id=$2 AND f.claim_version=$3 "+
   "AND f.owner_kind='CG09_CLAIM' AND i.owner_kind='CG09_CLAIM' "+
   "AND i.status='VALIDATED' AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "ORDER BY f.created_at DESC,f.id DESC LIMIT 16",
   [actor.realmId,claimRef,claimVersion]);
  return {files:found.rows};
 }
 /** No upload acknowledgement or arbitrary user-controlled file passes this check. */
 async guardVerifiedBill(tx:PoolClient,actor:VerifiedFoundationActor,
  claimRef:string,claimVersion:number,fileRef:string,fileVersion:number){
  await this.source.guardDraft(tx,actor,claimRef,claimVersion);
  if(!UUID.test(fileRef)||!Number.isSafeInteger(fileVersion)||fileVersion<1)
   throw new ConflictException({code:"FINANCE_CLAIM_BILL_INVALID"});
  const found=await tx.query<{id:string}>(
   "SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.claim_id=$3 AND f.claim_version=$4 "+
   "AND f.revision=$5 AND f.owner_kind='CG09_CLAIM' AND f.revoked_at IS NULL "+
   "AND f.scan_status='CLEAN_VERIFIED' AND i.owner_kind='CG09_CLAIM' "+
   "AND i.status='VALIDATED' FOR SHARE OF f,i",
   [fileRef,actor.realmId,claimRef,claimVersion,fileVersion]);
  if(!found.rows[0])throw new ConflictException({code:"FINANCE_CLAIM_BILL_INVALID"});
 }
 async download(bearer:string,reference:string){
  const actor=await this.authority(bearer,false);
  const rows=await this.db.query<Proof>(
   "SELECT f.id,f.revision,f.claim_id,f.claim_version,f.object_key,f.object_version,"+
   "f.original_mime,f.verified_sha256,f.verified_size_bytes,f.revoked_at "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG09_CLAIM' "+
   "AND i.owner_kind='CG09_CLAIM' AND i.status='VALIDATED' "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'",
   [uid(reference),actor.realmId]);
  const f=rows.rows[0];
  if(!f)throw new NotFoundException({code:"FINANCE_CLAIM_BILL_INVALID"});
  await this.source.historical(bearer,f.claim_id,f.claim_version);
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:f.object_key,objectVersion:f.object_version,
   maxBytes:Number(f.verified_size_bytes)
  });
  if(bytes.length!==Number(f.verified_size_bytes)||
     createHash("sha256").update(bytes).digest("hex")!==f.verified_sha256)
   throw new ServiceUnavailableException("Private bill integrity could not be verified");
  // Recheck after external storage read, so revocation does not leak stale bytes.
  await this.authority(bearer,false);
  await this.source.historical(bearer,f.claim_id,f.claim_version);
  const live=await this.db.query(
   "SELECT id FROM cg19_stored_file WHERE id=$1 AND realm_id=$2 AND revision=$3 "+
   "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
   [f.id,actor.realmId,f.revision]);
  if(!live.rowCount)throw new ConflictException({code:"FINANCE_CLAIM_BILL_CONFLICT"});
  return {data:bytes,mime:f.original_mime};
 }
}
