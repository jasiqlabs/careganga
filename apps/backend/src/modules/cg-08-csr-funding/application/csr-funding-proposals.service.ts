import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceCsrReceiptSourceFacade,type ApprovedFundingSource,type CsrParty} from "../../cg-09-finance-accounting/application/finance-csr-receipt-source.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {assertCsrFundingProject,csrFundingProjectOptions} from "../../cg-05-projects-field-operations/application/project-finance-source";
import {CsrPartnersService,csrDigest} from "./csr-partners.service";
import {parseFundingProposal} from "../domain/funding-proposal-input";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ref=(x:unknown):string=>{
 if(typeof x!=="string"||!UUID.test(x))
  throw new BadRequestException("Choose a current funding proposal or request.");
 return x.toLowerCase();
};
const changed=()=>new ConflictException("The original funding proposal changed. Refresh and try again.");
const missing=()=>new NotFoundException("The funding proposal is unavailable in your permitted branch.");
type ProposalRow={id:string;branch_ref:string|null;csr_partner_id:string|null;project_ref:string|null;project_source_version:number|null;status:string;version:number};
const projection='f.id AS ref,f.branch_ref AS "branchRef",b.name AS branch,'+
 'f.csr_partner_id AS "partnerRef",p.legal_name AS "partnerName",'+
 'f.project_ref AS "projectRef",f.project_source_version AS "projectVersion",'+
 'pr.code_norm||\' · \'||pr.title AS "projectName",f.purpose,'+
 'f.fund_type AS "fundType",f.currency,f.requested_minor::text AS "amountMinor",'+
 'f.csr_share_bps AS "csrShareBps",f.foundation_share_bps AS "foundationShareBps",'+
 'f.csr_requested_minor::text AS "csrRequestedMinor",'+
 'f.foundation_requested_minor::text AS "foundationRequestedMinor",'+
 'f.proposed_from::text AS "proposedFrom",f.proposed_until::text AS "proposedUntil",'+
 'f.agreement_summary AS "agreementSummary",f.status,f.version,f.updated_at AS "updatedAt"';
const joins=" FROM csr_funding_proposal f "+
 "LEFT JOIN branch b ON b.id=f.branch_ref AND b.root_realm_id=f.root_realm_id "+
 "LEFT JOIN csr_partner p ON p.id=f.csr_partner_id AND p.root_realm_id=f.root_realm_id "+
 "LEFT JOIN project pr ON pr.id=f.project_ref AND pr.root_realm_id=f.root_realm_id";

@Injectable()
export class CsrFundingProposalsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly partners:CsrPartnersService,
  private readonly receipts:FinanceCsrReceiptSourceFacade){}
 private async run<T>(bearer:string,action:string,
  fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>,read=false):Promise<T>{
  const a=await this.sessions.requireAction(bearer,action),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,a,action);
   const result=await fn(tx,a);
   await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
    ["23505","23503","23514","40001","40P01","55P03","P0001","P3409","P3410","P0924"].includes(String(e.code)))
    throw changed();
   throw e;
  }finally{tx.release();}
 }
 private async canSeeProjects(tx:PoolClient,a:VerifiedFoundationActor){
  try{await this.identity.assertCurrent(tx,a,"projects.view");return true;}
  catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async sourceScope(tx:PoolClient,a:VerifiedFoundationActor,v:ReturnType<typeof parseFundingProposal>){
  await this.branches.projectBranch(tx,a,v.branchRef);
  if(v.partnerRef!==null){
   await this.identity.assertCurrent(tx,a,"csr.partners.view");
   const p=await this.partners.guardAgreement(tx,a,v.partnerRef,null,false);
   if(p.status!=="APPROVED"||p.branch_ref!==null&&p.branch_ref!==v.branchRef)
    throw new ConflictException("The CSR sponsor is not approved for this Foundation branch.");
  }
  if(v.projectRef!==null){
   await this.identity.assertCurrent(tx,a,"projects.view");
   await assertCsrFundingProject(tx,a,v.projectRef,v.branchRef,v.projectVersion!);
  }
 }
 private async original(tx:PoolClient,a:VerifiedFoundationActor,id:string,update=false){
  const p=(await tx.query<ProposalRow>(
   "SELECT id,branch_ref,csr_partner_id,project_ref,project_source_version,status,version FROM csr_funding_proposal "+
   "WHERE root_realm_id=$1 AND id=$2 "+(update?"FOR UPDATE":"FOR SHARE"),
   [a.realmId,ref(id)])).rows[0];
  if(!p)throw missing();
  await this.branches.projectBranch(tx,a,p.branch_ref);
  return p;
 }
 /** CG19 current-source authority for a proposal-specific, private funding file.
  * The source, approval and finance modules remain the only respective masters.
  * Call within CG19's short transaction; never around a storage-provider await. */
 async guardFundingAgreement(tx:PoolClient,a:VerifiedFoundationActor,
  proposalRef:string,sourceVersion:number|null,write:boolean){
  await this.identity.assertCurrent(tx,a,write?"csr.partners.manage":"csr.partners.view");
  const p=await this.original(tx,a,ref(proposalRef),write);
  if(sourceVersion!==null&&p.version!==sourceVersion)throw changed();
  if(write&&p.status!=="DRAFT")throw changed();
  if(p.csr_partner_id!==null){
   const sponsor=await this.partners.guardAgreement(tx,a,p.csr_partner_id,null,false);
   if(sponsor.status!=="APPROVED"||
    sponsor.branch_ref!==null&&sponsor.branch_ref!==p.branch_ref)
    throw changed();
  }
  // A project-linked agreement may disclose protected project facts.
  // The original CG05 read grant is required even to retrieve the file.
  if(p.project_ref!==null){
   await this.identity.assertCurrent(tx,a,"projects.view");
   if(write)await assertCsrFundingProject(tx,a,p.project_ref,p.branch_ref,p.project_source_version!);
  }
  return {ref:p.id,version:p.version,status:p.status};
 }
 /** CG03 submits this one original proposal version and frozen exact amounts.
  * A scanned file is not independently verified signature or cash receipt. */
 async freezeForFundingReview(tx:PoolClient,a:VerifiedFoundationActor,
  proposalRef:string,sourceVersion:number,evidenceFileRef:string){
  const guarded=await this.guardFundingAgreement(tx,a,proposalRef,sourceVersion,true);
  if(guarded.status!=="DRAFT")throw changed();
  const row=(await tx.query<{
   branch_ref:string|null;csr_partner_id:string|null;project_ref:string|null;
   project_source_version:number|null;purpose:string;fund_type:string;currency:string;
   requested_minor:string;csr_share_bps:number;foundation_share_bps:number;
   csr_requested_minor:string;foundation_requested_minor:string;
   proposed_from:string|null;proposed_until:string|null;agreement_summary:string;
  }>("SELECT branch_ref,csr_partner_id,project_ref,project_source_version,purpose,"+
   "fund_type,currency,requested_minor::text,csr_share_bps,foundation_share_bps,"+
   "csr_requested_minor::text,foundation_requested_minor::text,"+
   "proposed_from::text,proposed_until::text,agreement_summary "+
   "FROM csr_funding_proposal WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
   [a.realmId,guarded.ref])).rows[0];
  if(!row||row.currency!=="INR")throw changed();
  const snapshot={
   proposalRef:guarded.ref,branchRef:row.branch_ref,partnerRef:row.csr_partner_id,
   projectRef:row.project_ref,projectVersion:row.project_source_version,
   purpose:row.purpose,fundType:row.fund_type,currency:row.currency,
   amountMinor:row.requested_minor,csrShareBps:row.csr_share_bps,
   foundationShareBps:row.foundation_share_bps,csrRequestedMinor:row.csr_requested_minor,
   foundationRequestedMinor:row.foundation_requested_minor,
   proposedFrom:row.proposed_from,proposedUntil:row.proposed_until,
   agreementSummary:row.agreement_summary,evidenceFileRef};
  const sourceDigest=csrDigest(["CG08_FUNDING_REVIEW_SOURCE_V1",snapshot]);
  const written=await tx.query(
   "UPDATE csr_funding_proposal SET status='SUBMITTED',version=version+1,"+
   "updated_by=$3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
   "AND version=$4 AND status='DRAFT' RETURNING id",
   [a.realmId,guarded.ref,a.accountId,sourceVersion]);
  if(!written.rowCount)throw changed();
  return {sourceVersion,sourceDigest,snapshot,
   title:row.purpose.slice(0,160)};
 }
 /** The independent, protected CG03 reviewer reads the same original source;
  * it cannot invent commitment totals or bypass the CG02 scope. */
 async fundingReviewSource(tx:PoolClient,a:VerifiedFoundationActor,proposalRef:string){
  await this.identity.assertCurrent(tx,a,"csr.partners.review");
  // Only original CG03's protected-root reviewer (or the CG19 adapter invoked
  // from that reviewer) may use this historical-source path. Branch closure
  // must not prevent an independent RETURN/REJECT or historical inspection.
  // Other staff endpoints continue to enforce CG02 active-branch permissions.
  const p=(await tx.query<ProposalRow>(
   "SELECT id,branch_ref,csr_partner_id,project_ref,project_source_version,"+
   "status,version FROM csr_funding_proposal WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [a.realmId,ref(proposalRef)])).rows[0];
  if(!p)throw missing();
  const row=(await tx.query<{
   branch_ref:string|null;csr_partner_id:string|null;project_ref:string|null;
   project_source_version:number|null;purpose:string;fund_type:string;currency:string;
   requested_minor:string;csr_share_bps:number;foundation_share_bps:number;
   csr_requested_minor:string;foundation_requested_minor:string;
   proposed_from:string|null;proposed_until:string|null;agreement_summary:string;
  }>("SELECT branch_ref,csr_partner_id,project_ref,project_source_version,purpose,"+
   "fund_type,currency,requested_minor::text,csr_share_bps,foundation_share_bps,"+
   "csr_requested_minor::text,foundation_requested_minor::text,"+
   "proposed_from::text,proposed_until::text,agreement_summary "+
   "FROM csr_funding_proposal WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,p.id])).rows[0];
  if(!row)throw changed();
  return {ref:p.id,status:p.status,version:p.version,branchRef:row.branch_ref,
   partnerRef:row.csr_partner_id,projectRef:row.project_ref,
   projectVersion:row.project_source_version,purpose:row.purpose,
   fundType:row.fund_type,currency:row.currency,amountMinor:row.requested_minor,
   csrShareBps:row.csr_share_bps,foundationShareBps:row.foundation_share_bps,
   csrRequestedMinor:row.csr_requested_minor,
   foundationRequestedMinor:row.foundation_requested_minor,
   proposedFrom:row.proposed_from,proposedUntil:row.proposed_until,
   agreementSummary:row.agreement_summary};
 }
 /** Only called by original CG03 after a password-verified immutable decision.
  * DB deferred proof enforces exact case+reviewer+document provenance at COMMIT. */
 async acceptFundingReviewEffect(tx:PoolClient,realm:string,proposalRef:string,
  sourceVersion:number,action:"APPROVE"|"RETURN"|"REJECT",reviewer:string){
  const id=ref(proposalRef);
  const row=(await tx.query<ProposalRow>(
   "SELECT id,branch_ref,csr_partner_id,project_ref,project_source_version,"+
   "status,version FROM csr_funding_proposal WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
   [realm,id])).rows[0];
  if(!row||row.status!=="SUBMITTED"||row.version!==sourceVersion+1)throw changed();
  const status=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED";
  const done=await tx.query(
   "UPDATE csr_funding_proposal SET status=$3,version=version+1,updated_by=$4,"+
   "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$5 "+
   "AND status='SUBMITTED' RETURNING version",
   [realm,id,status,reviewer,row.version]);
  if(!done.rowCount)throw changed();
  return {status,version:row.version+1};
 }
 private async replay(tx:PoolClient,a:VerifiedFoundationActor,key:string,digest:string,
  action:"CREATE"|"EDIT"|"RESUME",target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["CG08_FUNDING:"+a.realmId+":"+key]);
  const q=(await tx.query<{actor_ref:string;proposal_id:string;action:string;
   payload_digest:string;result_version:number}>(
    "SELECT actor_ref,proposal_id,action,payload_digest,result_version "+
    "FROM csr_funding_command WHERE root_realm_id=$1 AND request_key=$2",
    [a.realmId,key])).rows[0];
  if(!q)return null;
  if(q.actor_ref!==a.accountId||q.action!==action||
   q.payload_digest!==digest||target&&q.proposal_id!==target)throw changed();
  await this.original(tx,a,q.proposal_id);
  return {ref:q.proposal_id,version:q.result_version,status:"DRAFT",replayed:true};
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,id:string,key:string,
  digest:string,action:"CREATE"|"EDIT"|"RESUME",revision:number){
  await tx.query(
   "INSERT INTO csr_funding_command(root_realm_id,request_key,proposal_id,actor_ref,"+
   "action,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
   [a.realmId,key,id,a.accountId,action,digest,revision]);
  return {ref:id,version:revision,status:"DRAFT",replayed:false};
 }
 async create(bearer:string,raw:unknown){
  const v=parseFundingProposal(raw);
  if(v.expectedVersion!==null)throw new BadRequestException("Create a new funding draft.");
  const digest=csrDigest(["CG08_FUNDING_CREATE",v]);
  return this.run(bearer,"csr.partners.manage",async(tx,a)=>{
   const previous=await this.replay(tx,a,v.requestKey,digest,"CREATE");
   if(previous)return previous;
   await this.sourceScope(tx,a,v);
   const result=(await tx.query<{id:string;version:number}>(
    "INSERT INTO csr_funding_proposal(root_realm_id,branch_ref,csr_partner_id,"+
    "project_ref,project_source_version,purpose,fund_type,requested_minor,csr_share_bps,"+
    "foundation_share_bps,proposed_from,proposed_until,agreement_summary,created_by,updated_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id,version",
    [a.realmId,v.branchRef,v.partnerRef,v.projectRef,v.projectVersion,v.purpose,
     v.fundType,v.amountMinor,v.csrShareBps,v.foundationShareBps,
     v.proposedFrom,v.proposedUntil,v.agreementSummary,a.accountId])).rows[0];
   return this.event(tx,a,result.id,v.requestKey,digest,"CREATE",result.version);
  });
 }
 async edit(bearer:string,proposalRef:string,raw:unknown){
  const id=ref(proposalRef),v=parseFundingProposal(raw);
  if(v.expectedVersion===null)throw new BadRequestException("Refresh this funding proposal.");
  const digest=csrDigest(["CG08_FUNDING_EDIT",id,v]);
  return this.run(bearer,"csr.partners.manage",async(tx,a)=>{
   const previous=await this.replay(tx,a,v.requestKey,digest,"EDIT",id);
   if(previous)return previous;
   const current=await this.original(tx,a,id,true);
   if(current.status!=="DRAFT"||current.version!==v.expectedVersion||
    current.branch_ref!==v.branchRef||current.csr_partner_id!==v.partnerRef)throw changed();
   await this.sourceScope(tx,a,v);
   const updated=(await tx.query<{version:number}>(
    "UPDATE csr_funding_proposal SET project_ref=$3,project_source_version=$4,"+
    "purpose=$5,fund_type=$6,requested_minor=$7,csr_share_bps=$8,"+
    "foundation_share_bps=$9,proposed_from=$10,proposed_until=$11,"+
    "agreement_summary=$12,updated_by=$13,updated_at=now(),version=version+1 "+
    "WHERE root_realm_id=$1 AND id=$2 AND version=$14 AND status='DRAFT' "+
    "RETURNING version",
    [a.realmId,id,v.projectRef,v.projectVersion,v.purpose,v.fundType,v.amountMinor,
     v.csrShareBps,v.foundationShareBps,v.proposedFrom,v.proposedUntil,
     v.agreementSummary,a.accountId,v.expectedVersion])).rows[0];
   if(!updated)throw changed();
   return this.event(tx,a,id,v.requestKey,digest,"EDIT",updated.version);
  });
 }
 /** Explicit correction of a RETURNED review: no edit to historical terms,
  * no reuse of the previous signed file, and never reopen an APPROVED pledge.
  * The existing CG08 immutable command ledger protects unknown results. */
 async resumeReturned(bearer:string,proposalRef:string,raw:unknown){
  const id=ref(proposalRef);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException("Refresh the returned funding proposal.");
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","expectedVersion"].includes(k)))
   throw new BadRequestException("Use the original funding correction form.");
  const key=ref(v.requestKey),expected=v.expectedVersion;
  if(typeof expected!=="number"||!Number.isSafeInteger(expected)||
   expected<1||expected>=2147483646)
   throw new BadRequestException("Refresh the original source revision.");
  const hash=csrDigest(["CG08_FUNDING_RESUME",id,expected]);
  return this.run(bearer,"csr.partners.manage",async(tx,a)=>{
   const prior=await this.replay(tx,a,key,hash,"RESUME",id);
   if(prior)return prior;
   const row=await this.original(tx,a,id,true);
   if(row.status!=="RETURNED"||row.version!==expected)throw changed();
   const updated=(await tx.query<{version:number}>(
    "UPDATE csr_funding_proposal SET status='DRAFT',version=version+1,"+
    "updated_by=$3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND status='RETURNED' AND version=$4 RETURNING version",
    [a.realmId,id,a.accountId,expected])).rows[0];
   if(!updated)throw changed();
   return this.event(tx,a,id,key,hash,"RESUME",updated.version);
  });
 }

 /** Original funding approval is a promise only. CG09 owns all real money. */
 private async approvedFinanceSource(tx:PoolClient,a:VerifiedFoundationActor,
  id:string,write=false,correctionOnly=false):Promise<ApprovedFundingSource>{
  await this.identity.assertCurrent(tx,a,write?"csr.partners.manage":"csr.partners.view");
  const current=await this.original(tx,a,ref(id),write);
  if(current.status!=="APPROVED")throw changed();
  if(current.csr_partner_id!==null){
   const sponsor=await this.partners.guardAgreement(tx,a,current.csr_partner_id,null,false);
   if(sponsor.status!=="APPROVED"||
    sponsor.branch_ref!==null&&sponsor.branch_ref!==current.branch_ref)throw changed();
  }
  // A historical unspent allocation may be corrected after the linked
  // CG05 project closes. New receipt/allocation/utilization still need live CG05.
  if(current.project_ref!==null&&!correctionOnly){
   await this.identity.assertCurrent(tx,a,"projects.view");
   await assertCsrFundingProject(tx,a,current.project_ref,
    current.branch_ref,current.project_source_version!);
  }
  const value=(await tx.query<{csr_requested_minor:string;foundation_requested_minor:string}>(
   "SELECT csr_requested_minor::text,foundation_requested_minor::text "+
   "FROM csr_funding_proposal WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,current.id])).rows[0];
  if(!value)throw changed();
  return {proposalRef:current.id,sourceVersion:current.version,
   branchRef:current.branch_ref,projectRef:current.project_ref,csrMinor:value.csr_requested_minor,
   foundationMinor:value.foundation_requested_minor,status:"APPROVED"};
 }
 async verifiedFinance(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef,false,true);
   const amounts=await this.receipts.currentReceived(tx,a,source);
   const movements=await this.receipts.currentBudgetEffects(tx,a,source);
   const received=BigInt(amounts.csrReceivedMinor)+BigInt(amounts.foundationReceivedMinor);
   const allocated=BigInt(movements.allocatedMinor);
   return {proposalStatus:source.status,sourceVersion:source.sourceVersion,
    csrCommittedMinor:source.csrMinor,foundationCommittedMinor:source.foundationMinor,
    ...amounts,...movements,
    availableMinor:allocated<=received?(received-allocated).toString():null,
    needsFinanceRevalidation:allocated>received,
    notice:"Only verified bank receipts support CG09-approved allocation. Utilization requires a posted expense."};
  },true);
 }
 async eligibleVerifiedReceipts(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef);
   return this.receipts.eligibleReceipts(tx,a,source);
  },true);
 }
 async linkVerifiedReceipt(bearer:string,proposalRef:string,raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException("Select one original CG09 verified bank receipt.");
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(x=>!["requestKey","expectedVersion","partyKind","reconciliationRef","remitterConfirmed"].includes(x))||
   typeof v.expectedVersion!=="number"||!Number.isSafeInteger(v.expectedVersion)||
   v.expectedVersion<1||v.expectedVersion>=2147483647||
   !["CSR","FOUNDATION"].includes(String(v.partyKind))||v.remitterConfirmed!==true)
   throw new BadRequestException("Refresh the approved funding source and bank match.");
  return this.run(bearer,"csr.partners.manage",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef,true);
   if(source.sourceVersion!==v.expectedVersion)throw changed();
   return this.receipts.linkReceipt(tx,a,source,{
    partyKind:v.partyKind as CsrParty,requestKey:ref(v.requestKey),
    reconciliationRef:ref(v.reconciliationRef),remitterConfirmed:true});
  });
 }
 /** Real original CG09 approved budget selectors; no new category master. */
 async eligibleFinanceBudgets(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef,false,true);
   return this.receipts.eligibleBudgets(tx,a,source);
  },true);
 }
 async eligibleFinanceAllocations(bearer:string,proposalRef:string,
  budgetRef:string,partyKind:CsrParty){
  if(!["CSR","FOUNDATION"].includes(partyKind))
   throw new BadRequestException("Choose an approved funding party.");
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef,false,true);
   return this.receipts.eligibleBudgetAllocations(tx,a,source,ref(budgetRef),partyKind);
  },true);
 }
 async eligibleFinanceExpenses(bearer:string,proposalRef:string,budgetRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef);
   return this.receipts.eligibleBudgetExpenses(tx,a,source,ref(budgetRef));
  },true);
 }
 async applyFinanceBudgetEffect(bearer:string,proposalRef:string,raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException("Select the original approved budget effect.");
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","expectedVersion","budgetRef","partyKind",
   "kind","amountMinor","journalRef","correctionOfEventRef"].includes(k))||
   !Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<1||
   !["CSR","FOUNDATION"].includes(String(v.partyKind))||
   !["ALLOCATE","UTILIZE","DEALLOCATE"].includes(String(v.kind))||
   typeof v.amountMinor!=="string"||!/^[1-9][0-9]{0,13}$/.test(v.amountMinor))
   throw new BadRequestException("The approved budget or amount is invalid.");
  const journal=v.journalRef===null||v.journalRef===undefined?null:ref(v.journalRef);
  const correction=v.correctionOfEventRef===null||v.correctionOfEventRef===undefined?
   null:ref(v.correctionOfEventRef);
  if((v.kind==="UTILIZE"&&!journal)||(v.kind!=="UTILIZE"&&journal)||
   (v.kind==="DEALLOCATE"&&!correction)||(v.kind!=="DEALLOCATE"&&correction))
   throw new BadRequestException("Choose an original unspent allocation or posted expense.");
  return this.run(bearer,"csr.partners.manage",async(tx,a)=>{
   const source=await this.approvedFinanceSource(tx,a,proposalRef,true,
    v.kind==="DEALLOCATE");
   if(source.sourceVersion!==v.expectedVersion)throw changed();
   return this.receipts.recordBudgetEffect(tx,a,source,{
    requestKey:ref(v.requestKey),budgetRef:ref(v.budgetRef),
    kind:v.kind as "ALLOCATE"|"UTILIZE"|"DEALLOCATE",
    partyKind:v.partyKind as CsrParty,amountMinor:v.amountMinor as string,
    journalRef:journal,correctionOfEventRef:correction});
  });
 }
 /** Original CG05 owner, project geography and scope for B08.
  * No fabricated team/beneficiary/quantity master. */
 async fundingProjectContext(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const p=await this.original(tx,a,ref(proposalRef));
   if(!p.project_ref)return {kind:"GENERAL_FOUNDATION",project:null,
    note:"This funding purpose is not linked to a CG05 project."};
   await this.identity.assertCurrent(tx,a,"projects.view");
   const rows=await tx.query<{title:string;category:string;summary:string;
    description:string;location:string;owner:string;manager:string|null;
    branch:string|null;status:string}>(
    "SELECT p.title,p.category,p.summary,p.description,p.location_label AS location,"+
    "owner.display_name AS owner,manager.display_name AS manager,"+
    "branch.name AS branch,p.status FROM project p "+
    "JOIN account owner ON owner.id=p.owner_account_ref AND owner.realm_id=p.root_realm_id "+
    "LEFT JOIN branch ON branch.id=p.branch_ref AND branch.root_realm_id=p.root_realm_id "+
    "LEFT JOIN account manager ON manager.id=branch.manager_account_ref "+
    "AND manager.realm_id=branch.root_realm_id "+
    "WHERE p.root_realm_id=$1 AND p.id=$2 "+
    "AND p.branch_ref IS NOT DISTINCT FROM $3::uuid AND p.version=$4 "+
    "FOR SHARE OF p,owner",
    [a.realmId,p.project_ref,p.branch_ref,p.project_source_version]);
   if(!rows.rows[0])throw changed();
   let assigned:{name:string;kind:string}[]=[];
   let teamStatus:"SOURCE"|"RESTRICTED"="SOURCE";
   try{
    await this.identity.assertCurrent(tx,a,"projects.tasks.view");
    const members=await tx.query<{name:string;kind:string}>(
     "SELECT DISTINCT account.display_name AS name, "+
     "CASE WHEN task.assignee_volunteer_ref IS NOT NULL THEN 'VOLUNTEER' "+
     "ELSE task.assignee_kind END AS kind "+
     "FROM project_task task JOIN account ON account.id=task.assignee_account_ref "+
     "AND account.realm_id=task.root_realm_id AND account.status='ACTIVE' "+
     "WHERE task.root_realm_id=$1 AND task.project_id=$2 "+
     "AND task.assignee_account_ref IS NOT NULL "+
     "AND task.status IN('ASSIGNED','IN_PROGRESS') "+
     "ORDER BY name,kind LIMIT 26",
     [a.realmId,p.project_ref]);
    assigned=members.rows.slice(0,25);
   }catch(e){if(e instanceof ForbiddenException)teamStatus="RESTRICTED";else throw e;}
   return {kind:"PROJECT",project:rows.rows[0],teamStatus,assigned,
    note:teamStatus==="RESTRICTED"?
     "Project tasks are restricted for your current role.":
     "Current CG05 task assignments only; the original CG05 Tasks module owns changes."};
  },true);
 }
 /** Original B08 selectors from CG01/CG02/CG05/CG08 current sources only. */
 async options(bearer:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   const partners=await tx.query<{value:string;label:string;branchRef:string|null}>(
    'SELECT p.id AS value,p.legal_name AS label,p.branch_ref AS "branchRef" '+
    "FROM csr_partner p WHERE p.root_realm_id=$1 AND p.status='APPROVED' "+
    "AND ($2::boolean OR p.branch_ref=ANY($3::uuid[])) "+
    "ORDER BY p.legal_name,p.id LIMIT 101",
    [a.realmId,scope.all,scope.branches.map(x=>x.value)]);
   if(partners.rows.length>100)
    throw new ConflictException("Narrow the authorized CSR partner catalogue.");
   const projects=await this.canSeeProjects(tx,a)?
    await csrFundingProjectOptions(tx,a.realmId,scope):[];
   return {foundation:scope.all,branches:scope.branches.map(x=>({value:x.value,label:x.label})),
    partners:partners.rows,projects};
  },true);
 }
 async detail(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const id=ref(proposalRef);
   await this.original(tx,a,id);
   const row=(await tx.query("SELECT "+projection+joins+
    " WHERE f.root_realm_id=$1 AND f.id=$2",[a.realmId,id])).rows[0];
   if(!row)throw missing();
   return await this.canSeeProjects(tx,a)?row:{...row,
    projectRef:null,projectVersion:null,projectName:null};
  },true);
 }
 async list(bearer:string,raw:Record<string,unknown>){
  const allow=["branchRef","status","q","offset"];
  if(Object.keys(raw).some(k=>!allow.includes(k)))
   throw new BadRequestException("This funding filter is unavailable.");
  const status=raw.status===undefined?null:raw.status;
  if(status!==null&&typeof status!=="string"||
   status!==null&&!["DRAFT","SUBMITTED","RETURNED","APPROVED","REJECTED","CANCELLED"].includes(status as string))
   throw new BadRequestException("Choose an existing funding status.");
  const q=typeof raw.q==="string"&&raw.q.length<=80?raw.q.trim().toLowerCase():
   raw.q===undefined?"":null;
  if(q===null)throw new BadRequestException("Check the proposal search.");
  const offset=raw.offset===undefined?0:Number(raw.offset);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)
   throw new BadRequestException("Narrow your proposal results.");
  const branch=raw.branchRef===undefined?undefined:
   raw.branchRef==="FOUNDATION"?null:ref(raw.branchRef);
  let financeScope:{all:boolean;branchRefs:string[]}|null=null;
  try{financeScope=await this.branches.financeReportScope(bearer,"finance.reports.view");}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   if(branch===null&&!scope.all)
    throw new ForbiddenException("Foundation-wide funding is restricted.");
   if(branch&&!(scope.all||scope.branches.some(x=>x.value===branch)))
    throw new ForbiddenException("This funding branch is not assigned.");
   const rows=await tx.query(
    "SELECT "+projection+joins+
    " WHERE f.root_realm_id=$1 AND ($2::boolean OR f.branch_ref=ANY($3::uuid[])) "+
    "AND ($4::boolean OR f.branch_ref IS NOT DISTINCT FROM $5::uuid) "+
    "AND ($6='' OR strpos(lower(f.purpose),$6)>0) "+
    "AND ($7::text IS NULL OR f.status=$7) "+
    "ORDER BY f.updated_at DESC,f.id DESC LIMIT 26 OFFSET $8",
    [a.realmId,scope.all,scope.branches.map(x=>x.value),branch===undefined,
     branch??null,q,status,offset]);
   // CG08 requested-only summary is separate from original CG09's
   // finance-authorized committed and verified-received projection below.
   // Both retain CG02 root/branch/search scope independent of page size;
   // neither infers any allocation or utilization before CG09 budget proof.
   const sum=await tx.query<{requests:string;drafts:string;requestedMinor:string}>(
    "SELECT count(*)::text AS requests,"+
    "count(*) FILTER (WHERE f.status='DRAFT')::text AS drafts,"+
    "coalesce(sum(f.requested_minor),0)::text AS \"requestedMinor\" "+
    "FROM csr_funding_proposal f WHERE f.root_realm_id=$1 "+
    "AND ($2::boolean OR f.branch_ref=ANY($3::uuid[])) "+
    "AND ($4::boolean OR f.branch_ref IS NOT DISTINCT FROM $5::uuid) "+
    "AND ($6='' OR strpos(lower(f.purpose),$6)>0)",
    [a.realmId,scope.all,scope.branches.map(x=>x.value),branch===undefined,
     branch??null,q]);
   const totals=sum.rows[0];
   const summary={requests:Number(totals?.requests??0),
    drafts:Number(totals?.drafts??0),requestedMinor:totals?.requestedMinor??"0"};
   const permittedProjects=await this.canSeeProjects(tx,a);
   const records=rows.rows.slice(0,25) as Record<string,unknown>[];
   let verifiedFinance:null|Awaited<ReturnType<FinanceCsrReceiptSourceFacade["dashboardSummary"]>>=null;
   if(financeScope){
    const csrBranches=scope.branches.map(x=>x.value);
    const all=scope.all&&financeScope.all;
    const branchRefs=all?[]:financeScope.all?csrBranches:
     scope.all?financeScope.branchRefs:
      csrBranches.filter(x=>financeScope!.branchRefs.includes(x));
    try{verifiedFinance=await this.receipts.dashboardSummary(tx,a,{
     all,branchRefs,branchFilter:branch,query:q});
    }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   }
   return {items:permittedProjects?records:records.map(v=>({...v,
    projectRef:null,projectVersion:null,projectName:null})),
    hasMore:rows.rows.length>25,summary:{...summary,verifiedFinance}};
  },true);
 }
}
