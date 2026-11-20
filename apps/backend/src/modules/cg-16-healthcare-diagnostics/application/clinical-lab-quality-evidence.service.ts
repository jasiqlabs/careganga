import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException}
 from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"LAB_QUALITY_REFERENCE_INVALID"});
 return v;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Intent={id:string;root_realm_id:string;center_ref:string;equipment_ref:string;
 requested_by:string;request_key:string;request_digest:string;mime:string;
 size_bytes:string;sha256:string;document_kind:string;object_key:string;
 status:string;reserved_until:Date};
type QualityFile={id:string;sha256:string;size_bytes:string;object_key:string;
 object_version:string;intent_ref:string};
function input(v:unknown){
 if(!v||typeof v!=="object"||Array.isArray(v))throw new BadRequestException(
  {code:"LAB_QUALITY_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","mime","sha256","sizeBytes","documentKind"].includes(k))||
  x.mime!=="application/pdf"||typeof x.sha256!=="string"||!SHA.test(x.sha256)||
  !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
  Number(x.sizeBytes)>10485760||!["MAINTENANCE","CALIBRATION","QUALITY_CERTIFICATE"].includes(String(x.documentKind)))
  throw new BadRequestException({code:"LAB_QUALITY_INVALID"});
 return {requestKey:id(x.requestKey),sha256:x.sha256,
  sizeBytes:Number(x.sizeBytes),mime:"application/pdf",
  documentKind:String(x.documentKind)};
}

@Injectable()
export class ClinicalLabQualityEvidenceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly storage:PrivateObjectStorage){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const v=await run(c);await c.query("COMMIT");open=false;return v;
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{};throw e;}
  finally{c.release();}
 }
 private async equipment(c:PoolClient,root:string,center:string,equipment:string){
  const q=await c.query(
   "SELECT 1 FROM lab_equipment WHERE root_realm_id=$1 "+
   "AND center_ref=$2 AND id=$3 AND status='ACTIVE' FOR SHARE",
   [root,center,equipment]);
  if(!q.rowCount)throw new NotFoundException({code:"LAB_EQUIPMENT_NOT_ACTIVE"});
 }
 private async original(c:PoolClient,root:string,center:string,equipment:string,
  ref:string,actor:string,lock=false):Promise<Intent>{
  const q=await c.query<Intent>(
   "SELECT * FROM cg19_lab_quality_intent WHERE root_realm_id=$1 "+
   "AND center_ref=$2 AND equipment_ref=$3 AND id=$4 AND requested_by=$5 "+
   (lock?"FOR UPDATE":"FOR SHARE"),[root,center,equipment,ref,actor]);
  if(!q.rows[0])throw new NotFoundException({code:"LAB_QUALITY_UPLOAD_UNAVAILABLE"});
  return q.rows[0];
 }
 async prepare(token:string,centerRaw:string,equipmentRaw:string,raw:unknown){
  const center=id(centerRaw),equipment=id(equipmentRaw),data=input(raw);
  const sourceDigest=hash(["CG16_QUALITY_FILE_V1",center,equipment,
   data.documentKind,data.sha256,data.sizeBytes,data.mime]);
  const current=await this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.quality.record");
   await this.equipment(c,actor.realmId,center,equipment);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+data.requestKey]);
   const existing=await c.query<Intent>(
    "SELECT * FROM cg19_lab_quality_intent WHERE root_realm_id=$1 "+
    "AND requested_by=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,data.requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==sourceDigest||
      existing.rows[0].center_ref!==center||
      existing.rows[0].equipment_ref!==equipment)
     throw new ConflictException({code:"LAB_QUALITY_REQUEST_CONFLICT"});
    return {actor,upload:existing.rows[0]};
   }
   const created=await c.query<Intent>(
    "INSERT INTO cg19_lab_quality_intent(root_realm_id,center_ref,equipment_ref,"+
    "requested_by,request_key,request_digest,document_kind,mime,size_bytes,"+
    "sha256,object_key,reserved_until) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,$10,"+
    "now()+interval '15 minutes') RETURNING *",
    [actor.realmId,center,equipment,actor.accountId,data.requestKey,sourceDigest,
     data.documentKind,data.sizeBytes,data.sha256,
     "careganga/private/cg19/"+actor.realmId+"/lab-quality/"+randomUUID()]);
   return {actor,upload:created.rows[0]};
  });
  const row=current.upload,actor=current.actor;
  if(["VALIDATED","REJECTED"].includes(row.status)||
    row.reserved_until.getTime()<=Date.now())
   return {uploadRef:row.id,status:row.status,uploadReady:false};
  try{
   const reserved=await this.storage.reservePrivateUpload({
    objectKey:row.object_key,requestKey:row.request_key,
    mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.sha256,
    expiresAt:row.reserved_until.toISOString()
   });
   const until=Date.parse(reserved.expiresAt);
   if(!reserved.url.startsWith("https://")||!reserved.reservationRef||
      !Number.isFinite(until)||until<=Date.now()||
      until>row.reserved_until.getTime()||
      reserved.headers?.["Content-Type"]!=="application/pdf"||
      !Object.entries(reserved.headers).every(([k,v])=>
       ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
        "If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))
    throw Error("Invalid private quality object reservation");
   const saved=await this.db.query(
    "UPDATE cg19_lab_quality_intent SET status='INITIATED',"+
    "reservation_ref=$3,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND status IN('INITIATED','UNKNOWN') "+
    "AND reserved_until>now() RETURNING id",
    [actor.realmId,row.id,reserved.reservationRef]);
   if(!saved.rowCount)throw new ConflictException({code:"LAB_QUALITY_UPLOAD_EXPIRED"});
   return {uploadRef:row.id,status:"UPLOAD_READY",uploadReady:true,
    uploadUrl:reserved.url,uploadHeaders:reserved.headers,
    expiresAt:reserved.expiresAt};
  }catch{
   await this.db.query("UPDATE cg19_lab_quality_intent "+
    "SET status='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='INITIATED'",
    [actor.realmId,row.id]);
   return {uploadRef:row.id,status:"STORAGE_UNAVAILABLE",uploadReady:false,
    message:"Secure original quality document storage/scanner unavailable."};
  }
 }
 async current(token:string,centerRaw:string,equipmentRaw:string){
  const center=id(centerRaw),equipment=id(equipmentRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.quality.record");
   const q=await c.query<Intent>(
    "SELECT * FROM cg19_lab_quality_intent WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND equipment_ref=$3 AND requested_by=$4 "+
    "ORDER BY created_at DESC,id DESC LIMIT 1",
    [actor.realmId,center,equipment,actor.accountId]);
   const v=q.rows[0];
   if(!v)return {exists:false,cleanVerified:false};
   const file=await c.query("SELECT id FROM cg19_lab_quality_file "+
    "WHERE root_realm_id=$1 AND intent_ref=$2 AND revoked_at IS NULL",
    [actor.realmId,v.id]);
   return {exists:true,uploadRef:v.id,status:v.status,
    cleanVerified:v.status==="VALIDATED"&&!!file.rowCount,
    expiresAt:v.reserved_until.toISOString(),
    original:{requestKey:v.request_key,sizeBytes:Number(v.size_bytes),
     sha256:v.sha256,mime:v.mime,documentKind:v.document_kind}};
  });
 }
 async status(token:string,centerRaw:string,equipmentRaw:string,uploadRaw:string){
  const center=id(centerRaw),equipment=id(equipmentRaw),upload=id(uploadRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.quality.record");
   const v=await this.original(c,actor.realmId,center,equipment,upload,actor.accountId);
   const file=await c.query<{id:string}>(
    "SELECT id FROM cg19_lab_quality_file WHERE root_realm_id=$1 "+
    "AND intent_ref=$2 AND revoked_at IS NULL",
    [actor.realmId,upload]);
   return {uploadRef:upload,status:v.status,
    expiresAt:v.reserved_until.toISOString(),
    cleanVerified:v.status==="VALIDATED"&&!!file.rows[0],
    verifiedFileRef:file.rows[0]?.id??null};
  });
 }
 async confirm(token:string,centerRaw:string,equipmentRaw:string,uploadRaw:string){
  const center=id(centerRaw),equipment=id(equipmentRaw),upload=id(uploadRaw);
  const first=await this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.quality.record");
   await this.equipment(c,actor.realmId,center,equipment);
   const intent=await this.original(c,actor.realmId,center,equipment,upload,actor.accountId);
   return {actor,intent};
  });
  const v=first.intent;
  if(v.status==="VALIDATED"||v.status==="REJECTED")
   return this.status(token,center,equipment,upload);
  if(v.reserved_until.getTime()<=Date.now())
   throw new ConflictException({code:"LAB_QUALITY_UPLOAD_EXPIRED"});
  let proof:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   proof=await this.storage.verifyPrivateObject({
    objectKey:v.object_key,mime:v.mime,
    sizeBytes:Number(v.size_bytes),sha256:v.sha256
   });
  }catch{
   await this.db.query("UPDATE cg19_lab_quality_intent SET status='UNKNOWN',"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='INITIATED'",
    [first.actor.realmId,upload]);
   return {uploadRef:upload,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
  }
  const timestamp=Date.parse(proof.verifiedAt);
  const clean=proof.state==="CLEAN_VERIFIED"&&proof.sha256===v.sha256&&
   proof.mime===v.mime&&proof.sizeBytes===Number(v.size_bytes)&&
   typeof proof.objectVersion==="string"&&
   proof.objectVersion.length>0&&proof.objectVersion.length<=160&&
   typeof proof.scanProofRef==="string"&&
   proof.scanProofRef.length>=8&&proof.scanProofRef.length<=160&&
   Number.isFinite(timestamp)&&timestamp<=Date.now()+60000&&
   Date.now()-timestamp<900000;
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.quality.record");
   await this.equipment(c,actor.realmId,center,equipment);
   const current=await this.original(c,actor.realmId,center,equipment,upload,actor.accountId,true);
   if(current.status==="VALIDATED"){
    const found=await c.query<{id:string}>(
     "SELECT id FROM cg19_lab_quality_file WHERE root_realm_id=$1 "+
     "AND intent_ref=$2 AND revoked_at IS NULL",[actor.realmId,upload]);
    return {uploadRef:upload,status:"VALIDATED",cleanVerified:!!found.rows[0],
     verifiedFileRef:found.rows[0]?.id??null,replayed:true};
   }
   if(current.status==="REJECTED"||current.reserved_until.getTime()<=Date.now())
    throw new ConflictException({code:"LAB_QUALITY_UPLOAD_EXPIRED"});
   if(!clean){
    await c.query("UPDATE cg19_lab_quality_intent SET status='REJECTED',"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",[actor.realmId,upload]);
    return {uploadRef:upload,status:"REJECTED",cleanVerified:false};
   }
   await c.query("UPDATE cg19_lab_quality_intent SET status='VALIDATED',"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2",[actor.realmId,upload]);
   const file=await c.query<{id:string}>(
    "INSERT INTO cg19_lab_quality_file(root_realm_id,intent_ref,center_ref,"+
    "equipment_ref,sha256,mime,size_bytes,object_key,object_version,"+
    "scan_proof_ref,scan_status,scanned_at) VALUES($1,$2,$3,$4,$5,"+
    "'application/pdf',$6,$7,$8,$9,'CLEAN_VERIFIED',$10) RETURNING id",
    [actor.realmId,upload,center,equipment,current.sha256,current.size_bytes,
     current.object_key,proof.objectVersion,proof.scanProofRef,
     new Date(proof.verifiedAt)]);
   return {uploadRef:upload,status:"VALIDATED",cleanVerified:true,
    verifiedFileRef:file.rows[0].id,replayed:false};
  });
 }
 async file(token:string,centerRaw:string,equipmentRaw:string,fileRaw:string){
  const center=id(centerRaw),equipment=id(equipmentRaw),file=id(fileRaw);
  const record=await this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.view");
   const q=await c.query<QualityFile>(
    "SELECT f.id,f.sha256,f.size_bytes::text AS size_bytes,f.object_key,"+
    "f.object_version,f.intent_ref FROM cg19_lab_quality_file f "+
    "JOIN cg19_lab_quality_intent i ON i.root_realm_id=f.root_realm_id "+
    "AND i.id=f.intent_ref AND i.status='VALIDATED' "+
    "WHERE f.root_realm_id=$1 AND f.center_ref=$2 AND f.equipment_ref=$3 "+
    "AND f.id=$4 AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL",
    [actor.realmId,center,equipment,file]);
   if(!q.rows[0])throw new NotFoundException({code:"LAB_QUALITY_FILE_UNAVAILABLE"});
   return q.rows[0];
  });
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:record.object_key,objectVersion:record.object_version,maxBytes:10485760});
  if(bytes.length!==Number(record.size_bytes)||
    bytes.subarray(0,4).toString("ascii")!=="%PDF"||
    createHash("sha256").update(bytes).digest("hex")!==record.sha256)
   throw new ConflictException({code:"LAB_QUALITY_FILE_CHANGED"});
  // Permission is checked again after external I/O: revocation or global OFF
  // cannot race into a successful protected response.
  await this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.view");
   const q=await c.query("SELECT 1 FROM cg19_lab_quality_file "+
    "WHERE root_realm_id=$1 AND center_ref=$2 AND equipment_ref=$3 "+
    "AND id=$4 AND revoked_at IS NULL FOR SHARE",
    [actor.realmId,center,equipment,file]);
   if(!q.rowCount)throw new NotFoundException({code:"LAB_QUALITY_FILE_UNAVAILABLE"});
  });
  return bytes;
 }
}
