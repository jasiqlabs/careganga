import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrEnrollmentSourceFacade} from "../../cg-10-human-resources/application/hr-enrollment-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const CLASS=["HR_IDENTITY_PROOF","HR_QUALIFICATION","HR_PORTRAIT"] as const;
const MIME=["application/pdf","image/jpeg","image/png","image/webp"] as const;
type Kind=typeof CLASS[number];
type Input={applicationRef:string;sourceVersion:number;classification:Kind;
 requestKey:string;mime:string;sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;hr_application_id:string;hr_source_version:number;
 classification:Kind;requested_by:string;request_key:string;
 request_digest:string;mime:string;size_bytes:string;expected_sha256:string;
 status:string;object_key:string;reserved_until:Date;storage_reservation_ref:string|null};
type File={id:string;revision:number;hr_application_id:string;hr_source_version:number;
 verified_sha256:string;verified_size_bytes:string;object_key:string;object_version:string;
 original_mime:string;scan_status:string;revoked_at:Date|null};
const id=(v:unknown,label:string)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException("Choose a valid "+label);
 return v;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const hashBytes=(v:Buffer)=>createHash("sha256").update(v).digest("hex");
function parse(input:unknown):Input{
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new BadRequestException("Check the private HR upload details");
 const x=input as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["applicationRef","sourceVersion","classification",
   "requestKey","mime","sizeBytes","sha256"].includes(k))||
   !Number.isSafeInteger(x.sourceVersion)||Number(x.sourceVersion)<1||
   !CLASS.some(k=>k===x.classification)||!MIME.some(m=>m===x.mime)||
   !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
   Number(x.sizeBytes)>10485760||typeof x.sha256!=="string"||!SHA.test(x.sha256))
  throw new BadRequestException("Check the private HR upload details");
 return {applicationRef:id(x.applicationRef,"application"),
  sourceVersion:Number(x.sourceVersion),classification:x.classification as Kind,
  requestKey:id(x.requestKey,"upload request"),mime:x.mime as string,
  sizeBytes:Number(x.sizeBytes),sha256:x.sha256};
}
@Injectable()
export class HrEmployeeEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:HrEnrollmentSourceFacade,
  private readonly objects:PrivateObjectStorage){}
 private async app(tx:PoolClient,actor:VerifiedFoundationActor,
  applicationRef:string,version:number,mutate:boolean){
  const original=await this.source.draft(tx,actor,applicationRef);
  if(original.revision_no!==version)
   throw new ConflictException("Employee draft changed. Refresh its files.");
  if(mutate&&!["DRAFT","RETURNED"].includes(original.state))
   throw new ConflictException("Submitted employee documents cannot be changed");
 }
 private async event(tx:PoolClient,actor:VerifiedFoundationActor,
  applicationRef:string,action:string,intentRef:string|null,fileRef:string|null){
  await tx.query(
   "INSERT INTO cg19_hr_evidence_event(realm_id,application_id,actor_ref,action,intent_ref,file_ref) "+
   "VALUES($1,$2,$3,$4,$5,$6)",
   [actor.realmId,applicationRef,actor.accountId,action,intentRef,fileRef]);
 }
 async initiate(token:string,body:unknown){
  const x=parse(body),actor=await this.sessions.requireAction(token,"hr.applications.manage");
  const commandDigest=hash(["CG10_DRAFT",x]);
  const storageKey="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
  const tx=await this.db.connect();let open=false;let intent:Intent;
  try{
   await tx.query("BEGIN");open=true;
   await this.app(tx,actor,x.applicationRef,x.sourceVersion,true);
   const q=await tx.query<Intent>(
    "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
    "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
    "object_key,reserved_until,owner_kind,hr_application_id,hr_source_version) "+
    "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '15 minutes',"+
    "'CG10_DRAFT',$11,$12) "+
    "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
    [actor.realmId,x.sourceVersion,actor.accountId,x.requestKey,x.mime,x.sizeBytes,
     x.sha256,commandDigest,x.classification,storageKey,x.applicationRef,x.sourceVersion]);
   if(q.rows[0]){
    intent=q.rows[0];await this.event(tx,actor,x.applicationRef,"UPLOAD_INITIATED",intent.id,null);
   }else{
    const previous=await tx.query<Intent>(
     "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 "+
     "AND request_key=$3 AND owner_kind='CG10_DRAFT' FOR SHARE",
     [actor.realmId,actor.accountId,x.requestKey]);
    if(!previous.rows[0]||previous.rows[0].request_digest!==commandDigest)
     throw new ConflictException("This upload request was already used");
    intent=previous.rows[0];
   }
   await tx.query("COMMIT");open=false;
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
  if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
    intent.reserved_until.getTime()<=Date.now())
   return {uploadRef:intent.id,status:intent.status,
    message:"Check the existing original file status."};
  try{
   const u=await this.objects.reservePrivateUpload({
    objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
    sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
    expiresAt:intent.reserved_until.toISOString()
   });
   const expires=Date.parse(u.expiresAt);
   if(!u.url.startsWith("https://")||!Number.isFinite(expires)||
     expires<=Date.now()||expires>intent.reserved_until.getTime()||
     !u.reservationRef||u.reservationRef.length>160||
     u.headers?.["Content-Type"]!==intent.mime||
     !Object.entries(u.headers).every(([k,v])=>
       ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
         "If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))
    throw new ServiceUnavailableException("Private upload authorization unavailable");
   const confirm=await this.db.query(
    "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG10_DRAFT' "+
    "AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
    [intent.id,actor.realmId,u.reservationRef]);
   if(!confirm.rowCount)throw new ConflictException("Upload authorization expired");
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:u.url,
    uploadHeaders:u.headers,expiresAt:u.expiresAt,
    message:"The file is private and will be accepted only after a verified malware scan."};
  }catch{
   await this.db.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG10_DRAFT' "+
    "AND status='INITIATED'",[intent.id,actor.realmId]);
   return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
    message:"Secure upload or malware scanning is unavailable. No proof was accepted."};
  }
 }
 private async intent(token:string,intentRef:string,mutate:boolean){
  const actor=await this.sessions.requireAction(token,"hr.applications.manage");
  const ref=id(intentRef,"private upload");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const q=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
    "AND owner_kind='CG10_DRAFT' FOR SHARE",[ref,actor.realmId]);
   const row=q.rows[0];
   if(!row)throw new NotFoundException("Private employee upload unavailable");
   if(row.requested_by!==actor.accountId)
    throw new ForbiddenException("Another staff member initiated this upload");
   await this.app(tx,actor,row.hr_application_id,row.hr_source_version,mutate);
   await tx.query("COMMIT");
   return {actor,row};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async status(token:string,intentRef:string){
  const {actor,row}=await this.intent(token,intentRef,false);
  const q=await this.db.query<{id:string;revision:number}>(
   "SELECT id,revision FROM cg19_stored_file "+
   "WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG10_DRAFT' "+
   "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
   [actor.realmId,row.id]);
  return {uploadRef:row.id,status:row.status,
   fileRef:row.status==="VALIDATED"?q.rows[0]?.id??null:null,
   fileVersion:row.status==="VALIDATED"?q.rows[0]?.revision??null:null,
   cleanVerified:row.status==="VALIDATED"&&Boolean(q.rows[0])};
 }
 async confirm(token:string,intentRef:string){
  const {actor,row}=await this.intent(token,intentRef,true);
  if(row.status==="VALIDATED")return this.status(token,row.id);
  if(["REJECTED","EXPIRED"].includes(row.status)||row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let original:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   original=await this.objects.verifyPrivateObject({
    objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
    sha256:row.expected_sha256});
  }catch{
   await this.db.query(
    "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG10_DRAFT' "+
    "AND status IN('INITIATED','VERIFYING')",[row.id,actor.realmId]);
   return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const scanAt=Date.parse(original.verifiedAt),now=Date.now();
  const clean=original.state==="CLEAN_VERIFIED"&&original.sha256===row.expected_sha256&&
   original.sizeBytes===Number(row.size_bytes)&&original.mime===row.mime&&
   original.objectVersion.length>0&&original.objectVersion.length<=160&&
   original.scanProofRef.length>=8&&original.scanProofRef.length<=160&&
   Number.isFinite(scanAt)&&scanAt<=now+60000&&now-scanAt<900000;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const q=await tx.query<Intent>(
    "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
    "AND owner_kind='CG10_DRAFT' FOR UPDATE",[row.id,actor.realmId]);
   if(!q.rows[0]||["REJECTED","EXPIRED"].includes(q.rows[0].status)||
     q.rows[0].reserved_until.getTime()<=Date.now())
    throw new ConflictException("The original private upload has expired");
   await this.app(tx,actor,row.hr_application_id,row.hr_source_version,true);
   if(q.rows[0].status!=="VALIDATED"){
    await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
     "WHERE id=$1 AND realm_id=$2",[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
    if(clean)await tx.query(
     "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
     "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
     "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,hr_application_id,"+
     "hr_source_version) VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,"+
     "'CG10_DRAFT',$12,$13) ON CONFLICT(upload_intent_id) DO NOTHING",
     [actor.realmId,row.id,row.hr_source_version,row.mime,row.expected_sha256,row.size_bytes,
      row.object_key,original.objectVersion,original.scanProofRef,new Date(original.verifiedAt),
      actor.accountId,row.hr_application_id,row.hr_source_version]);
    await this.event(tx,actor,row.hr_application_id,
     clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",row.id,null);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
  return this.status(token,row.id);
 }
 /** Only original CG19 can attest a CLEAN verified, not revoked file. */
 async prove(tx:PoolClient,realm:string,applicationRef:string,version:number,
  fileRef:string,expectedClassification:Kind,expectedFileVersion:number){
  const q=await tx.query<{id:string;revision:number}>(
   "SELECT f.id,f.revision FROM cg19_stored_file f "+
   "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.hr_application_id=$3 "+
   "AND f.hr_source_version=$4 AND f.revision=$5 "+
   "AND f.owner_kind='CG10_DRAFT' AND f.revoked_at IS NULL "+
   "AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED' "+
   "AND i.classification=$6 FOR SHARE OF f,i",
   [id(fileRef,"verified file"),realm,id(applicationRef,"application"),
    version,expectedFileVersion,expectedClassification]);
  if(!q.rows[0])throw new ConflictException("The original HR file is not verified or changed");
  return q.rows[0];
 }
 async list(token:string,applicationInput:string){
  const actor=await this.sessions.requireAction(token,"hr.applications.manage");
  const ref=id(applicationInput,"application"),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.source.draft(tx,actor,ref);
   const q=await tx.query<{id:string;revision:number;classification:Kind;
      hr_source_version:number;status:string;revoked_at:Date|null}>(
    "SELECT f.id,f.revision,i.classification,f.hr_source_version,i.status,f.revoked_at "+
    "FROM cg19_stored_file f "+
    "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
    "WHERE f.realm_id=$1 AND f.hr_application_id=$2 AND f.owner_kind='CG10_DRAFT' "+
    "ORDER BY f.created_at DESC,f.id DESC LIMIT 50",[actor.realmId,ref]);
   await tx.query("COMMIT");
   return {files:q.rows.map(f=>({fileRef:f.id,fileVersion:f.revision,
     classification:f.classification,sourceVersion:f.hr_source_version,
     status:f.revoked_at?"REVOKED":f.status,
     cleanVerified:!f.revoked_at&&f.status==="VALIDATED"}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }

 /** Internal original CG03 reviewer adapter. No client can select a raw file:
  * CG03 first verifies live reviewer, exact immutable case and revision.
  */
 async protectedReviewRead(actor:VerifiedFoundationActor,applicationRef:string,
  version:number,fileRef:string,classification:Kind){
  if(!Number.isSafeInteger(version)||version<1||!CLASS.includes(classification))
   throw new BadRequestException("Choose an original protected employee file");
  const check=async(audit:boolean)=>{
   const tx=await this.db.connect();
   try{
    await tx.query("BEGIN");
    await this.identity.assertCurrent(tx,actor,"approvals.review");
    await this.identity.assertCurrent(tx,actor,"hr.employees.review");
    const file=await tx.query<File>(
     "SELECT f.* FROM cg19_stored_file f "+
     "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
     "WHERE f.realm_id=$1 AND f.hr_application_id=$2 "+
     "AND f.hr_source_version=$3 AND f.id=$4 "+
     "AND f.owner_kind='CG10_DRAFT' AND i.classification=$5 "+
     "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
     "AND i.status='VALIDATED' FOR SHARE OF f,i",
     [actor.realmId,id(applicationRef,"application"),version,id(fileRef,"file"),
      classification]);
    const row=file.rows[0];
    if(!row)throw new NotFoundException("Original private employee proof unavailable");
    if(audit)await this.event(tx,actor,applicationRef,"PRIVATE_REVIEW_READ",null,fileRef);
    await tx.query("COMMIT");
    return row;
   }catch(e){await tx.query("ROLLBACK");throw e;}
   finally{tx.release();}
  };
  const row=await check(false);
  const bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:row.object_key,objectVersion:row.object_version,
   maxBytes:Math.min(10485760,Number(row.verified_size_bytes))});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(row.verified_size_bytes)||
    hashBytes(bytes)!==row.verified_sha256)
   throw new ServiceUnavailableException("Original private employee proof changed");
  const after=await check(true);
  if(after.id!==row.id||after.revision!==row.revision||
    after.object_version!==row.object_version)
   throw new ConflictException("Private employee proof was revoked or changed");
  return {data:bytes,mime:row.original_mime};
 }

}
