import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {CsrPartnersService} from "../../cg-08-csr-funding/application/csr-partners.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

/** CG19 owns only private agreement proof; the actual CSR partner and status
 * remain CG08, the approval case remains original CG03. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME=["application/pdf","image/jpeg","image/png","image/webp"];
const changed=()=>new ConflictException({code:"CG08_AGREEMENT_CHANGED",message:"This agreement or CSR draft has changed. Refresh."});
const unavailable=()=>new ServiceUnavailableException("Secure agreement storage or verification is unavailable.");
const uid=(x:unknown)=>{if(typeof x!=="string"||!UUID.test(x))throw new BadRequestException("Choose a current CSR application or file.");return x.toLowerCase();};
type Input={partnerRef:string;sourceVersion:number;requestKey:string;mime:string;sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;csr_partner_id:string;proposal_revision:number;requested_by:string;request_key:string;mime:string;size_bytes:string;expected_sha256:string;request_digest:string;object_key:string;status:string;reserved_until:Date};
type FileRow={id:string;csr_partner_id:string;proposal_revision:number;revision:number;original_mime:string;verified_size_bytes:string;verified_sha256:string;object_key:string;object_version:string};
export function parseCsrAgreementUpload(value:unknown):Input{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new BadRequestException("Choose an agreement document.");
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["partnerRef","sourceVersion","requestKey","mime","sizeBytes","sha256"].includes(k))
  ||!Number.isSafeInteger(x.sourceVersion)||Number(x.sourceVersion)<1
  ||typeof x.mime!=="string"||!MIME.includes(x.mime)
  ||!Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||Number(x.sizeBytes)>10485760
  ||typeof x.sha256!=="string"||!/^[0-9a-f]{64}$/.test(x.sha256))
  throw new BadRequestException("Choose a PDF or image agreement under 10 MB.");
 return {partnerRef:uid(x.partnerRef),sourceVersion:Number(x.sourceVersion),requestKey:uid(x.requestKey),
  mime:x.mime,sizeBytes:Number(x.sizeBytes),sha256:x.sha256};
}
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class CsrAgreementEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly partners:CsrPartnersService,private readonly objects:PrivateObjectStorage){}
 private async run<T>(bearer:string,write:boolean,fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>){
  const action=write?"documents.files.manage":"documents.files.view";
  const a=await this.sessions.requireAction(bearer,action),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);
   if(write)await this.identity.assertCurrent(tx,a,"documents.files.view");
   const result=await fn(tx,a);await tx.query("COMMIT");return result;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,intent:Intent,action:string){
  await tx.query("INSERT INTO cg19_csr_evidence_event(realm_id,partner_id,intent_ref,actor_ref,action) VALUES($1,$2,$3,$4,$5)",
   [a.realmId,intent.csr_partner_id,intent.id,a.accountId,action]);
 }
 private async intent(tx:PoolClient,a:VerifiedFoundationActor,id:string,write:boolean,lock=false){
  const r=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3 AND owner_kind='CG08_CSR_AGREEMENT'",
   [a.realmId,uid(id),a.accountId])).rows[0];
  if(!r)throw new NotFoundException("CSR agreement upload unavailable.");
  await this.partners.guardAgreement(tx,a,r.csr_partner_id,write?r.proposal_revision:null,write);
  if(!lock)return r;
  const current=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3 AND owner_kind='CG08_CSR_AGREEMENT' FOR UPDATE",
   [a.realmId,r.id,a.accountId])).rows[0];
  if(!current)throw changed();
  return current;
 }
 async initiate(bearer:string,input:unknown){
  const x=parseCsrAgreementUpload(input),h=digest(["CG08_AGREEMENT_V1",x]);
  const row=await this.run(bearer,true,async(tx,a)=>{
   await this.partners.guardAgreement(tx,a,x.partnerRef,x.sourceVersion,true);
   const q=await tx.query<Intent>("INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,request_key,mime,size_bytes,expected_sha256,request_digest,classification,object_key,reserved_until,owner_kind,csr_partner_id) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,'CSR_AGREEMENT',$9,now()+interval '15 minutes','CG08_CSR_AGREEMENT',$10) ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [a.realmId,x.sourceVersion,a.accountId,x.requestKey,x.mime,x.sizeBytes,x.sha256,h,"careganga/private/cg19/"+a.realmId+"/"+randomUUID(),x.partnerRef]);
   if(q.rows[0]){await this.event(tx,a,q.rows[0],"UPLOAD_INITIATED");return q.rows[0];}
   const old=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 AND owner_kind='CG08_CSR_AGREEMENT' FOR SHARE",
    [a.realmId,a.accountId,x.requestKey])).rows[0];
   if(!old||old.request_digest!==h||old.csr_partner_id!==x.partnerRef)throw changed();
   return old;
  });
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const reservation=await this.objects.reservePrivateUpload({objectKey:row.object_key,requestKey:row.request_key,
    mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256,expiresAt:row.reserved_until.toISOString()});
   const until=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!Number.isFinite(until)||until<=Date.now()
    ||until>row.reserved_until.getTime()||!reservation.reservationRef||reservation.reservationRef.length>160
    ||reservation.headers["Content-Type"]!==row.mime
    ||!Object.entries(reservation.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))
    throw unavailable();
   await this.run(bearer,true,async(tx,a)=>{
    const cur=await this.intent(tx,a,row.id,true,true);
    const update=await tx.query("UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
     [a.realmId,cur.id,reservation.reservationRef]);
    if(!update.rowCount)throw changed();
   });
   return {uploadRef:row.id,status:"UPLOAD_READY",uploadUrl:reservation.url,
    uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt,cleanVerified:false};
  }catch(e){
   if(e instanceof ForbiddenException||e instanceof ConflictException)throw e;
   await this.markUnknown(bearer,row.id);
   return {uploadRef:row.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 private async markUnknown(bearer:string,id:string){
  return this.run(bearer,true,async(tx,a)=>{
   const row=await this.intent(tx,a,id,true,true);
   const q=await tx.query("UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','VERIFYING') RETURNING id",[a.realmId,row.id]);
   if(q.rowCount)await this.event(tx,a,row,"UPLOAD_UNKNOWN");
  });
 }
 async status(bearer:string,id:string){
  return this.run(bearer,false,async(tx,a)=>{
   const row=await this.intent(tx,a,id,false);
   const f=(await tx.query<{id:string;revision:number}>("SELECT id,revision FROM cg19_stored_file WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG08_CSR_AGREEMENT' AND scan_status='CLEAN_VERIFIED' AND revoked_at IS NULL",[a.realmId,row.id])).rows[0];
   return {uploadRef:row.id,status:row.status,cleanVerified:row.status==="VALIDATED"&&!!f,
    fileRef:row.status==="VALIDATED"?f?.id??null:null,fileVersion:row.status==="VALIDATED"?f?.revision??null:null};
  });
 }
 async confirm(bearer:string,id:string){
  const row=await this.run(bearer,true,(tx,a)=>this.intent(tx,a,id,true));
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let proof;
  try{proof=await this.objects.verifyPrivateObject({objectKey:row.object_key,mime:row.mime,
   sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});}
  catch{await this.markUnknown(bearer,row.id);return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const verifiedAt=Date.parse(proof.verifiedAt);
  const clean=proof.state==="CLEAN_VERIFIED"&&proof.sha256===row.expected_sha256
   &&proof.mime===row.mime&&proof.sizeBytes===Number(row.size_bytes)
   &&typeof proof.objectVersion==="string"&&proof.objectVersion.length>0&&proof.objectVersion.length<=160
   &&typeof proof.scanProofRef==="string"&&proof.scanProofRef.length>=8&&proof.scanProofRef.length<=160
   &&Number.isFinite(verifiedAt)&&verifiedAt<=Date.now()+60000&&Date.now()-verifiedAt<900000;
  await this.run(bearer,true,async(tx,a)=>{
   const current=await this.intent(tx,a,row.id,true,true);
   if(current.status==="VALIDATED")return;
   if(["REJECTED","EXPIRED"].includes(current.status)||current.reserved_until.getTime()<=Date.now())throw changed();
   await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() WHERE realm_id=$1 AND id=$2",
    [a.realmId,current.id,clean?"VALIDATED":"REJECTED"]);
   if(clean)await tx.query("INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,original_mime,verified_sha256,verified_size_bytes,object_key,object_version,scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,csr_partner_id) VALUES($1,$2,NULL,$12,$3,$4,$5,$6,$7,'CLEAN_VERIFIED',$8,$9,$10,'CG08_CSR_AGREEMENT',$11)",
    [a.realmId,row.id,row.mime,row.expected_sha256,row.size_bytes,row.object_key,proof.objectVersion,proof.scanProofRef,proof.verifiedAt,a.accountId,row.csr_partner_id,row.proposal_revision]);
   await this.event(tx,a,current,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED");
  });
  return this.status(bearer,row.id);
 }
 /** Approved review owner may only treat scanner-CLEAN, same current revision
  * as proof. A reserved upload URL is not evidence. */
 async requireCurrentProof(tx:PoolClient,a:VerifiedFoundationActor,partnerId:string,version:number,fileId:string,independentReview=false){
  // CG03's already verified protected reviewer must use its own current review grant;
  // ordinary staff proof checks still require current partner-view branch scope.
  const owner=independentReview?await this.partners.reviewSource(tx,a,partnerId):
   await this.partners.guardAgreement(tx,a,partnerId,null,false);
  // Submit increments the source version once, while the signed proof is
  // deliberately pinned to its immutable prior draft revision.
  if(!(owner.version===version&&["DRAFT","RETURNED"].includes(owner.status)||
    owner.version===version+1&&owner.status==="SUBMITTED"))throw changed();
  const q=await tx.query("SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.realm_id=$1 AND f.csr_partner_id=$2 AND f.id=$3 AND f.proposal_revision=$4 AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.owner_kind='CG08_CSR_AGREEMENT' AND i.csr_partner_id=f.csr_partner_id AND i.classification='CSR_AGREEMENT' AND i.status='VALIDATED' FOR SHARE OF f,i",
   [a.realmId,uid(partnerId),uid(fileId),version]);
  if(!q.rowCount)throw changed();
 }

 /** CG03 is the only caller. A reviewer must independently hold the real
  * protected root role and the current CSR review grant in the same SQL tx.
  * Keep the file row locked during the private byte read so revocation cannot
  * race the export. This is not a public download or signed upload URL. */

 /** One locked, original CG03-scoped snapshot for the reviewer. Never await
  * private storage while this or any other SQL transaction holds locks. */
 async prepareOriginalReviewFile(tx:PoolClient,a:VerifiedFoundationActor,
  partnerId:string,sourceVersion:number,fileRef:string):Promise<FileRow>{
  await this.requireCurrentProof(tx,a,partnerId,sourceVersion,fileRef,true);
  const f=(await tx.query<FileRow>(
   "SELECT f.id,f.csr_partner_id,f.proposal_revision,f.revision,f.original_mime,"+
   "f.verified_size_bytes::text,f.verified_sha256,f.object_key,f.object_version "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.realm_id=$1 AND f.id=$2 AND f.csr_partner_id=$3 AND f.proposal_revision=$4 "+
   "AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.revoked_at IS NULL AND i.owner_kind='CG08_CSR_AGREEMENT' "+
   "AND i.classification='CSR_AGREEMENT' AND i.csr_partner_id=f.csr_partner_id "+
   "AND i.status='VALIDATED' FOR SHARE OF f,i",
   [a.realmId,uid(fileRef),uid(partnerId),sourceVersion])).rows[0];
  if(!f)throw changed();
  return f;
 }
 /** Explicitly outside all PostgreSQL transactions, for storage latency/NFR.
  * Caller MUST revalidate the same source, review case and immutable bytes
  * after this read before allowing a user to see the confidential document. */
 async readPreparedOriginalReviewFile(prepared:FileRow){
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:prepared.object_key,objectVersion:prepared.object_version,maxBytes:10485760});}
  catch{throw unavailable();}
  if(bytes.length!==Number(prepared.verified_size_bytes)||
   createHash("sha256").update(bytes).digest("hex")!==prepared.verified_sha256||
   !MIME.includes(prepared.original_mime))throw changed();
  return {bytes,mime:prepared.original_mime};
 }
 /** Called inside the CG03 post-read protected transaction.  No database
  * credential or storage key is ever sent to the original reviewer UI. */
 async assertOriginalReviewFileUnchanged(tx:PoolClient,a:VerifiedFoundationActor,
  partnerId:string,sourceVersion:number,fileRef:string,prepared:FileRow){
  const latest=await this.prepareOriginalReviewFile(tx,a,partnerId,sourceVersion,fileRef);
  if(latest.id!==prepared.id||latest.revision!==prepared.revision||
   latest.object_version!==prepared.object_version||
   latest.object_key!==prepared.object_key||
   latest.verified_sha256!==prepared.verified_sha256||
   latest.verified_size_bytes!==prepared.verified_size_bytes||
   latest.original_mime!==prepared.original_mime)throw changed();
 }

 async list(bearer:string,partnerId:string){
  return this.run(bearer,false,async(tx,a)=>{
   const partner=await this.partners.guardAgreement(tx,a,partnerId,null,false);
   const q=await tx.query("SELECT f.id AS \"fileRef\",f.revision AS \"fileVersion\",f.proposal_revision AS \"sourceVersion\",f.original_mime AS mime,f.created_at AS \"createdAt\" FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.realm_id=$1 AND f.csr_partner_id=$2 AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' AND i.owner_kind='CG08_CSR_AGREEMENT' ORDER BY f.created_at DESC,f.id DESC LIMIT 16",[a.realmId,partner.id]);
   return {files:q.rows,currentVersion:partner.version};
  });
 }
 private async file(tx:PoolClient,a:VerifiedFoundationActor,id:string){
  const f=(await tx.query<FileRow>("SELECT f.id,f.csr_partner_id,f.proposal_revision,f.revision,f.original_mime,f.verified_size_bytes::text,f.verified_sha256,f.object_key,f.object_version FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.realm_id=$1 AND f.id=$2 AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.owner_kind='CG08_CSR_AGREEMENT' AND i.csr_partner_id=f.csr_partner_id AND i.status='VALIDATED' FOR SHARE OF f,i",[a.realmId,uid(id)])).rows[0];
  if(!f)throw new NotFoundException("Verified CSR agreement unavailable.");
  await this.partners.guardAgreement(tx,a,f.csr_partner_id,null,false);return f;
 }
 async download(bearer:string,fileRef:string){
  const f=await this.run(bearer,false,(tx,a)=>this.file(tx,a,fileRef));
  let bytes:Buffer;try{bytes=await this.objects.readVerifiedPrivateObject({objectKey:f.object_key,objectVersion:f.object_version,maxBytes:10485760});}
  catch{throw unavailable();}
  if(bytes.length!==Number(f.verified_size_bytes)||createHash("sha256").update(bytes).digest("hex")!==f.verified_sha256||!MIME.includes(f.original_mime))throw changed();
  const latest=await this.run(bearer,false,(tx,a)=>this.file(tx,a,fileRef));
  if(latest.revision!==f.revision||latest.object_version!==f.object_version)throw changed();
  return {bytes,mime:f.original_mime};
 }
}
