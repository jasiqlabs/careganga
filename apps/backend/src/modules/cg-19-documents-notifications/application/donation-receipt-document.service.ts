import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {DonationReceiptSourceFacade} from "../../cg-07-campaigns-donations/application/donation-receipt-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ref=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException("Choose a valid original donation reference.");return v;};
type Receipt={id:string;donation_id:string;receipt_number:string;source_digest:string;
 issue_key:string;status:string;object_key:string;object_version:string|null;
 content_sha256:string|null;content_length:number|null;created_at:Date;issued_at:Date|null};
type Original=Awaited<ReturnType<DonationReceiptSourceFacade["original"]>>;
async function render(receipt:Receipt,source:Original){
 const document=await PDFDocument.create();
 document.setTitle("CareGanga Foundation Donation Acknowledgment");
 document.setSubject("CG07-DONATION:"+source.sourceDigest);
 document.setCreator("CareGanga CG19 verified document issuer");
 document.setCreationDate(receipt.created_at);
 const page=document.addPage([595,842]),font=await document.embedFont(StandardFonts.Helvetica);
 const bold=await document.embedFont(StandardFonts.HelveticaBold);
 const label=(value:string,y:number,size=12,strong=false)=>
  page.drawText(value,{x:52,y,size,font:strong?bold:font,color:rgb(.12,.21,.33)});
 label("CAREGANGA FOUNDATION",762,19,true);
 label("Donation acknowledgment",720,17,true);
 label("Receipt: "+receipt.receipt_number,672,12);
 label("Donation: "+source.donationNumber,650);
 label("Received on: "+source.postingDate,628);
 const raw=BigInt(source.amountMinor),amount=(raw/100n).toString()+"."+(raw%100n).toString().padStart(2,"0");
 label("Verified amount: INR "+amount,606,13,true);
 const name=/^[ -~]{1,120}$/.test(source.donorName)?source.donorName:"Details securely retained by Foundation";
 label("Donor: "+name,584);
 label("Donation kind: "+source.donationKind,562);
 label("The amount above is based on a confirmed Foundation finance posting.",522,10);
 label("This document is NOT a tax deduction or 80G certificate.",498,11,true);
 label("Tax eligibility, if applicable, requires separately verified legal evidence.",478,10);
 label("Corrections and refunds remain in the original Foundation finance history.",458,10);
 label("Generated securely; valid only while current source and document proofs match.",98,9);
 return Buffer.from(await document.save());
}
@Injectable()
export class DonationReceiptDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly source:DonationReceiptSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async inTx<T>(work:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");const result=await work(tx);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async actor(token:string,issue:boolean){
  const a=await this.sessions.requireAction(token,"finance.journals.post");
  await this.sessions.requireAction(token,issue?"documents.files.manage":"documents.files.view");
  return a;
 }
 async status(token:string,donationInput:string){
  const a=await this.actor(token,false),donation=ref(donationInput);
  return this.inTx(async tx=>{
   await this.source.original(tx,a,donation);
   const doc=(await tx.query<Receipt>(
    "SELECT * FROM cg19_donation_receipt_document WHERE root_realm_id=$1 AND donation_id=$2",
    [a.realmId,donation])).rows[0];
   return {status:doc?.status??"NOT_ISSUED",documentAvailable:doc?.status==="ISSUED",
    receiptNumber:doc?.status==="ISSUED"?doc.receipt_number:null};
  });
 }
 async issue(token:string,donationInput:string,keyInput:string){
  const a=await this.actor(token,true),donation=ref(donationInput),key=ref(keyInput);
  const {source,receipt,created}=await this.inTx(async tx=>{
   const original=await this.source.original(tx,a,donation);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG19:DONATION:ISSUE:"+a.realmId+":"+donation]);
   let doc=(await tx.query<Receipt>(
    "SELECT * FROM cg19_donation_receipt_document WHERE root_realm_id=$1 AND donation_id=$2 FOR UPDATE",
    [a.realmId,donation])).rows[0],first=false;
   if(doc){
    if(doc.issue_key!==key||doc.source_digest!==original.sourceDigest)
     throw new ConflictException("The original donation receipt request changed.");
   }else{
    doc=(await tx.query<Receipt>(
     "INSERT INTO cg19_donation_receipt_document(root_realm_id,donation_id,source_digest,"+
     "issue_key,issued_by,object_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
     [a.realmId,donation,original.sourceDigest,key,a.accountId,
      "careganga/private/cg19/"+a.realmId+"/donations/"+randomUUID()])).rows[0];
    first=true;
   }
   return {source:original,receipt:doc,created:first};
  });
  if(receipt.status==="ISSUED")return {status:"ISSUED",receiptNumber:receipt.receipt_number,replayed:true};
  if(!created){
   try{
    const found=await this.storage.reconcileIssuedPrivateDocument({
     objectKey:receipt.object_key,maxBytes:10485760});
    const bytes=await this.storage.readVerifiedPrivateObject({
     objectKey:receipt.object_key,objectVersion:found.objectVersion,maxBytes:found.sizeBytes});
    if(bytes.length!==found.sizeBytes||createHash("sha256").update(bytes).digest("hex")!==found.sha256)
     throw Error();
    const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
    if(pdf.getSubject()!=="CG07-DONATION:"+source.sourceDigest)throw Error();
    await this.actor(token,true);
    return await this.finalize(a.realmId,donation,receipt,source,found.objectVersion,found.sha256,found.sizeBytes);
   }catch{/* Original private object not recoverable; never label it issued. */}
  }
  try{
   const bytes=await render(receipt,source),sha=createHash("sha256").update(bytes).digest("hex");
   const object=await this.storage.writeVerifiedPrivateDocument({objectKey:receipt.object_key,bytes,sha256:sha});
   if(!object.objectVersion||object.sha256!==sha)throw Error();
   await this.actor(token,true);
   return await this.finalize(a.realmId,donation,receipt,source,object.objectVersion,sha,bytes.length);
  }catch{
   await this.db.query(
    "UPDATE cg19_donation_receipt_document SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING'",[receipt.id,a.realmId]).catch(()=>undefined);
   return {status:"UNKNOWN",receiptNumber:null,confirmed:false};
  }
 }
 private async finalize(root:string,donation:string,receipt:Receipt,source:Original,
  version:string,sha:string,length:number){
  return this.inTx(async tx=>{
   const current=(await tx.query<Receipt>(
    "SELECT * FROM cg19_donation_receipt_document WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [root,receipt.id])).rows[0];
   if(!current||current.source_digest!==source.sourceDigest||
    !["PENDING","UNKNOWN","ISSUED"].includes(current.status))throw new ConflictException("Donation receipt source changed.");
   if(current.status!=="ISSUED"){
    // This DB trigger only accepts current actual CG09 POSTED source.
    await tx.query("UPDATE cg19_donation_receipt_document SET status='ISSUED',"+
     "object_version=$3,content_sha256=$4,content_length=$5,issued_at=$6,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND status IN('PENDING','UNKNOWN')",
     [root,receipt.id,version,sha,length,receipt.created_at]);
   }
   return {status:"ISSUED",receiptNumber:receipt.receipt_number,confirmed:true};
  });
 }

 /** A refund never changes an original issued receipt; CG19 issues a
  * separate neutral correction after a genuine CG09 balanced reversal. */
 async issueCorrection(bearer:string,refundRef:string,issueKey:string){
  const a=await this.actor(bearer,true),refund=ref(refundRef),key=ref(issueKey);
  const details=await this.inTx(async tx=>{
   const basis=(await tx.query<{
    refund_id:string;donation_id:string;amount_minor:string;source_digest:string;
    original_receipt_id:string;original_number:string;donation_number:string;posted_on:string}>(
    "SELECT r.id AS refund_id,d.id AS donation_id,r.amount_minor::text,"+
    "j.immutable_payload_digest AS source_digest,o.id AS original_receipt_id,"+
    "o.receipt_number AS original_number,d.donation_number,j.posting_date::text AS posted_on "+
    "FROM donation_refund_request r JOIN donation d ON d.root_realm_id=r.root_realm_id "+
    "AND d.id=r.donation_id JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id "+
    "AND e.donation_id=d.id JOIN journal collected ON collected.root_realm_id=e.root_realm_id "+
    "AND collected.id=e.journal_id JOIN cg19_donation_receipt_document o "+
    "ON o.root_realm_id=d.root_realm_id AND o.donation_id=d.id "+
    "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
    "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.status='FINANCE_REVERSED' "+
    "AND o.status='ISSUED' AND o.source_digest=e.immutable_digest "+
    "AND e.status='POSTED' AND collected.status='POSTED' AND collected.source_ref=d.id "+
    "AND d.source_status='RECEIVED_POSTED' AND j.status='POSTED' "+
    "AND j.source_ref=r.id AND j.immutable_source_event_key=r.approval_request_key "+
    "FOR SHARE OF r,d,e,o,j,collected",[a.realmId,refund])).rows[0];
   if(!basis)throw new NotFoundException("Verified refund and original issued receipt are required.");
   await this.source.original(tx,a,basis.donation_id);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG19:CORRECTION:"+a.realmId+":"+refund]);
   let correction=(await tx.query<{
    id:string;status:string;correction_number:string;source_digest:string;issue_key:string;
    object_key:string;created_at:Date;amount_minor:string}>(
    "SELECT * FROM cg19_donation_receipt_correction "+
    "WHERE root_realm_id=$1 AND refund_request_id=$2 FOR UPDATE",[a.realmId,refund])).rows[0];
   if(correction){
    if(correction.issue_key!==key||correction.source_digest!==basis.source_digest||
     correction.amount_minor!==basis.amount_minor)
     throw new ConflictException("Original correction issuance request changed.");
   }else correction=(await tx.query<{id:string;status:string;correction_number:string;source_digest:string;issue_key:string;object_key:string;created_at:Date;amount_minor:string}>(
    "INSERT INTO cg19_donation_receipt_correction(root_realm_id,donation_id,"+
    "original_receipt_id,refund_request_id,source_digest,issue_key,issued_by,"+
    "amount_minor,object_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [a.realmId,basis.donation_id,basis.original_receipt_id,refund,basis.source_digest,key,
     a.accountId,basis.amount_minor,
     "careganga/private/cg19/"+a.realmId+"/corrections/"+randomUUID()])).rows[0];
   return {basis,correction};
  });
  const c=details.correction;
  if(!c)throw new ConflictException("Original correction could not be reserved.");
  if(c.status==="ISSUED")return {status:"ISSUED",correctionNumber:c.correction_number,replayed:true};
  try{
   let object:{objectVersion:string;sha256:string;sizeBytes:number}|null=null;
   if(c.status==="UNKNOWN"){
    try{
     const found=await this.storage.reconcileIssuedPrivateDocument({
      objectKey:c.object_key,maxBytes:10485760});
     const bytes=await this.storage.readVerifiedPrivateObject({
      objectKey:c.object_key,objectVersion:found.objectVersion,maxBytes:found.sizeBytes});
     if(bytes.length!==found.sizeBytes||
      createHash("sha256").update(bytes).digest("hex")!==found.sha256)throw Error();
     const parsed=await PDFDocument.load(bytes,{updateMetadata:false});
     if(parsed.getSubject()!=="CG19-REFUND:"+c.source_digest)throw Error();
     object=found;
    }catch{/* Never declare a mismatched recovered private object issued. */}
   }
   if(!object){
    const pdf=await PDFDocument.create();
    pdf.setTitle("CareGanga Donation Refund Correction");
    pdf.setSubject("CG19-REFUND:"+c.source_digest);
    pdf.setCreationDate(c.created_at);
    const page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);
    const label=(s:string,y:number)=>page.drawText(s,{x:48,y,size:12,font,
     color:rgb(.12,.21,.33)});
    const amount=BigInt(details.basis.amount_minor);
    label("CareGanga Foundation - Donation Refund Correction",765);
    label("Correction: "+c.correction_number,708);
    label("Original receipt: "+details.basis.original_number,676);
    label("Donation: "+details.basis.donation_number,650);
    label("Confirmed refund: INR "+(amount/100n)+"."+String(amount%100n).padStart(2,"0"),620);
    label("Finance posting date: "+details.basis.posted_on,591);
    label("The original issued receipt is retained unchanged.",543);
    label("This is not an 80G tax deduction certificate.",510);
    label("Only actual posted CG09 refunds alter verified donation net.",477);
    const bytes=Buffer.from(await pdf.save()),sha=createHash("sha256").update(bytes).digest("hex");
    const saved=await this.storage.writeVerifiedPrivateDocument({
     objectKey:c.object_key,bytes,sha256:sha});
    if(saved.sha256!==sha||!saved.objectVersion)
     throw new ConflictException("Private correction write was not verified.");
    object={objectVersion:saved.objectVersion,sha256:sha,sizeBytes:bytes.length};
   }
   await this.actor(bearer,true);
   return await this.inTx(async tx=>{
    const row=(await tx.query<{status:string;source_digest:string}>(
     "SELECT status,source_digest FROM cg19_donation_receipt_correction "+
     "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,c.id])).rows[0];
    if(!row||row.source_digest!==c.source_digest)
     throw new ConflictException("Original correction source changed.");
    if(row.status!=="ISSUED"){
     await this.source.original(tx,a,details.basis.donation_id);
     await tx.query("UPDATE cg19_donation_receipt_correction SET status='ISSUED',"+
      "object_version=$3,content_sha256=$4,content_length=$5,issued_at=$6 "+
      "WHERE root_realm_id=$1 AND id=$2 AND status IN('PENDING','UNKNOWN')",
      [a.realmId,c.id,object.objectVersion,object.sha256,object.sizeBytes,c.created_at]);
    }
    return {status:"ISSUED",correctionNumber:c.correction_number,replayed:row.status==="ISSUED"};
   });
  }catch{
   await this.db.query("UPDATE cg19_donation_receipt_correction SET status='UNKNOWN' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",[a.realmId,c.id]).catch(()=>undefined);
   return {status:"UNKNOWN",confirmed:false};
  }
 }


 /** Private status-token correction history; never search by donor name,
  * PAN, email, phone, another branch or public correction number alone. */
 async ownCorrections(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=="statusToken"))
   throw new BadRequestException("Provide the original private donation proof.");
  const value=(raw as Record<string,unknown>).statusToken;
  if(typeof value!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(value))
   throw new NotFoundException("Private donation proof unavailable.");
  const hash=createHash("sha256").update(value).digest("hex");
  const rows=await this.db.query<{correctionNumber:string;originalNumber:string;
   amountMinor:string;issuedAt:Date}>(
   "SELECT c.correction_number AS \"correctionNumber\",o.receipt_number AS \"originalNumber\","+
   "c.amount_minor::text AS \"amountMinor\",c.issued_at AS \"issuedAt\" "+
   "FROM donation d JOIN cg19_donation_receipt_correction c "+
   "ON c.root_realm_id=d.root_realm_id AND c.donation_id=d.id "+
   "JOIN cg19_donation_receipt_document o ON o.root_realm_id=c.root_realm_id "+
   "AND o.id=c.original_receipt_id "+
   "JOIN donation_refund_request r ON r.root_realm_id=c.root_realm_id AND r.id=c.refund_request_id "+
   "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
   "WHERE d.status_token_digest=$1 AND d.status_token_expires_at>now() "+
   "AND d.source_status='RECEIVED_POSTED' AND c.status='ISSUED' AND o.status='ISSUED' "+
   "AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id "+
   "AND j.immutable_payload_digest=c.source_digest "+
   "ORDER BY c.issued_at DESC,c.id DESC LIMIT 51",[hash]);
  if(rows.rows.length>50)throw new ConflictException("Too many corrections; request an authorized Foundation lookup.");
  return {items:rows.rows.map(x=>({...x,issuedAt:x.issuedAt.toISOString()}))};
 }
 /** Retrieval is POST-only and revalidates owner proof after private storage.
  * No correction token or object storage path appears in browser URLs. */
 async downloadCorrection(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>!["statusToken","correctionNumber"].includes(k)))
   throw new BadRequestException("Enter your private correction proof.");
  const body=raw as Record<string,unknown>,token=body.statusToken,number=body.correctionNumber;
  if(typeof token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(token)||
   typeof number!=="string"||!/^CG-COR-[0-9]{9}$/.test(number))
   throw new NotFoundException("Private correction unavailable.");
  const hash=createHash("sha256").update(token).digest("hex");
  const correction=(await this.db.query<{id:string;root_realm_id:string;object_key:string;
   object_version:string;content_sha256:string;content_length:number}>(
   "SELECT c.id,c.root_realm_id,c.object_key,c.object_version,c.content_sha256,c.content_length "+
   "FROM donation d JOIN cg19_donation_receipt_correction c "+
   "ON c.root_realm_id=d.root_realm_id AND c.donation_id=d.id "+
   "JOIN donation_refund_request r ON r.root_realm_id=c.root_realm_id AND r.id=c.refund_request_id "+
   "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
   "WHERE d.status_token_digest=$1 AND d.status_token_expires_at>now() "+
   "AND c.correction_number=$2 AND d.source_status='RECEIVED_POSTED' "+
   "AND c.status='ISSUED' AND r.status='FINANCE_REVERSED' "+
   "AND j.status='POSTED' AND j.source_ref=r.id "+
   "AND j.immutable_payload_digest=c.source_digest",[hash,number])).rows[0];
  if(!correction||!correction.object_version||!correction.content_sha256||
   correction.content_length<100||correction.content_length>10485760)
   throw new NotFoundException("Private correction has not been issued.");
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:correction.object_key,objectVersion:correction.object_version,
   maxBytes:correction.content_length});
  if(bytes.length!==correction.content_length||
   createHash("sha256").update(bytes).digest("hex")!==correction.content_sha256)
   throw new ConflictException("Protected correction bytes could not be verified.");
  const still=await this.db.query(
   "SELECT 1 FROM cg19_donation_receipt_correction c "+
   "JOIN donation d ON d.root_realm_id=c.root_realm_id AND d.id=c.donation_id "+
   "JOIN donation_refund_request r ON r.root_realm_id=c.root_realm_id AND r.id=c.refund_request_id "+
   "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
   "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.status='ISSUED' "+
   "AND c.object_version=$3 AND c.content_sha256=$4 "+
   "AND d.status_token_digest=$5 AND d.status_token_expires_at>now() "+
   "AND d.source_status='RECEIVED_POSTED' AND r.status='FINANCE_REVERSED' "+
   "AND j.status='POSTED' AND j.immutable_payload_digest=c.source_digest",
   [correction.root_realm_id,correction.id,correction.object_version,
    correction.content_sha256,hash]);
  if(still.rowCount!==1)throw new NotFoundException("Protected correction has changed.");
  return bytes;
 }

 async downloadWithProof(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(x=>x!=="statusToken"))throw new BadRequestException("Enter your original private donation proof.");
  const value=(raw as Record<string,unknown>).statusToken;
  if(typeof value!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(value))
   throw new NotFoundException("Private receipt proof unavailable.");
  const tokenHash=createHash("sha256").update(value).digest("hex");
  const original=await this.db.query<{id:string;root_realm_id:string}>(
   "SELECT id,root_realm_id FROM donation WHERE status_token_digest=$1 "+
    "AND status_token_expires_at>now() AND source_status='RECEIVED_POSTED'",[tokenHash]);
  const donor=original.rows[0];
  if(!donor)throw new NotFoundException("The original private receipt proof expired or has no posted finance receipt.");
  const receipt=(await this.db.query<Receipt>(
   "SELECT r.* FROM cg19_donation_receipt_document r "+
   "JOIN donation_finance_effect e ON e.root_realm_id=r.root_realm_id AND e.donation_id=r.donation_id "+
   "JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id "+
   "WHERE r.root_realm_id=$1 AND r.donation_id=$2 AND r.status='ISSUED' "+
   "AND e.status='POSTED' AND j.status='POSTED' AND j.source_ref=r.donation_id "+
   "AND r.source_digest=e.immutable_digest AND j.immutable_payload_digest=e.immutable_digest",
   [donor.root_realm_id,donor.id])).rows[0];
  if(!receipt||!receipt.object_version||!receipt.content_sha256||!receipt.content_length)
   throw new NotFoundException("The private receipt has not yet been issued.");
  const bytes=await this.storage.readVerifiedPrivateObject({objectKey:receipt.object_key,
   objectVersion:receipt.object_version,maxBytes:receipt.content_length});
  if(bytes.length!==receipt.content_length||
   createHash("sha256").update(bytes).digest("hex")!==receipt.content_sha256)
   throw new ConflictException("Private receipt bytes could not be verified.");
  const still=(await this.db.query(
   "SELECT 1 FROM cg19_donation_receipt_document r JOIN donation d "+
   "ON d.root_realm_id=r.root_realm_id AND d.id=r.donation_id "+
   "WHERE r.id=$1 AND r.root_realm_id=$2 AND r.status='ISSUED' "+
   "AND r.object_version=$3 AND d.source_status='RECEIVED_POSTED' "+
   "AND d.status_token_digest=$4 AND d.status_token_expires_at>now()",
   [receipt.id,donor.root_realm_id,receipt.object_version,tokenHash])).rowCount;
  if(!still)throw new NotFoundException("Your receipt has changed or is unavailable.");
  return bytes;
 }
}
