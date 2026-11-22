import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {DonationFinancePostingFacade} from "../../cg-09-finance-accounting/application/donation-finance-posting.facade";
import {donationUuid} from "../domain/donation-input";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const conflict=()=>new ConflictException("This donation or protected cash verification changed. Refresh before retrying.");
const record=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||
  Object.keys(v).some(k=>!keys.includes(k)))throw new BadRequestException("Check the original cash voucher details.");
 return v as Record<string,unknown>;
};
const voucher=(v:unknown)=>{
 if(typeof v!=="string"||!/^[A-Za-z0-9._/ -]{4,100}$/.test(v.trim()))
  throw new BadRequestException("Enter the actual physical cash voucher number.");
 return v.trim().toUpperCase();
};
type Evidence={id:string;donation_id:string;recorded_by:string;status:string;
 source_digest:string;request_key:string;voucher_reference:string;amount_minor:string;
 cash_account_ref:string;income_account_ref:string;financial_year_ref:string;
 posting_date:string;review_request_key:string|null;review_digest:string|null;
 reviewed_by:string|null;journal_ref:string|null};
type Donation={id:string;source_status:string;amount_minor:string;branch_ref:string|null;donation_number:string};
@Injectable()
export class DonationManualService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly finance:DonationFinancePostingFacade){}
 private async run<T>(bearer:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.requireAction(bearer,"finance.journals.post"),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,"finance.journals.post");
   const value=await fn(tx,a);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async scope(tx:PoolClient,a:Actor,branch:string|null){
  if(branch===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
  else await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.journals.post");
 }
 private async ensureNoOnlineCollection(tx:PoolClient,a:Actor,donation:string){
  const other=await tx.query(
   "SELECT 1 FROM donation_payment_attempt WHERE root_realm_id=$1 AND donation_id=$2 "+
   "AND method='ONLINE' AND status NOT IN('FAILED','EXPIRED') LIMIT 1",
   [a.realmId,donation]);
  if(other.rowCount)throw new ConflictException(
   "This donation has a live or uncertain online payment. Reconcile it before receiving cash.");
 }
 private async donation(tx:PoolClient,a:Actor,ref:string){
  const q=await tx.query<Donation>("SELECT id,source_status,amount_minor::text,branch_ref,donation_number "+
   "FROM donation WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,donationUuid(ref)]);
  if(!q.rows[0])throw new NotFoundException("Donation is unavailable in the current Foundation.");
  await this.scope(tx,a,q.rows[0].branch_ref);
  return q.rows[0];
 }
 /** The cashier must receive the donor's private POST-body status proof
  * rather than discover an anonymous donor's unredacted roster. */
 async options(bearer:string,raw:unknown){
  const x=record(raw,["statusToken"]),proof=x.statusToken;
  if(typeof proof!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(proof))
   throw new BadRequestException("Enter the original private donation status proof.");
  const hash=createHash("sha256").update(proof).digest("hex");
  return this.run(bearer,async(tx,a)=>{
   const d=(await tx.query<Donation>(
    "SELECT id,source_status,amount_minor::text,branch_ref,donation_number FROM donation "+
    "WHERE root_realm_id=$1 AND status_token_digest=$2 AND status_token_expires_at>now() FOR SHARE",
    [a.realmId,hash])).rows[0];
   if(!d)throw new NotFoundException("This donor status proof is unavailable.");
   await this.scope(tx,a,d.branch_ref);
   if(d.source_status!=="REQUESTED")throw conflict();
   await this.ensureNoOnlineCollection(tx,a,d.id);
   return {donationNumber:d.donation_number,amountMinor:d.amount_minor,
    ...await this.finance.options(tx,a,d.branch_ref)};
  });
 }
 async prepare(bearer:string,raw:unknown){
  const x=record(raw,["statusToken","requestKey","cashVoucher","cashAccountRef",
   "incomeAccountRef","financialYearRef","postingDate"]);
  const key=donationUuid(x.requestKey),cash=donationUuid(x.cashAccountRef),
   income=donationUuid(x.incomeAccountRef),year=donationUuid(x.financialYearRef),
   slip=voucher(x.cashVoucher),day=x.postingDate;
  const proof=x.statusToken;
  if(typeof proof!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(proof)||
   typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))
   throw new BadRequestException("Ask the donor for a current private status proof and posting date.");
  const tokenDigest=createHash("sha256").update(proof).digest("hex");
  const requestDigest=digest(["CG07_CASH_PREPARE",tokenDigest,cash,income,year,day,slip]);
  return this.run(bearer,async(tx,a)=>{
   const source=(await tx.query<{id:string}>(
    "SELECT id FROM donation WHERE root_realm_id=$1 AND status_token_digest=$2 "+
    "AND status_token_expires_at>now()",[a.realmId,tokenDigest])).rows[0];
   if(!source)throw new NotFoundException("Donation status proof is expired or unavailable.");
   const d=await this.donation(tx,a,source.id);
   const prev=(await tx.query<Evidence>(
    "SELECT * FROM donation_manual_evidence WHERE root_realm_id=$1 AND donation_id=$2 FOR SHARE",
    [a.realmId,d.id])).rows[0];
   if(prev){
    if(prev.recorded_by!==a.accountId||prev.request_key!==key||prev.source_digest!==requestDigest)
     throw conflict();
    return {voucher:prev.voucher_reference,status:prev.status,evidenceRef:prev.id,replayed:true};
   }
   if(d.source_status!=="REQUESTED")throw conflict();
   await this.ensureNoOnlineCollection(tx,a,d.id);
   await this.finance.checkCash(tx,a,{cashAccountRef:cash,incomeAccountRef:income,
    yearRef:year,postingDate:day,branchRef:d.branch_ref});
   const attempt=(await tx.query<{id:string}>(
    "INSERT INTO donation_payment_attempt(root_realm_id,donation_id,request_key,source_digest,method,status) "+
    "VALUES($1,$2,$3,$4,'CASH','DRAFT') RETURNING id",
    [a.realmId,d.id,key,requestDigest])).rows[0];
   const e=(await tx.query<Evidence>(
    "INSERT INTO donation_manual_evidence(root_realm_id,donation_id,attempt_id,request_key,"+
    "source_digest,voucher_reference,method,cash_account_ref,income_account_ref,financial_year_ref,"+
    "posting_date,amount_minor,recorded_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,'CASH',$7,$8,$9,$10,$11,$12) RETURNING *",
    [a.realmId,d.id,attempt.id,key,requestDigest,slip,cash,income,year,day,d.amount_minor,a.accountId])).rows[0];
   return {voucher:e.voucher_reference,status:e.status,evidenceRef:e.id,replayed:false};
  });
 }
 async queue(bearer:string){
  return this.run(bearer,async(tx,a)=>{
   const scope=await this.branches.financeReportScope(bearer,"finance.journals.post");
   const items=(await tx.query<{evidenceRef:string;voucher:string;status:string;amountMinor:string;
      donationNumber:string;postingDate:string;recordedAt:Date;canReview:boolean}>(
    "SELECT e.id AS \"evidenceRef\",e.voucher_reference AS voucher,e.status,"+
    "e.amount_minor::text AS \"amountMinor\",d.donation_number AS \"donationNumber\","+
    "e.posting_date::text AS \"postingDate\",e.recorded_at AS \"recordedAt\", "+
    "(e.recorded_by<>$2) AS \"canReview\" FROM donation_manual_evidence e "+
    "JOIN donation d ON d.root_realm_id=e.root_realm_id AND d.id=e.donation_id "+
    "WHERE e.root_realm_id=$1 AND ($3::boolean OR d.branch_ref=ANY($4::uuid[])) "+
    "ORDER BY e.recorded_at DESC,e.id DESC LIMIT 101",
    [a.realmId,a.accountId,scope.all,scope.branchRefs])).rows;
   return {items:items.slice(0,100),hasMore:items.length>100};
  });
 }
 async confirm(bearer:string,evidenceInput:string,raw:unknown){
  const ref=donationUuid(evidenceInput),x=record(raw,["requestKey","currentPassword"]);
  const key=donationUuid(x.requestKey),password=x.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)
   throw new BadRequestException("Enter your current password for independent cash verification.");
  const a=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.limitFoundationRootProof(a);
  return this.run(bearer,async(tx,actor)=>{
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const e=(await tx.query<Evidence>(
    "SELECT id,donation_id,recorded_by,status,source_digest,request_key,voucher_reference,"+
    "amount_minor::text,cash_account_ref,income_account_ref,financial_year_ref,posting_date::text,"+
    "review_request_key,review_digest,reviewed_by,journal_ref "+
    "FROM donation_manual_evidence WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,ref])).rows[0];
   if(!e)throw new NotFoundException("Cash voucher not available.");
   if(e.recorded_by===actor.accountId)throw new ForbiddenException("A different authorized Foundation reviewer must confirm this cash donation.");
   const d=await this.donation(tx,actor,e.donation_id);
   const reviewDigest=digest(["CG07_CASH_VERIFY",e.id,e.source_digest,e.amount_minor]);
   if(e.status==="POSTED"){
    if(e.review_request_key!==key||e.review_digest!==reviewDigest||e.reviewed_by!==actor.accountId)
     throw conflict();
    return {status:"RECEIVED_POSTED",voucher:e.voucher_reference,replayed:true};
   }
   if(e.status!=="PENDING_REVIEW"||d.source_status!=="REQUESTED"||d.amount_minor!==e.amount_minor)
    throw conflict();
   await this.sessions.requireFreshFoundationRootProof(tx,actor,password);
   const j=await this.finance.postCash(tx,actor,{
    donationRef:d.id,amountMinor:d.amount_minor,branchRef:d.branch_ref,
    cashAccountRef:e.cash_account_ref,incomeAccountRef:e.income_account_ref,
    yearRef:e.financial_year_ref,postingDate:e.posting_date,
    eventKey:key,digest:reviewDigest,voucher:e.voucher_reference});
   await tx.query("INSERT INTO donation_finance_effect(root_realm_id,donation_id,source_event_key,"+
    "immutable_digest,journal_id,status) VALUES($1,$2,$3,$4,$5,'POSTED')",
    [actor.realmId,d.id,key,reviewDigest,j]);
   await tx.query("UPDATE donation_payment_attempt SET status='RECEIVED_POSTED' "+
    "WHERE root_realm_id=$1 AND donation_id=$2 AND request_key=$3 AND status='DRAFT'",
    [actor.realmId,d.id,e.request_key]);
   await tx.query("UPDATE donation_manual_evidence SET status='POSTED',reviewed_by=$3,"+
    "review_request_key=$4,review_digest=$5,journal_ref=$6,reviewed_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING_REVIEW'",
    [actor.realmId,e.id,actor.accountId,key,reviewDigest,j]);
   await tx.query("UPDATE donation SET source_status='RECEIVED_POSTED',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='REQUESTED'",
    [actor.realmId,d.id]);
   return {status:"RECEIVED_POSTED",voucher:e.voucher_reference,replayed:false};
  });
 }
}
