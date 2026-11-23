import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
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
  private readonly partners:CsrPartnersService){}
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
    ["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))
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
  if(write&&p.status!=="DRAFT"&&p.status!=="RETURNED")throw changed();
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
  const p=await this.original(tx,a,proposalRef);
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
  action:"CREATE"|"EDIT",target?:string){
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
  digest:string,action:"CREATE"|"EDIT",revision:number){
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
   // Original B07 requested-only summary. Same CG02 root/branch/search scope
   // as the source rows, independent of page size and selected status tab.
   // Does NOT compute committed, bank-received, allocated or utilized cash.
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
   return {items:permittedProjects?records:records.map(v=>({...v,
    projectRef:null,projectVersion:null,projectName:null})),
    hasMore:rows.rows.length>25,summary};
  },true);
 }
}
