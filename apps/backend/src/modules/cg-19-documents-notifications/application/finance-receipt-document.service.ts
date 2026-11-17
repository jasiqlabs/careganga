import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReceiptSourceFacade} from "../../cg-09-finance-accounting/application/finance-receipt-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {renderFinanceReceipt} from "./finance-receipt-pdf-renderer";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(value:unknown):string=>{
 if(typeof value!=="string"||!UUID.test(value))
  throw new BadRequestException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
 return value;
};
type ReceiptDoc={id:string;receipt_id:string;source_version:number;source_digest:string;
 issue_key:string;status:string;object_key:string;object_version:string|null;
 content_sha256:string|null;content_length:number|null;issued_at:Date|null};
@Injectable()
export class FinanceReceiptDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:FinanceReceiptSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 async status(bearer:string,receiptInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(receiptInput);
  const rows=await this.db.query<ReceiptDoc>(
   "SELECT * FROM cg19_finance_receipt_document "+
   "WHERE root_realm_id=$1 AND receipt_id=$2",[actor.realmId,ref]);
  const doc=rows.rows[0];
  if(!doc)return {status:"NOT_ISSUED",canDownload:false};
  return {status:doc.status,canDownload:doc.status==="ISSUED",
   documentRef:doc.id,issuedAt:doc.issued_at};
 }
 async issue(bearer:string,receiptInput:string,keyInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  const receiptRef=id(receiptInput),key=id(keyInput);
  const original=await this.source.original(bearer,receiptRef);
  let doc:ReceiptDoc,first=false;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":receipt-document:"+receiptRef]);
   const prev=await tx.query<ReceiptDoc>(
    "SELECT * FROM cg19_finance_receipt_document "+
    "WHERE root_realm_id=$1 AND receipt_id=$2 FOR UPDATE",
    [actor.realmId,receiptRef]);
   if(prev.rows[0]){
    doc=prev.rows[0];
    if(doc.issue_key!==key||doc.source_digest!==original.sourceDigest)
     throw new ConflictException({code:"FINANCE_INVOICE_ISSUE_CONFLICT"});
   }else{
    const storageKey="careganga/private/cg19/"+actor.realmId+"/receipts/"+randomUUID();
    const saved=await tx.query<ReceiptDoc>(
     "INSERT INTO cg19_finance_receipt_document(root_realm_id,receipt_id,"+
     "source_version,source_digest,issue_key,issued_by,object_key) "+
     "VALUES($1,$2,1,$3,$4,$5,$6) RETURNING *",
     [actor.realmId,receiptRef,original.sourceDigest,key,actor.accountId,storageKey]);
    doc=saved.rows[0];first=true;
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(!first)return {confirmed:doc.status==="ISSUED",status:doc.status,documentRef:doc.id};
  try{
   const issuedAt=new Date().toISOString();
   const bytes=await renderFinanceReceipt(original,issuedAt);
   const digest=createHash("sha256").update(bytes).digest("hex");
   const storage=await this.storage.writeVerifiedPrivateDocument({
    objectKey:doc.object_key,bytes,sha256:digest});
   if(!storage.objectVersion||storage.objectVersion.length>160||
     storage.sha256!==digest)throw Error("Unconfirmed private receipt storage");
   const done=await this.db.query(
    "UPDATE cg19_finance_receipt_document SET status='ISSUED',object_version=$3,"+
    "content_sha256=$4,content_length=$5,issued_at=now(),updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING' AND object_version IS NULL RETURNING id",
    [doc.id,actor.realmId,storage.objectVersion,digest,bytes.length]);
   if(!done.rowCount)throw Error("Original private receipt issuance unconfirmed");
   return {confirmed:true,status:"ISSUED",documentRef:doc.id};
  }catch{
   await this.db.query(
    "UPDATE cg19_finance_receipt_document SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING'",
    [doc.id,actor.realmId]).catch(()=>undefined);
   return {confirmed:false,status:"UNKNOWN",documentRef:doc.id};
  }
 }
 async download(bearer:string,documentInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(documentInput);
  const docs=await this.db.query<ReceiptDoc>(
   "SELECT * FROM cg19_finance_receipt_document WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='ISSUED' AND revoked_at IS NULL",[ref,actor.realmId]);
  const doc=docs.rows[0];
  if(!doc||!doc.object_version||!doc.content_sha256||!doc.content_length)
   throw new NotFoundException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  const actual=await this.db.query<{immutable_digest:string}>(
   "SELECT r.immutable_digest FROM finance_invoice_receipt r "+
   "JOIN finance_invoice i ON i.id=r.invoice_id AND i.root_realm_id=r.root_realm_id "+
   "JOIN finance_bank_reconciliation b ON b.id=r.reconciliation_id "+
   "AND b.root_realm_id=r.root_realm_id "+
   "WHERE r.id=$1 AND r.root_realm_id=$2 AND r.status='PAID_VERIFIED' "+
   "AND i.status='ISSUED' AND b.status='VERIFIED' AND b.variance_minor=0",
   [doc.receipt_id,actor.realmId]);
  if(!actual.rows[0]||actual.rows[0].immutable_digest!==doc.source_digest)
   throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:doc.object_key,objectVersion:doc.object_version,
   maxBytes:doc.content_length});
  if(bytes.length!==doc.content_length||
   createHash("sha256").update(bytes).digest("hex")!==doc.content_sha256)
   throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  await this.sessions.requireAction(bearer,"finance.invoices.view");
  const live=await this.db.query(
   "SELECT id FROM cg19_finance_receipt_document WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='ISSUED' AND revoked_at IS NULL AND object_version=$3",
   [doc.id,actor.realmId,doc.object_version]);
  if(!live.rowCount)throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  return bytes;
 }
}
