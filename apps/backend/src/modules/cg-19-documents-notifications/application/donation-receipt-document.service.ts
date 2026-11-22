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
