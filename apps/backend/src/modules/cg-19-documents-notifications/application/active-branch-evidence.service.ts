import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import type {BranchFileVersion} from "../../cg-02-foundation-structure/application/branch-lifecycle.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const CATEGORIES=new Set(["BRANCH_PHOTO","BRANCH_LOGO","REGISTRATION_PROOF","AGREEMENT"]);
const record=(value:unknown):Record<string,unknown>=>{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new BadRequestException("Check private branch evidence");
 return value as Record<string,unknown>;
};
const uuid=(value:unknown):string=>{
 if(typeof value!=="string"||!UUID.test(value))
   throw new BadRequestException("Choose a valid private document");
 return value;
};
const revision=(value:unknown):number=>{
 if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>2147483646)
   throw new BadRequestException("Refresh the approved branch before changing its files");
 return Number(value);
};
type Upload={
 branchRef:string;branchVersion:number;classification:string;requestKey:string;
 mime:string;sizeBytes:number;sha256:string
};
type Intent={id:string;realm_id:string;branch_id:string;branch_version:number;
 requested_by:string;request_key:string;request_digest:string;mime:string;size_bytes:string;
 expected_sha256:string;classification:string;status:string;object_key:string;reserved_until:Date};
type Stored={id:string;realm_id:string;branch_id:string;branch_version:number;
 upload_intent_id:string;original_mime:string;verified_size_bytes:string;verified_sha256:string;
 object_key:string;object_version:string;scan_status:string;revision:number;revoked_at:Date|null;
 classification:string;intent_status:string};
function parse(input:unknown):Upload{
 const r=record(input);
 if(Object.keys(r).some(key=>!["branchRef","branchVersion","classification","requestKey",
   "mime","sizeBytes","sha256"].includes(key))||
   typeof r.branchRef!=="string"||!UUID.test(r.branchRef)||
   !Number.isSafeInteger(r.branchVersion)||Number(r.branchVersion)<1||
   typeof r.classification!=="string"||!CATEGORIES.has(r.classification)||
   typeof r.requestKey!=="string"||!UUID.test(r.requestKey)||
   typeof r.mime!=="string"||!MIME.has(r.mime)||
   !Number.isSafeInteger(r.sizeBytes)||Number(r.sizeBytes)<1||Number(r.sizeBytes)>10485760||
   typeof r.sha256!=="string"||!SHA.test(r.sha256))
   throw new BadRequestException("Select a supported private file under 10 MB");
 return r as Upload;
}
const digest=(x:Upload)=>createHash("sha256").update(JSON.stringify([
 "CG02_ACTIVE_BRANCH_FILE",x.branchRef,x.branchVersion,x.classification,
 x.mime,x.sizeBytes,x.sha256])).digest("hex");
/** CG-19-owned adapter for private evidence replacing a LIVE approved CG-02
 * branch file. Reuses CG-19 original scan/object/download authority and metadata.
 */
@Injectable()
export class ActiveBranchEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
   private readonly sessions:SessionService,
   private readonly source:BranchSourceFacade,
   private readonly objects:PrivateObjectStorage){}
 private async scope(bearer:string,branchRef:string,expectedVersion?:number,write=false){
   const actor=await this.sessions.requireAction(bearer,
     write?"foundation.branches.manage":"foundation.branches.view");
   const branch=await this.source.activeBranch(bearer,branchRef,expectedVersion,write);
   if(branch.root!==actor.realmId)throw new ForbiddenException("Branch file scope unavailable");
   return {actor,branch};
 }
 private async event(client:PoolClient,actor:VerifiedFoundationActor,
  branchRef:string,key:string,intentRef:string|null,fileRef:string|null){
   await client.query(`
     INSERT INTO cg19_document_event(realm_id,actor_id,branch_id,event_key,intent_id,file_id)
     VALUES($1,$2,$3,$4,$5,$6)
   `,[actor.realmId,actor.accountId,branchRef,key,intentRef,fileRef]);
 }
 async initiate(bearer:string,input:unknown){
   const body=parse(input);
   const {actor}=await this.scope(bearer,body.branchRef,body.branchVersion,true);
   const client=await this.db.connect();let tx=false;let intent:Intent;
   try{
     await client.query("BEGIN");tx=true;
     await this.source.guardActiveBranch(client,actor,body.branchRef,body.branchVersion,true);
     const inserted=await client.query<Intent>(`
       INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,
         request_key,mime,size_bytes,expected_sha256,request_digest,classification,
         object_key,reserved_until,owner_kind,branch_id,branch_version)
       VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '15 minutes',
         'CG02_BRANCH',$11,$12)
       ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *
     `,[actor.realmId,body.branchVersion,actor.accountId,body.requestKey,
       body.mime,body.sizeBytes,body.sha256,digest(body),body.classification,
       "careganga/private/cg19/"+actor.realmId+"/"+randomUUID(),
       body.branchRef,body.branchVersion]);
     if(inserted.rows[0]){
       intent=inserted.rows[0];
       await this.event(client,actor,body.branchRef,"UPLOAD_INITIATED",intent.id,null);
     }else{
       const prior=await client.query<Intent>(`
         SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND
           requested_by=$2 AND request_key=$3 AND owner_kind='CG02_BRANCH' FOR SHARE
       `,[actor.realmId,actor.accountId,body.requestKey]);
       if(!prior.rows[0]||prior.rows[0].request_digest!==digest(body))
         throw new ConflictException("This upload request belongs to a different file");
       intent=prior.rows[0];
     }
     await client.query("COMMIT");tx=false;
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
   if(!["INITIATED","VERIFYING","UNKNOWN"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
     return {uploadRef:intent.id,status:intent.status,
       message:"The original private upload must be checked before reuse."};
   try{
     const allowed=await this.objects.reservePrivateUpload({
       objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
       sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
       expiresAt:intent.reserved_until.toISOString()
     });
     const expiry=Date.parse(allowed.expiresAt);
     if(!allowed.url.startsWith("https://")||!Number.isFinite(expiry)||
       expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
       !allowed.reservationRef||allowed.reservationRef.length>160||
       !allowed.headers||allowed.headers["Content-Type"]!==intent.mime||
       !Object.entries(allowed.headers).every(([name,value])=>
         ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(name)&&
         typeof value==="string"&&value.length<=160))
       throw new ServiceUnavailableException("Private file permission is unavailable");
     const updated=await this.db.query(`
       UPDATE cg19_upload_intent SET storage_reservation_ref=$3,
         status='INITIATED',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN')
         AND reserved_until>now() RETURNING id
     `,[intent.id,actor.realmId,allowed.reservationRef]);
     if(!updated.rowCount)throw new ConflictException("The original upload reservation changed");
     return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:allowed.url,
       uploadHeaders:allowed.headers,expiresAt:allowed.expiresAt,
       message:"Upload permission ready; verification is still required."};
   }catch{
     await this.db.query(`
       UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status='INITIATED'
     `,[intent.id,actor.realmId]);
     return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
       message:"Private storage or scanning is unavailable. No verified file was stored."};
   }
 }
 private async original(bearer:string,intentRef:string,write=false){
   const actor=await this.sessions.requireAction(bearer,
     write?"foundation.branches.manage":"foundation.branches.view");
   const found=await this.db.query<Intent>(`
     SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2
       AND owner_kind='CG02_BRANCH'
   `,[uuid(intentRef),actor.realmId]);
   const intent=found.rows[0];
   if(!intent)throw new NotFoundException("Private branch upload unavailable");
   await this.scope(bearer,intent.branch_id,write?intent.branch_version:undefined,write);
   return {actor,intent};
 }
 async status(bearer:string,intentRef:string){
   const {actor,intent}=await this.original(bearer,intentRef);
   const stored=await this.db.query<{id:string;revision:number}>(`
     SELECT id,revision FROM cg19_stored_file
     WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG02_BRANCH'
       AND revoked_at IS NULL
   `,[actor.realmId,intent.id]);
   return {uploadRef:intent.id,status:intent.status,
     fileRef:intent.status==="VALIDATED"?stored.rows[0]?.id??null:null,
     fileVersion:intent.status==="VALIDATED"?stored.rows[0]?.revision??null:null,
     cleanVerified:intent.status==="VALIDATED"&&!!stored.rows[0]};
 }
 async confirm(bearer:string,intentRef:string){
   const {actor,intent}=await this.original(bearer,intentRef,true);
   if(intent.status==="VALIDATED")return this.status(bearer,intentRef);
   if(["REJECTED","EXPIRED"].includes(intent.status)||intent.reserved_until.getTime()<=Date.now())
     return {uploadRef:intent.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
   let verified;
   try{
     verified=await this.objects.verifyPrivateObject({
       objectKey:intent.object_key,mime:intent.mime,sizeBytes:Number(intent.size_bytes),
       sha256:intent.expected_sha256
     });
   }catch{
     await this.db.query(`
       UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')
     `,[intent.id,actor.realmId]);
     return {uploadRef:intent.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
   }
   const scanAt=Date.parse(verified.verifiedAt);
   const clean=verified.state==="CLEAN_VERIFIED"&&verified.sha256===intent.expected_sha256&&
     verified.mime===intent.mime&&verified.sizeBytes===Number(intent.size_bytes)&&
     typeof verified.objectVersion==="string"&&verified.objectVersion.length>0&&
     verified.objectVersion.length<=160&&typeof verified.scanProofRef==="string"&&
     verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
     Number.isFinite(scanAt)&&scanAt<=Date.now()+60000&&Date.now()-scanAt<900000;
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.source.guardActiveBranch(client,actor,intent.branch_id,intent.branch_version,true);
     const locked=await client.query<Intent>(`
       SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 FOR UPDATE
     `,[intent.id,actor.realmId]);
     if(!locked.rows[0]||["REJECTED","EXPIRED"].includes(locked.rows[0].status)||
       locked.rows[0].reserved_until.getTime()<=Date.now())
       throw new ConflictException("The original private upload has expired or changed");
     if(locked.rows[0].status!=="VALIDATED"){
       await client.query(`
         UPDATE cg19_upload_intent SET status=$3,updated_at=now()
         WHERE id=$1 AND realm_id=$2
       `,[intent.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
       if(clean)await client.query(`
         INSERT INTO cg19_stored_file(
           realm_id,upload_intent_id,case_id,proposal_revision,original_mime,
           verified_sha256,verified_size_bytes,object_key,object_version,scan_status,
           scan_proof_ref,scanned_at,created_by,owner_kind,branch_id,branch_version
         ) VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,
           'CG02_BRANCH',$12,$13)
         ON CONFLICT(upload_intent_id) DO NOTHING
       `,[actor.realmId,intent.id,intent.branch_version,intent.mime,
         intent.expected_sha256,intent.size_bytes,intent.object_key,verified.objectVersion,
         verified.scanProofRef,new Date(verified.verifiedAt),actor.accountId,
         intent.branch_id,intent.branch_version]);
       await this.event(client,actor,intent.branch_id,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",intent.id,null);
     }
     await client.query("COMMIT");tx=false;
     return this.status(bearer,intent.id);
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async list(bearer:string,branchRef:string){
   const {actor}=await this.scope(bearer,uuid(branchRef));
   const files=await this.db.query<Stored>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.branch_id=$2 AND f.owner_kind='CG02_BRANCH'
     ORDER BY f.created_at DESC,f.id DESC LIMIT 50
   `,[actor.realmId,branchRef]);
   return {files:files.rows.map(x=>({fileRef:x.id,revision:x.revision,
     classification:x.classification,revoked:x.revoked_at!==null,
     status:x.revoked_at?"REVOKED":x.intent_status,mime:x.original_mime}))};
 }
 async prevalidate(bearer:string,branchRef:string,expectedVersion:number,refsInput:unknown):
   Promise<BranchFileVersion[]>{
   const {actor}=await this.scope(bearer,uuid(branchRef),revision(expectedVersion),true);
   if(!Array.isArray(refsInput)||refsInput.length>12||
     refsInput.some(x=>typeof x!=="string"||!UUID.test(x))||
     new Set(refsInput).size!==refsInput.length)
     throw new BadRequestException("Choose current verified branch file versions");
   const refs=refsInput as string[];
   if(!refs.length)return [];
   const found=await this.db.query<Stored>(`
     SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f
     JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.branch_id=$2 AND f.branch_version=$3
       AND f.id=ANY($4::uuid[]) AND f.owner_kind='CG02_BRANCH'
       AND i.owner_kind='CG02_BRANCH' AND f.revoked_at IS NULL
       AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED'
   `,[actor.realmId,branchRef,expectedVersion,refs]);
   if(found.rowCount!==refs.length)
     throw new ConflictException("A selected branch file is stale, revoked or not scanned");
   return found.rows.map(x=>({fileRef:x.id,revision:x.revision,
     classification:x.classification})).sort((a,b)=>a.fileRef.localeCompare(b.fileRef));
 }
 async guardProof(client:PoolClient,actor:VerifiedFoundationActor,
   branchRef:string,expectedVersion:number,versions:readonly BranchFileVersion[]){
   if(versions.length>12||new Set(versions.map(x=>x.fileRef)).size!==versions.length)
     throw new ConflictException("The current branch document list is invalid");
   if(!versions.length)return;
   const refs=versions.map(x=>uuid(x.fileRef)).sort();
   const found=await client.query<Stored>(`
     SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f
     JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.branch_id=$2 AND f.branch_version=$3
       AND f.id=ANY($4::uuid[]) AND f.owner_kind='CG02_BRANCH'
       AND i.owner_kind='CG02_BRANCH'
     ORDER BY f.id FOR SHARE OF f,i
   `,[actor.realmId,uuid(branchRef),expectedVersion,refs]);
   if(found.rowCount!==versions.length)
     throw new ConflictException("The selected private branch files are unavailable");
   for(const expected of versions){
     const actual=found.rows.find(row=>row.id===expected.fileRef);
     if(!actual||actual.revision!==expected.revision||
       actual.classification!==expected.classification||
       actual.revoked_at!==null||actual.scan_status!=="CLEAN_VERIFIED"||
       actual.intent_status!=="VALIDATED")
       throw new ConflictException("The selected private file changed before the branch save");
   }
 }
 async revoke(bearer:string,fileRef:string,expectedVersion:unknown){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.manage");
   const revisionExpected=revision(expectedVersion);
   const current=await this.db.query<Stored>(`
     SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f
     JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG02_BRANCH'
   `,[uuid(fileRef),actor.realmId]);
   const row=current.rows[0];
   if(!row)throw new NotFoundException("Private branch file unavailable");
   const currentBranch=await this.scope(bearer,row.branch_id,undefined,true);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.source.guardActiveBranch(client,actor,row.branch_id,currentBranch.branch.version,true);
     const locked=await client.query<{revision:number;revoked_at:Date|null}>(`
       SELECT revision,revoked_at FROM cg19_stored_file WHERE id=$1 AND realm_id=$2
         AND owner_kind='CG02_BRANCH' FOR UPDATE
     `,[fileRef,actor.realmId]);
     if(!locked.rows[0]||locked.rows[0].revision!==revisionExpected)
       throw new ConflictException("The private file changed");
     if(!locked.rows[0].revoked_at){
       await client.query(`
         UPDATE cg19_stored_file SET revoked_at=now(),revision=revision+1
         WHERE id=$1 AND realm_id=$2
       `,[fileRef,actor.realmId]);
       await this.event(client,actor,row.branch_id,"FILE_REVOKED",null,fileRef);
     }
     await client.query("COMMIT");tx=false;
     return {revoked:true,revision:locked.rows[0].revoked_at?revisionExpected:revisionExpected+1};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async download(bearer:string,fileRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const found=await this.db.query<Stored>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG02_BRANCH'
       AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED'
   `,[uuid(fileRef),actor.realmId]);
   const row=found.rows[0];
   if(!row)throw new NotFoundException("Private file unavailable");
   await this.scope(bearer,row.branch_id);
   const bytes=await this.objects.readVerifiedPrivateObject({
     objectKey:row.object_key,objectVersion:row.object_version,
     maxBytes:Math.min(10485760,Number(row.verified_size_bytes))
   });
   if(!Buffer.isBuffer(bytes)||bytes.length!==Number(row.verified_size_bytes)||
     createHash("sha256").update(bytes).digest("hex")!==row.verified_sha256)
     throw new ServiceUnavailableException("Private file verification failed");
   await this.scope(bearer,row.branch_id);
   const active=await this.db.query(`
     SELECT 1 FROM cg19_stored_file
     WHERE id=$1 AND realm_id=$2 AND revision=$3 AND revoked_at IS NULL
   `,[fileRef,actor.realmId,row.revision]);
   if(!active.rowCount)throw new NotFoundException("Private file was revoked");
   return {data:bytes,mime:row.original_mime};
 }
}
