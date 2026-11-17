import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceBankStatementSourceFacade} from "../../cg-09-finance-accounting/application/finance-bank-statement-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const uid=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
 return v;
};
type Input={reconciliationRef:string;requestKey:string;mime:string;sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;reconciliation_id:string;requested_by:string;
 request_key:string;mime:string;size_bytes:string;expected_sha256:string;
 request_digest:string;object_key:string;status:string;reserved_until:Date};
type Stored={id:string;reconciliation_id:string;revision:number;original_mime:string;
 verified_size_bytes:string;verified_sha256:string;object_key:string;object_version:string};
function parse(raw:unknown):Input{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["reconciliationRef","requestKey","mime","sizeBytes","sha256"].includes(k))||
  typeof v.reconciliationRef!=="string"||!UUID.test(v.reconciliationRef)||
  typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
  typeof v.mime!=="string"||!MIME.has(v.mime)||
  !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||
  Number(v.sizeBytes)>10485760||typeof v.sha256!=="string"||!SHA.test(v.sha256))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
 return v as Input;
}
const fingerprint=(x:Input)=>createHash("sha256").update(JSON.stringify([
 "CG19_BANK_STATEMENT_V1",x.reconciliationRef,x.mime,x.sizeBytes,x.sha256
])).digest("hex");
/** Original CG-19-owned clean private statement file.
 * Recording a user reference does NOT establish this evidence or pay funds.
 */
@Injectable()
export class FinanceBankStatementEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:FinanceBankStatementSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async uploader(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.manage");
  await this.sessions.requireAction(bearer,"documents.files.manage");
  return actor;
 }
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.review");
  await this.sessions.requireAction(bearer,"documents.files.view");
  return actor;
 }
 async initiate(bearer:string,raw:unknown){
  const v=parse(raw),actor=await this.uploader(bearer),digest=fingerprint(v);
  await this.source.pendingForUploader(bearer,v.reconciliationRef);
  const newKey="careganga/private/cg19/"+actor.realmId+"/bank-statements/"+randomUUID();
  const tx=await this.db.connect();
  let intent:Intent;
  try{
   await tx.query("BEGIN");
   await this.source.guardPending(tx,actor,v.reconciliationRef);
   const result=await tx.query<Intent>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,"+
    "requested_by,request_key,mime,size_bytes,expected_sha256,request_digest,"+
    "classification,object_key,reserved_until,owner_kind,reconciliation_id) "+
    "VALUES($1,NULL,1,$2,$3,$4,$5,$6,$7,'FINANCE_BANK_STATEMENT',$8,"+
    "now()+interval '15 minutes','CG09_BANK_STATEMENT',$9) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,actor.accountId,v.requestKey,v.mime,v.sizeBytes,v.sha256,
     digest,newKey,v.reconciliationRef]);
   intent=result.rows[0];
   if(!intent){
    const previous=await tx.query<Intent>(
     "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 "+
     "AND request_key=$3 AND owner_kind='CG09_BANK_STATEMENT' FOR SHARE",
     [actor.realmId,actor.accountId,v.requestKey]);
    intent=previous.rows[0];
    if(!intent||intent.request_digest!==digest||
      intent.reconciliation_id!==v.reconciliationRef)
     throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"});
   }else await tx.query(
    "INSERT INTO cg19_document_event(realm_id,reconciliation_id,actor_id,intent_id,event_key) "+
    "VALUES($1,$2,$3,$4,'UPLOAD_INITIATED')",
    [actor.realmId,v.reconciliationRef,actor.accountId,intent.id]);
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status,cleanVerified:intent.status==="VALIDATED"};
  try{
   const signed=await this.storage.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()});
   const expiry=Date.parse(signed.expiresAt);
   if(!signed.url.startsWith("https://")||!signed.reservationRef||
     signed.reservationRef.length>160||!Number.isFinite(expiry)||
     expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
     signed.headers?.["Content-Type"]!==intent.mime||
     !Object.entries(signed.headers).every(([k,val])=>
      ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&
       typeof val==="string"&&val.length<=160))
    throw new ServiceUnavailableException("Private bank statement upload unavailable");
   const saved=await this.db.query(
    "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN') "+
    "AND reserved_until>now() RETURNING id",
    [intent.id,actor.realmId,signed.reservationRef]);
   if(!saved.rowCount)throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"});
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:signed.url,
    uploadHeaders:signed.headers,expiresAt:signed.expiresAt};
  }catch{
   await this.db.query("UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status='INITIATED'",
    [intent.id,actor.realmId]).catch(()=>undefined);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 private async ownedIntent(bearer:string,ref:string){
  const actor=await this.uploader(bearer);
  const rows=await this.db.query<Intent>(
   "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
   "AND requested_by=$3 AND owner_kind='CG09_BANK_STATEMENT'",
   [uid(ref),actor.realmId,actor.accountId]);
  if(!rows.rows[0])
   throw new NotFoundException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
  return {actor,intent:rows.rows[0]};
 }
 async status(bearer:string,ref:string){
  const {actor,intent}=await this.ownedIntent(bearer,ref);
  const f=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_stored_file WHERE realm_id=$1 "+
   "AND upload_intent_id=$2 AND owner_kind='CG09_BANK_STATEMENT' AND revoked_at IS NULL",
   [actor.realmId,intent.id]);
  return {uploadRef:intent.id,status:intent.status,
   cleanVerified:intent.status==="VALIDATED"&&!!f.rows[0],
   fileRef:intent.status==="VALIDATED"?f.rows[0]?.id??null:null,
   fileVersion:intent.status==="VALIDATED"?f.rows[0]?.revision??null:null};
 }
 async confirm(bearer:string,ref:string){
  const {actor,intent}=await this.ownedIntent(bearer,ref);
  if(intent.status==="VALIDATED")return this.status(bearer,intent.id);
  if(["REJECTED","EXPIRED"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified;
  try{
   verified=await this.storage.verifyPrivateObject({
    objectKey:intent.object_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256});
  }catch{
   await this.db.query("UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')",
    [intent.id,actor.realmId]).catch(()=>undefined);
   return {uploadRef:intent.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const scannedAt=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&verified.mime===intent.mime&&
   verified.sha256===intent.expected_sha256&&
   verified.sizeBytes===Number(intent.size_bytes)&&
   verified.objectVersion.length>0&&verified.objectVersion.length<=160&&
   verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
   Number.isFinite(scannedAt)&&scannedAt<=Date.now()+60000&&Date.now()-scannedAt<900000;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.source.guardPending(tx,actor,intent.reconciliation_id);
   const current=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
    "AND requested_by=$3 AND owner_kind='CG09_BANK_STATEMENT' FOR UPDATE",
    [intent.id,actor.realmId,actor.accountId]);
   const row=current.rows[0];
   if(!row||row.reserved_until.getTime()<=Date.now()||
     ["REJECTED","EXPIRED"].includes(row.status))
    throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"});
   if(row.status!=="VALIDATED"){
    await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
     "WHERE id=$1 AND realm_id=$2",[intent.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
    if(clean){
     const saved=await tx.query<{id:string}>(
      "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,"+
      "proposal_revision,original_mime,verified_sha256,verified_size_bytes,"+
      "object_key,object_version,scan_status,scan_proof_ref,scanned_at,"+
      "created_by,owner_kind,reconciliation_id) "+
      "VALUES($1,$2,NULL,1,$3,$4,$5,$6,$7,'CLEAN_VERIFIED',$8,$9,"+
      "$10,'CG09_BANK_STATEMENT',$11) RETURNING id",
      [actor.realmId,intent.id,intent.mime,intent.expected_sha256,
       intent.size_bytes,intent.object_key,verified.objectVersion,
       verified.scanProofRef,verified.verifiedAt,actor.accountId,intent.reconciliation_id]);
     await tx.query("INSERT INTO cg19_document_event(realm_id,reconciliation_id,"+
      "actor_id,intent_id,file_id,event_key) VALUES($1,$2,$3,$4,$5,'UPLOAD_VERIFIED')",
      [actor.realmId,intent.reconciliation_id,actor.accountId,intent.id,saved.rows[0].id]);
    }else await tx.query(
     "INSERT INTO cg19_document_event(realm_id,reconciliation_id,actor_id,intent_id,event_key) "+
     "VALUES($1,$2,$3,$4,'UPLOAD_REJECTED')",
     [actor.realmId,intent.reconciliation_id,actor.accountId,intent.id]);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  return this.status(bearer,intent.id);
 }
 async listForReviewer(bearer:string,reconciliationRef:string){
  const actor=await this.reviewer(bearer);
  const ref=uid(reconciliationRef);
  const match=await this.db.query(
   "SELECT id FROM finance_bank_reconciliation WHERE id=$1 AND root_realm_id=$2",
   [ref,actor.realmId]);
  if(!match.rows[0])throw new NotFoundException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
  const data=await this.db.query<{fileRef:string;fileVersion:number;mime:string;sizeBytes:string}>(
   "SELECT f.id AS \"fileRef\",f.revision AS \"fileVersion\","+
   "f.original_mime AS mime,f.verified_size_bytes::text AS \"sizeBytes\" "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.realm_id=$1 AND f.reconciliation_id=$2 "+
   "AND f.owner_kind='CG09_BANK_STATEMENT' AND i.owner_kind='CG09_BANK_STATEMENT' "+
   "AND i.reconciliation_id=$2 AND i.status='VALIDATED' "+
   "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
   "ORDER BY f.created_at DESC,f.id DESC LIMIT 20",
   [actor.realmId,ref]);
  return {files:data.rows};
 }
 async download(bearer:string,fileRef:string){
  const actor=await this.reviewer(bearer),ref=uid(fileRef);
  const rows=await this.db.query<Stored>(
   "SELECT f.id,f.reconciliation_id,f.revision,f.original_mime,"+
   "f.verified_size_bytes::text,f.verified_sha256,f.object_key,f.object_version "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG09_BANK_STATEMENT' "+
   "AND i.owner_kind='CG09_BANK_STATEMENT' AND f.reconciliation_id=i.reconciliation_id "+
   "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
   "AND i.status='VALIDATED'",[ref,actor.realmId]);
  const file=rows.rows[0];
  if(!file)throw new NotFoundException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:file.object_key,objectVersion:file.object_version,
   maxBytes:Number(file.verified_size_bytes)});
  if(bytes.length!==Number(file.verified_size_bytes)||
   createHash("sha256").update(bytes).digest("hex")!==file.verified_sha256)
   throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"});
  await this.reviewer(bearer);
  const current=await this.db.query(
   "SELECT id FROM cg19_stored_file WHERE id=$1 AND realm_id=$2 "+
   "AND owner_kind='CG09_BANK_STATEMENT' AND revoked_at IS NULL AND object_version=$3",
   [ref,actor.realmId,file.object_version]);
  if(!current.rowCount)
   throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"});
  return {data:bytes,mime:file.original_mime};
 }
}
