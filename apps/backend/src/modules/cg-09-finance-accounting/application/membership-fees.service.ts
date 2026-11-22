import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import {object,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
type Application={id:string;application_ref:string;version:number;status:string;accepted_fee_minor:string;branch_ref:string|null;submitted_digest:string|null};
type Collection={application_id:string;journal_id:string;request_key:string;request_digest:string;amount_minor:string;branch_id:string|null;bank_account_id:string;income_account_id:string;recorded_by:string};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const changed=()=>new ConflictException("The original membership fee or finance record changed. Refresh before continuing.");
const date=(v:unknown)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+"T00:00:00Z"))||new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw new BadRequestException("Choose a valid posting date.");return v;};
@Injectable()
export class MembershipFeesService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,private readonly owner:ProtectedAccessOwnerService,private readonly posting:FinanceJournalPostingService){}
 private async run<T>(token:string,work:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.requireAction(token,"finance.journals.post"),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,"finance.journals.post");const result=await work(tx,a);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03","P0901","P0902","P0903","P0904","P0001"].includes(String(e.code)))throw changed();throw e;}finally{tx.release();}
 }
 private async scope(tx:PoolClient,a:Actor,branch:string|null){if(branch===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");else await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.journals.post");}
 private async application(tx:PoolClient,a:Actor,id:string){
  const v=(await tx.query<Application>("SELECT id,application_ref,version,status,accepted_fee_minor::text,branch_ref,submitted_digest FROM membership_application WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,id])).rows[0];
  if(!v)throw new NotFoundException("Membership fee source unavailable.");await this.scope(tx,a,v.branch_ref);return v;
 }
 private async collection(tx:PoolClient,realm:string,id:string){return (await tx.query<Collection>("SELECT application_id,journal_id,request_key,request_digest,amount_minor::text,branch_id,bank_account_id,income_account_id,recorded_by FROM finance_membership_collection WHERE root_realm_id=$1 AND application_id=$2 FOR SHARE",[realm,id])).rows[0];}
 private async accountOptions(tx:PoolClient,a:Actor,branch:string|null,postingDate:string){
  const years=(await tx.query("SELECT id AS value,name AS label FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' AND $2::date BETWEEN start_on AND end_on ORDER BY start_on DESC,id LIMIT 20",[a.realmId,postingDate])).rows;
  const accounts=(await tx.query<{value:string;label:string;kind:string}>("SELECT f.id AS value,f.name AS label,CASE WHEN f.account_kind='BANK' THEN 'BANK' ELSE 'INCOME' END AS kind FROM finance_account f JOIN account_group g ON g.root_realm_id=f.root_realm_id AND g.id=f.group_id WHERE f.root_realm_id=$1 AND f.status='ACTIVE' AND (f.branch_id IS NULL OR f.branch_id=$2) AND (f.account_kind='BANK' OR f.account_kind='GENERAL' AND g.category='INCOME') ORDER BY f.name,f.id LIMIT 101",[a.realmId,branch])).rows;
  if(accounts.length>100)throw new ConflictException("More than 100 finance accounts match. Ask the finance administrator to review the account options.");
  return {years,banks:accounts.filter(x=>x.kind==="BANK"),incomeAccounts:accounts.filter(x=>x.kind==="INCOME")};
 }
 async options(token:string,ref:string,raw:unknown){const id=uuid(ref),x=object(raw,["postingDate"]),day=date(x.postingDate);return this.run(token,async(tx,a)=>{const app=await this.application(tx,a,id);return {...await this.accountOptions(tx,a,app.branch_ref,day),...await this.statusInTx(tx,a.realmId,id)};});}
 private async checkAccounts(tx:PoolClient,a:Actor,branch:string|null,bank:string,income:string,year:string,day:string){
  if(bank===income)throw changed();
  if(!(await tx.query("SELECT 1 FROM financial_year WHERE root_realm_id=$1 AND id=$2 AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",[a.realmId,year,day])).rowCount)throw new ConflictException("Select an open financial year containing the posting date.");
  const rows=(await tx.query<{id:string;account_kind:string;category:string}>("SELECT f.id,f.account_kind,g.category FROM finance_account f JOIN account_group g ON g.root_realm_id=f.root_realm_id AND g.id=f.group_id WHERE f.root_realm_id=$1 AND f.id=ANY($2::uuid[]) AND f.status='ACTIVE' AND (f.branch_id IS NULL OR f.branch_id=$3) FOR SHARE OF f,g",[a.realmId,[bank,income],branch])).rows;
  if(rows.length!==2||!rows.some(x=>x.id===bank&&x.account_kind==="BANK"&&x.category==="ASSET")||!rows.some(x=>x.id===income&&x.account_kind==="GENERAL"&&x.category==="INCOME"))throw new BadRequestException("Choose an active bank and membership income account in the permitted finance scope.");
 }
 async record(token:string,ref:string,raw:unknown){
  const id=uuid(ref),x=object(raw,["requestKey","bankAccountRef","incomeAccountRef","financialYearRef","postingDate"]),key=uuid(x.requestKey),bank=uuid(x.bankAccountRef),income=uuid(x.incomeAccountRef),year=uuid(x.financialYearRef),day=date(x.postingDate),requestDigest=digest(["MEMBERSHIP_FEE",id,bank,income,year,day]);
  return this.run(token,async(tx,a)=>{
   const app=await this.application(tx,a,id),prior=await this.collection(tx,a.realmId,id);
   if(prior){if(prior.request_key!==key||prior.request_digest!==requestDigest||prior.recorded_by!==a.accountId)throw new ConflictException("A membership fee is already recorded. Open the original fee and reconcile its bank statement.");return {...await this.statusInTx(tx,a.realmId,id),replayed:true};}
   if(app.status!=="SUBMITTED"||!app.submitted_digest||BigInt(app.accepted_fee_minor)<=0n)throw new ConflictException("An eligible submitted application with a payable membership fee is required.");
   const process=(await tx.query("SELECT 1 FROM cg03_case WHERE realm_id=$1 AND membership_application_id=$2 AND membership_application_version=$3 AND membership_review_digest=$4 AND case_kind='MEMBER_APPLICATION' AND status IN('SUBMITTED','PENDING_OWNER')",[a.realmId,id,app.version,app.submitted_digest])).rowCount;
   if(!process)throw changed();
   await this.checkAccounts(tx,a,app.branch_ref,bank,income,year,day);
   const j=await this.posting.postBalanced(tx,a,{financialYearRef:year,postingDate:day,sourceRef:id,eventKey:key,immutableDigest:digest([requestDigest,app.version,app.submitted_digest,app.accepted_fee_minor,app.branch_ref]),kind:"GENERAL",description:"Membership fee "+app.application_ref+" — awaiting bank verification",lines:[{accountRef:bank,branchRef:app.branch_ref,debitMinor:app.accepted_fee_minor,creditMinor:"0"},{accountRef:income,branchRef:app.branch_ref,debitMinor:"0",creditMinor:app.accepted_fee_minor}]});
   await tx.query("INSERT INTO finance_membership_collection(root_realm_id,application_id,submitted_version,submitted_digest,amount_minor,branch_id,bank_account_id,income_account_id,journal_id,request_key,request_digest,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",[a.realmId,id,app.version,app.submitted_digest,app.accepted_fee_minor,app.branch_ref,bank,income,j,key,requestDigest,a.accountId]);
   await tx.query("INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) VALUES($1,$2,'JOURNAL',$3,'MEMBERSHIP_FEE_POSTED',$4)",[a.realmId,a.accountId,j,key]);
   return {...await this.statusInTx(tx,a.realmId,id),replayed:false};
  });
 }
 /** Called only inside the original CG03 rejection or CG09 reconciliation
  * transaction. Serializes the exact application and creates no bank posting. */
 async requestRefundIfPaid(tx:PoolClient,a:Actor,app:string){
  await tx.query("SELECT id FROM membership_application WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,app]);
  await tx.query("INSERT INTO finance_membership_refund_request(root_realm_id,application_id,original_journal_id,original_reconciliation_id,amount_minor,requested_by) SELECT v.root_realm_id,v.application_id,v.journal_id,v.reconciliation_id,v.amount_minor,$3 FROM finance_membership_verified_collection v JOIN membership_application m ON m.root_realm_id=v.root_realm_id AND m.id=v.application_id WHERE v.root_realm_id=$1 AND v.application_id=$2 AND m.status='REJECTED' ON CONFLICT(root_realm_id,application_id) DO NOTHING",[a.realmId,app,a.accountId]);
 }
 async onReconciliationVerified(tx:PoolClient,a:Actor,reconciliationRef:string){
  const r=(await tx.query<{application_id:string}>("SELECT m.application_id FROM finance_membership_collection m JOIN finance_bank_reconciliation r ON r.root_realm_id=m.root_realm_id AND r.journal_id=m.journal_id AND r.bank_account_id=m.bank_account_id WHERE r.root_realm_id=$1 AND r.id=$2",[a.realmId,reconciliationRef])).rows[0];
  if(r)await this.requestRefundIfPaid(tx,a,r.application_id);
 }
 async approveRefund(token:string,ref:string,raw:unknown){
  const id=uuid(ref),x=object(raw,["requestKey","financialYearRef","postingDate","currentPassword"]),key=uuid(x.requestKey),year=uuid(x.financialYearRef),day=date(x.postingDate);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Enter your current password to confirm the original refund.");
  const password=x.currentPassword,requestDigest=digest(["MEMBERSHIP_REFUND",id,year,day]),actor=await this.sessions.requireAction(token,"finance.journals.post");await this.sessions.limitFoundationRootProof(actor);
  return this.run(token,async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);const app=await this.application(tx,a,id);
   if(app.status!=="REJECTED")throw changed();
   const collection=await this.collection(tx,a.realmId,id);if(!collection)throw changed();
   const request=(await tx.query<{amount_minor:string;requested_by:string}>("SELECT amount_minor::text,requested_by FROM finance_membership_refund_request WHERE root_realm_id=$1 AND application_id=$2 FOR SHARE",[a.realmId,id])).rows[0];
   if(!request||request.requested_by===a.accountId||collection.recorded_by===a.accountId)throw new ConflictException("A different protected Foundation reviewer must authorize the refund of the original verified fee.");
   const prior=(await tx.query<{request_key:string;request_digest:string;approved_by:string}>("SELECT request_key,request_digest,approved_by FROM finance_membership_refund_posting WHERE root_realm_id=$1 AND application_id=$2 FOR SHARE",[a.realmId,id])).rows[0];
   if(prior){if(prior.request_key!==key||prior.request_digest!==requestDigest||prior.approved_by!==a.accountId)throw changed();return {...await this.statusInTx(tx,a.realmId,id),replayed:true};}
   const collected=(await tx.query("SELECT 1 FROM finance_membership_verified_collection WHERE root_realm_id=$1 AND application_id=$2",[a.realmId,id])).rowCount;if(!collected)throw changed();
   await this.checkAccounts(tx,a,collection.branch_id,collection.bank_account_id,collection.income_account_id,year,day);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const j=await this.posting.postBalanced(tx,a,{financialYearRef:year,postingDate:day,sourceRef:id,eventKey:key,immutableDigest:digest([requestDigest,collection.journal_id,request.amount_minor]),kind:"REFUND",description:"Original rejected membership fee refund "+app.application_ref,lines:[{accountRef:collection.income_account_id,branchRef:collection.branch_id,debitMinor:request.amount_minor,creditMinor:"0"},{accountRef:collection.bank_account_id,branchRef:collection.branch_id,debitMinor:"0",creditMinor:request.amount_minor}]});
   await tx.query("INSERT INTO finance_membership_refund_posting(root_realm_id,application_id,journal_id,request_key,request_digest,approved_by,password_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())",[a.realmId,id,j,key,requestDigest,a.accountId]);
   await tx.query("INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) VALUES($1,$2,'JOURNAL',$3,'MEMBERSHIP_REFUND_POSTED',$4)",[a.realmId,a.accountId,j,key]);
   return {...await this.statusInTx(tx,a.realmId,id),replayed:false};
  });
 }
 async status(token:string,ref:string){const id=uuid(ref);return this.run(token,async(tx,a)=>{await this.application(tx,a,id);return this.statusInTx(tx,a.realmId,id);});}
 /** Original owner read: consumer must separately authorize its own source. */
 async statusInTx(tx:PoolClient,realm:string,id:string){
  const v=(await tx.query<{fee:string;appStatus:string;collection:boolean;verified:boolean;refundRequested:boolean;refundPosted:boolean;refunded:boolean}>("SELECT a.accepted_fee_minor::text AS fee,a.status AS \"appStatus\",m.application_id IS NOT NULL AS collection,v.application_id IS NOT NULL AS verified,r.application_id IS NOT NULL AS \"refundRequested\",p.application_id IS NOT NULL AS \"refundPosted\",f.application_id IS NOT NULL AS refunded FROM membership_application a LEFT JOIN finance_membership_collection m ON m.root_realm_id=a.root_realm_id AND m.application_id=a.id LEFT JOIN finance_membership_verified_collection v ON v.root_realm_id=a.root_realm_id AND v.application_id=a.id LEFT JOIN finance_membership_refund_request r ON r.root_realm_id=a.root_realm_id AND r.application_id=a.id LEFT JOIN finance_membership_refund_posting p ON p.root_realm_id=a.root_realm_id AND p.application_id=a.id LEFT JOIN finance_membership_verified_refund f ON f.root_realm_id=a.root_realm_id AND f.application_id=a.id WHERE a.root_realm_id=$1 AND a.id=$2",[realm,id])).rows[0];
  if(!v)throw changed();const state=v.fee==="0"?"NOT_DUE":v.refunded?"REFUNDED":v.refundPosted?"REFUND_AWAITING_BANK_VERIFICATION":v.refundRequested?"REFUND_PENDING":v.verified?"VERIFIED":v.collection?"AWAITING_BANK_VERIFICATION":"PENDING";
  return {feeMinor:v.fee,currency:"INR" as const,paymentStatus:state,verifiedMinor:v.verified&&!v.refunded?v.fee:"0",refundRequired:v.appStatus==="REJECTED"&&v.verified&&!v.refunded};
 }
}
