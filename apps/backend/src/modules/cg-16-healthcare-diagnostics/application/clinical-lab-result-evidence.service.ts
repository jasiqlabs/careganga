import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const id=(x:unknown)=>{if(typeof x!=="string"||!UUID.test(x))
 throw new BadRequestException({code:"LAB_RESULT_INVALID"});return x;};
const originalDigest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v))
 .digest("hex");
type Intent={
 id:string;order_ref:string;center_ref:string;patient_ref:string;
 result_revision_ref:string;requested_by:string;request_key:string;
 request_digest:string;mime:string;sha256:string;size_bytes:string;
 object_key:string;reserved_until:Date;status:string
};
type Order={id:string;patient_ref:string;status:string};
function input(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"LAB_RESULT_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","sizeBytes","sha256","mime"].includes(k))||
  x.mime!=="application/pdf"||!Number.isSafeInteger(x.sizeBytes)||
  Number(x.sizeBytes)<1||Number(x.sizeBytes)>10485760||
  typeof x.sha256!=="string"||!SHA.test(x.sha256))
  throw new BadRequestException({code:"LAB_RESULT_INVALID"});
 return {key:id(x.requestKey),size:Number(x.sizeBytes),sha:x.sha256 as string};
}
@Injectable()
export class ClinicalLabResultEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly objects:PrivateObjectStorage){}
 private async tx<T>(execute:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await execute(c);
   await c.query("COMMIT");active=false;return value;
  }catch(e){if(active)try{await c.query("ROLLBACK");}catch{}throw e;}
  finally{c.release();}
 }
 private async check(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,order:string){
  const found=await c.query<Order>(
   "SELECT id,patient_ref,status FROM lab_order WHERE root_realm_id=$1 "+
   "AND id=$2 AND center_ref=$3 FOR UPDATE",
   [actor.realmId,order,center]);
  const row=found.rows[0];
  if(!row||row.status!=="PROCESSING")
   throw new NotFoundException({code:"LAB_RESULT_ORDER_NOT_READY"});
  const samples=await c.query<{all_count:string;processing_count:string}>(
   "SELECT count(*)::text AS all_count,"+
   "count(*) FILTER (WHERE s.custody_state='PROCESSING')::text "+
   "AS processing_count FROM lab_sample s "+
   "WHERE s.root_realm_id=$1 AND s.order_ref=$2 "+
   "AND NOT EXISTS(SELECT 1 FROM lab_sample replacement "+
   "WHERE replacement.root_realm_id=s.root_realm_id "+
   "AND replacement.order_ref=s.order_ref "+
   "AND replacement.replacement_for_sample_ref=s.id)",
   [actor.realmId,order]);
  const total=Number(samples.rows[0]?.all_count??0);
  if(total<1||total!==Number(samples.rows[0]?.processing_count??0))
   throw new ConflictException({code:"LAB_RESULT_SPECIMENS_NOT_READY"});
  const consent=await c.query(
   "SELECT 1 FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=$1 AND consent.patient_id=$2 "+
   "AND consent.purpose='PATIENT_CARE' AND consent.granted=true "+
   "AND consent.revision_no=(SELECT MAX(latest.revision_no) "+
   "FROM cg15_patient_consent latest "+
   "WHERE latest.root_realm_id=consent.root_realm_id "+
   "AND latest.patient_id=consent.patient_id "+
   "AND latest.purpose='PATIENT_CARE')",
   [actor.realmId,row.patient_ref]);
  if(!consent.rowCount)
   throw new ForbiddenException({code:"LAB_PATIENT_CONSENT_REQUIRED"});
  return row;
 }
 private async original(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,order:string,upload:string,lock=false){
  const result=await c.query<Intent>(
   "SELECT * FROM cg19_lab_result_intent WHERE root_realm_id=$1 "+
   "AND id=$2 AND order_ref=$3 AND center_ref=$4 AND requested_by=$5 "+
   (lock?"FOR UPDATE":"FOR SHARE"),
   [actor.realmId,upload,order,center,actor.accountId]);
  const row=result.rows[0];
  if(!row)throw new NotFoundException({code:"LAB_RESULT_UPLOAD_UNAVAILABLE"});
  return row;
 }
 private async log(c:PoolClient,actor:VerifiedFoundationActor,
  upload:string,action:string,file:string|null=null){
  await c.query(
   "INSERT INTO cg19_lab_result_event(root_realm_id,intent_ref,file_ref,"+
   "actor_ref,action) VALUES($1,$2,$3,$4,$5)",
   [actor.realmId,upload,file,actor.accountId,action]);
 }
 async prepare(token:string,centerRaw:string,orderRaw:string,raw:unknown){
  const center=id(centerRaw),order=id(orderRaw),v=input(raw);
  const hash=originalDigest(["CG16_ORIGINAL_LAB_RESULT_V1",
   center,order,v.size,v.sha]);
  const actor=await this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   const original=await this.check(c,actor,center,order);
   const previous=await c.query<Intent>(
    "SELECT * FROM cg19_lab_result_intent WHERE root_realm_id=$1 "+
    "AND requested_by=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,v.key]);
   if(previous.rows[0]){
    if(previous.rows[0].request_digest!==hash||
     previous.rows[0].order_ref!==order||previous.rows[0].center_ref!==center)
     throw new ConflictException({code:"LAB_RESULT_REQUEST_CONFLICT"});
    return {actor,upload:previous.rows[0]};
   }
   const existing=await c.query(
    "SELECT id FROM lab_result_revision WHERE root_realm_id=$1 "+
    "AND order_ref=$2 LIMIT 1",[actor.realmId,order]);
   if(existing.rowCount)
    throw new ConflictException({code:"LAB_RESULT_REVISION_ALREADY_EXISTS"});
   const result=await c.query<{id:string}>(
    "INSERT INTO lab_result_revision(root_realm_id,order_ref,version_no,"+
    "operator_account_ref,source_key) VALUES($1,$2,1,$3,$4) RETURNING id",
    [actor.realmId,order,actor.accountId,v.key]);
   const upload=await c.query<Intent>(
    "INSERT INTO cg19_lab_result_intent(root_realm_id,order_ref,center_ref,"+
    "patient_ref,result_revision_ref,requested_by,request_key,request_digest,"+
    "mime,size_bytes,sha256,object_key,reserved_until) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,'application/pdf',$9,$10,$11,"+
    "now()+interval '15 minutes') RETURNING *",
    [actor.realmId,order,center,original.patient_ref,result.rows[0].id,
     actor.accountId,v.key,hash,v.size,v.sha,
     "careganga/private/cg19/"+actor.realmId+"/lab-result/"+randomUUID()]);
   await this.log(c,actor,upload.rows[0].id,"UPLOAD_INTENT");
   return {actor,upload:upload.rows[0]};
  });
  const row=actor.upload;
  if(row.status==="VALIDATED"||row.status==="REJECTED"||
   row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:row.status,uploadReady:false};
  try{
   const reserved=await this.objects.reservePrivateUpload({
    objectKey:row.object_key,requestKey:row.request_key,
    mime:"application/pdf",sizeBytes:Number(row.size_bytes),
    sha256:row.sha256,expiresAt:row.reserved_until.toISOString()
   });
   const when=Date.parse(reserved.expiresAt);
   if(!reserved.url.startsWith("https://")||!reserved.reservationRef||
    !Number.isFinite(when)||when<=Date.now()||
    when>row.reserved_until.getTime()||
    reserved.headers?.["Content-Type"]!=="application/pdf"||
    !Object.entries(reserved.headers).every(([key,value])=>
     ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
      "If-None-Match"].includes(key)&&typeof value==="string"&&value.length<=160))
    throw Error("Original private storage reservation invalid");
   const applied=await this.db.query(
    "UPDATE cg19_lab_result_intent SET status='INITIATED',"+
    "reservation_ref=$3,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() "+
    "RETURNING id",
    [actor.actor.realmId,row.id,reserved.reservationRef]);
   if(!applied.rowCount)
    throw new ConflictException({code:"LAB_RESULT_UPLOAD_EXPIRED"});
   return {uploadRef:row.id,status:"UPLOAD_READY",uploadReady:true,
    uploadUrl:reserved.url,uploadHeaders:reserved.headers,
    expiresAt:reserved.expiresAt};
  }catch{
   await this.db.query(
    "UPDATE cg19_lab_result_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='INITIATED'",
    [actor.actor.realmId,row.id]);
   return {uploadRef:row.id,status:"STORAGE_UNAVAILABLE",uploadReady:false,
    message:"Secure laboratory report storage or scanning could not be verified."};
  }
 }
 /** Recover an original staff upload after app restart or a lost HTTP reply.
  * Never list another operator's intent or create an alternate report.
  */
 async current(token:string,centerRaw:string,orderRaw:string){
  const center=id(centerRaw),order=id(orderRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   await this.check(c,actor,center,order);
   const found=await c.query<Intent>(
    "SELECT * FROM cg19_lab_result_intent WHERE root_realm_id=$1 "+
    "AND order_ref=$2 AND center_ref=$3 AND requested_by=$4 "+
    "ORDER BY created_at DESC,id DESC LIMIT 1",
    [actor.realmId,order,center,actor.accountId]);
   const row=found.rows[0];
   if(!row)return {exists:false,cleanVerified:false};
   const files=await c.query<{id:string}>(
    "SELECT id FROM cg19_lab_result_file WHERE root_realm_id=$1 "+
    "AND intent_ref=$2 AND order_ref=$3 AND revoked_at IS NULL",
    [actor.realmId,row.id,order]);
   return {exists:true,uploadRef:row.id,status:row.status,
    cleanVerified:row.status==="VALIDATED"&&files.rowCount>0,
    original:{requestKey:row.request_key,
     sizeBytes:Number(row.size_bytes),sha256:row.sha256,mime:"application/pdf"},
    expiresAt:row.reserved_until.toISOString()};
  });
 }
 async status(token:string,centerRaw:string,orderRaw:string,uploadRaw:string){
  const center=id(centerRaw),order=id(orderRaw),upload=id(uploadRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   const row=await this.original(c,actor,center,order,upload);
   const files=await c.query<{id:string}>(
    "SELECT id FROM cg19_lab_result_file WHERE root_realm_id=$1 "+
    "AND intent_ref=$2 AND order_ref=$3 AND revoked_at IS NULL",
    [actor.realmId,upload,order]);
   return {uploadRef:row.id,status:row.status,cleanVerified:
    row.status==="VALIDATED"&&files.rowCount>0,
    resultRef:row.result_revision_ref,
    originalFileRef:row.status==="VALIDATED"?files.rows[0]?.id??null:null};
  });
 }
 async confirm(token:string,centerRaw:string,orderRaw:string,uploadRaw:string){
  const center=id(centerRaw),order=id(orderRaw),upload=id(uploadRaw);
  const context=await this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   const row=await this.original(c,actor,center,order,upload);
   if(row.status==="VALIDATED"||row.status==="REJECTED")
    return {actor,row,skip:true};
   await this.check(c,actor,center,order);
   return {actor,row,skip:false};
  });
  if(context.skip)return this.status(token,center,order,upload);
  const row=context.row,actor=context.actor;
  if(row.reserved_until.getTime()<=Date.now())
   throw new ConflictException({code:"LAB_RESULT_UPLOAD_EXPIRED"});
  let verified:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   verified=await this.objects.verifyPrivateObject({
    objectKey:row.object_key,mime:"application/pdf",
    sizeBytes:Number(row.size_bytes),sha256:row.sha256
   });
  }catch{
   await this.db.query(
    "UPDATE cg19_lab_result_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='INITIATED'",
    [actor.realmId,row.id]);
   return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",
    cleanVerified:false,professionallyReleased:false};
  }
  const time=Date.parse(verified.verifiedAt);
  const clean=verified.state==="CLEAN_VERIFIED"&&
   verified.sha256===row.sha256&&verified.mime==="application/pdf"&&
   verified.sizeBytes===Number(row.size_bytes)&&
   typeof verified.objectVersion==="string"&&
   verified.objectVersion.length>0&&verified.objectVersion.length<=160&&
   typeof verified.scanProofRef==="string"&&
   verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
   Number.isFinite(time)&&time<=Date.now()+60000&&Date.now()-time<900000;
  return this.tx(async c=>{
   const currentActor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   await this.check(c,currentActor,center,order);
   const current=await this.original(c,currentActor,center,order,upload,true);
   if(current.status==="VALIDATED")
    return {uploadRef:upload,status:"RESULT_READY",cleanVerified:true,
     professionallyReleased:false,replayed:true};
   if(current.status==="REJECTED"||current.reserved_until.getTime()<=Date.now())
    throw new ConflictException({code:"LAB_RESULT_UPLOAD_EXPIRED"});
   if(!clean){
    await c.query(
     "UPDATE cg19_lab_result_intent SET status='REJECTED',updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2",[currentActor.realmId,upload]);
    await this.log(c,currentActor,upload,"SCAN_REJECTED");
    return {uploadRef:upload,status:"REJECTED",cleanVerified:false,
     professionallyReleased:false};
   }
   const r=await c.query<{result_state:string}>(
    "SELECT result_state FROM lab_result_revision WHERE root_realm_id=$1 "+
    "AND order_ref=$2 AND id=$3 FOR UPDATE",
    [currentActor.realmId,order,current.result_revision_ref]);
   if(r.rows[0]?.result_state!=="DRAFT")
    throw new ConflictException({code:"LAB_RESULT_REVISION_ALREADY_EXISTS"});
   await c.query("UPDATE cg19_lab_result_intent SET status='VALIDATED',"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [currentActor.realmId,upload]);
   const file=await c.query<{id:string}>(
    "INSERT INTO cg19_lab_result_file(root_realm_id,intent_ref,order_ref,"+
    "center_ref,patient_ref,result_revision_ref,sha256,mime,size_bytes,"+
    "object_key,object_version,scan_proof_ref,scan_status,scanned_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,$10,$11,"+
    "'CLEAN_VERIFIED',$12) RETURNING id",
    [currentActor.realmId,upload,order,center,current.patient_ref,
     current.result_revision_ref,current.sha256,current.size_bytes,
     current.object_key,verified.objectVersion,verified.scanProofRef,
     new Date(verified.verifiedAt)]);
   await c.query(
    "UPDATE lab_result_revision SET result_state='RESULT_READY',"+
    "original_cg19_file_ref=$4,report_digest=$5 "+
    "WHERE root_realm_id=$1 AND order_ref=$2 AND id=$3",
    [currentActor.realmId,order,current.result_revision_ref,
     file.rows[0].id,current.sha256]);
   await this.log(c,currentActor,upload,"SCAN_VERIFIED",file.rows[0].id);
   return {uploadRef:upload,status:"RESULT_READY",cleanVerified:true,
    resultRef:current.result_revision_ref,professionallyReleased:false,
    replayed:false};
  });
 }
}
