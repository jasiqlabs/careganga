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
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
export const BRANCH_CLASSES=["BRANCH_PHOTO","BRANCH_LOGO","REGISTRATION_PROOF","AGREEMENT"] as const;
type BranchClass=typeof BRANCH_CLASSES[number];
export type BranchVerifiedFile={fileRef:string;revision:number;classification:BranchClass};
type Input={registrationRef:string;draftVersion:number;classification:BranchClass;
 requestKey:string;mime:string;sizeBytes:number;sha256:string};
type IntentRow={id:string;realm_id:string;registration_id:string;
 registration_draft_version:number;requested_by:string;request_key:string;
 mime:string;size_bytes:string;expected_sha256:string;request_digest:string;
 classification:BranchClass;object_key:string;status:string;reserved_until:Date};
type FileRow={id:string;realm_id:string;registration_id:string;registration_draft_version:number;
 upload_intent_id:string;original_mime:string;verified_size_bytes:string;verified_sha256:string;
 object_key:string;object_version:string;revision:number;revoked_at:Date|null;
 scan_status:string;classification:BranchClass;intent_status:string;created_at:Date};
const id=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid private file");
 return v;
};
function parse(value:unknown):Input{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new BadRequestException("Check the selected evidence");
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["registrationRef","draftVersion","classification",
    "requestKey","mime","sizeBytes","sha256"].includes(k))||
    typeof x.registrationRef!=="string"||!UUID.test(x.registrationRef)||
    !Number.isSafeInteger(x.draftVersion)||Number(x.draftVersion)<1||
    !BRANCH_CLASSES.includes(x.classification as BranchClass)||
    typeof x.requestKey!=="string"||!UUID.test(x.requestKey)||
    typeof x.mime!=="string"||!MIME.has(x.mime)||
    !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
    Number(x.sizeBytes)>10485760||typeof x.sha256!=="string"||!SHA.test(x.sha256))
   throw new BadRequestException("Choose a PDF, JPEG, PNG or WebP smaller than 10 MB");
 return x as Input;
}
const digest=(input:Input)=>createHash("sha256").update(JSON.stringify(
 ["CG02_PRIVATE_BRANCH_EVIDENCE",input.registrationRef,input.draftVersion,
 input.classification,input.mime,input.sizeBytes,input.sha256])).digest("hex");
const exactlyVerified=(value:{
  state:string;sha256:string;sizeBytes:number;mime:string;objectVersion:string;
  scanProofRef:string;verifiedAt:string
},row:IntentRow)=>{
 const date=Date.parse(value.verifiedAt);
 return value.state==="CLEAN_VERIFIED"&&value.sha256===row.expected_sha256&&
   value.sizeBytes===Number(row.size_bytes)&&value.mime===row.mime&&
   typeof value.objectVersion==="string"&&value.objectVersion.length>=1&&
   value.objectVersion.length<=160&&typeof value.scanProofRef==="string"&&
   value.scanProofRef.length>=8&&value.scanProofRef.length<=160&&
   Number.isFinite(date)&&date<=Date.now()+60000&&Date.now()-date<900000;
};
/** CG-19 original verified-object authority, with CG-02 source authentication.
 * No unsigned object keys, provider calls under locks, public media URL or
 * separate document/master. The same private storage+scan interface is used.
 */
@Injectable()
export class BranchPrivateEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
   private readonly sessions:SessionService,
   private readonly source:BranchSourceFacade,
   private readonly objects:PrivateObjectStorage){}
 private async sourceAccess(bearer:string,registrationRef:string,mutable=false){
   const actor=await this.sessions.requireAction(bearer,
     mutable?"foundation.branches.manage":"foundation.branches.view");
   const draft=await this.source.draft(bearer,registrationRef,undefined,mutable);
   if(actor.realmId!==draft.root)throw new ForbiddenException("Private branch source not permitted");
   return {actor,draft};
 }
 private async recordEvent(client:PoolClient,actor:VerifiedFoundationActor,
   registrationRef:string,event:string,intentRef:string|null,fileRef:string|null){
   await client.query(`
     INSERT INTO cg19_document_event(realm_id,registration_id,actor_id,intent_id,file_id,event_key)
     VALUES($1,$2,$3,$4,$5,$6)
   `,[actor.realmId,registrationRef,actor.accountId,intentRef,fileRef,event]);
 }
 async initiate(bearer:string,value:unknown){
   const input=parse(value);
   const {actor,draft}=await this.sourceAccess(bearer,input.registrationRef,true);
   if(draft.revision!==input.draftVersion)
     throw new ConflictException("The branch draft changed. Refresh before uploading.");
   const requestDigest=digest(input);
   const key="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
   const client=await this.db.connect();let tx=false;let intent:IntentRow;
   try{
     await client.query("BEGIN");tx=true;
     await this.source.guardDraft(client,actor,input.registrationRef,input.draftVersion,true);
     const inserted=await client.query<IntentRow>(`
       INSERT INTO cg19_upload_intent(
         realm_id,case_id,proposal_revision,requested_by,request_key,mime,
         size_bytes,expected_sha256,request_digest,classification,object_key,reserved_until,
         owner_kind,registration_id,registration_draft_version
       ) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '15 minutes',
         'CG02_DRAFT',$11,$12)
       ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *
     `,[actor.realmId,input.draftVersion,actor.accountId,input.requestKey,
       input.mime,input.sizeBytes,input.sha256,requestDigest,input.classification,
       key,input.registrationRef,input.draftVersion]);
     if(inserted.rows[0]){
       intent=inserted.rows[0];
       await this.recordEvent(client,actor,input.registrationRef,"UPLOAD_INITIATED",intent.id,null);
     }else{
       const prior=await client.query<IntentRow>(`
         SELECT * FROM cg19_upload_intent
         WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3
           AND owner_kind='CG02_DRAFT' FOR SHARE
       `,[actor.realmId,actor.accountId,input.requestKey]);
       if(!prior.rows[0]||prior.rows[0].request_digest!==requestDigest)
         throw new ConflictException("A different file already uses this upload request");
       intent=prior.rows[0];
     }
     await client.query("COMMIT");tx=false;
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
   if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
     intent.reserved_until.getTime()<=Date.now())
     return {uploadRef:intent.id,status:intent.status,message:"Check the previous file status."};
   try{
     const permission=await this.objects.reservePrivateUpload({
       objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
       sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
       expiresAt:intent.reserved_until.toISOString()
     });
     const expiry=Date.parse(permission.expiresAt);
     if(!permission.url.startsWith("https://")||!Number.isFinite(expiry)||
       expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
       !permission.reservationRef||permission.reservationRef.length>160||
       !permission.headers||permission.headers["Content-Type"]!==intent.mime||
       !Object.entries(permission.headers).every(([name,value])=>
         ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(name)&&
         typeof value==="string"&&value.length<=160))
       throw new ServiceUnavailableException("Secure file permission unavailable");
     const saved=await this.db.query(`
       UPDATE cg19_upload_intent SET storage_reservation_ref=$3,
         status='INITIATED',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now()
       RETURNING id
     `,[intent.id,actor.realmId,permission.reservationRef]);
     if(!saved.rowCount)throw new ConflictException("Upload intent expired");
     return {uploadRef:intent.id,status:"UPLOAD_READY" as const,
       uploadUrl:permission.url,uploadHeaders:permission.headers,expiresAt:permission.expiresAt,
       message:"Private upload permission prepared; file not yet verified."};
   }catch{
     await this.db.query(`
       UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status='INITIATED'
     `,[intent.id,actor.realmId]);
     return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE" as const,
       message:"Secure private storage or scanning is unavailable."};
   }
 }
 private async intent(bearer:string,intentRef:string,write=false){
   const actor=await this.sessions.requireAction(bearer,
      write?"foundation.branches.manage":"foundation.branches.view");
   const rows=await this.db.query<IntentRow>(`
     SELECT * FROM cg19_upload_intent
     WHERE id=$1 AND realm_id=$2 AND owner_kind='CG02_DRAFT'
   `,[id(intentRef),actor.realmId]);
   const row=rows.rows[0];
   if(!row)throw new NotFoundException("Private evidence unavailable");
   await this.sourceAccess(bearer,row.registration_id,write);
   return {actor,row};
 }
 async status(bearer:string,intentRef:string){
   const {actor,row}=await this.intent(bearer,intentRef);
   const found=await this.db.query<{id:string;revision:number}>(`
     SELECT id,revision FROM cg19_stored_file
     WHERE upload_intent_id=$1 AND realm_id=$2 AND revoked_at IS NULL
       AND owner_kind='CG02_DRAFT'
   `,[row.id,actor.realmId]);
   return {uploadRef:row.id,status:row.status,
     fileRef:row.status==="VALIDATED"?found.rows[0]?.id??null:null,
     fileVersion:row.status==="VALIDATED"?found.rows[0]?.revision??null:null,
     cleanVerified:row.status==="VALIDATED"&&!!found.rows[0]};
 }
 async confirm(bearer:string,intentRef:string){
   const {actor,row}=await this.intent(bearer,intentRef,true);
   if(row.status==="VALIDATED")return this.status(bearer,intentRef);
   if(["REJECTED","EXPIRED"].includes(row.status)||
      row.reserved_until.getTime()<=Date.now())
     return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
   let verified;
   try{
     verified=await this.objects.verifyPrivateObject({
       objectKey:row.object_key,mime:row.mime,
       sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256
     });
   }catch{
     await this.db.query(`
       UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')
     `,[row.id,actor.realmId]);
     return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
   }
   const clean=exactlyVerified(verified,row);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     const locked=await client.query<IntentRow>(`
       SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 FOR UPDATE
     `,[row.id,actor.realmId]);
     if(!locked.rows[0]||["REJECTED","EXPIRED"].includes(locked.rows[0].status)||
       locked.rows[0].reserved_until.getTime()<=Date.now())
       throw new ConflictException("This upload expired or changed");
     if(locked.rows[0].status!=="VALIDATED"){
       await client.query(`
         UPDATE cg19_upload_intent SET status=$3,updated_at=now()
         WHERE id=$1 AND realm_id=$2
       `,[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
       if(clean){
         await client.query(`
           INSERT INTO cg19_stored_file(
             realm_id,upload_intent_id,case_id,proposal_revision,
             original_mime,verified_sha256,verified_size_bytes,object_key,object_version,
             scan_status,scan_proof_ref,scanned_at,created_by,
             owner_kind,registration_id,registration_draft_version
           ) VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,
             'CG02_DRAFT',$12,$13)
           ON CONFLICT(upload_intent_id) DO NOTHING
         `,[actor.realmId,row.id,row.registration_draft_version,row.mime,
           row.expected_sha256,row.size_bytes,row.object_key,verified.objectVersion,
           verified.scanProofRef,new Date(verified.verifiedAt),
           actor.accountId,row.registration_id,row.registration_draft_version]);
       }
       await this.recordEvent(client,actor,row.registration_id,
          clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",row.id,null);
     }
     await client.query("COMMIT");tx=false;
     return this.status(bearer,row.id);
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 private async filesForActor(bearer:string,registrationRef:string):Promise<FileRow[]>{
   const {actor}=await this.sourceAccess(bearer,registrationRef);
   const result=await this.db.query<FileRow>(`
     SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f
     JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.registration_id=$2 AND f.owner_kind='CG02_DRAFT'
     ORDER BY f.created_at DESC,f.id DESC LIMIT 50
   `,[actor.realmId,registrationRef]);
   return result.rows;
 }
 async list(bearer:string,registrationRef:string){
   const rows=await this.filesForActor(bearer,id(registrationRef));
   return {files:rows.map(x=>({fileRef:x.id,revision:x.revision,
     classification:x.classification,mime:x.original_mime,
     sizeBytes:Number(x.verified_size_bytes),revoked:x.revoked_at!==null,
     status:x.revoked_at?"REVOKED":x.intent_status,
     createdAt:x.created_at.toISOString()}))};
 }
 async prevalidate(bearer:string,registrationRef:string,filesInput:unknown,
     requireComplete=true):Promise<BranchVerifiedFile[]>{
   const {actor}=await this.sourceAccess(bearer,id(registrationRef));
   if(!Array.isArray(filesInput)||filesInput.length>16||
     filesInput.some(x=>typeof x!=="string"||!UUID.test(x))||
     new Set(filesInput).size!==filesInput.length)
     throw new BadRequestException("Choose valid current private evidence");
   const refs=filesInput as string[];
   if(requireComplete&&refs.length===0)
     throw new BadRequestException("Verified registration and agreement documents are required");
   const rows=await this.db.query<FileRow>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.registration_id=$2 AND f.id=ANY($3::uuid[])
       AND f.owner_kind='CG02_DRAFT' AND i.owner_kind='CG02_DRAFT'
       AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
       AND i.status='VALIDATED'
   `,[actor.realmId,registrationRef,refs]);
   if(rows.rowCount!==refs.length)
     throw new ConflictException("Private evidence changed or is not verified");
   const found=rows.rows.map(x=>({fileRef:x.id,revision:x.revision,
     classification:x.classification}));
   const kinds=found.map(x=>x.classification);
   if(requireComplete&&(!kinds.includes("REGISTRATION_PROOF")||!kinds.includes("AGREEMENT")))
     throw new BadRequestException("Add verified registration proof and agreement before submitting");
   return found.sort((x,y)=>x.fileRef.localeCompare(y.fileRef));
 }
 async guardProof(client:PoolClient,actor:VerifiedFoundationActor,
     registrationRef:string,versions:readonly BranchVerifiedFile[]){
   if(versions.length>16||new Set(versions.map(x=>x.fileRef)).size!==versions.length)
     throw new ConflictException("Invalid original private evidence proof");
   // All readers and revoke writers lock the same CG-19 files. Never do
   // external storage/scan/provider work under CG-02/CG-03 row locks.
   const ids=[...versions].map(x=>id(x.fileRef)).sort();
   if(ids.length===0)throw new ConflictException("Verified required evidence is missing");
   const rows=await client.query<FileRow>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.realm_id=$1 AND f.registration_id=$2 AND f.id=ANY($3::uuid[])
       AND f.owner_kind='CG02_DRAFT' AND i.owner_kind='CG02_DRAFT'
     ORDER BY f.id FOR SHARE OF f,i
   `,[actor.realmId,id(registrationRef),ids]);
   if(rows.rowCount!==versions.length)
     throw new ConflictException("Private evidence no longer matches the approved snapshot");
   for(const proof of versions){
     const actual=rows.rows.find(x=>x.id===proof.fileRef);
     if(!actual||actual.revision!==proof.revision||
       actual.classification!==proof.classification||
       actual.revoked_at!==null||actual.scan_status!=="CLEAN_VERIFIED"||
       actual.intent_status!=="VALIDATED")
       throw new ConflictException("Original evidence was changed or revoked");
   }
   const kinds=rows.rows.map(x=>x.classification);
   if(!kinds.includes("REGISTRATION_PROOF")||!kinds.includes("AGREEMENT"))
     throw new ConflictException("Required verified documents are missing");
 }
 async revoke(bearer:string,fileRef:string,revisionInput:unknown){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.manage");
   const expected=Number(revisionInput);
   if(!Number.isSafeInteger(expected)||expected<1)
     throw new BadRequestException("Refresh the file before revoking");
   const row=await this.db.query<FileRow>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG02_DRAFT'
   `,[id(fileRef),actor.realmId]);
   if(!row.rows[0])throw new NotFoundException("Private evidence unavailable");
   await this.sourceAccess(bearer,row.rows[0].registration_id);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     const locked=await client.query<{id:string;revision:number;revoked_at:Date|null}>(`
       SELECT id,revision,revoked_at FROM cg19_stored_file
       WHERE id=$1 AND realm_id=$2 AND owner_kind='CG02_DRAFT' FOR UPDATE
     `,[fileRef,actor.realmId]);
     if(!locked.rows[0]||locked.rows[0].revision!==expected)
       throw new ConflictException("The private file changed");
     if(!locked.rows[0].revoked_at){
       await client.query(`
         UPDATE cg19_stored_file SET revision=revision+1,revoked_at=now()
         WHERE id=$1 AND realm_id=$2
       `,[fileRef,actor.realmId]);
       await this.recordEvent(client,actor,row.rows[0].registration_id,
         "FILE_REVOKED",null,fileRef);
     }
     await client.query("COMMIT");tx=false;
     return {revoked:true,revision:locked.rows[0].revoked_at?expected:expected+1};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async download(bearer:string,fileRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const file=await this.db.query<FileRow>(`
     SELECT f.*,i.classification,i.status AS intent_status
     FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
     WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG02_DRAFT'
       AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
       AND i.status='VALIDATED'
   `,[id(fileRef),actor.realmId]);
   const row=file.rows[0];
   if(!row)throw new NotFoundException("Private file unavailable");
   await this.sourceAccess(bearer,row.registration_id);
   const bytes=await this.objects.readVerifiedPrivateObject({
     objectKey:row.object_key,objectVersion:row.object_version,
     maxBytes:Math.min(Number(row.verified_size_bytes),10485760)
   });
   if(!Buffer.isBuffer(bytes)||bytes.length!==Number(row.verified_size_bytes)||
     createHash("sha256").update(bytes).digest("hex")!==row.verified_sha256)
     throw new ServiceUnavailableException("Private document verification failed");
   await this.sourceAccess(bearer,row.registration_id);
   const current=await this.db.query<{id:string}>(`
     SELECT id FROM cg19_stored_file WHERE id=$1 AND realm_id=$2
       AND revoked_at IS NULL AND revision=$3
   `,[row.id,actor.realmId,row.revision]);
   if(!current.rows[0])throw new NotFoundException("Private evidence is no longer available");
   return {data:bytes,mime:row.original_mime};
 }
}
