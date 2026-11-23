import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {CsrPartnersService,csrDigest} from "../../cg-08-csr-funding/application/csr-partners.service";
import {CsrAgreementEvidenceService} from "../../cg-19-documents-notifications/application/csr-agreement-evidence.service";

type Case={id:string;case_number:string;process_id:string;proposer_id:string;status:string;
 revision:number;case_kind:string;csr_review_ref:string;csr_partner_id:string;
 csr_source_version:number;csr_source_digest:string;request_digest:string};
type Frozen={id:string;partner_id:string;source_version:number;source_digest:string;
 evidence_file_id:string;submitted_by:string;source_snapshot:Record<string,unknown>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const changed=()=>new ConflictException({code:"CG08_CSR_REVIEW_CHANGED",message:"CSR review changed. Refresh and review the current record."});
const missing=()=>new NotFoundException("CSR partner review is unavailable.");
function key(x:unknown):string{
 if(typeof x!=="string"||!UUID.test(x))throw new BadRequestException("Choose a valid current CSR record.");
 return x.toLowerCase();
}
function rev(x:unknown):number{
 if(typeof x!=="number"||!Number.isSafeInteger(x)||x<1||x>2147483645)throw new BadRequestException("Refresh the current CSR review.");
 return x;
}
function note(x:unknown,min=0):string{
 if(typeof x!=="string"||x.trim().length<min||x.trim().length>500||/[<>\u0000-\u001f\u007f]/.test(x))
  throw new BadRequestException("Enter a short safe review remark.");
 return x.trim();
}
function fields(raw:unknown,allowed:string[]):Record<string,unknown>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BadRequestException("Check this CSR review request.");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!allowed.includes(k)))throw new BadRequestException("This CSR review field is unavailable.");
 return v;
}
@Injectable()
export class CsrPartnerReviewService {
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly owner:ProtectedAccessOwnerService,
  private readonly partners:CsrPartnersService,
  private readonly evidence:CsrAgreementEvidenceService){}
 private async transaction<T>(work:(tx:PoolClient)=>Promise<T>,read=false):Promise<T>{
  const tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   const value=await work(tx);await tx.query("COMMIT");return value;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
    ["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))throw changed();
   throw e;
  }finally{tx.release();}
 }
 private async reviewer(bearer:string){
  const a=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"csr.partners.review");
  return a;
 }
 private async reviewerCurrent(tx:PoolClient,a:Actor){
  await this.owner.verifyReviewer(tx,a,"approvals.review",true);
  await this.identity.assertCurrent(tx,a,"csr.partners.review");
 }
 private async process(tx:PoolClient,root:string){
  const q=await tx.query<{id:string;version:number}>(
   "SELECT p.id,p.version FROM cg03_csr_process_current cur JOIN cg03_process p "+
   "ON p.id=cur.process_id AND p.realm_id=cur.realm_id "+
   "WHERE cur.realm_id=$1 AND p.process_kind='CSR_PARTNER_REVIEW' FOR SHARE OF p",[root]);
  return q.rows[0];
 }
 private async event(tx:PoolClient,a:Actor,c:Case,action:string,remarks=""){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref,safe_remarks) "+
    "VALUES($1,$2,$3,$4,1,$5,$6)",[a.realmId,c.id,a.accountId,action,randomUUID(),remarks]);
 }
 private async case(tx:PoolClient,a:Actor,id:string,write=false):Promise<Case>{
  const q=await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='CSR_PARTNER_REVIEW' "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,key(id)]);
  if(!q.rows[0])throw missing();
  return q.rows[0];
 }
 private async snapshot(tx:PoolClient,a:Actor,c:Case,current=false){
  const r=(await tx.query<Frozen>("SELECT * FROM csr_partner_review_snapshot WHERE root_realm_id=$1 "+
   "AND id=$2 AND partner_id=$3 AND source_version=$4 AND source_digest=$5 FOR SHARE",
   [a.realmId,c.csr_review_ref,c.csr_partner_id,c.csr_source_version,c.csr_source_digest])).rows[0];
  if(!r||r.submitted_by!==c.proposer_id||
   csrDigest(["CG08_REVIEW_SOURCE_V1",r.source_snapshot])!==r.source_digest||
   r.source_snapshot.partnerRef!==c.csr_partner_id||r.source_snapshot.evidenceFileRef!==r.evidence_file_id)throw changed();
  if(current){
   const p=await this.partners.reviewSource(tx,a,c.csr_partner_id);
   if(p.status!=="SUBMITTED"||p.version!==r.source_version+1||
    p.branchRef!==r.source_snapshot.branchRef||p.legalName!==r.source_snapshot.legalName||
    p.registrationReference!==r.source_snapshot.registrationReference||
    p.contactName!==r.source_snapshot.contactName||p.contactEmail!==r.source_snapshot.contactEmail||
    p.contactMobile!==r.source_snapshot.contactMobile||p.supportSummary!==r.source_snapshot.supportSummary)throw changed();
   await this.evidence.requireCurrentProof(tx,a,r.partner_id,r.source_version,r.evidence_file_id);
  }
  return r;
 }
 async policy(bearer:string){
  const a=await this.reviewer(bearer);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const p=await this.process(tx,a.realmId);
   return {configured:Boolean(p),version:p?.version??0};
  },true);
 }
 async configure(bearer:string,raw:unknown){
  const v=fields(raw,["currentPassword"]),password=v.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)
   throw new BadRequestException("Enter your current password to configure CSR review.");
  const a=await this.sessions.requireAction(bearer,"approvals.process.manage");
  await this.sessions.limitFoundationRootProof(a);
  return this.transaction(async tx=>{
   if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [a.realmId])).rowCount)throw missing();
   await this.identity.assertCurrent(tx,a,"approvals.process.manage");
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const existing=await this.process(tx,a.realmId);
   if(existing)return {configured:true,version:existing.version,replayed:true};
   const p=(await tx.query<{id:string;version:number}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) "+
    "SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'CSR_PARTNER_REVIEW' "+
    "FROM cg03_process WHERE realm_id=$1 RETURNING id,version",[a.realmId,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query("INSERT INTO cg03_csr_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);
   return {configured:true,version:p.version,replayed:false};
  });
 }
 async submit(bearer:string,partnerRef:string,raw:unknown){
  const a=await this.sessions.requireAction(bearer,"csr.partners.manage"),id=key(partnerRef);
  const v=fields(raw,["requestKey","expectedVersion","evidenceFileRef"]);
  const requestKey=key(v.requestKey),expected=rev(v.expectedVersion),fileRef=key(v.evidenceFileRef);
  const h=csrDigest(["CG08_CSR_SUBMIT",id,expected,fileRef]);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,a,"csr.partners.manage");
   await this.identity.assertCurrent(tx,a,"csr.partners.view");
   await this.identity.assertCurrent(tx,a,"documents.files.view");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG08:CSR:SUBMIT:"+a.realmId+":"+a.accountId+":"+requestKey]);
   const prior=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 "+
    "AND proposer_id=$2 AND request_key=$3",[a.realmId,a.accountId,requestKey])).rows[0];
   if(prior){
    if(prior.case_kind!=="CSR_PARTNER_REVIEW"||prior.csr_partner_id!==id||prior.request_digest!==h)throw changed();
    await this.partners.guardAgreement(tx,a,id,null,false);
    return {reference:prior.case_number,status:prior.status,replayed:true};
   }
   const p=await this.process(tx,a.realmId);
   if(!p)throw new ConflictException("CSR review is not configured. Your draft remains saved; ask Foundation Admin.");
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const last=(await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND csr_partner_id=$2 "+
    "AND case_kind='CSR_PARTNER_REVIEW' ORDER BY csr_source_version DESC LIMIT 1 FOR SHARE",
    [a.realmId,id])).rows[0];
   if(last&&last.status!=="RETURNED")throw changed();
   await this.evidence.requireCurrentProof(tx,a,id,expected,fileRef);
   const frozen=await this.partners.freezeForReview(tx,a,id,expected,fileRef);
   const snap=(await tx.query<{id:string}>(
    "INSERT INTO csr_partner_review_snapshot(root_realm_id,partner_id,source_version,source_digest,"+
    "evidence_file_id,submitted_by,request_key,source_snapshot) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id",
    [a.realmId,id,frozen.sourceVersion,frozen.sourceDigest,fileRef,a.accountId,requestKey,
     JSON.stringify(frozen.snapshot)])).rows[0];
   const c=(await tx.query<Case>(
    "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,"+
    "target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
    "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
    "request_digest,request_key,case_kind,csr_review_ref,csr_partner_id,csr_source_version,"+
    "csr_source_digest,previous_case_id) "+
    "VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
    "$2,$3,$4,NULL,NULL,$5,'CSR partner',NULL,NULL,$6,$7,$8,$9,'CSR_PARTNER_REVIEW',"+
    "$10,$11,$6,$7,$12) RETURNING *",
    [a.realmId,p.id,p.version,a.accountId,frozen.title,frozen.sourceVersion,
     frozen.sourceDigest,h,requestKey,snap.id,id,last?.id??null])).rows[0];
   await this.event(tx,a,c,"SUBMITTED");
   return {reference:c.case_number,caseRef:c.id,status:c.status,replayed:false};
  });
 }
 async inbox(bearer:string,raw:Record<string,unknown>){
  const a=await this.reviewer(bearer),v=fields(raw,["q","status","offset"]);
  const status=v.status??"ALL",search=v.q??"",offset=v.offset??"0";
  if(typeof status!=="string"||!["ALL","SUBMITTED","RETURNED","REJECTED","OWNER_COMPLETED"].includes(status)||
   typeof search!=="string"||search.length>80||/[<>\u0000-\u001f\u007f]/.test(search)||
   typeof offset!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(offset)||Number(offset)>5000)
   throw new BadRequestException("Check the CSR review filters.");
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const rows=(await tx.query(
    "SELECT id AS \"caseRef\",case_number AS reference,status,revision,"+
    "submitted_at AS \"submittedAt\",account_name_snapshot AS title,proposer_id<>$2 AS \"canDecide\" "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='CSR_PARTNER_REVIEW' "+
    "AND ($3='ALL' OR status=$3) AND ($4='' OR strpos(lower(account_name_snapshot),lower($4))>0 "+
    "OR strpos(lower(case_number),lower($4))>0) "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 26 OFFSET $5",
    [a.realmId,a.accountId,status,search,Number(offset)])).rows;
   return {items:rows.slice(0,25),offset:Number(offset),hasMore:rows.length>25};
  },true);
 }
 async detail(bearer:string,caseRef:string){
  const a=await this.reviewer(bearer);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.case(tx,a,caseRef);
   const frozen=await this.snapshot(tx,a,c);
   const events=(await tx.query(
    "SELECT e.action,e.safe_remarks AS remarks,e.occurred_at AS at,actor.display_name AS actor "+
    "FROM cg03_case_event e JOIN account actor ON actor.id=e.actor_id AND actor.realm_id=e.realm_id "+
    "WHERE e.realm_id=$1 AND e.case_id=$2 ORDER BY e.occurred_at DESC LIMIT 30",
    [a.realmId,c.id])).rows;
   return {caseRef:c.id,reference:c.case_number,status:c.status,revision:c.revision,
    source:frozen.source_snapshot,history:events,
    canDecide:c.status==="SUBMITTED"&&c.proposer_id!==a.accountId};
  },true);
 }
 async decide(bearer:string,caseRef:string,raw:unknown){
  const a=await this.reviewer(bearer),id=key(caseRef);
  const v=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]);
  const requestKey=key(v.requestKey),expected=rev(v.expectedRevision),action=v.action;
  if(!["APPROVE","RETURN","REJECT"].includes(String(action)))
   throw new BadRequestException("Choose Approve, Return or Reject.");
  const remarks=note(v.remarks??"",action==="APPROVE"?0:3),password=v.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)
   throw new BadRequestException("Enter your current password for independent CSR review.");
  const h=csrDigest(["CG08_CSR_DECISION",id,expected,action,remarks]);
  await this.sessions.limitFoundationRootProof(a);
  return this.transaction(async tx=>{
   await this.reviewerCurrent(tx,a);
   const c=await this.case(tx,a,id,true);
   if(c.proposer_id===a.accountId)throw new ForbiddenException("A different Foundation reviewer must decide.");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>(
    "SELECT actor_id,request_digest FROM cg03_case_decision "+
    "WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",
    [a.realmId,id,requestKey])).rows[0];
   if(prior){
    if(prior.actor_id!==a.accountId||prior.request_digest!==h)throw changed();
    return {reference:c.case_number,status:c.status,revision:c.revision,replayed:true};
   }
   if(c.status!=="SUBMITTED"||c.revision!==expected)throw changed();
   await this.snapshot(tx,a,c,true);
   const route=(await tx.query(
    "SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id "+
    "WHERE p.realm_id=$1 AND p.id=$2 AND p.process_kind='CSR_PARTNER_REVIEW' "+
    "AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required "+
    "FOR SHARE OF p,s",[a.realmId,c.process_id])).rows[0];
   if(!route)throw changed();
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   const done=await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE realm_id=$1 AND id=$2 AND status='SUBMITTED' AND revision=$4",
    [a.realmId,id,next,expected]);
   if(done.rowCount!==1)throw changed();
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,"+
    "expected_case_revision,accepted_case_revision,request_key,request_digest,"+
    "safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",
    [a.realmId,id,a.accountId,action,expected,expected+1,requestKey,h,remarks]);
   const effect=await this.partners.acceptReviewEffect(tx,a.realmId,c.csr_partner_id,c.csr_source_version,
    action as "APPROVE"|"RETURN"|"REJECT",a.accountId);
   await this.event(tx,a,c,action==="APPROVE"?"FINAL_APPROVED":next,remarks);
   if(action==="APPROVE"){
    await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() "+
      "WHERE realm_id=$1 AND id=$2 AND status='PENDING_OWNER'",[a.realmId,id]);
    await this.event(tx,a,c,"OWNER_COMPLETED");
   }
   return {reference:c.case_number,status:action==="APPROVE"?"OWNER_COMPLETED":next,
    partnerStatus:effect.status,revision:expected+(action==="APPROVE"?2:1),replayed:false};
  });
 }
 async partnerHistory(bearer:string,partnerRef:string){
  const a=await this.sessions.requireAction(bearer,"csr.partners.view"),id=key(partnerRef);
  return this.transaction(async tx=>{
   await this.partners.guardAgreement(tx,a,id,null,false);
   const rows=(await tx.query(
    "SELECT case_number AS reference,status,revision,submitted_at AS \"submittedAt\" "+
    "FROM cg03_case WHERE realm_id=$1 AND csr_partner_id=$2 "+
    "AND case_kind='CSR_PARTNER_REVIEW' ORDER BY submitted_at DESC LIMIT 30",
    [a.realmId,id])).rows;
   return {items:rows};
  },true);
 }
}
