import {
 BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Actor=VerifiedFoundationActor;
type PriceSource={
 id:string;root_realm_id:string;center_test_mapping_ref:string;
 version_no:number;status:"PROPOSED"|"APPROVED"|"REJECTED";
 effective_from:Date;effective_to:Date|null;
 base_price_minor:string;advertised_patient_price_minor:string;
 price_currency:string;discount_reason:string|null;proposed_by:string
};
type Case={id:string;case_number:string;status:string;revision:number;
 proposer_id:string;process_id:string;current_step:number;cg16_price_digest:string;
 cg16_price_version:number;request_digest:string;request_key:string};
export function priceSourceDigest(p:PriceSource){
 return sha(["CG16_LAB_PRICE_SOURCE_V1",{
  id:p.id,mapping:p.center_test_mapping_ref,version:p.version_no,
  from:p.effective_from.toISOString(),to:p.effective_to?.toISOString()??null,
  base:String(p.base_price_minor),patient:String(p.advertised_patient_price_minor),
  currency:p.price_currency,discount:p.discount_reason??null,
  proposer:p.proposed_by
 }]);
}
/** Original CG-03-owned review case and decision contract used by CG-16.
 * Runs IN the enclosing CG-16 price transaction. CG03 remains the only
 * immutable reviewer and current-password proof source; no shadow approval. */
@Injectable()
export class DiagnosticsPriceReviewSource{
 constructor(
  private readonly sessions:SessionService,
  private readonly owner:ProtectedAccessOwnerService
 ){}
 private async price(tx:PoolClient,realm:string,ref:string):Promise<PriceSource>{
  if(!ID.test(ref))throw new BadRequestException({code:"LAB_CATALOG_INVALID"});
  const r=await tx.query<PriceSource>(
   "SELECT id,root_realm_id,center_test_mapping_ref,version_no,status,"+
   "effective_from,effective_to,base_price_minor::text,"+
   "advertised_patient_price_minor::text,price_currency,discount_reason,"+
   "proposed_by FROM lab_center_price_version "+
   "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[realm,ref]);
  if(!r.rows[0])throw new NotFoundException("The proposed lab price is unavailable");
  return r.rows[0];
 }
 /** Proposer creates a CG03 case after a real immutable price revision is
  * inserted and before the outer price transaction commits. */
 async create(tx:PoolClient,actor:Actor,priceRef:string,requestKey:string){
  if(!ID.test(requestKey))throw new BadRequestException({code:"LAB_CATALOG_INVALID"});
  const p=await this.price(tx,actor.realmId,priceRef);
  if(p.status!=="PROPOSED"||p.proposed_by!==actor.accountId)
   throw new ForbiddenException("This current price proposal cannot be submitted");
  await this.owner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  // Lock current root before allocating process version, matching the
  // source-owned CG03 health approval process pattern.
  const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 "+
   "AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!root.rowCount)throw new ForbiddenException("Foundation review is unavailable");
  const current=await tx.query<{process_id:string}>(
   "SELECT process_id FROM cg03_health_process_current "+
   "WHERE realm_id=$1 AND case_kind='HEALTH_LAB_PRICE_REVIEW' FOR SHARE",
   [actor.realmId]);
  let process=current.rows[0]?.process_id;
  if(!process){
   const version=await tx.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version "+
    "FROM cg03_process WHERE realm_id=$1",[actor.realmId]);
   const next=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'HEALTH_LAB_PRICE_REVIEW') "+
    "RETURNING id",[actor.realmId,Number(version.rows[0].version),actor.accountId]);
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
    "protected_root_required) VALUES($1,1,'approvals.review',true)",
    [next.rows[0].id]);
   await tx.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
    "VALUES($1,'HEALTH_LAB_PRICE_REVIEW',$2)",[actor.realmId,next.rows[0].id]);
   process=next.rows[0].id;
  }
  const sourceDigest=priceSourceDigest(p);
  const commandDigest=sha(["CG03_LAB_PRICE_V1",priceRef,requestKey,sourceDigest]);
  const prior=await tx.query<{id:string;proposer_id:string;request_key:string;
   request_digest:string;case_number:string}>(
   "SELECT id,proposer_id,request_key,request_digest,case_number "+
   "FROM cg03_case WHERE realm_id=$1 AND case_kind='HEALTH_LAB_PRICE_REVIEW' "+
   "AND cg16_price_id=$2 FOR SHARE",[actor.realmId,priceRef]);
  if(prior.rows[0]){
   if(prior.rows[0].proposer_id!==actor.accountId||
    prior.rows[0].request_key!==requestKey||
    prior.rows[0].request_digest!==commandDigest)
    throw new ConflictException({code:"LAB_CATALOG_CONFLICT"});
   return {caseRef:prior.rows[0].id,reference:prior.rows[0].case_number,replayed:true};
  }
  const mapping=await tx.query<{center_ref:string;name:string}>(
   "SELECT m.center_ref,c.display_name AS name "+
   "FROM lab_center_test_mapping m JOIN health_center c "+
   "ON c.root_realm_id=m.root_realm_id AND c.id=m.center_ref "+
   "WHERE m.root_realm_id=$1 AND m.id=$2",
   [actor.realmId,p.center_test_mapping_ref]);
  if(!mapping.rows[0])throw new ConflictException({code:"LAB_CATALOG_CONFLICT"});
  const label=(mapping.rows[0].name+" · Lab price review").slice(0,160);
  const row=await tx.query<{id:string;case_number:string}>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,cg16_price_id,cg16_price_version,cg16_price_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "process.id,process.version,$2,NULL,NULL,$3,'Lab commercial price review',"+
   "NULL,NULL,$4,$5,$6,$7,'HEALTH_LAB_PRICE_REVIEW',$8,$9,$10 "+
   "FROM cg03_process process WHERE process.id=$11 RETURNING id,case_number",
   [actor.realmId,actor.accountId,label,p.version_no,sourceDigest,
    commandDigest,requestKey,priceRef,p.version_no,sourceDigest,process]);
  if(!row.rows[0])throw new ConflictException({code:"LAB_CATALOG_CONFLICT"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,row.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:row.rows[0].id,reference:row.rows[0].case_number,replayed:false};
 }
 async decide(tx:PoolClient,actor:Actor,input:{
  priceRef:string;priceVersion:number;expectedCaseRevision:number;
  requestKey:string;currentPassword:string;action:"APPROVE"|"REJECT"
 }){
  await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
  const p=await this.price(tx,actor.realmId,input.priceRef);
  if(p.status!=="PROPOSED"||p.version_no!==input.priceVersion)
   throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
  const caseRow=await tx.query<Case>(
   "SELECT id,case_number,status,revision,proposer_id,process_id,"+
   "current_step,cg16_price_digest,cg16_price_version,request_digest,request_key "+
   "FROM cg03_case WHERE realm_id=$1 AND case_kind='HEALTH_LAB_PRICE_REVIEW' "+
   "AND cg16_price_id=$2 FOR UPDATE",[actor.realmId,input.priceRef]);
  const c=caseRow.rows[0];
  if(!c||!["SUBMITTED","IN_REVIEW"].includes(c.status)||
   c.revision!==input.expectedCaseRevision||
   c.cg16_price_version!==input.priceVersion||
   c.cg16_price_digest!==priceSourceDigest(p))
   throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
  if(c.proposer_id===actor.accountId||p.proposed_by===actor.accountId)
   throw new ForbiddenException("A different Foundation reviewer must approve this lab price");
  const step=await tx.query(
   "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
   "AND ordinal=$2 AND capability_key='approvals.review' "+
   "AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step]);
  if(!step.rowCount)throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
  await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
  const decisionDigest=sha(["CG03_LAB_PRICE_DECISION_V1",input.action,
   input.priceRef,input.priceVersion,input.expectedCaseRevision]);
  const target=input.action==="APPROVE"?"PENDING_OWNER":"REJECTED";
  await tx.query("UPDATE cg03_case SET status=$4,revision=revision+1,"+
   "updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$3",
   [actor.realmId,c.id,c.revision,target]);
  const result=await tx.query<{id:string}>(
   "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
   "step_ordinal,expected_case_revision,accepted_case_revision,request_key,"+
   "request_digest,safe_remarks,fresh_password_verified_at) "+
   "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now()) RETURNING id",
   [actor.realmId,c.id,actor.accountId,input.action,c.revision,c.revision+1,
    input.requestKey,decisionDigest]);
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,$4,1,$5)",
   [actor.realmId,c.id,actor.accountId,
    input.action==="APPROVE"?"FINAL_APPROVED":"REJECTED",randomUUID()]);
  return {caseRef:c.id,caseNumber:c.case_number,decisionRef:result.rows[0].id};
 }
 async finish(tx:PoolClient,actor:Actor,caseRef:string){
  const done=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='HEALTH_LAB_PRICE_REVIEW' AND status='PENDING_OWNER' "+
   "RETURNING id",[actor.realmId,caseRef]);
  if(!done.rowCount)throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
