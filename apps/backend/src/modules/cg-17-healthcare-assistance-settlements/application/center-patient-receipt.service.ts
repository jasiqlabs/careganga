import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import {renderCenterCashReceipt}
 from "../../cg-19-documents-notifications/application/center-collection-receipt-renderer";
import {ConsultationPatientChargeService} from "./consultation-patient-charge.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CENTER_CASH_RECEIPT_INVALID"});
 return v;
};
type Cash={
 id:string;center_ref:string;charge_ref:string;amount_minor:string;
 source_digest:string;cash_receipt_number:string;created_at:Date;
 accepted_by_account:string;center_name:string
};
type Document={
 id:string;collection_ref:string;center_ref:string;charge_ref:string;
 source_digest:string;center_display_name:string;status:string;
 issue_key:string;object_key:string;object_version:string|null;
 content_sha256:string|null;content_length:number|null;
 created_at:Date;issued_at:Date|null
};
const sha=(v:Buffer|string)=>createHash("sha256").update(v).digest("hex");
const originalDigest=(root:string,c:Cash)=>sha(JSON.stringify([
 "CG17_CENTER_VERIFIED_CASH_RECEIPT_V1",root,c.id,c.center_ref,c.charge_ref,
 c.amount_minor,c.source_digest,c.cash_receipt_number,
 c.created_at.toISOString(),c.accepted_by_account
]));
/** One source-bound CG19-issued private cash receipt. It never creates
 * an additional CG17 collection, CG09 journal, or patient payment claim.
 * All external storage effects stay outside database transactions.
 */
@Injectable()
export class CenterPatientReceiptService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly storage:PrivateObjectStorage,
  private readonly charges:ConsultationPatientChargeService){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const v=await run(c);await c.query("COMMIT");started=false;return v;
  }catch(e){if(started)try{await c.query("ROLLBACK");}catch{}throw e;}
  finally{c.release();}
 }
 private async staff(c:PoolClient,token:string,center:string,
  action:"healthcare.assistance.collections.view"|
   "healthcare.assistance.collections.record"){
  const actor=await this.sessions.requireAction(token,action);
  await this.centers.assertCurrent(c,actor,center,action);
  return actor;
 }
 private async source(c:PoolClient,root:string,center:string,collection:string){
  const q=await c.query<Cash>(
   "SELECT collect.id,collect.center_ref,collect.charge_ref,"+
   "collect.amount_minor::text,collect.source_digest,"+
   "collect.cash_receipt_number,collect.created_at,collect.accepted_by_account,"+
   "center.display_name AS center_name FROM center_collection collect "+
   "JOIN patient_charge charge ON charge.root_realm_id=collect.root_realm_id "+
   "AND charge.id=collect.charge_ref AND charge.center_ref=collect.center_ref "+
   "AND charge.charge_state='ACCEPTED' "+
   "JOIN health_center center ON center.root_realm_id=collect.root_realm_id "+
   "AND center.id=collect.center_ref "+
   "WHERE collect.root_realm_id=$1 AND collect.center_ref=$2 AND collect.id=$3 "+
   "AND collect.method='CASH' AND collect.verification_state='VERIFIED_CASH' "+
   "AND collect.cash_receipt_number IS NOT NULL FOR SHARE OF collect,charge,center",
   [root,center,collection]);
  const s=q.rows[0];
  if(!s)throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
  return s;
 }
 private async document(c:PoolClient,root:string,collection:string){
  const q=await c.query<Document>(
   "SELECT * FROM cg19_center_patient_receipt_document "+
   "WHERE root_realm_id=$1 AND collection_ref=$2",
   [root,collection]);
  return q.rows[0]??null;
 }
 private statusView(d:Document|null){
  if(!d)return {status:"NOT_ISSUED",canDownload:false,documentRef:null};
  return {status:d.status,canDownload:d.status==="ISSUED",
   documentRef:d.id,issuedAt:d.issued_at?.toISOString()??null};
 }
 async status(token:string,centerRaw:string,collectionRaw:string){
  const center=id(centerRaw),collection=id(collectionRaw);
  return this.tx(async c=>{
   const a=await this.staff(c,token,center,"healthcare.assistance.collections.view");
   const s=await this.source(c,a.realmId,center,collection);
   const d=await this.document(c,a.realmId,collection);
   if(d&&d.source_digest!==originalDigest(a.realmId,s))
    throw new ConflictException({code:"CENTER_CASH_RECEIPT_SOURCE_CHANGED"});
   return this.statusView(d);
  });
 }
 async issue(token:string,centerRaw:string,collectionRaw:string,keyRaw:string){
  const center=id(centerRaw),collection=id(collectionRaw),key=id(keyRaw);
  const initial=await this.tx(async c=>{
   const a=await this.staff(c,token,center,"healthcare.assistance.collections.record");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [a.realmId+":CG19:CENTER_CASH:"+collection]);
   const s=await this.source(c,a.realmId,center,collection);
   const digest=originalDigest(a.realmId,s);
   let doc=await this.document(c,a.realmId,collection),created=false;
   if(doc){
    if(doc.issue_key!==key||doc.source_digest!==digest||doc.center_ref!==center)
     throw new ConflictException({code:"CENTER_CASH_RECEIPT_ALREADY_ISSUED"});
   }else{
    const q=await c.query<Document>(
     "INSERT INTO cg19_center_patient_receipt_document("+
     "root_realm_id,collection_ref,charge_ref,center_ref,center_display_name,"+
     "source_digest,issued_by_account,issue_key,object_key) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
     [a.realmId,collection,s.charge_ref,center,s.center_name,
      digest,a.accountId,key,"careganga/private/cg19/"+a.realmId+
      "/center-cash-receipts/"+randomUUID()]);
    doc=q.rows[0];created=true;
   }
   return {doc:doc!,source:s,created,root:a.realmId};
  });
  const {doc,source,created,root}=initial;
  if(doc.status==="ISSUED")return {...this.statusView(doc),replayed:true};
  if(!["PENDING","UNKNOWN"].includes(doc.status))
   throw new ConflictException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
  // A prior storage write might have succeeded while the SQL response was
  // lost. Never overwrite create-only S3/Firebase key on that retry.
  if(!created){
   try{
    const stored=await this.storage.reconcileIssuedPrivateDocument({
     objectKey:doc.object_key,maxBytes:10485760});
    const bytes=await this.storage.readVerifiedPrivateObject({
     objectKey:doc.object_key,objectVersion:stored.objectVersion,
     maxBytes:stored.sizeBytes});
    if(bytes.length!==stored.sizeBytes||sha(bytes)!==stored.sha256)
     throw Error("Private receipt bytes changed");
    const parsed=await PDFDocument.load(bytes,{updateMetadata:false});
    if(parsed.getSubject()!=="CG17-CENTER-CASH-RECEIPT:"+doc.source_digest)
     throw Error("Private receipt no longer matches original cash");
    return this.finalize(token,center,collection,doc,root,stored.objectVersion,
     stored.sha256,stored.sizeBytes,true);
   }catch{
    // An unverified or absent prior file is never a confirmed receipt.
   }
  }
  try{
   const bytes=await renderCenterCashReceipt({
    receiptNumber:source.cash_receipt_number,
    centerName:doc.center_display_name,amountMinor:source.amount_minor,
    collectionDate:source.created_at.toISOString(),
    issuedAt:doc.created_at.toISOString(),sourceDigest:doc.source_digest
   });
   const digest=sha(bytes);
   const stored=await this.storage.writeVerifiedPrivateDocument({
    objectKey:doc.object_key,bytes,sha256:digest});
   if(!stored.objectVersion||stored.objectVersion.length>160||
    stored.sha256!==digest)throw Error("Secure receipt storage not verified");
   return this.finalize(token,center,collection,doc,root,
    stored.objectVersion,digest,bytes.length,false);
  }catch{
   await this.db.query(
    "UPDATE cg19_center_patient_receipt_document SET status='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",
    [root,doc.id]).catch(()=>undefined);
   return {status:"UNKNOWN",canDownload:false,documentRef:doc.id};
  }
 }
 private async finalize(token:string,center:string,collection:string,
  doc:Document,root:string,objectVersion:string,digest:string,
  length:number,recovered:boolean){
  return this.tx(async c=>{
   const a=await this.staff(c,token,center,"healthcare.assistance.collections.record");
   if(a.realmId!==root)throw new ConflictException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
   const source=await this.source(c,root,center,collection);
   if(originalDigest(root,source)!==doc.source_digest)
    throw new ConflictException({code:"CENTER_CASH_RECEIPT_SOURCE_CHANGED"});
   const update=await c.query(
    "UPDATE cg19_center_patient_receipt_document SET status='ISSUED',"+
    "object_version=$3,content_sha256=$4,content_length=$5,"+
    "issued_at=created_at,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND collection_ref=$6 AND issue_key=$7 "+
    "AND status IN('PENDING','UNKNOWN') AND object_version IS NULL RETURNING id",
    [root,doc.id,objectVersion,digest,length,collection,doc.issue_key]);
   if(!update.rowCount){
    const latest=await this.document(c,root,collection);
    if(latest?.status==="ISSUED"&&latest.source_digest===doc.source_digest)
     return {...this.statusView(latest),replayed:true};
    throw new ConflictException({code:"CENTER_CASH_RECEIPT_ISSUE_UNCERTAIN"});
   }
   return {status:"ISSUED",canDownload:true,documentRef:doc.id,recovered};
  });
 }
 private async ownPatient(token:string,booking:string,collection:string){
  const charge=await this.charges.previewBooking(token,booking);
  if(!("accepted" in charge)||charge.accepted!==true||
   !("chargeRef" in charge)||typeof charge.chargeRef!=="string"||
   !("centerRef" in charge)||typeof charge.centerRef!=="string")
   throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
  const a=await this.sessions.verifySession(token);
  return {root:a.realmId,center:id(charge.centerRef),charge:id(charge.chargeRef),
   collection};
 }
 async patientStatus(token:string,bookingRaw:string,collectionRaw:string){
  const booking=id(bookingRaw),collection=id(collectionRaw);
  const context=await this.ownPatient(token,booking,collection);
  return this.tx(async c=>{
   const s=await this.source(c,context.root,context.center,collection);
   if(s.charge_ref!==context.charge)
    throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
   const d=await this.document(c,context.root,collection);
   if(d&&d.source_digest!==originalDigest(context.root,s))
    throw new ConflictException({code:"CENTER_CASH_RECEIPT_SOURCE_CHANGED"});
   return this.statusView(d);
  });
 }
 private async read(doc:Document):Promise<Buffer>{
  if(doc.status!=="ISSUED"||!doc.object_version||
   !doc.content_sha256||!doc.content_length)
   throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:doc.object_key,objectVersion:doc.object_version,
   maxBytes:doc.content_length});
  if(bytes.length!==doc.content_length||
   bytes.subarray(0,4).toString("ascii")!=="%PDF"||
   sha(bytes)!==doc.content_sha256)
   throw new ConflictException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
  return bytes;
 }
 async staffDownload(token:string,centerRaw:string,collectionRaw:string){
  const center=id(centerRaw),collection=id(collectionRaw);
  const original=await this.tx(async c=>{
   const a=await this.staff(c,token,center,"healthcare.assistance.collections.view");
   const s=await this.source(c,a.realmId,center,collection);
   const d=await this.document(c,a.realmId,collection);
   if(!d||d.source_digest!==originalDigest(a.realmId,s))
    throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
   return d;
  });
  const bytes=await this.read(original);
  await this.status(token,center,collection);
  return bytes;
 }
 async patientDownload(token:string,bookingRaw:string,collectionRaw:string){
  const booking=id(bookingRaw),collection=id(collectionRaw);
  const scope=await this.ownPatient(token,booking,collection);
  const doc=await this.tx(async c=>{
   const s=await this.source(c,scope.root,scope.center,collection);
   if(s.charge_ref!==scope.charge)
    throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
   const d=await this.document(c,scope.root,collection);
   if(!d||d.source_digest!==originalDigest(scope.root,s))
    throw new NotFoundException({code:"CENTER_CASH_RECEIPT_UNAVAILABLE"});
   return d;
  });
  const bytes=await this.read(doc);
  await this.patientStatus(token,booking,collection);
  return bytes;
 }
}
