import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {ConsultationSlipSourceFacade,type OriginalConsultationSlip}
 from "../../cg-15-patients-appointments/application/consultation-slip-source.facade";
import {renderConsultationSlip} from "./cg19-consultation-slip-renderer";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN=/^CGV-[A-F0-9]{24}$/;
type Document={id:string;appointment_id:string;source_revision:number;source_digest:string;
 issued_by_account:string;issue_key:string;status:string;qr_digest:string;
 object_key:string;object_version:string|null;content_sha256:string|null;
 content_length:number|null;created_at:Date;issued_at:Date|null;revoked_at:Date|null};
const hash=(raw:string|Buffer)=>createHash("sha256").update(raw).digest("hex");
const uuid=(raw:string)=>{
 if(!ID.test(raw))throw new BadRequestException({code:"CG19_SLIP_UNAVAILABLE"});
 return raw;
};
function token(source:OriginalConsultationSlip){
 const key=Buffer.from(process.env.CG19_APPOINTMENT_QR_KEY??"","base64");
 if(key.length!==32)
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 const content=source.rootRef+":"+source.bookingRef+":"+source.sourceDigest;
 return "CGV-"+createHmac("sha256",key).update(content).digest("hex").slice(0,24).toUpperCase();
}
@Injectable()
export class AppointmentSlipDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly original:ConsultationSlipSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private source(bearer:string,bookingRef:string,staff:boolean){
  return staff?this.original.originalForCenter(bearer,bookingRef):
   this.original.original(bearer,bookingRef);
 }

 async status(bearer:string,bookingRaw:string,staff=false){
  const source=await this.source(bearer,uuid(bookingRaw),staff);
  const docs=await this.db.query<Document>(
   "SELECT * FROM cg19_consultation_slip "+
   "WHERE root_realm_id=$1 AND appointment_id=$2 AND source_revision=$3",
   [source.rootRef,source.bookingRef,source.sourceVersion]);
  const doc=docs.rows[0];
  return doc?{status:doc.status,documentRef:doc.id,
   canDownload:doc.status==="ISSUED"&&!doc.revoked_at&&doc.source_digest===source.sourceDigest,
   issuedAt:doc.issued_at?.toISOString()??null}:{
   status:"NOT_ISSUED",canDownload:false,documentRef:null,issuedAt:null};
 }
 async issue(bearer:string,bookingRaw:string,requestRaw:string,staff=false){
  const bookingRef=uuid(bookingRaw),requestKey=uuid(requestRaw);
  const source=await this.source(bearer,bookingRef,staff);
  const verifiedActor=await this.original.actorForSlip(bearer);
  if(source.bookingStatus==="CANCELLED"||source.bookingStatus==="NO_SHOW")
   throw new ConflictException({code:"CG19_SLIP_UNAVAILABLE"});
  const qr=token(source);
  let document:Document,first=false;
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [source.rootRef+":CG19:SLIP:"+source.bookingRef+":"+source.sourceVersion]);
   const result=await tx.query<Document>(
    "SELECT * FROM cg19_consultation_slip WHERE root_realm_id=$1 "+
    "AND appointment_id=$2 AND source_revision=$3 FOR UPDATE",
    [source.rootRef,source.bookingRef,source.sourceVersion]);
   const existing=result.rows[0];
   if(existing){
    if(existing.source_digest!==source.sourceDigest||existing.issue_key!==requestKey)
     throw new ConflictException({code:"CG19_SLIP_CONFLICT"});
    document=existing;
   }else{
    const docId=randomUUID(),objectKey="careganga/private/cg19/"+source.rootRef+
     "/appointments/"+docId;
    const created=await tx.query<Document>(
     "INSERT INTO cg19_consultation_slip(root_realm_id,id,appointment_id,"+
     "source_revision,source_digest,issued_by_account,issue_key,qr_digest,object_key) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
     [source.rootRef,docId,source.bookingRef,source.sourceVersion,
      source.sourceDigest,verifiedActor.accountId,
      requestKey,hash(qr),objectKey]);
    document=created.rows[0];first=true;
   }
   await tx.query("COMMIT");open=false;
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
  if(!first&&document.status==="ISSUED")
   return {status:"ISSUED",documentRef:document.id,confirmed:true,replayed:true};
  if(!first&&document.status==="REVOKED")
   throw new ConflictException({code:"CG19_SLIP_UNAVAILABLE"});
  if(!first&&["PENDING","UNKNOWN"].includes(document.status)){
   try{
    const stored=await this.storage.reconcileIssuedPrivateDocument({
     objectKey:document.object_key,maxBytes:10485760});
    const actual=await this.storage.readVerifiedPrivateObject({
     objectKey:document.object_key,objectVersion:stored.objectVersion,
     maxBytes:stored.sizeBytes});
    if(actual.length!==stored.sizeBytes||hash(actual)!==stored.sha256)
     throw Error("Private slip digest changed");
    const checked=await PDFDocument.load(actual,{updateMetadata:false});
    if(checked.getSubject()!=="CG15-APPOINTMENT:"+source.sourceDigest)
     throw Error("Original source mismatch");
    await this.source(bearer,bookingRef,staff);
    const fixed=await this.db.query(
     "UPDATE cg19_consultation_slip SET status='ISSUED',object_version=$3,"+
     "content_sha256=$4,content_length=$5,issued_at=created_at,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND status IN('PENDING','UNKNOWN') "+
     "AND object_version IS NULL RETURNING id",
     [source.rootRef,document.id,stored.objectVersion,stored.sha256,stored.sizeBytes]);
    if(fixed.rowCount)return {status:"ISSUED",documentRef:document.id,
     confirmed:true,recovered:true};
   }catch{/* Never claim an unverified object as issued. */}
  }
  try{
   const pdf=await renderConsultationSlip(source,qr,document.created_at.toISOString());
   const checksum=hash(pdf);
   const stored=await this.storage.writeVerifiedPrivateDocument({
    objectKey:document.object_key,bytes:pdf,sha256:checksum});
   if(!stored.objectVersion||stored.sha256!==checksum)
    throw Error("Slip private storage not independently verified");
   const current=await this.source(bearer,bookingRef,staff);
   if(current.sourceDigest!==source.sourceDigest)
    throw Error("Appointment changed before slip issued");
   const confirmed=await this.db.query(
    "UPDATE cg19_consultation_slip SET status='ISSUED',object_version=$3,"+
    "content_sha256=$4,content_length=$5,issued_at=created_at,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_digest=$6 "+
    "AND status IN('PENDING','UNKNOWN') AND object_version IS NULL RETURNING id",
    [source.rootRef,document.id,stored.objectVersion,checksum,pdf.length,source.sourceDigest]);
   if(!confirmed.rowCount)throw Error("Original slip publication uncertain");
   return {status:"ISSUED",documentRef:document.id,confirmed:true};
  }catch{
   await this.db.query(
    "UPDATE cg19_consultation_slip SET status='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",
    [source.rootRef,document.id]).catch(()=>undefined);
   return {status:"UNKNOWN",documentRef:document.id,confirmed:false};
  }
 }
 /** CG19-owned two-minute purpose-bound, recipient-bound private download grant.
  * This is NOT a public presigned storage URL: each use still requires the
  * ORIGINAL current CG01 patient/staff session, CG15 consent and file ACL.
  */
 private downloadSignature(source:OriginalConsultationSlip,actorId:string,
  documentRef:string,staff:boolean,expiry:number){
  const key=Buffer.from(process.env.CG19_APPOINTMENT_QR_KEY??"","base64");
  if(key.length!==32)
   throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
  const digest=createHmac("sha256",key)
   .update(["CG19_PRIVATE_APPOINTMENT_SLIP_V1",source.rootRef,
    source.bookingRef,String(source.sourceVersion),source.sourceDigest,
    documentRef,actorId,staff?"STAFF":"PATIENT",String(expiry)].join("|"))
   .digest("hex");
  return digest;
 }
 async issueDownloadGrant(bearer:string,bookingRaw:string,staff=false){
  const source=await this.source(bearer,uuid(bookingRaw),staff);
  const actor=await this.original.actorForSlip(bearer);
  const d=await this.db.query<{id:string}>(
   "SELECT id FROM cg19_consultation_slip "+
   "WHERE root_realm_id=$1 AND appointment_id=$2 AND source_revision=$3 "+
   "AND source_digest=$4 AND status='ISSUED' AND revoked_at IS NULL "+
   "AND object_version IS NOT NULL AND content_sha256 IS NOT NULL",
   [source.rootRef,source.bookingRef,source.sourceVersion,source.sourceDigest]);
  if(!d.rows[0])throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  const expires=Math.floor(Date.now()/1000)+120;
  const signature=this.downloadSignature(source,actor.accountId,
   d.rows[0].id,staff,expires);
  return {status:"GRANTED",purpose:"APPOINTMENT_SLIP",expiresAt:
    new Date(expires*1000).toISOString(),grant:String(expires)+"."+signature};
 }
 async downloadGranted(bearer:string,bookingRaw:string,grant:unknown,staff=false){
  if(typeof grant!=="string"||!/^[0-9]{10}\.[a-f0-9]{64}$/.test(grant))
   throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  const source=await this.source(bearer,uuid(bookingRaw),staff);
  const actor=await this.original.actorForSlip(bearer);
  const d=await this.db.query<{id:string}>(
   "SELECT id FROM cg19_consultation_slip "+
   "WHERE root_realm_id=$1 AND appointment_id=$2 AND source_revision=$3 "+
   "AND source_digest=$4 AND status='ISSUED' AND revoked_at IS NULL "+
   "AND object_version IS NOT NULL AND content_sha256 IS NOT NULL",
   [source.rootRef,source.bookingRef,source.sourceVersion,source.sourceDigest]);
  if(!d.rows[0])throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  const [seconds,presented]=grant.split(".");
  const expires=Number(seconds),now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(expires)||expires<=now||expires>now+120)
   throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  const expected=this.downloadSignature(source,actor.accountId,
   d.rows[0].id,staff,expires);
  if(!timingSafeEqual(Buffer.from(presented,"hex"),Buffer.from(expected,"hex")))
   throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  // Recheck current source ACL/consent and verified bytes after grant validation.
  return this.download(bearer,source.bookingRef,staff);
 }
 async download(bearer:string,bookingRaw:string,staff=false){
  const source=await this.source(bearer,uuid(bookingRaw),staff);
  const row=await this.db.query<Document>(
   "SELECT * FROM cg19_consultation_slip WHERE root_realm_id=$1 AND "+
   "appointment_id=$2 AND source_revision=$3 AND source_digest=$4 "+
   "AND status='ISSUED' AND revoked_at IS NULL",
   [source.rootRef,source.bookingRef,source.sourceVersion,source.sourceDigest]);
  const d=row.rows[0];
  if(!d?.object_version||!d.content_length||!d.content_sha256)
   throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:d.object_key,objectVersion:d.object_version,maxBytes:d.content_length});
  if(bytes.length!==d.content_length||hash(bytes)!==d.content_sha256)
   throw new ConflictException({code:"CG19_SLIP_UNAVAILABLE"});
  const current=await this.source(bearer,source.bookingRef,staff);
  if(current.sourceDigest!==source.sourceDigest)
   throw new ConflictException({code:"CG19_SLIP_UNAVAILABLE"});
  const live=await this.db.query(
   "SELECT id FROM cg19_consultation_slip WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='ISSUED' AND revoked_at IS NULL AND object_version=$3",
   [source.rootRef,d.id,d.object_version]);
  if(!live.rowCount)throw new NotFoundException({code:"CG19_SLIP_UNAVAILABLE"});
  return bytes;
 }
 async verifyPublic(raw:unknown){
  if(typeof raw!=="string"||!TOKEN.test(raw))
   throw new BadRequestException({code:"CG19_SLIP_VERIFY_INVALID"});
  const result=await this.db.query<{
   root_realm_id:string;appointment_id:string;source_revision:number
  }>(
   "SELECT root_realm_id,appointment_id,source_revision FROM cg19_consultation_slip "+
   "WHERE qr_digest=$1 AND status='ISSUED' AND revoked_at IS NULL LIMIT 1",
   [hash(raw)]);
  const source=result.rows[0];
  return {valid:!!source&&await this.original.activeForToken(
   source.root_realm_id,source.appointment_id,source.source_revision)};
 }
}
