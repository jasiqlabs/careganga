import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {DonationRefundPostingFacade} from "../../cg-09-finance-accounting/application/donation-refund-posting.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const NUMBER=/^CG-DON-[0-9]{8}$/;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const changed=()=>new ConflictException("The original refund or posted donation changed. Refresh before retrying.");
const input=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException("Check the original donation refund request.");
 return v as Record<string,unknown>;
};
const money=(v:unknown):string=>{
 if(typeof v!=="string"||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(v))
  throw new BadRequestException("Enter a positive refund amount in INR.");
 const [units,frac=""]=v.split(".");
 const minor=BigInt(units)*100n+BigInt(frac.padEnd(2,"0"));
 if(minor<1n||minor>99999999999999n)
  throw new BadRequestException("Refund amount is outside the permitted range.");
 return minor.toString();
};
type Refund={id:string;donation_id:string;amount_minor:string;reason:string;
 request_key:string;request_digest:string;requested_by:string;status:string;
 approval_request_key:string|null;reversal_journal_ref:string|null;settlement_method:string};
type Donation={id:string;donation_number:string;amount_minor:string;branch_ref:string|null;source_status:string};
@Injectable()
export class DonationRefundService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,private readonly owner:ProtectedAccessOwnerService,
  private readonly finance:DonationRefundPostingFacade){}
 private async run<T>(bearer:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>){
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post"),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   const out=await fn(tx,actor);await tx.query("COMMIT");return out;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async current(tx:PoolClient,a:Actor,id:string){
  const q=await tx.query<Donation>("SELECT id,donation_number,amount_minor::text,branch_ref,source_status "+
   "FROM donation WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,id]);
  const d=q.rows[0];if(!d)throw new NotFoundException("Donation unavailable.");
  if(d.branch_ref===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
  else await this.branches.requireFinanceActiveBranch(tx,a,d.branch_ref,"finance.journals.post");
  return d;
 }
 async request(bearer:string,raw:unknown){
  const x=input(raw,["donationNumber","requestKey","amount","reason"]);
  if(typeof x.donationNumber!=="string"||!NUMBER.test(x.donationNumber)||
   typeof x.requestKey!=="string"||!ID.test(x.requestKey)||
   typeof x.reason!=="string"||x.reason.trim().length<12||x.reason.trim().length>300)
   throw new BadRequestException("Enter a current donation, refund amount and reason.");
  const amt=money(x.amount),reason=x.reason.trim(),key=x.requestKey;
  return this.run(bearer,async(tx,a)=>{
   const d=(await tx.query<Donation>("SELECT id,donation_number,amount_minor::text,branch_ref,source_status "+
    "FROM donation WHERE root_realm_id=$1 AND donation_number=$2 FOR UPDATE",
    [a.realmId,x.donationNumber])).rows[0];
   if(!d)throw new NotFoundException("Original received donation unavailable.");
   await this.current(tx,a,d.id);
   const digest=hash(["CG07_REFUND_REQUEST",d.id,amt,reason]);
   const prev=(await tx.query<Refund>(
    "SELECT id,donation_id,amount_minor::text,request_key,request_digest,requested_by,status "+
    "FROM donation_refund_request WHERE root_realm_id=$1 AND requested_by=$2 AND request_key=$3 FOR SHARE",
    [a.realmId,a.accountId,key])).rows[0];
   if(prev){if(prev.donation_id!==d.id||prev.request_digest!==digest)throw changed();
    return {refundRef:prev.id,status:prev.status,replayed:true};}
   if(d.source_status!=="RECEIVED_POSTED")throw changed();
   const exists=await tx.query("SELECT 1 FROM donation_finance_effect e "+
    "JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id "+
    "WHERE e.root_realm_id=$1 AND e.donation_id=$2 AND e.status='POSTED' "+
    "AND j.status='POSTED' AND j.source_ref=$2",[a.realmId,d.id]);
   if(!exists.rowCount)throw changed();
   const cash=(await tx.query(
    "SELECT 1 FROM donation_manual_evidence WHERE root_realm_id=$1 "+
    "AND donation_id=$2 AND status='POSTED'",[a.realmId,d.id])).rowCount===1;
   const online=(await tx.query(
    "SELECT 1 FROM donation_payment_event WHERE root_realm_id=$1 AND donation_id=$2 "+
    "AND provider='razorpay' AND outcome='SUCCESS' AND provider_payment_id IS NOT NULL",
    [a.realmId,d.id])).rowCount===1;
   if(cash===online)throw new ConflictException(
    "This source does not have one supported original refund payout channel. Bank collections require separately verified bank return.");
   const method=online?"ONLINE":"CASH";
   const inserted=(await tx.query<{id:string}>(
    "INSERT INTO donation_refund_request(root_realm_id,donation_id,amount_minor,request_key,"+
    "request_digest,reason,requested_by,settlement_method) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [a.realmId,d.id,amt,key,digest,reason,a.accountId,method])).rows[0];
   return {refundRef:inserted.id,status:"REQUESTED",replayed:false};
  });
 }
 async options(bearer:string,ref:string){
  if(!ID.test(ref))throw new BadRequestException("Choose an original refund request.");
  return this.run(bearer,async(tx,a)=>{
   const row=(await tx.query<{donation_id:string;status:string;amount_minor:string;settlement_method:string}>(
    "SELECT donation_id,status,amount_minor::text,settlement_method FROM donation_refund_request "+
    "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,ref])).rows[0];
   if(!row||row.status!=="REQUESTED")throw new NotFoundException("Current refund request unavailable.");
   await this.current(tx,a,row.donation_id);
   const years=await tx.query<{value:string;label:string}>(
    "SELECT id AS value,name AS label FROM financial_year WHERE root_realm_id=$1 "+
    "AND status='OPEN' ORDER BY start_on DESC,id LIMIT 21",[a.realmId]);
   return {amountMinor:row.amount_minor,settlementMethod:row.settlement_method,years:years.rows.slice(0,20),
    complete:years.rows.length<=20};
  });
 }
 async queue(bearer:string){
  return this.run(bearer,async(tx,a)=>{
   const scope=await this.branches.financeReportScope(bearer,"finance.journals.post");
   const rows=await tx.query<{refundRef:string;donationNumber:string;amountMinor:string;
    reason:string;status:string;canReview:boolean;requestedAt:Date;settlementMethod:string;providerState:string}>(
    "SELECT r.id AS \"refundRef\",d.donation_number AS \"donationNumber\","+
    "r.amount_minor::text AS \"amountMinor\",r.reason,r.status,"+
    "r.settlement_method AS \"settlementMethod\",coalesce(p.state,'NOT_STARTED') AS \"providerState\","+
    "(r.requested_by<>$2) AS \"canReview\",r.requested_at AS \"requestedAt\" "+
    "FROM donation_refund_request r JOIN donation d ON d.root_realm_id=r.root_realm_id "+
    "AND d.id=r.donation_id LEFT JOIN donation_provider_refund p ON p.root_realm_id=r.root_realm_id "+
    "AND p.refund_request_id=r.id WHERE r.root_realm_id=$1 AND "+
    "($3::boolean OR d.branch_ref=ANY($4::uuid[])) "+
    "ORDER BY r.requested_at DESC,r.id DESC LIMIT 101",
    [a.realmId,a.accountId,scope.all,scope.branchRefs]);
   return {items:rows.rows.slice(0,100),hasMore:rows.rows.length>100};
  });
 }
 async confirmCash(bearer:string,refundInput:string,raw:unknown){
  const x=input(raw,["requestKey","currentPassword","cashVoucher","yearRef","postingDate","payoutConfirmed"]);
  if(!ID.test(refundInput)||typeof x.requestKey!=="string"||!ID.test(x.requestKey)||
   typeof x.cashVoucher!=="string"||!/^[A-Za-z0-9._/ -]{4,100}$/.test(x.cashVoucher.trim())||
   typeof x.yearRef!=="string"||!ID.test(x.yearRef)||
   typeof x.postingDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x.postingDate)||
   typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword)>1024||x.payoutConfirmed!==true)
   throw new BadRequestException("Independent cash refund confirmation and current password are required.");
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(bearer,async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const r=(await tx.query<Refund>(
    "SELECT id,donation_id,amount_minor::text,reason,request_key,request_digest,"+
    "requested_by,status,approval_request_key,reversal_journal_ref,settlement_method "+
    "FROM donation_refund_request WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [a.realmId,refundInput])).rows[0];
   if(!r)throw new NotFoundException("Original refund request unavailable.");
   if(r.settlement_method!=="CASH")throw new ConflictException("Online and bank refunds cannot be attested as physical cash.");
   if(r.requested_by===a.accountId)throw new ForbiddenException("An independent Foundation reviewer must confirm this physical cash refund.");
   const d=await this.current(tx,a,r.donation_id);
   const digest=hash(["CG07_CASH_REFUND",r.id,r.request_digest,r.amount_minor,
    x.cashVoucher,x.yearRef,x.postingDate]);
   if(r.status==="FINANCE_REVERSED"){
    if(r.approval_request_key!==x.requestKey)throw changed();
    return {status:"FINANCE_REVERSED",donationNumber:d.donation_number,replayed:true};
   }
   if(r.status!=="REQUESTED"||d.source_status!=="RECEIVED_POSTED")throw changed();
   await this.sessions.requireFreshFoundationRootProof(tx,a,String(x.currentPassword));
   // Reviewer explicitly attests physical cash handover; bank/online refunds
   // are NOT verified by this route and cannot be silently marked paid.
   const journal=await this.finance.post(tx,a,{
    refundRef:r.id,donationRef:d.id,yearRef:String(x.yearRef),date:String(x.postingDate),
    amountMinor:r.amount_minor,requestKey:String(x.requestKey),digest,
    cashVoucher:String(x.cashVoucher).trim()});
   const update=await tx.query("UPDATE donation_refund_request "+
    "SET status='FINANCE_REVERSED',approved_by=$3,approval_request_key=$4,"+
    "voucher_reference=$5,cash_account_ref=e.cash_account_ref,income_account_ref=e.income_account_ref,"+
    "financial_year_ref=$6,posting_date=$7,reversal_journal_ref=$8,password_verified_at=now(),verified_at=now() "+
    "FROM donation_manual_evidence e WHERE donation_refund_request.root_realm_id=$1 "+
    "AND donation_refund_request.id=$2 AND e.root_realm_id=$1 AND e.donation_id=$9 "+
    "AND e.status='POSTED' AND donation_refund_request.status='REQUESTED' RETURNING donation_refund_request.id",
    [a.realmId,r.id,a.accountId,x.requestKey,String(x.cashVoucher).trim().toUpperCase(),
      x.yearRef,x.postingDate,journal,d.id]);
   if(update.rowCount!==1)throw changed();
   return {status:"FINANCE_REVERSED",donationNumber:d.donation_number,replayed:false,
    message:"Original CG09 cash correction posted. Any issued receipt requires a linked CG19 correction."};
  });
 }
}
