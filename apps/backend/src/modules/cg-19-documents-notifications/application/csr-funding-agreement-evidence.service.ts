import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {CsrFundingProposalsService} from "../../cg-08-csr-funding/application/csr-funding-proposals.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

/** CG19 keeps scanner-verified PRIVATE bytes for one original CG08 funding
 * proposal and immutable source version. CG03, not CG19, decides whether the
 * scanned document is genuinely signed and authorizes the commitment. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME=["application/pdf","image/jpeg","image/png","image/webp"];
const changed=()=>new ConflictException({
 code:"CG08_FUNDING_EVIDENCE_CHANGED",
 message:"Funding request or private agreement changed. Refresh its original source."});
const unavailable=()=>new ServiceUnavailableException("Private funding agreement verification is unavailable.");
function uid(v:unknown):string{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid original funding request or file.");
 return v.toLowerCase();
}
export function parseCsrFundingAgreementUpload(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException("Choose a private funding agreement.");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["proposalRef","sourceVersion","requestKey","mime","sizeBytes","sha256"].includes(k))||
  !Number.isSafeInteger(v.sourceVersion)||Number(v.sourceVersion)<1||
  typeof v.mime!=="string"||!MIME.includes(v.mime)||
  !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||Number(v.sizeBytes)>10485760||
  typeof v.sha256!=="string"||!/^[a-f0-9]{64}$/.test(v.sha256))
  throw new BadRequestException("Choose a PDF or image agreement under 10 MB.");
 return {proposalRef:uid(v.proposalRef),sourceVersion:Number(v.sourceVersion),
  requestKey:uid(v.requestKey),mime:v.mime,sizeBytes:Number(v.sizeBytes),
  sha256:v.sha256};
}
type Intent={id:string;funding_proposal_id:string;proposal_revision:number;
 requested_by:string;request_key:string;request_digest:string;mime:string;
 size_bytes:string;expected_sha256:string;object_key:string;status:string;
 reserved_until:Date};
type FileRow={id:string;funding_proposal_id:string;proposal_revision:number;
 revision:number;original_mime:string;verified_size_bytes:string;
 verified_sha256:string;object_key:string;object_version:string};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class CsrFundingAgreementEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly funding:CsrFundingProposalsService,
  private readonly objects:PrivateObjectStorage){}
 private async run<T>(bearer:string,write:boolean,
  fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>):Promise<T>{
  const action=write?"documents.files.manage":"documents.files.view";
  const a=await this.sessions.requireAction(bearer,action),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,a,action);
   if(write)await this.identity.assertCurrent(tx,a,"documents.files.view");
   const value=await fn(tx,a);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}
  finally{tx.release();}
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,i:Intent,action:string){
  await tx.query("INSERT INTO cg19_funding_evidence_event(realm_id,funding_proposal_id,intent_ref,actor_ref,action) "+
   "VALUES($1,$2,$3,$4,$5)",[a.realmId,i.funding_proposal_id,i.id,a.accountId,action]);
 }
 private async intent(tx:PoolClient,a:VerifiedFoundationActor,id:string,write:boolean,lock=false){
  const i=(await tx.query<Intent>(
   "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3 "+
   "AND owner_kind='CG08_FUNDING_AGREEMENT'",[a.realmId,uid(id),a.accountId])).rows[0];
  if(!i)throw new NotFoundException("Funding agreement upload unavailable.");
  await this.funding.guardFundingAgreement(tx,a,i.funding_proposal_id,
   write?i.proposal_revision:null,write);
  if(!lock)return i;
  const current=(await tx.query<Intent>(
   "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3 "+
   "AND owner_kind='CG08_FUNDING_AGREEMENT' FOR UPDATE",
   [a.realmId,i.id,a.accountId])).rows[0];
  if(!current)throw changed();
  return current;
 }
 async initiate(bearer:string,raw:unknown){
  const v=parseCsrFundingAgreementUpload(raw),hash=digest(["CG08_FUNDING_FILE_V1",v]);
  const row=await this.run(bearer,true,async(tx,a)=>{
   await this.funding.guardFundingAgreement(tx,a,v.proposalRef,v.sourceVersion,true);
   const q=await tx.query<Intent>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,request_key,"+
    "mime,size_bytes,expected_sha256,request_digest,classification,object_key,"+
    "reserved_until,owner_kind,funding_proposal_id) "+
    "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,'CSR_FUNDING_AGREEMENT',$9,"+
    "now()+interval '15 minutes','CG08_FUNDING_AGREEMENT',$10) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [a.realmId,v.sourceVersion,a.accountId,v.requestKey,v.mime,v.sizeBytes,v.sha256,
     hash,"careganga/private/cg19/"+a.realmId+"/"+randomUUID(),v.proposalRef]);
   if(q.rows[0]){await this.event(tx,a,q.rows[0],"UPLOAD_INITIATED");return q.rows[0];}
   const prior=(await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 "+
    "AND request_key=$3 AND owner_kind='CG08_FUNDING_AGREEMENT' FOR SHARE",
    [a.realmId,a.accountId,v.requestKey])).rows[0];
   if(!prior||prior.request_digest!==hash||prior.funding_proposal_id!==v.proposalRef)
    throw changed();
   return prior;
  });
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||
   row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const res=await this.objects.reservePrivateUpload({
    objectKey:row.object_key,requestKey:row.request_key,mime:row.mime,
    sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256,
    expiresAt:row.reserved_until.toISOString()});
   const until=Date.parse(res.expiresAt);
   if(!res.url.startsWith("https://")||!Number.isFinite(until)||
    until<=Date.now()||until>row.reserved_until.getTime()||
    !res.reservationRef||res.reservationRef.length>160||
    res.headers["Content-Type"]!==row.mime||
    !Object.entries(res.headers).every(([k,val])=>
     ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&
     typeof val==="string"&&val.length<=160))
    throw unavailable();
   await this.run(bearer,true,async(tx,a)=>{
    const i=await this.intent(tx,a,row.id,true,true);
    const u=await tx.query(
     "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() "+
     "WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
     [a.realmId,i.id,res.reservationRef]);
    if(!u.rowCount)throw changed();
   });
   return {uploadRef:row.id,status:"UPLOAD_READY",uploadUrl:res.url,
    uploadHeaders:res.headers,expiresAt:res.expiresAt,cleanVerified:false};
  }catch(e){
   if(e instanceof ForbiddenException||e instanceof ConflictException)throw e;
   await this.markUnknown(bearer,row.id);
   return {uploadRef:row.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 private async markUnknown(bearer:string,id:string){
  return this.run(bearer,true,async(tx,a)=>{
   const i=await this.intent(tx,a,id,true,true);
   const q=await tx.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','VERIFYING') RETURNING id",
    [a.realmId,i.id]);
   if(q.rowCount)await this.event(tx,a,i,"UPLOAD_UNKNOWN");
  });
 }
 async status(bearer:string,id:string){
  return this.run(bearer,false,async(tx,a)=>{
   const i=await this.intent(tx,a,id,false);
   const f=(await tx.query<{id:string;revision:number}>(
    "SELECT id,revision FROM cg19_stored_file WHERE realm_id=$1 AND upload_intent_id=$2 "+
    "AND owner_kind='CG08_FUNDING_AGREEMENT' AND scan_status='CLEAN_VERIFIED' "+
    "AND revoked_at IS NULL",[a.realmId,i.id])).rows[0];
   return {uploadRef:i.id,status:i.status,
    cleanVerified:i.status==="VALIDATED"&&!!f,
    fileRef:i.status==="VALIDATED"?f?.id??null:null,
    fileVersion:i.status==="VALIDATED"?f?.revision??null:null};
  });
 }
 async confirm(bearer:string,id:string){
  const row=await this.run(bearer,true,(tx,a)=>this.intent(tx,a,id,true));
  if(row.status==="VALIDATED")return this.status(bearer,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||
    row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let proof;
  try{proof=await this.objects.verifyPrivateObject({objectKey:row.object_key,
    mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});}
  catch{await this.markUnknown(bearer,row.id);return {uploadRef:row.id,
    status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const checked=Date.parse(proof.verifiedAt);
  const clean=proof.state==="CLEAN_VERIFIED"&&
   proof.sha256===row.expected_sha256&&proof.mime===row.mime&&
   proof.sizeBytes===Number(row.size_bytes)&&
   typeof proof.objectVersion==="string"&&proof.objectVersion.length>0&&
   proof.objectVersion.length<=160&&
   typeof proof.scanProofRef==="string"&&proof.scanProofRef.length>=8&&
   proof.scanProofRef.length<=160&&Number.isFinite(checked)&&
   checked<=Date.now()+60000&&Date.now()-checked<900000;
  await this.run(bearer,true,async(tx,a)=>{
   const i=await this.intent(tx,a,row.id,true,true);
   if(i.status==="VALIDATED")return;
   if(["REJECTED","EXPIRED"].includes(i.status)||
     i.reserved_until.getTime()<=Date.now())throw changed();
   await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2",[a.realmId,i.id,clean?"VALIDATED":"REJECTED"]);
   if(clean)await tx.query(
    "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
    "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
    "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,funding_proposal_id) "+
    "VALUES($1,$2,NULL,$12,$3,$4,$5,$6,$7,'CLEAN_VERIFIED',$8,$9,$10,"+
    "'CG08_FUNDING_AGREEMENT',$11)",
    [a.realmId,row.id,row.mime,row.expected_sha256,row.size_bytes,row.object_key,
     proof.objectVersion,proof.scanProofRef,proof.verifiedAt,a.accountId,
     row.funding_proposal_id,row.proposal_revision]);
   await this.event(tx,a,i,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED");
  });
  return this.status(bearer,row.id);
 }
 /** For eventual CG03 independent reviewer: current source identity and
  * immutable scanner proof must match exactly; this proves uploaded bytes,
  * NOT that the agreement was signed or that cash was received. */
 async requireCurrentProof(tx:PoolClient,a:VerifiedFoundationActor,
  proposalRef:string,version:number,fileRef:string){
  await this.funding.guardFundingAgreement(tx,a,proposalRef,version,false);
  const q=await tx.query(
   "SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.realm_id=$1 AND f.funding_proposal_id=$2 AND f.id=$3 "+
   "AND f.proposal_revision=$4 AND f.owner_kind='CG08_FUNDING_AGREEMENT' "+
   "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
   "AND i.owner_kind='CG08_FUNDING_AGREEMENT' "+
   "AND i.funding_proposal_id=f.funding_proposal_id "+
   "AND i.classification='CSR_FUNDING_AGREEMENT' AND i.status='VALIDATED' "+
   "FOR SHARE OF f,i",[a.realmId,uid(proposalRef),uid(fileRef),version]);
  if(!q.rowCount)throw changed();
 }
 async list(bearer:string,proposalRef:string){
  return this.run(bearer,false,async(tx,a)=>{
   const p=await this.funding.guardFundingAgreement(tx,a,uid(proposalRef),null,false);
   const files=await tx.query(
    'SELECT f.id AS "fileRef",f.revision AS "fileVersion",'+
    'f.proposal_revision AS "sourceVersion",f.original_mime AS mime,'+
    'f.created_at AS "createdAt" FROM cg19_stored_file f '+
    'JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id '+
    "WHERE f.realm_id=$1 AND f.funding_proposal_id=$2 "+
    "AND f.owner_kind='CG08_FUNDING_AGREEMENT' AND "+
    "f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
    "AND i.owner_kind='CG08_FUNDING_AGREEMENT' AND i.status='VALIDATED' "+
    "ORDER BY f.created_at DESC,f.id DESC LIMIT 16",[a.realmId,p.ref]);
   return {files:files.rows,currentVersion:p.version,
    notice:"Scanner verification is not independent signature or funding approval."};
  });
 }
 private async file(tx:PoolClient,a:VerifiedFoundationActor,id:string){
  const f=(await tx.query<FileRow>(
   "SELECT f.id,f.funding_proposal_id,f.proposal_revision,f.revision,f.original_mime,"+
   "f.verified_size_bytes::text,f.verified_sha256,f.object_key,f.object_version "+
   "FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.realm_id=$1 AND f.id=$2 "+
   "AND f.owner_kind='CG08_FUNDING_AGREEMENT' AND "+
   "f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
   "AND i.owner_kind='CG08_FUNDING_AGREEMENT' AND i.status='VALIDATED' "+
   "AND i.funding_proposal_id=f.funding_proposal_id FOR SHARE OF f,i",
   [a.realmId,uid(id)])).rows[0];
  if(!f)throw new NotFoundException("Verified private funding agreement unavailable.");
  await this.funding.guardFundingAgreement(tx,a,f.funding_proposal_id,null,false);
  return f;
 }
 async download(bearer:string,fileRef:string){
  const f=await this.run(bearer,false,(tx,a)=>this.file(tx,a,fileRef));
  let bytes:Buffer;
  try{bytes=await this.objects.readVerifiedPrivateObject({
    objectKey:f.object_key,objectVersion:f.object_version,maxBytes:10485760});}
  catch{throw unavailable();}
  if(bytes.length!==Number(f.verified_size_bytes)||
   createHash("sha256").update(bytes).digest("hex")!==f.verified_sha256||
   !MIME.includes(f.original_mime))throw changed();
  const newest=await this.run(bearer,false,(tx,a)=>this.file(tx,a,fileRef));
  if(newest.revision!==f.revision||newest.object_version!==f.object_version||
    newest.funding_proposal_id!==f.funding_proposal_id)throw changed();
  return {bytes,mime:f.original_mime};
 }
}
