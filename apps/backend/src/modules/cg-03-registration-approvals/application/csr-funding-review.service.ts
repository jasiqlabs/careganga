import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {CsrFundingProposalsService} from "../../cg-08-csr-funding/application/csr-funding-proposals.service";
import {csrDigest} from "../../cg-08-csr-funding/application/csr-partners.service";
import {CsrFundingAgreementEvidenceService} from "../../cg-19-documents-notifications/application/csr-funding-agreement-evidence.service";

type Case={id:string;realm_id:string;case_number:string;process_id:string;
 proposer_id:string;status:string;revision:number;case_kind:string;
 csr_funding_review_ref:string;csr_funding_proposal_id:string;
 csr_funding_source_version:number;csr_funding_source_digest:string;
 request_digest:string};
type Snapshot={id:string;proposal_id:string;source_version:number;
 source_digest:string;evidence_file_id:string;submitted_by:string;
 source_snapshot:Record<string,unknown>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const stale=()=>new ConflictException({
 code:"CG08_FUNDING_REVIEW_CHANGED",
 message:"The original funding approval or signed agreement changed. Refresh."});
const missing=()=>new NotFoundException("Funding approval unavailable in your Foundation.");
function uuid(x:unknown):string{
 if(typeof x!=="string"||!UUID.test(x))
  throw new BadRequestException("Choose a current funding proposal, file or request.");
 return x.toLowerCase();
}
function revision(x:unknown):number{
 if(typeof x!=="number"||!Number.isSafeInteger(x)||x<1||x>2147483645)
  throw new BadRequestException("Refresh the current funding review revision.");
 return x;
}
function data(x:unknown,allow:string[]){
 if(!x||typeof x!=="object"||Array.isArray(x)||
  Object.keys(x).some(k=>!allow.includes(k)))
  throw new BadRequestException("Check the original funding review form.");
 return x as Record<string,unknown>;
}
function remark(x:unknown,min=0){
 if(typeof x!=="string"||x.trim().length<min||x.trim().length>500||
  /[<>\u0000-\u001f\u007f]/.test(x))
  throw new BadRequestException("Enter a short, safe funding-review remark.");
 return x.trim();
}
@Injectable()
export class CsrFundingReviewService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly owner:ProtectedAccessOwnerService,
  private readonly funding:CsrFundingProposalsService,
  private readonly proof:CsrFundingAgreementEvidenceService){}
 private async transaction<T>(work:(tx:PoolClient)=>Promise<T>,read=false){
  const tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   const result=await work(tx);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
    ["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))
    throw stale();
   throw e;
  }finally{tx.release();}
 }
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"csr.partners.review");
  return actor;
 }
 private async reviewerCurrent(tx:PoolClient,a:Actor){
  await this.owner.verifyReviewer(tx,a,"approvals.review",true);
  await this.identity.assertCurrent(tx,a,"csr.partners.review");
 }
 private async process(tx:PoolClient,realm:string){
  return (await tx.query<{id:string;version:number}>(
   "SELECT p.id,p.version FROM cg03_funding_process_current c "+
   "JOIN cg03_process p ON p.realm_id=c.realm_id AND p.id=c.process_id "+
   "WHERE c.realm_id=$1 AND p.process_kind='CSR_FUNDING_REVIEW' FOR SHARE OF p",
   [realm])).rows[0];
 }
 private async fundingCase(tx:PoolClient,a:Actor,ref:string,write=false){
  const item=(await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='CSR_FUNDING_REVIEW' "+(write?"FOR UPDATE":"FOR SHARE"),
   [a.realmId,uuid(ref)])).rows[0];
  if(!item)throw missing();
  return item;
 }
 private async event(tx:PoolClient,a:Actor,c:Case,action:string,remarks=""){
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,"+
   "correlation_ref,safe_remarks) VALUES($1,$2,$3,$4,1,$5,$6)",
   [a.realmId,c.id,a.accountId,action,randomUUID(),remarks]);
 }
 /** Case/source version, currency, split, branch, project and evidence must
  * remain precisely the immutable applicant-signed review snapshot. */
 private async snapshot(tx:PoolClient,a:Actor,c:Case,current=false,requireEvidence=true){
  const r=(await tx.query<Snapshot>(
   "SELECT * FROM csr_funding_review_snapshot WHERE root_realm_id=$1 "+
   "AND id=$2 AND proposal_id=$3 AND source_version=$4 AND source_digest=$5 FOR SHARE",
   [a.realmId,c.csr_funding_review_ref,c.csr_funding_proposal_id,
    c.csr_funding_source_version,c.csr_funding_source_digest])).rows[0];
  if(!r||r.submitted_by!==c.proposer_id||
   csrDigest(["CG08_FUNDING_REVIEW_SOURCE_V1",r.source_snapshot])!==r.source_digest||
   r.source_snapshot.proposalRef!==c.csr_funding_proposal_id||
   r.source_snapshot.evidenceFileRef!==r.evidence_file_id)throw stale();
  const actual=await this.funding.fundingReviewSource(tx,a,r.proposal_id);
  if(current){
   if(actual.status!=="SUBMITTED"||actual.version!==r.source_version+1)throw stale();
   const expected={proposalRef:actual.ref,branchRef:actual.branchRef,
    partnerRef:actual.partnerRef,projectRef:actual.projectRef,
    projectVersion:actual.projectVersion,purpose:actual.purpose,
    fundType:actual.fundType,currency:actual.currency,amountMinor:actual.amountMinor,
    csrShareBps:actual.csrShareBps,foundationShareBps:actual.foundationShareBps,
    csrRequestedMinor:actual.csrRequestedMinor,
    foundationRequestedMinor:actual.foundationRequestedMinor,
    proposedFrom:actual.proposedFrom,proposedUntil:actual.proposedUntil,
    agreementSummary:actual.agreementSummary,evidenceFileRef:r.evidence_file_id};
   if(csrDigest(["CG08_FUNDING_REVIEW_SOURCE_V1",expected])!==r.source_digest)
    throw stale();
   if(requireEvidence)await this.proof.requireCurrentProof(tx,a,r.proposal_id,
    r.source_version,r.evidence_file_id,true);
  }
  return r;
 }
 async policy(bearer:string){
  const a=await this.reviewer(bearer);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const p=await this.process(tx,a.realmId);
   return {configured:!!p,version:p?.version??0};
  },true);
 }
 async configure(bearer:string,raw:unknown){
  const v=data(raw,["currentPassword"]),password=v.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)
   throw new BadRequestException("Enter your current password to configure funding review.");
  const a=await this.sessions.requireAction(bearer,"approvals.process.manage");
  await this.sessions.limitFoundationRootProof(a);
  return this.transaction(async tx=>{
   if(!(await tx.query(
    "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [a.realmId])).rowCount)throw missing();
   await this.identity.assertCurrent(tx,a,"approvals.process.manage");
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const old=await this.process(tx,a.realmId);
   if(old)return {configured:true,version:old.version,replayed:true};
   const p=(await tx.query<{id:string;version:number}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) "+
    "SELECT $1,coalesce(max(version),0)+1,NULL,$2,'CSR_FUNDING_REVIEW' "+
    "FROM cg03_process WHERE realm_id=$1 RETURNING id,version",
    [a.realmId,a.accountId])).rows[0];
   await tx.query(
    "INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query(
    "INSERT INTO cg03_funding_process_current(realm_id,process_id) VALUES($1,$2)",
    [a.realmId,p.id]);
   return {configured:true,version:p.version,replayed:false};
  });
 }
 async submit(bearer:string,proposalRef:string,raw:unknown){
  const a=await this.sessions.requireAction(bearer,"csr.partners.manage"),id=uuid(proposalRef);
  const v=data(raw,["requestKey","expectedVersion","evidenceFileRef"]);
  const key=uuid(v.requestKey),version=revision(v.expectedVersion),file=uuid(v.evidenceFileRef);
  const hash=csrDigest(["CG08_FUNDING_SUBMIT",id,version,file]);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,a,"csr.partners.manage");
   await this.identity.assertCurrent(tx,a,"csr.partners.view");
   await this.identity.assertCurrent(tx,a,"documents.files.view");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG08:FUNDING:SUBMIT:"+a.realmId+":"+a.accountId+":"+key]);
   const prior=(await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3",
    [a.realmId,a.accountId,key])).rows[0];
   if(prior){
    if(prior.case_kind!=="CSR_FUNDING_REVIEW"||
     prior.csr_funding_proposal_id!==id||prior.request_digest!==hash)throw stale();
    await this.funding.guardFundingAgreement(tx,a,id,null,false);
    return {reference:prior.case_number,caseRef:prior.id,
     status:prior.status,replayed:true};
   }
   const p=await this.process(tx,a.realmId);
   if(!p)throw new ConflictException(
    "CSR funding review has not been configured. Save the draft and ask Foundation Admin.");
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const last=(await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND csr_funding_proposal_id=$2 "+
    "AND case_kind='CSR_FUNDING_REVIEW' "+
    "ORDER BY csr_funding_source_version DESC LIMIT 1 FOR SHARE",
    [a.realmId,id])).rows[0];
   if(last&&last.status!=="RETURNED")throw stale();
   await this.proof.requireCurrentProof(tx,a,id,version,file);
   const frozen=await this.funding.freezeForFundingReview(tx,a,id,version,file);
   const snap=(await tx.query<{id:string}>(
    "INSERT INTO csr_funding_review_snapshot(root_realm_id,proposal_id,source_version,"+
    "source_digest,evidence_file_id,submitted_by,request_key,source_snapshot) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id",
    [a.realmId,id,frozen.sourceVersion,frozen.sourceDigest,file,
     a.accountId,key,JSON.stringify(frozen.snapshot)])).rows[0];
   const c=(await tx.query<Case>(
    "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,"+
    "target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
    "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
    "request_digest,request_key,case_kind,csr_funding_review_ref,csr_funding_proposal_id,"+
    "csr_funding_source_version,csr_funding_source_digest,previous_case_id) "+
    "VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
    "$2,$3,$4,NULL,NULL,$5,'CSR funding',NULL,NULL,$6,$7,$8,$9,"+
    "'CSR_FUNDING_REVIEW',$10,$11,$6,$7,$12) RETURNING *",
    [a.realmId,p.id,p.version,a.accountId,frozen.title,
     frozen.sourceVersion,frozen.sourceDigest,hash,key,snap.id,id,last?.id??null])).rows[0];
   await this.event(tx,a,c,last?"CORRECTED":"SUBMITTED");
   return {reference:c.case_number,caseRef:c.id,status:c.status,replayed:false};
  });
 }
 async inbox(bearer:string,raw:Record<string,unknown>){
  const a=await this.reviewer(bearer),v=data(raw,["q","status","offset"]);
  const status=v.status??"ALL",q=v.q??"",offset=v.offset??"0";
  if(typeof status!=="string"||
   !["ALL","SUBMITTED","RETURNED","REJECTED","OWNER_COMPLETED"].includes(status)||
   typeof q!=="string"||q.length>80||/[<>\u0000-\u001f\u007f]/.test(q)||
   typeof offset!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(offset)||
   Number(offset)>5000)
   throw new BadRequestException("Check the original funding-review filters.");
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const rows=(await tx.query(
    "SELECT id AS \"caseRef\",case_number AS reference,status,revision,"+
    "submitted_at AS \"submittedAt\",account_name_snapshot AS title,"+
    "proposer_id<>$2 AS \"canDecide\" "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='CSR_FUNDING_REVIEW' "+
    "AND ($3='ALL' OR status=$3) "+
    "AND ($4='' OR strpos(lower(account_name_snapshot),lower($4))>0 "+
    "OR strpos(lower(case_number),lower($4))>0) "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 26 OFFSET $5",
    [a.realmId,a.accountId,status,q,Number(offset)])).rows;
   return {items:rows.slice(0,25),offset:Number(offset),hasMore:rows.length>25};
  },true);
 }
 async detail(bearer:string,caseRef:string){
  const a=await this.reviewer(bearer);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.fundingCase(tx,a,caseRef);
   const frozen=await this.snapshot(tx,a,c);
   const events=(await tx.query(
    "SELECT e.action,e.safe_remarks AS remarks,e.occurred_at AS at,"+
    "actor.display_name AS actor FROM cg03_case_event e "+
    "JOIN account actor ON actor.id=e.actor_id AND actor.realm_id=e.realm_id "+
    "WHERE e.realm_id=$1 AND e.case_id=$2 "+
    "ORDER BY e.occurred_at DESC LIMIT 30",[a.realmId,c.id])).rows;
   return {caseRef:c.id,reference:c.case_number,status:c.status,
    revision:c.revision,source:frozen.source_snapshot,history:events,
    canDecide:c.status==="SUBMITTED"&&c.proposer_id!==a.accountId};
  },true);
 }
 async decide(bearer:string,caseRef:string,raw:unknown){
  const a=await this.reviewer(bearer),id=uuid(caseRef);
  const v=data(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]);
  const key=uuid(v.requestKey),expected=revision(v.expectedRevision),action=v.action;
  if(!["APPROVE","RETURN","REJECT"].includes(String(action)))
   throw new BadRequestException("Choose approve, return or reject.");
  const remarks=remark(v.remarks??"",action==="APPROVE"?0:3),password=v.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)
   throw new BadRequestException("Reauthenticate with your current password.");
  const hash=csrDigest(["CG08_FUNDING_DECISION",id,expected,action,remarks]);
  await this.sessions.limitFoundationRootProof(a);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.fundingCase(tx,a,id,true);
   if(c.proposer_id===a.accountId)
    throw new ForbiddenException("A different Foundation reviewer must decide.");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>(
    "SELECT actor_id,request_digest FROM cg03_case_decision "+
    "WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",
    [a.realmId,id,key])).rows[0];
   if(prior){
    if(prior.actor_id!==a.accountId||prior.request_digest!==hash)throw stale();
    return {reference:c.case_number,status:c.status,revision:c.revision,replayed:true};
   }
   if(c.status!=="SUBMITTED"||c.revision!==expected)throw stale();
   // A revoked/unsafe document must prevent approval, but never prevent
   // an authorized independent reviewer from RETURNING or REJECTING the case.
   await this.snapshot(tx,a,c,true,action==="APPROVE");
   const route=await tx.query(
    "SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id "+
    "WHERE p.realm_id=$1 AND p.id=$2 AND p.process_kind='CSR_FUNDING_REVIEW' "+
    "AND s.ordinal=1 AND s.capability_key='approvals.review' "+
    "AND s.protected_root_required FOR SHARE OF p,s",[a.realmId,c.process_id]);
   if(!route.rowCount)throw stale();
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   const changed=await tx.query(
    "UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status='SUBMITTED' AND revision=$4",
    [a.realmId,id,next,expected]);
   if(changed.rowCount!==1)throw stale();
   await tx.query(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
    "step_ordinal,expected_case_revision,accepted_case_revision,"+
    "request_key,request_digest,safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",
    [a.realmId,id,a.accountId,action,expected,expected+1,key,hash,remarks]);
   const effect=await this.funding.acceptFundingReviewEffect(tx,a.realmId,
    c.csr_funding_proposal_id,c.csr_funding_source_version,
    action as "APPROVE"|"RETURN"|"REJECT",a.accountId);
   await this.event(tx,a,c,action==="APPROVE"?"FINAL_APPROVED":next,remarks);
   if(action==="APPROVE"){
    const finished=await tx.query(
     "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
     "updated_at=now() WHERE realm_id=$1 AND id=$2 AND status='PENDING_OWNER'",
     [a.realmId,id]);
    if(finished.rowCount!==1)throw stale();
    await this.event(tx,a,c,"OWNER_COMPLETED");
   }
   return {reference:c.case_number,status:action==="APPROVE"?"OWNER_COMPLETED":next,
    proposalStatus:effect.status,revision:expected+(action==="APPROVE"?2:1),
    replayed:false,receivedMinor:null,
    notice:"Approved commitment is not verified cash or a CG09 allocation."};
  });
 }
 /** No provider IO while holding database locks. Recheck exact review case
  * and scanner proof after reading bytes; never send storage keys to staff. */
 async verifiedAgreement(bearer:string,caseRef:string){
  const a=await this.reviewer(bearer);
  const pending=await this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.fundingCase(tx,a,caseRef);
   if(c.status!=="SUBMITTED")throw stale();
   const snap=await this.snapshot(tx,a,c,true);
   const file=await this.proof.prepareFundingReviewFile(tx,a,
    snap.proposal_id,snap.source_version,snap.evidence_file_id);
   return {caseId:c.id,version:snap.source_version,proposalRef:snap.proposal_id,
    evidenceRef:snap.evidence_file_id,file};
  },true);
  const response=await this.proof.readPreparedFundingReviewFile(pending.file);
  await this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.fundingCase(tx,a,caseRef);
   if(c.id!==pending.caseId||c.status!=="SUBMITTED")throw stale();
   const snap=await this.snapshot(tx,a,c,true);
   if(snap.proposal_id!==pending.proposalRef||
     snap.source_version!==pending.version||
     snap.evidence_file_id!==pending.evidenceRef)throw stale();
   await this.proof.assertFundingReviewFileUnchanged(tx,a,pending.proposalRef,
    pending.version,pending.evidenceRef,pending.file);
  },true);
  return response;
 }
 async history(bearer:string,proposalRef:string){
  const a=await this.sessions.requireAction(bearer,"csr.partners.view"),id=uuid(proposalRef);
  return this.transaction(async tx=>{
   await this.funding.guardFundingAgreement(tx,a,id,null,false);
   const rows=(await tx.query(
    "SELECT case_number AS reference,status,revision,"+
    "submitted_at AS \"submittedAt\" FROM cg03_case "+
    "WHERE realm_id=$1 AND csr_funding_proposal_id=$2 "+
    "AND case_kind='CSR_FUNDING_REVIEW' ORDER BY submitted_at DESC LIMIT 30",
    [a.realmId,id])).rows;
   return {items:rows};
  },true);
 }
}
