import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceInvoiceSourceFacade} from "../../cg-09-finance-accounting/application/finance-invoice-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {renderOriginalFinanceInvoice} from "./finance-invoice-pdf-renderer";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_INVOICE_SOURCE_INVALID",field:"invoiceRef"});
 return v;
};
type Document={id:string;root_realm_id:string;invoice_id:string;source_version:number;
 source_digest:string;status:string;issue_key:string;object_key:string;object_version:string|null;
 content_sha256:string|null;content_length:number|null;issued_at:Date|null;revoked_at:Date|null};
@Injectable()
export class FinanceInvoiceDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:FinanceInvoiceSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 async status(bearer:string,invoiceInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(invoiceInput);
  const docs=await this.db.query<Document>(
   "SELECT * FROM cg19_finance_invoice_document WHERE root_realm_id=$1 "+
   "AND invoice_id=$2 ORDER BY source_version DESC LIMIT 1",
   [actor.realmId,ref]);
  const doc=docs.rows[0];
  if(!doc)return {status:"NOT_ISSUED",canDownload:false};
  return {status:doc.status,canDownload:doc.status==="ISSUED",
   documentRef:doc.id,issuedAt:doc.issued_at,sourceVersion:doc.source_version};
 }
 /** Creates exactly one original issued document per invoice revision. Any
  * uncertain provider state remains UNKNOWN until a verified source lookup.
  */
 async issue(bearer:string,invoiceInput:string,requestInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  const invoiceRef=id(invoiceInput),requestKey=id(requestInput);
  const current=await this.db.query<{version:number}>(
   "SELECT version FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
   [invoiceRef,actor.realmId]);
  if(!current.rows[0])
   throw new NotFoundException({code:"FINANCE_INVOICE_SOURCE_INVALID"});
  const source=await this.source.issuedSource(bearer,invoiceRef,current.rows[0].version);
  let row:Document,first=false;
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const prior=await tx.query<Document>(
    "SELECT * FROM cg19_finance_invoice_document WHERE root_realm_id=$1 "+
    "AND invoice_id=$2 AND source_version=$3 FOR UPDATE",
    [actor.realmId,invoiceRef,source.version]);
   if(prior.rows[0]){
    row=prior.rows[0];
    if(row.source_digest!==source.sourceDigest||row.issue_key!==requestKey)
     throw new ConflictException({code:"FINANCE_INVOICE_ISSUE_CONFLICT"});
   }else{
    const storageKey="careganga/private/cg19/"+actor.realmId+"/invoices/"+randomUUID();
    const created=await tx.query<Document>(
     "INSERT INTO cg19_finance_invoice_document(root_realm_id,invoice_id,"+
     "source_version,source_digest,issue_key,issued_by,object_key) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
     [actor.realmId,invoiceRef,source.version,source.sourceDigest,
      requestKey,actor.accountId,storageKey]);
    row=created.rows[0];first=true;
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(!first)return {status:row.status,documentRef:row.id,
   confirmed:row.status==="ISSUED"};
  try{
   const draft=source.draft as {info?:Record<string,unknown>;
    items?:Record<string,unknown>;payment?:Record<string,unknown>};
   const info=draft.info,items=draft.items,payment=draft.payment;
   if(!info||!items||!payment||!Array.isArray(items.rows))
    throw Error("Invalid original invoice snapshot");
   const itemRows=items.rows as Array<{description:string;quantity:number;
    lineTotalMinor:string;unitRateMinor:string}>;
   const issuedAt=new Date().toISOString();
   const bytes=await renderOriginalFinanceInvoice({
    invoiceNumber:source.invoiceNumber,date:String(info.invoiceDate),
    due:String(info.dueDate),counterparty:String(info.counterpartyName),
    address:typeof info.counterpartyAddress==="string"?info.counterpartyAddress:null,
    purpose:String(info.purpose),category:String(info.category),items:itemRows,
    grossMinor:String(items.grossMinor),taxMinor:String(items.taxMinor),
    chargesMinor:String(items.chargesMinor),totalMinor:String(items.totalMinor),
    terms:String(payment.terms??"Payment due per invoice"),
    notes:typeof payment.notes==="string"?payment.notes:null,
    postedAt:issuedAt,issueAt:issuedAt
   });
   const digest=createHash("sha256").update(bytes).digest("hex");
   const stored=await this.storage.writeVerifiedPrivateDocument({
    objectKey:row.object_key,bytes,sha256:digest});
   if(!stored.objectVersion||stored.objectVersion.length>160||
      stored.sha256!==digest)
    throw Error("Unconfirmed private storage version");
   const done=await this.db.query(
    "UPDATE cg19_finance_invoice_document SET status='ISSUED',object_version=$3,"+
    "content_sha256=$4,content_length=$5,issued_at=now(),updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING' "+
    "AND object_version IS NULL RETURNING id",
    [row.id,actor.realmId,stored.objectVersion,digest,bytes.length]);
   if(!done.rowCount)throw Error("Unconfirmed issue state");
   return {status:"ISSUED",confirmed:true,documentRef:row.id};
  }catch{
   await this.db.query(
    "UPDATE cg19_finance_invoice_document SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING'",
    [row.id,actor.realmId]).catch(()=>undefined);
   return {status:"UNKNOWN",confirmed:false,documentRef:row.id};
  }
 }
 async download(bearer:string,documentInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(documentInput);
  const docs=await this.db.query<Document>(
   "SELECT * FROM cg19_finance_invoice_document "+
   "WHERE id=$1 AND root_realm_id=$2 AND status='ISSUED' AND revoked_at IS NULL",
   [ref,actor.realmId]);
  const doc=docs.rows[0];
  if(!doc||!doc.object_version||!doc.content_sha256||!doc.content_length)
   throw new NotFoundException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  const invoices=await this.db.query<{id:string;version:number;status:string;
   current_digest:string}>(
   "SELECT id,version,status,current_digest FROM finance_invoice "+
   "WHERE id=$1 AND root_realm_id=$2",
   [doc.invoice_id,actor.realmId]);
  const current=invoices.rows[0];
  if(!current||!["ISSUED","POSTED"].includes(current.status)||
     current.version!==doc.source_version||current.current_digest!==doc.source_digest)
   throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:doc.object_key,objectVersion:doc.object_version,maxBytes:doc.content_length});
  if(bytes.length!==doc.content_length||
    createHash("sha256").update(bytes).digest("hex")!==doc.content_sha256)
   throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  await this.sessions.requireAction(bearer,"finance.invoices.view");
  const live=await this.db.query(
   "SELECT id FROM cg19_finance_invoice_document WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='ISSUED' AND revoked_at IS NULL AND object_version=$3",
   [doc.id,actor.realmId,doc.object_version]);
  if(!live.rowCount)
   throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
  return bytes;
 }
}
