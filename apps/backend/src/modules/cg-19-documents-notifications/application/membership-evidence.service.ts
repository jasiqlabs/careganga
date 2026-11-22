import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {int,object,pick,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
type Intent={id:string;realm_id:string;application_id:string;application_version:number;requested_by:string;request_key:string;request_digest:string;classification:string;mime:string;size_bytes:string;sha256:string;object_key:string;reserved_until:Date;status:string};
type File={id:string;application_id:string;application_version:number;intent_id:string;classification:string;mime:string;size_bytes:string;sha256:string;object_key:string;object_version:string;revision:number;revoked_at:Date|null};
const missing=()=>new NotFoundException("Your application document is not available.");
const changed=()=>new ConflictException("The application or document changed. Refresh before continuing.");
const unavailable=()=>new ServiceUnavailableException("Secure document storage or verification is temporarily unavailable.");
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
@Injectable()
export class MembershipEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly objects:PrivateObjectStorage){}
 private async run<T>(token:string,work:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.verifiedCommunityApplicant(tx,a);const r=await work(tx,a);await tx.query("COMMIT");return r;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03"].includes(String(e.code)))throw changed();throw e;}finally{tx.release();}
 }
 private async own(tx:PoolClient,a:Actor,app:string,version:number|null,write=false){
  const r=(await tx.query<{version:number;status:string}>("SELECT version,status FROM membership_application WHERE root_realm_id=$1 AND id=$2 AND applicant_account_ref=$3 FOR SHARE",[a.realmId,app,a.accountId])).rows[0];
  if(!r)throw missing();
  if(r.status==="CANCELLED"||write&&(!["DRAFT","RETURNED"].includes(r.status)||version!==null&&r.version!==version))throw changed();
  return r;
 }
 private async intent(tx:PoolClient,a:Actor,ref:string,write=false){
  const row=(await tx.query<Intent>("SELECT * FROM cg19_membership_file_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3",[a.realmId,uuid(ref),a.accountId])).rows[0];
  if(!row)throw missing();
  await this.own(tx,a,row.application_id,write?row.application_version:null,write);
  if(!write)return row;
  const current=(await tx.query<Intent>("SELECT * FROM cg19_membership_file_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3 FOR UPDATE",[a.realmId,row.id,a.accountId])).rows[0];
  if(!current)throw missing();return current;
 }
 private async event(tx:PoolClient,a:Actor,row:Intent,action:string,file:string|null=null){
  await tx.query("INSERT INTO cg19_membership_file_event(realm_id,application_id,intent_id,file_id,actor_ref,action) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,row.application_id,row.id,file,a.accountId,action]);
 }
 private async statusInTx(tx:PoolClient,a:Actor,row:Intent){
  const file=(await tx.query<{id:string;revision:number}>("SELECT id,revision FROM cg19_membership_private_file WHERE realm_id=$1 AND intent_id=$2 AND revoked_at IS NULL",[a.realmId,row.id])).rows[0];
  return {uploadRef:row.id,status:row.status==="INITIATED"&&row.reserved_until.getTime()<=Date.now()?"EXPIRED":row.status,fileRef:row.status==="VALIDATED"?file?.id??null:null,fileVersion:row.status==="VALIDATED"?file?.revision??null:null,cleanVerified:row.status==="VALIDATED"&&!!file};
 }
 async initiate(token:string,raw:unknown){
  const x=object(raw,["applicationRef","applicationVersion","requestKey","classification","mime","sizeBytes","sha256"]);
  const app=uuid(x.applicationRef),version=int(x.applicationVersion,1,2147483647,"application revision"),key=uuid(x.requestKey),classification=pick(x.classification,["MEMBER_IDENTITY_PROOF","MEMBER_PORTRAIT"] as const,"document type"),mime=pick(x.mime,["application/pdf","image/jpeg","image/png","image/webp"] as const,"file format"),size=int(x.sizeBytes,1,10485760,"file size");
  if(classification==="MEMBER_PORTRAIT"&&mime==="application/pdf"||typeof x.sha256!=="string"||!/^[a-f0-9]{64}$/.test(x.sha256))throw new BadRequestException("Choose a supported document or photo.");
  const sha=x.sha256,digest=hash([app,version,classification,mime,size,sha]);
  const row=await this.run(token,async(tx,a)=>{
   await this.own(tx,a,app,version,true);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG19:MEMBER:"+a.realmId+":"+app]);
   const prior=(await tx.query<Intent>("SELECT * FROM cg19_membership_file_intent WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 FOR SHARE",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==digest)throw changed();return prior;}
   const active=(await tx.query("SELECT 1 FROM cg19_membership_private_file WHERE realm_id=$1 AND application_id=$2 AND classification=$3 AND revoked_at IS NULL",[a.realmId,app,classification])).rowCount;
   if(active)throw new ConflictException("Remove the existing document before replacing it.");
   const pending=(await tx.query("SELECT 1 FROM cg19_membership_file_intent WHERE realm_id=$1 AND application_id=$2 AND application_version=$3 AND classification=$4 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() LIMIT 1",[a.realmId,app,version,classification])).rowCount;
   if(pending)throw new ConflictException("An upload is still pending. Check its status or try again after it expires.");
   const added=(await tx.query<Intent>("INSERT INTO cg19_membership_file_intent(realm_id,application_id,application_version,requested_by,request_key,request_digest,classification,mime,size_bytes,sha256,object_key,reserved_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '15 minutes') RETURNING *",[a.realmId,app,version,a.accountId,key,digest,classification,mime,size,sha,"careganga/private/cg19/membership/"+a.realmId+"/"+randomUUID()])).rows[0];
   await this.event(tx,a,added,"UPLOAD_INITIATED");return added;
  });
  if(row.status==="VALIDATED"||row.status==="REJECTED"||row.reserved_until.getTime()<=Date.now())return this.status(token,row.id);
  let reservation:Awaited<ReturnType<PrivateObjectStorage["reservePrivateUpload"]>>;
  try{
   reservation=await this.objects.reservePrivateUpload({objectKey:row.object_key,requestKey:row.request_key,mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.sha256,expiresAt:row.reserved_until.toISOString()});
   const expiry=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!reservation.reservationRef||reservation.reservationRef.length>160||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>row.reserved_until.getTime()||reservation.headers["Content-Type"]!==row.mime||!Object.entries(reservation.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))throw unavailable();
  }catch{return {uploadRef:row.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};}
  return this.run(token,async(tx,a)=>{
   const current=await this.intent(tx,a,row.id,true);
   if(current.status==="VALIDATED"||current.status==="REJECTED")return this.statusInTx(tx,a,current);
   const ok=await tx.query("UPDATE cg19_membership_file_intent SET status='INITIATED',storage_reservation_ref=$3,updated_at=now() WHERE realm_id=$1 AND id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",[a.realmId,row.id,reservation.reservationRef]);
   if(!ok.rowCount)throw changed();return {uploadRef:row.id,status:"UPLOAD_READY",uploadUrl:reservation.url,uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt,cleanVerified:false};
  });
 }
 async status(token:string,ref:string){return this.run(token,async(tx,a)=>this.statusInTx(tx,a,await this.intent(tx,a,ref)));}
 async confirm(token:string,ref:string){
  const row=await this.run(token,(tx,a)=>this.intent(tx,a,ref,true));
  if(row.status==="VALIDATED"||row.status==="REJECTED"||row.reserved_until.getTime()<=Date.now())return this.status(token,ref);
  let v:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{v=await this.objects.verifyPrivateObject({objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.sha256});}
  catch{return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const at=Date.parse(v.verifiedAt),clean=v.state==="CLEAN_VERIFIED"&&v.sha256===row.sha256&&v.mime===row.mime&&v.sizeBytes===Number(row.size_bytes)&&typeof v.objectVersion==="string"&&v.objectVersion.length>0&&v.objectVersion.length<=160&&typeof v.scanProofRef==="string"&&v.scanProofRef.length>=8&&v.scanProofRef.length<=160&&Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<900000;
  return this.run(token,async(tx,a)=>{
   const current=await this.intent(tx,a,ref,true);
   if(current.status==="VALIDATED"||current.status==="REJECTED")return this.statusInTx(tx,a,current);
   if(current.reserved_until.getTime()<=Date.now())throw changed();
   if(!clean){await tx.query("UPDATE cg19_membership_file_intent SET status='REJECTED',updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,row.id]);await this.event(tx,a,row,"UPLOAD_REJECTED");return {uploadRef:row.id,status:"REJECTED",cleanVerified:false};}
   await tx.query("UPDATE cg19_membership_file_intent SET status='VALIDATED',updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,row.id]);
   const file=(await tx.query<{id:string;revision:number}>("INSERT INTO cg19_membership_private_file(realm_id,application_id,application_version,intent_id,classification,mime,size_bytes,sha256,object_key,object_version,scan_proof_ref,scan_status,scanned_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CLEAN_VERIFIED',$12) RETURNING id,revision",[a.realmId,row.application_id,row.application_version,row.id,row.classification,row.mime,row.size_bytes,row.sha256,row.object_key,v.objectVersion,v.scanProofRef,new Date(at)])).rows[0];
   await this.event(tx,a,row,"UPLOAD_VERIFIED",file.id);return {uploadRef:row.id,status:"VALIDATED",fileRef:file.id,fileVersion:file.revision,cleanVerified:true};
  });
 }
 async list(token:string,appRef:string){
  const app=uuid(appRef);return this.run(token,async(tx,a)=>{
   const current=await this.own(tx,a,app,null);
   const files=(await tx.query("SELECT id AS \"fileRef\",classification,mime,size_bytes::int AS \"sizeBytes\",revision AS \"fileVersion\",application_version AS \"applicationVersion\",created_at AS \"createdAt\" FROM cg19_membership_private_file WHERE realm_id=$1 AND application_id=$2 AND revoked_at IS NULL ORDER BY classification",[a.realmId,app])).rows;
   const pending=(await tx.query("SELECT id AS \"uploadRef\",classification,status,reserved_until AS \"expiresAt\" FROM cg19_membership_file_intent WHERE realm_id=$1 AND application_id=$2 AND application_version=$3 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() ORDER BY created_at LIMIT 2",[a.realmId,app,current.version])).rows;
   return {files,pending};
  });
 }
 private async file(tx:PoolClient,a:Actor,ref:string,write=false){
  const v=(await tx.query<File>("SELECT * FROM cg19_membership_private_file WHERE realm_id=$1 AND id=$2",[a.realmId,uuid(ref)])).rows[0];
  if(!v)throw missing();await this.own(tx,a,v.application_id,null,write);
  if(!write){if(v.revoked_at)throw missing();return v;}
  const locked=(await tx.query<File>("SELECT * FROM cg19_membership_private_file WHERE realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,v.id])).rows[0];if(!locked)throw missing();return locked;
 }
 async revoke(token:string,ref:string,raw:unknown){
  const x=object(raw,["expectedVersion"]),expected=int(x.expectedVersion,1,2147483646,"document revision");
  return this.run(token,async(tx,a)=>{const f=await this.file(tx,a,ref,true);if(f.revoked_at)return {status:"REVOKED",version:f.revision};if(f.revision!==expected)throw changed();
   await tx.query("UPDATE cg19_membership_private_file SET revision=revision+1,revoked_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,f.id]);
   const row=(await tx.query<Intent>("SELECT * FROM cg19_membership_file_intent WHERE realm_id=$1 AND id=$2",[a.realmId,f.intent_id])).rows[0];await this.event(tx,a,row,"FILE_REVOKED",f.id);return {status:"REVOKED",version:f.revision+1};});
 }
 async download(token:string,ref:string){
  const before=await this.run(token,(tx,a)=>this.file(tx,a,ref));
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:before.object_key,objectVersion:before.object_version,maxBytes:Number(before.size_bytes)});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.size_bytes)||createHash("sha256").update(bytes).digest("hex")!==before.sha256)throw unavailable();
  const after=await this.run(token,(tx,a)=>this.file(tx,a,ref));
  if(after.revision!==before.revision||after.object_version!==before.object_version)throw missing();return {bytes,mime:before.mime};
 }
 /** Only the current protected distinct reviewer can read the original
  * proof for a current CG03 case. Never issue a direct signed GET URL. */
 private async reviewFile(token:string,caseRef:string,fileRef:string){
  const actor=await this.sessions.requireAction(token,"membership.applications.review");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"membership.applications.review");
   await this.identity.assertCurrent(tx,actor,"approvals.review");
   await this.identity.assertCurrent(tx,actor,"documents.files.view");
   const f=(await tx.query<File>("SELECT d.* FROM cg03_case c JOIN membership_review_file f ON f.root_realm_id=c.realm_id AND f.snapshot_id=c.membership_review_ref AND f.application_id=c.membership_application_id JOIN cg19_membership_private_file d ON d.realm_id=f.root_realm_id AND d.id=f.file_id AND d.application_id=f.application_id JOIN membership_application a ON a.root_realm_id=c.realm_id AND a.id=c.membership_application_id WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='MEMBER_APPLICATION' AND c.proposer_id<>$3 AND c.status IN('SUBMITTED','PENDING_OWNER') AND a.status='SUBMITTED' AND a.version=c.membership_application_version AND a.submitted_digest=c.membership_review_digest AND f.file_id=$4 AND d.revoked_at IS NULL AND d.scan_status='CLEAN_VERIFIED' AND d.revision=f.file_version AND d.sha256=f.sha256 FOR SHARE OF c,d,a",[actor.realmId,uuid(caseRef),actor.accountId,uuid(fileRef)])).rows[0];
   if(!f)throw missing();await tx.query("COMMIT");return f;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 async reviewDownload(token:string,caseRef:string,fileRef:string){
  const before=await this.reviewFile(token,caseRef,fileRef);
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:before.object_key,objectVersion:before.object_version,maxBytes:Number(before.size_bytes)});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(before.size_bytes)||createHash("sha256").update(bytes).digest("hex")!==before.sha256)throw unavailable();
  const after=await this.reviewFile(token,caseRef,fileRef);
  if(after.revision!==before.revision||after.object_version!==before.object_version)throw missing();return {bytes,mime:before.mime};
 }
 /** Private original review source: exact verified proof, no client assertions
  * of scan status. Caller locks application and performs original scope check. */
 async frozenProof(tx:PoolClient,realm:string,app:string,version:number){
  const pending=await tx.query("SELECT 1 FROM cg19_membership_file_intent WHERE realm_id=$1 AND application_id=$2 AND application_version=$3 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() LIMIT 1",[realm,app,version]);
  if(pending.rowCount)throw new ConflictException("Finish verifying your uploaded documents before submitting.");
  const files=(await tx.query<{fileRef:string;fileVersion:number;sourceVersion:number;classification:string;sha256:string}>("SELECT f.id AS \"fileRef\",f.revision AS \"fileVersion\",f.application_version AS \"sourceVersion\",f.classification,f.sha256 FROM cg19_membership_private_file f JOIN cg19_membership_file_intent i ON i.realm_id=f.realm_id AND i.id=f.intent_id WHERE f.realm_id=$1 AND f.application_id=$2 AND f.application_version<=$3 AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED' ORDER BY f.classification FOR SHARE OF f,i",[realm,app,version])).rows;
  if(!files.some(f=>f.classification==="MEMBER_IDENTITY_PROOF"))throw new ConflictException("Upload and verify your identity document before submitting.");
  return files;
 }
}
