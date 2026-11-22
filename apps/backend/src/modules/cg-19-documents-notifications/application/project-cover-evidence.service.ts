import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {ProjectsService} from "../../cg-05-projects-field-operations/application/projects.service";
import {fields,ref as projectRefValue,version} from "../../cg-05-projects-field-operations/domain/project-input";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
const invalid=()=>new BadRequestException({code:"CG05_COVER_INVALID"});
const changed=()=>new ConflictException({code:"CG05_COVER_INVALID"});
const MIME=["image/jpeg","image/png","image/webp"];
type Intent={id:string;realm_id:string;project_id:string;proposal_revision:number;requested_by:string;request_key:string;mime:string;size_bytes:string;expected_sha256:string;request_digest:string;object_key:string;status:string;reserved_until:Date};
function parse(v:unknown){
 const x=fields(v,["projectRef","projectVersion","requestKey","mime","sizeBytes","sha256"]);
 if(typeof x.mime!=="string"||!MIME.includes(x.mime)||typeof x.sizeBytes!=="number"||!Number.isSafeInteger(x.sizeBytes)||x.sizeBytes<1||x.sizeBytes>10485760||typeof x.sha256!=="string"||!/^[a-f0-9]{64}$/.test(x.sha256))throw invalid();
 return {projectRef:projectRefValue(x.projectRef),projectVersion:version(x.projectVersion),requestKey:projectRefValue(x.requestKey),mime:x.mime,sizeBytes:x.sizeBytes,sha256:x.sha256};
}
@Injectable()
export class ProjectCoverEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly source:ProjectsService,private readonly objects:PrivateObjectStorage){}
 private async run<T>(token:string,write:boolean,work:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>){
  const action=write?"documents.files.manage":"documents.files.view";
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);if(write)await this.identity.assertCurrent(tx,a,"documents.files.view");const result=await work(tx,a);await tx.query("COMMIT");return result;}
  catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,row:Intent,action:string){
  await tx.query("INSERT INTO cg19_project_cover_event(realm_id,project_id,actor_ref,intent_ref,action) VALUES($1,$2,$3,$4,$5)",[a.realmId,row.project_id,a.accountId,row.id,action]);
 }
 private async getIntent(tx:PoolClient,a:VerifiedFoundationActor,ref:string,write:boolean,lock=false){
  const r=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 AND requested_by=$3 AND owner_kind='CG05_PROJECT'",[projectRefValue(ref),a.realmId,a.accountId])).rows[0];
  if(!r)throw new NotFoundException("Project cover document unavailable");
  await this.source.guardCover(tx,a,r.project_id,r.proposal_revision,write);
  if(!lock)return r;
  const current=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 AND requested_by=$3 AND owner_kind='CG05_PROJECT' FOR UPDATE",[r.id,a.realmId,a.accountId])).rows[0];
  if(!current)throw changed();return current;
 }
 async initiate(token:string,body:unknown){
  const input=parse(body),digest=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const intent=await this.run(token,true,async(tx,a)=>{
   await this.source.guardCover(tx,a,input.projectRef,input.projectVersion,true);
   const q=await tx.query<Intent>("INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,request_key,mime,size_bytes,expected_sha256,request_digest,classification,object_key,reserved_until,owner_kind,project_id) VALUES($1,NULL,$10,$2,$3,$4,$5,$6,$7,'PROJECT_COVER',$8,now()+interval '15 minutes','CG05_PROJECT',$9) ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",[a.realmId,a.accountId,input.requestKey,input.mime,input.sizeBytes,input.sha256,digest,"careganga/private/cg19/"+a.realmId+"/"+randomUUID(),input.projectRef,input.projectVersion]);
   if(q.rows[0]){await this.event(tx,a,q.rows[0],"UPLOAD_INITIATED");return q.rows[0];}
   const prior=(await tx.query<Intent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 AND owner_kind='CG05_PROJECT' FOR SHARE",[a.realmId,a.accountId,input.requestKey])).rows[0];
   if(!prior||prior.request_digest!==digest)throw changed();return prior;
  });
  if(intent.status==="VALIDATED")return this.status(token,intent.id);
  if(["EXPIRED","REJECTED"].includes(intent.status)||intent.reserved_until.getTime()<=Date.now())return {uploadRef:intent.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const reservation=await this.objects.reservePrivateUpload({objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,expiresAt:intent.reserved_until.toISOString()});
   const limit=Date.parse(reservation.expiresAt);
   if(!reservation.url.startsWith("https://")||!Number.isFinite(limit)||limit<=Date.now()||limit>intent.reserved_until.getTime()||!reservation.reservationRef||reservation.reservationRef.length>160||reservation.headers["Content-Type"]!==intent.mime||!Object.entries(reservation.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))throw new ServiceUnavailableException("Project cover upload reservation unavailable");
   await this.run(token,true,async(tx,a)=>{const cur=await this.getIntent(tx,a,intent.id,true,true);const q=await tx.query("UPDATE cg19_upload_intent SET status='INITIATED',storage_reservation_ref=$3,updated_at=now() WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",[cur.id,a.realmId,reservation.reservationRef]);if(!q.rowCount)throw changed();});
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:reservation.url,uploadHeaders:reservation.headers,expiresAt:reservation.expiresAt};
  }catch(e){
   if(e instanceof ForbiddenException||e instanceof ConflictException)throw e;
   await this.markUnknown(token,intent.id);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 private async markUnknown(token:string,ref:string){
  return this.run(token,true,async(tx,a)=>{const row=await this.getIntent(tx,a,ref,true,true);const q=await tx.query("UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING') RETURNING id",[row.id,a.realmId]);if(q.rowCount)await this.event(tx,a,row,"UPLOAD_UNKNOWN");});
 }
 async status(token:string,ref:string){
  return this.run(token,false,async(tx,a)=>{const row=await this.getIntent(tx,a,ref,false);
   const clean=(await tx.query<{id:string;revision:number}>("SELECT id,revision FROM cg19_stored_file WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG05_PROJECT' AND scan_status='CLEAN_VERIFIED' AND revoked_at IS NULL",[a.realmId,row.id])).rows[0];
   return {uploadRef:row.id,status:row.status,cleanVerified:row.status==="VALIDATED"&&!!clean,fileRef:row.status==="VALIDATED"?clean?.id??null:null,fileVersion:row.status==="VALIDATED"?clean?.revision??null:null};
  });
 }
 async confirm(token:string,ref:string){
  const row=await this.run(token,true,(tx,a)=>this.getIntent(tx,a,ref,true));
  if(row.status==="VALIDATED")return this.status(token,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let verified;
  try{verified=await this.objects.verifyPrivateObject({objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});}
  catch{await this.markUnknown(token,row.id);return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const when=Date.parse(verified.verifiedAt),clean=verified.state==="CLEAN_VERIFIED"&&verified.sha256===row.expected_sha256&&verified.mime===row.mime&&verified.sizeBytes===Number(row.size_bytes)&&typeof verified.objectVersion==="string"&&verified.objectVersion.length>0&&verified.objectVersion.length<=160&&typeof verified.scanProofRef==="string"&&verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&Number.isFinite(when)&&when<=Date.now()+60000&&Date.now()-when<900000;
  await this.run(token,true,async(tx,a)=>{
   const current=await this.getIntent(tx,a,row.id,true,true);
   if(current.status==="VALIDATED")return;
   if(["REJECTED","EXPIRED"].includes(current.status)||current.reserved_until.getTime()<=Date.now())throw changed();
   await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() WHERE id=$1 AND realm_id=$2",[row.id,a.realmId,clean?"VALIDATED":"REJECTED"]);
   if(clean)await tx.query("INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,original_mime,verified_sha256,verified_size_bytes,object_key,object_version,scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,project_id) VALUES($1,$2,NULL,$12,$3,$4,$5,$6,$7,'CLEAN_VERIFIED',$8,$9,$10,'CG05_PROJECT',$11)",[a.realmId,row.id,row.mime,row.expected_sha256,row.size_bytes,row.object_key,verified.objectVersion,verified.scanProofRef,verified.verifiedAt,a.accountId,row.project_id,row.proposal_revision]);
   await this.event(tx,a,row,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED");
  });
  return this.status(token,row.id);
 }
 async list(token:string,projectRef:string){
  return this.run(token,false,async(tx,a)=>{
   const source=await this.source.guardCover(tx,a,projectRef,null,false);
   const q=await tx.query("SELECT f.id AS \"fileRef\",f.revision AS \"fileVersion\",f.original_mime AS mime,f.verified_size_bytes::text AS size,f.created_at AS \"createdAt\" FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.realm_id=$1 AND f.project_id=$2 AND f.proposal_revision=$3 AND f.owner_kind='CG05_PROJECT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.owner_kind='CG05_PROJECT' AND i.status='VALIDATED' ORDER BY f.created_at DESC,f.id DESC LIMIT 16",[a.realmId,source.id,source.version]);
   return {files:q.rows,projectVersion:source.version};
  });
 }
 private async fileSource(tx:PoolClient,a:VerifiedFoundationActor,fileRef:string){
  const f=(await tx.query<{id:string;project_id:string;proposal_revision:number;revision:number;original_mime:string;verified_sha256:string;verified_size_bytes:string;object_key:string;object_version:string}>("SELECT f.id,f.project_id,f.proposal_revision,f.revision,f.original_mime,f.verified_sha256,f.verified_size_bytes::text,f.object_key,f.object_version FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG05_PROJECT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.owner_kind='CG05_PROJECT' AND i.status='VALIDATED'",[projectRefValue(fileRef),a.realmId])).rows[0];
  if(!f)throw new NotFoundException("Project cover unavailable");
  await this.source.guardCover(tx,a,f.project_id,f.proposal_revision,false);
  const current=(await tx.query("SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.revision=$3 AND f.revoked_at IS NULL AND i.status='VALIDATED' FOR SHARE OF f,i",[f.id,a.realmId,f.revision])).rowCount;
  if(!current)throw changed();
  return f;
 }
 async preview(token:string,fileRef:string){
  const f=await this.run(token,false,(tx,a)=>this.fileSource(tx,a,fileRef));
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:f.object_key,objectVersion:f.object_version,maxBytes:10485760});
  if(!MIME.includes(f.original_mime)||bytes.length!==Number(f.verified_size_bytes)||createHash("sha256").update(bytes).digest("hex")!==f.verified_sha256)throw changed();
  const current=await this.run(token,false,(tx,a)=>this.fileSource(tx,a,fileRef));
  if(current.revision!==f.revision||current.object_version!==f.object_version)throw changed();
  return {bytes,mime:f.original_mime};
 }
}
