import {ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createDecipheriv,createHmac} from "node:crypto";
import type {PoolClient} from "pg";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
type D={id:string;donation_number:string;amount_minor:string;currency:string;
 donor_private_ciphertext:string;branch_ref:string|null;source_digest:string;
 posting_date:string;donation_kind:string};
function donorName(privateData:string):string{
 const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Donation privacy service unavailable.");
 const [nonce,tag,payload]=privateData.split(".");
 if(!nonce||!tag||!payload)throw new ConflictException("Original donor source is invalid.");
 const secret=createHmac("sha256",key).update("careganga-cg07-donor-private-v1").digest();
 try{
  const c=createDecipheriv("aes-256-gcm",secret,Buffer.from(nonce,"base64url"));
  c.setAuthTag(Buffer.from(tag,"base64url"));
  const data:unknown=JSON.parse(Buffer.concat([c.update(Buffer.from(payload,"base64url")),c.final()]).toString("utf8"));
  if(!data||typeof data!=="object"||!("name" in data)||typeof data.name!=="string"||
   data.name.length>120)throw Error();
  return data.name.trim();
 }catch{throw new ConflictException("Original donation identity source changed.");}
}
/** Original donation and CG09 ledger truth; CG19 owns the receipt bytes. */
@Injectable()
export class DonationReceiptSourceFacade{
 constructor(private readonly branches:BranchSourceFacade){}
 async original(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ref))
   throw new NotFoundException("Donation is unavailable.");
  const q=await tx.query<D>(
   "SELECT d.id,d.donation_number,d.amount_minor::text,d.currency,d.donation_kind,"+
   "d.donor_private_ciphertext,d.branch_ref,e.immutable_digest AS source_digest,"+
   "j.posting_date::text FROM donation d JOIN donation_finance_effect e "+
   "ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id "+
   "JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id "+
   "WHERE d.root_realm_id=$1 AND d.id=$2 AND d.source_status='RECEIVED_POSTED' "+
   "AND e.status='POSTED' AND j.status='POSTED' AND j.source_ref=d.id "+
   "AND j.immutable_source_event_key=e.source_event_key "+
   "AND j.immutable_payload_digest=e.immutable_digest "+
   "FOR SHARE OF d,e,j",[actor.realmId,ref]);
  const v=q.rows[0];
  if(!v)throw new NotFoundException("Only a verified CG09-posted donation can be receipted.");
  if(v.branch_ref===null)
   await this.branches.requireFinanceRootScope(tx,actor,"finance.journals.post");
  else
   await this.branches.requireFinanceActiveBranch(tx,actor,v.branch_ref,"finance.journals.post");
  return {donationRef:v.id,donationNumber:v.donation_number,sourceDigest:v.source_digest,
   amountMinor:v.amount_minor,currency:v.currency,postingDate:v.posting_date,
   donationKind:v.donation_kind,donorName:donorName(v.donor_private_ciphertext)};
 }
}
