import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {assertCsrFundingProject} from "../../cg-05-projects-field-operations/application/project-finance-source";
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
type ProposalRow={id:string;branch_ref:string|null;csr_partner_id:string|null;status:string;version:number};
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
 private async sourceScope(tx:PoolClient,a:VerifiedFoundationActor,v:ReturnType<typeof parseFundingProposal>){
  await this.branches.projectBranch(tx,a,v.branchRef);
  if(v.partnerRef!==null){
   await this.identity.assertCurrent(tx,a,"csr.partners.view");
   const p=await this.partners.guardAgreement(tx,a,v.partnerRef,null,false);
   if(p.status!=="APPROVED"||p.branch_ref!==null&&p.branch_ref!==v.branchRef)
    throw new ConflictException("The CSR sponsor is not approved for this Foundation branch.");
  }
  if(v.projectRef!==null)
   await assertCsrFundingProject(tx,a,v.projectRef,v.branchRef,v.projectVersion!);
 }
 private async original(tx:PoolClient,a:VerifiedFoundationActor,id:string,update=false){
  const p=(await tx.query<ProposalRow>(
   "SELECT id,branch_ref,csr_partner_id,status,version FROM csr_funding_proposal "+
   "WHERE root_realm_id=$1 AND id=$2 "+(update?"FOR UPDATE":"FOR SHARE"),
   [a.realmId,ref(id)])).rows[0];
  if(!p)throw missing();
  await this.branches.projectBranch(tx,a,p.branch_ref);
  return p;
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
 async detail(bearer:string,proposalRef:string){
  return this.run(bearer,"csr.partners.view",async(tx,a)=>{
   const id=ref(proposalRef);
   await this.original(tx,a,id);
   const row=(await tx.query("SELECT "+projection+joins+
    " WHERE f.root_realm_id=$1 AND f.id=$2",[a.realmId,id])).rows[0];
   if(!row)throw missing();
   return row;
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
   return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25};
  },true);
 }
}
