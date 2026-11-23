import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {readPrivateDonor} from "../../cg-07-campaigns-donations/application/donation-receipt-source.facade";
import {CommunicationProviders} from "../infrastructure/channel-providers";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Channel="EMAIL"|"WHATSAPP";
type Donation={id:string;root_realm_id:string;donor_private_ciphertext:string;receipt_id:string};
type Message={id:string;state:string;channel:Channel;request_key:string;attempt_key:string|null};
const format=(state:string)=>({
 receiptStatus:"ISSUED",downloadAvailable:true,
 messageStatus:state==="PROVIDER_ACCEPTED"?"PROVIDER_ACCEPTED":"MESSAGE_PENDING",
 providerAccepted:state==="PROVIDER_ACCEPTED",delivered:false,
 notice:state==="PROVIDER_ACCEPTED"?
  "Email provider accepted the notice; delivery is not confirmed. Your receipt is available for private download.":
  "Receipt download is available. Optional message delivery is pending or unavailable."
});
@Injectable()
export class DonationReceiptMessageService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly providers:CommunicationProviders){}
 private async transaction<T>(fn:(client:PoolClient)=>Promise<T>){
  const client=await this.db.connect();
  try{await client.query("BEGIN");const v=await fn(client);await client.query("COMMIT");return v;}
  catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}finally{client.release();}
 }
 private async verifiedEmailReady(root:string){
  if(!this.providers.configured("EMAIL","TRANSACTIONAL"))return false;
  const secret=process.env.CG19_SENDGRID_SECRET_REF?.trim()??"";
  if(!/^secretref:[A-Za-z0-9/_-]{10,230}$/.test(secret))return false;
  const q=await this.db.query(
   "SELECT 1 FROM integration_connection WHERE foundation_realm_id=$1 "+
   "AND scope_kind='FOUNDATION' AND provider='sendgrid' AND purpose='email' "+
   "AND verification_status='VERIFIED' AND last_result_class='CHECK_ACCEPTED' "+
   "AND credential_revision=last_checked_credential_revision "+
   "AND last_checked_at>now()-interval '24 hours' AND secret_reference=$2 LIMIT 1",
   [root,secret]);
  return q.rowCount===1;
 }
 /** Explicit donor button is opt-in for ONE generic document-available email;
  * never send receipt bytes, amount, donor name, PAN, private token or URL.
  * Unsupported WhatsApp is MESSAGE_PENDING until an approved adapter exists.
  */
 async request(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>!["statusToken","channel","requestKey"].includes(k)))
   throw new BadRequestException("Choose the original donation receipt message.");
  const req=raw as Record<string,unknown>,proof=req.statusToken,key=req.requestKey,channel=req.channel;
  if(typeof proof!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(proof)||
   typeof key!=="string"||!UUID.test(key)||!["EMAIL","WHATSAPP"].includes(String(channel)))
   throw new BadRequestException("Use the original private receipt proof and message channel.");
  const tokenHash=createHash("sha256").update(proof).digest("hex");
  const scoped=await this.transaction(async tx=>{
   const donation=(await tx.query<Donation>(
    "SELECT d.id,d.root_realm_id,d.donor_private_ciphertext,r.id AS receipt_id "+
    "FROM donation d JOIN donation_finance_effect e "+
    "ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id "+
    "JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id "+
    "JOIN cg19_donation_receipt_document r "+
    "ON r.root_realm_id=d.root_realm_id AND r.donation_id=d.id "+
    "WHERE d.status_token_digest=$1 AND d.status_token_expires_at>now() "+
    "AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED' "+
    "AND j.status='POSTED' AND j.source_ref=d.id "+
    "AND j.immutable_source_event_key=e.source_event_key "+
    "AND j.immutable_payload_digest=e.immutable_digest "+
    "AND r.status='ISSUED' AND r.source_digest=e.immutable_digest FOR UPDATE OF d",
    [tokenHash])).rows[0];
   if(!donation)throw new NotFoundException("A genuine issued receipt is not available to this private proof.");
   const existing=(await tx.query<Message>(
    "SELECT id,state,channel,request_key,attempt_key FROM cg19_donation_receipt_message "+
    "WHERE root_realm_id=$1 AND donation_id=$2 AND channel=$3 FOR UPDATE",
    [donation.root_realm_id,donation.id,channel])).rows[0];
   if(existing&&existing.request_key!==key)
    throw new ConflictException("One message attempt already exists. Check its original outcome.");
   const message=existing??(await tx.query<Message>(
    "INSERT INTO cg19_donation_receipt_message(root_realm_id,donation_id,receipt_id,channel,request_key) "+
    "VALUES($1,$2,$3,$4,$5) RETURNING id,state,channel,request_key,attempt_key",
    [donation.root_realm_id,donation.id,donation.receipt_id,channel,key])).rows[0];
   if(!message)throw new ConflictException("Donation receipt message was not reserved.");
   const contact=readPrivateDonor(donation.donor_private_ciphertext);
   return {donation,message,contact};
  });
  const {donation,message,contact}=scoped;
  if(message.state!=="MESSAGE_PENDING")return format(message.state);
  if(channel==="WHATSAPP")return format("MESSAGE_PENDING");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
   return format("MESSAGE_PENDING");
  if(!await this.verifiedEmailReady(donation.root_realm_id))
   return format("MESSAGE_PENDING");
  const attempt=randomUUID();
  const reserved=await this.transaction(async tx=>{
   const result=await tx.query(
    "UPDATE cg19_donation_receipt_message SET state='SEND_RESERVED',"+
    "attempt_key=$4,attempted_at=now(),updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='MESSAGE_PENDING' AND request_key=$3 "+
    "RETURNING id",
    [donation.root_realm_id,message.id,key,attempt]);
   return result.rowCount===1;
  });
  if(!reserved)return format("MESSAGE_PENDING");
  const outcome=await this.providers.send({
   notificationRef:message.id,attemptRef:attempt,channel:"EMAIL",to:contact.email,
   subject:"Your CareGanga donation receipt is ready",
   body:"CareGanga Foundation: Your receipt is available. Open the Foundation website or app and use your private status proof to download it securely. Never share your proof.",
   purpose:"TRANSACTIONAL"
  }).catch(()=>({state:"UNKNOWN" as const,provider:"SENDGRID" as const,providerRef:null}));
  const result=outcome.state==="ACCEPTED"?"PROVIDER_ACCEPTED":
   outcome.state==="UNKNOWN"?"PROVIDER_UNKNOWN":
   outcome.state==="UNAVAILABLE"?"PROVIDER_UNKNOWN":"DELIVERY_FAILED";
  await this.db.query(
   "UPDATE cg19_donation_receipt_message SET state=$4,provider_ref=$5,updated_at=now() "+
   "WHERE root_realm_id=$1 AND id=$2 AND attempt_key=$3 AND state='SEND_RESERVED'",
   [donation.root_realm_id,message.id,attempt,result,outcome.providerRef]).catch(()=>undefined);
  return format(result);
 }
 async current(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=="statusToken"))
   throw new BadRequestException("Provide your original private receipt proof.");
  const proof=(raw as Record<string,unknown>).statusToken;
  if(typeof proof!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(proof))
   throw new NotFoundException("Private receipt proof is invalid.");
  const key=createHash("sha256").update(proof).digest("hex");
  const q=await this.db.query<{state:string;channel:string}>(
   "SELECT m.state,m.channel FROM donation d JOIN cg19_donation_receipt_document r "+
   "ON r.root_realm_id=d.root_realm_id AND r.donation_id=d.id "+
   "LEFT JOIN cg19_donation_receipt_message m "+
   "ON m.root_realm_id=d.root_realm_id AND m.receipt_id=r.id "+
   "WHERE d.status_token_digest=$1 AND d.status_token_expires_at>now() "+
   "AND d.source_status='RECEIVED_POSTED' AND r.status='ISSUED' "+
   "ORDER BY m.requested_at DESC NULLS LAST LIMIT 1",[key]);
  if(!q.rows[0])throw new NotFoundException("No private issued receipt is available.");
  return format(q.rows[0].state??"MESSAGE_PENDING");
 }
}
