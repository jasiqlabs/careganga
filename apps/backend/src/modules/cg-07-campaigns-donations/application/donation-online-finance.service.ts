import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {DonationFinancePostingFacade} from "../../cg-09-finance-accounting/application/donation-finance-posting.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const NUMBER=/^CG-DON-[0-9]{8}$/;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const bad=()=>new ConflictException("The verified payment or finance posting changed. Refresh before retrying.");
const body=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException("Check the Foundation gateway finance confirmation.");
 return v as Record<string,unknown>;
};
type Online={id:string;root_realm_id:string;branch_ref:string|null;amount_minor:string;
 source_status:string;donation_number:string};
@Injectable()
export class DonationOnlineFinanceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly owner:ProtectedAccessOwnerService,
  private readonly finance:DonationFinancePostingFacade){}
 private async run<T>(token:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.requireAction(token,"finance.journals.post");
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,"finance.journals.post");
   const out=await fn(tx,a);await tx.query("COMMIT");return out;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async scope(tx:PoolClient,a:Actor,branch:string|null){
  if(branch===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
  else await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.journals.post");
 }
 private async current(tx:PoolClient,a:Actor,n:string){
  const d=(await tx.query<Online>("SELECT id,root_realm_id,branch_ref,amount_minor::text,"+
   "source_status,donation_number FROM donation WHERE root_realm_id=$1 "+
   "AND donation_number=$2 FOR UPDATE",[a.realmId,n])).rows[0];
  if(!d)throw new NotFoundException("This donation is unavailable to current Foundation finance.");
  await this.scope(tx,a,d.branch_ref);
  return d;
 }
 private async verified(tx:PoolClient,a:Actor,donation:string){
  const q=await tx.query<{id:string;external_reference:string;merchant_reference:string;
   amount_minor:string;immutable_digest:string}>(
   "SELECT a.id,a.external_reference,a.merchant_reference,d.amount_minor::text,"+
   "p.immutable_digest FROM donation_payment_attempt a "+
   "JOIN donation d ON d.root_realm_id=a.root_realm_id AND d.id=a.donation_id "+
   "JOIN donation_payment_event p ON p.root_realm_id=a.root_realm_id AND p.attempt_id=a.id "+
   "AND p.donation_id=d.id AND p.provider=a.provider "+
   "AND p.merchant_reference=a.merchant_reference "+
   "WHERE d.root_realm_id=$1 AND d.id=$2 AND a.method='ONLINE' "+
   "AND a.provider='razorpay' AND a.status IN('VERIFIED_EXTERNAL','RECEIVED_POSTED') "+
   "AND p.outcome='SUCCESS' AND p.amount_minor=d.amount_minor AND p.currency='INR' "+
   "AND EXISTS(SELECT 1 FROM integration_connection c "+
    "WHERE c.foundation_realm_id=d.root_realm_id AND c.scope_kind='FOUNDATION' "+
    "AND c.provider='razorpay' AND c.purpose='donations' "+
    "AND c.verification_status='VERIFIED' "+
    "AND c.last_checked_credential_revision=c.credential_revision "+
    "AND c.secret_reference=$3) ORDER BY p.recorded_at DESC LIMIT 1 FOR SHARE OF a,d,p",
   [a.realmId,donation,process.env.CG07_RAZORPAY_SECRET_REF??""]);
  if(!q.rows[0])throw new ConflictException("Provider confirmation is not yet independently verified.");
  if(q.rows[0].merchant_reference!==process.env.CG07_RAZORPAY_KEY_ID)
   throw new ConflictException("Foundation provider merchant configuration changed.");
  return q.rows[0];
 }
 async options(token:string,raw:unknown){
  const x=body(raw,["donationNumber"]);
  if(typeof x.donationNumber!=="string"||!NUMBER.test(x.donationNumber))
   throw new BadRequestException("Enter a valid Foundation donation number.");
  return this.run(token,async(tx,a)=>{
   const d=await this.current(tx,a,String(x.donationNumber));
   if(d.source_status!=="VERIFIED_EXTERNAL")throw bad();
   await this.verified(tx,a,d.id);
   return {donationNumber:d.donation_number,amountMinor:d.amount_minor,
    ...await this.finance.providerOptions(tx,a,d.branch_ref)};
  });
 }
 async post(token:string,raw:unknown){
  const x=body(raw,["donationNumber","requestKey","clearingAccountRef",
   "incomeAccountRef","financialYearRef","postingDate","currentPassword"]);
  if(typeof x.donationNumber!=="string"||!NUMBER.test(x.donationNumber)||
   typeof x.requestKey!=="string"||!ID.test(x.requestKey)||
   typeof x.clearingAccountRef!=="string"||!ID.test(x.clearingAccountRef)||
   typeof x.incomeAccountRef!=="string"||!ID.test(x.incomeAccountRef)||
   typeof x.financialYearRef!=="string"||!ID.test(x.financialYearRef)||
   typeof x.postingDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x.postingDate)||
   typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword)>1024)
   throw new BadRequestException("Check the actual verified provider finance posting details.");
  const actor=await this.sessions.requireAction(token,"finance.journals.post");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(token,async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const d=await this.current(tx,a,String(x.donationNumber));
   const eventKey=String(x.requestKey),entryDigest=digest(["CG07_PROVIDER_SETTLEMENT",d.id,
    x.clearingAccountRef,x.incomeAccountRef,x.financialYearRef,x.postingDate,d.amount_minor]);
   const prior=(await tx.query<{source_event_key:string;immutable_digest:string;status:string}>(
    "SELECT source_event_key,immutable_digest,status FROM donation_finance_effect "+
    "WHERE root_realm_id=$1 AND donation_id=$2 FOR SHARE",[a.realmId,d.id])).rows[0];
   if(prior){
    if(prior.source_event_key!==eventKey||prior.immutable_digest!==entryDigest||
     prior.status!=="POSTED")throw bad();
    return {status:"RECEIVED_POSTED",donationNumber:d.donation_number,replayed:true};
   }
   if(d.source_status!=="VERIFIED_EXTERNAL")throw bad();
   const proof=await this.verified(tx,a,d.id);
   await this.sessions.requireFreshFoundationRootProof(tx,a,String(x.currentPassword));
   const journal=await this.finance.postProvider(tx,a,{
    donationRef:d.id,branchRef:d.branch_ref,amountMinor:d.amount_minor,eventKey,digest:entryDigest,
    yearRef:String(x.financialYearRef),postingDate:String(x.postingDate),
    clearingAccountRef:String(x.clearingAccountRef),incomeAccountRef:String(x.incomeAccountRef),
    paymentReference:proof.external_reference});
   await tx.query("INSERT INTO donation_finance_effect(root_realm_id,donation_id,source_event_key,"+
    "immutable_digest,journal_id,status) VALUES($1,$2,$3,$4,$5,'POSTED')",
    [a.realmId,d.id,eventKey,entryDigest,journal]);
   await tx.query("UPDATE donation_payment_attempt SET status='RECEIVED_POSTED' "+
    "WHERE root_realm_id=$1 AND id=$2",[a.realmId,proof.id]);
   await tx.query("UPDATE donation SET source_status='RECEIVED_POSTED',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='VERIFIED_EXTERNAL'",[a.realmId,d.id]);
   return {status:"RECEIVED_POSTED",donationNumber:d.donation_number,replayed:false};
  });
 }
}
