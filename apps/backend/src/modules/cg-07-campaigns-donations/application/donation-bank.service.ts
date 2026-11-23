import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {DonationBankCollectionFacade} from "../../cg-09-finance-accounting/application/donation-bank-collection.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenHash=(x:string)=>createHash("sha256").update(x).digest("hex");
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Donation={id:string;root_realm_id:string;branch_ref:string|null;donation_number:string;
 amount_minor:string;source_status:string};
type Row={id:string;donation_id:string;request_key:string;source_digest:string;
 recorded_by:string;source_status:string;reconciliation_id:string;method:string};
const input=(raw:unknown,fields:string[])=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).some(x=>!fields.includes(x)))
  throw new BadRequestException("Check the original offline donation details.");
 return raw as Record<string,unknown>;
};
const privateProof=(p:unknown)=>{
 if(typeof p!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(p))
  throw new NotFoundException("Original private donation proof unavailable.");
 return tokenHash(p);
};
const noDuplicate=()=>new ConflictException(
 "This donation already has a collection method pending verification. Check its original status before retrying.");
@Injectable()
export class DonationBankService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,
  private readonly finance:DonationBankCollectionFacade){}
 private async tx<T>(bearer:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"finance.reconciliation.manage");
  await this.sessions.requireAction(bearer,"documents.files.manage");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   for(const action of ["finance.journals.post","finance.reconciliation.manage","documents.files.manage"])
    await this.identity.assertCurrent(tx,a,action);
   const value=await fn(tx,a);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async original(tx:PoolClient,a:Actor,proof:string){
  const d=(await tx.query<Donation>(
   "SELECT id,root_realm_id,branch_ref,donation_number,amount_minor::text,source_status "+
   "FROM donation WHERE root_realm_id=$1 AND status_token_digest=$2 "+
   "AND status_token_expires_at>now() FOR UPDATE",[a.realmId,privateProof(proof)])).rows[0];
  if(!d)throw new NotFoundException("Original donor status proof is expired or unavailable.");
  if(d.branch_ref===null)
   await this.branches.requireFinanceRootScope(tx,a,"finance.reconciliation.manage");
  else
   await this.branches.requireFinanceActiveBranch(tx,a,d.branch_ref,"finance.reconciliation.manage");
  return d;
 }
 async options(bearer:string,raw:unknown){
  const v=input(raw,["statusToken"]);
  return this.tx(bearer,async(tx,a)=>{
   const d=await this.original(tx,a,String(v.statusToken??""));
   if(d.source_status!=="REQUESTED")throw noDuplicate();
   const pending=await tx.query(
    "SELECT 1 FROM donation_payment_attempt WHERE root_realm_id=$1 AND donation_id=$2 "+
    "AND status NOT IN('FAILED','EXPIRED') LIMIT 1",[a.realmId,d.id]);
   if(pending.rowCount)throw noDuplicate();
   return {donationNumber:d.donation_number,amountMinor:d.amount_minor,
    ...await this.finance.options(tx,a,d.branch_ref)};
  });
 }
 async prepare(bearer:string,raw:unknown){
  const v=input(raw,["statusToken","requestKey","method","bankAccountRef","suspenseAccountRef",
   "incomeAccountRef","financialYearRef","postingDate","bankItemReference"]);
  if(typeof v.statusToken!=="string"||typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
   !["BANK","CHEQUE","NEFT"].includes(String(v.method))||
   typeof v.bankAccountRef!=="string"||!UUID.test(v.bankAccountRef)||
   typeof v.suspenseAccountRef!=="string"||!UUID.test(v.suspenseAccountRef)||
   typeof v.incomeAccountRef!=="string"||!UUID.test(v.incomeAccountRef)||
   typeof v.financialYearRef!=="string"||!UUID.test(v.financialYearRef)||
   typeof v.postingDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v.postingDate)||
   typeof v.bankItemReference!=="string"||
   !/^[A-Za-z0-9._/: -]{4,100}$/.test(v.bankItemReference))
   throw new BadRequestException("Choose a bank, source reference, open year and account.");
  return this.tx(bearer,async(tx,a)=>{
   const d=await this.original(tx,a,String(v.statusToken));
   const form={
    donationRef:d.id,method:v.method as "BANK"|"CHEQUE"|"NEFT",amountMinor:d.amount_minor,
    bankAccountRef:String(v.bankAccountRef),suspenseAccountRef:String(v.suspenseAccountRef),
    incomeAccountRef:String(v.incomeAccountRef),yearRef:String(v.financialYearRef),
    postingDate:String(v.postingDate),bankItemRef:String(v.bankItemReference),
    requestKey:String(v.requestKey),branchRef:d.branch_ref
   };
   const digest=sha(["CG07_BANK_SUSPENSE",form.donationRef,form.amountMinor,form.bankAccountRef,
    form.suspenseAccountRef,form.incomeAccountRef,form.yearRef,form.postingDate,
    form.bankItemRef,form.method]);
   const existing=(await tx.query<Row>(
    "SELECT id,donation_id,request_key,source_digest,recorded_by,source_status,"+
    "reconciliation_id,method FROM donation_bank_collection WHERE root_realm_id=$1 "+
    "AND donation_id=$2 FOR SHARE",[a.realmId,d.id])).rows[0];
   if(existing){
    if(existing.recorded_by!==a.accountId||existing.request_key!==v.requestKey||
     existing.source_digest!==digest||existing.method!==v.method)throw noDuplicate();
    return {donationNumber:d.donation_number,status:existing.source_status,
     message:existing.source_status==="PENDING"?
      "Bank statement and independent Foundation finance review are pending. This is not confirmed money.":
      "The original bank donation has an existing verified finance decision.",replayed:true};
   }
   if(d.source_status!=="REQUESTED")throw noDuplicate();
   const other=await tx.query(
    "SELECT 1 FROM donation_payment_attempt WHERE root_realm_id=$1 AND donation_id=$2 "+
    "AND status NOT IN('FAILED','EXPIRED') LIMIT 1",[a.realmId,d.id]);
   if(other.rowCount)throw noDuplicate();
   const attempt=(await tx.query<{id:string}>(
    "INSERT INTO donation_payment_attempt(root_realm_id,donation_id,request_key,source_digest,"+
    "method,status) VALUES($1,$2,$3,$4,$5,'PAYMENT_PENDING') RETURNING id",
    [a.realmId,d.id,v.requestKey,digest,v.method])).rows[0];
   if(!attempt)throw new ConflictException("Original bank payment source could not be reserved.");
   const staged=await this.finance.stage(tx,a,form);
   await tx.query(
    "INSERT INTO donation_bank_collection(root_realm_id,donation_id,attempt_id,"+
    "reconciliation_id,initial_journal_id,method,bank_account_ref,suspense_account_ref,"+
    "income_account_ref,financial_year_ref,posting_date,bank_item_ref,amount_minor,"+
    "request_key,source_digest,recorded_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
    [a.realmId,d.id,attempt.id,staged.reconciliationRef,staged.initialJournalRef,
     v.method,v.bankAccountRef,v.suspenseAccountRef,v.incomeAccountRef,v.financialYearRef,
     v.postingDate,v.bankItemReference,d.amount_minor,v.requestKey,digest,a.accountId]);
   const updated=await tx.query(
    "UPDATE donation SET source_status='PAYMENT_PENDING',version=version+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND source_status='REQUESTED'",
    [a.realmId,d.id]);
   if(updated.rowCount!==1)throw noDuplicate();
   return {donationNumber:d.donation_number,status:"PENDING",
    message:"Provisional bank collection is held in suspense. Upload the original CG19 bank statement in Finance and obtain a different authorized reviewer. Not received donation income.",replayed:false};
  });
 }
}
