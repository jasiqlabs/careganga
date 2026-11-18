import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthDraftEvidenceService} from "../../cg-19-documents-notifications/application/health-draft-evidence.service";
import {HealthVerificationApprovalService} from "../../cg-03-registration-approvals/application/health-verification-approval.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import type {HealthSubmission,HealthReviewKind} from "./health-review-source.facade";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Actor=VerifiedFoundationActor;
const id=(v:unknown,field:string)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
 return v;
};
function input(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value)||
   Object.keys(value).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
 return value as Record<string,unknown>;
}
const vers=(v:unknown)=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"HEALTH_VERSION_INVALID",field:"expectedVersion"});
 return Number(v);
};
@Injectable()
export class HealthReviewWorkflowService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly evidence:HealthDraftEvidenceService,
  private readonly review:HealthVerificationApprovalService){}
 private async transaction<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let begun=false;
  try{
   await tx.query("BEGIN");begun=true;
   const result=await fn(tx);
   await tx.query("COMMIT");begun=false;
   return result;
  }catch(e){
   if(begun)try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
     (e.code==="23505"||e.code==="23503"||e.code==="23514"))
    throw new ConflictException({code:"HEALTH_REVIEW_CONFLICT"});
   throw e;
  }finally{tx.release();}
 }
 private async command(tx:PoolClient,actor:Actor,action:string,key:string,signature:unknown){
  const sha=digest(signature);
  const stored=await tx.query<{id:string}>(
   "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
   "request_key,request_digest) VALUES($1,$2,$3,$4,$5) "+
   "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) "+
   "DO NOTHING RETURNING id",
   [actor.realmId,actor.accountId,action,key,sha]);
  if(stored.rows[0])return {id:stored.rows[0].id,ref:null as string|null,version:null as number|null};
  const old=await tx.query<{request_digest:string;result_ref:string|null;result_version:number|null}>(
   "SELECT request_digest,result_ref,result_version FROM health_network_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key=$3 AND request_key=$4 FOR SHARE",
   [actor.realmId,actor.accountId,action,key]);
  if(old.rows[0]?.request_digest!==sha||!old.rows[0]?.result_ref)
   throw new ConflictException({code:"HEALTH_REQUEST_CONFLICT"});
  return {id:null,ref:old.rows[0].result_ref,version:old.rows[0].result_version};
 }
 private async complete(tx:PoolClient,actor:Actor,cmd:string|null,
  providerRef:string,centerRef:string|null,action:string,ref:string,version:number){
  if(cmd)await tx.query("UPDATE health_network_command "+
    "SET result_ref=$2,result_version=$3 WHERE id=$1",[cmd,ref,version]);
  await tx.query("INSERT INTO health_network_event(root_realm_id,actor_ref,"+
    "provider_id,center_id,action_key,version,command_id) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor.realmId,actor.accountId,providerRef,centerRef,action,version,cmd]);
 }
 async submitProvider(bearer:string,providerRef:string,body:unknown){
  const data=input(body,["requestKey","expectedVersion","proofFileRef"]);
  const ref=id(providerRef,"providerRef"),key=id(data.requestKey,"requestKey"),
    expected=vers(data.expectedVersion),file=id(data.proofFileRef,"proofFileRef");
  const actor=await this.sessions.requireAction(bearer,"health.providers.manage");
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.manage");
   const cmd=await this.command(tx,actor,"HEALTH_PROVIDER_SUBMIT",key,{ref,expected,file});
   if(cmd.ref)return {caseRef:cmd.ref,revision:cmd.version,replayed:true};
   const parent=await tx.query<{id:string;version:number;legal_name:string;provider_code:string;
    provider_type:string;registration_ref:string|null;contact_name:string;
    contact_phone:string;contact_email:string|null}>(
    "SELECT id,version,legal_name,provider_code,provider_type,registration_ref,"+
    "contact_name,contact_phone,contact_email FROM health_provider "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING' FOR UPDATE",
    [actor.realmId,ref]);
   const row=parent.rows[0];
   if(!row)throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   if(row.version!==expected)throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   const proof=await this.evidence.prove(tx,actor,ref,null,file,"HEALTH_PROVIDER_REGISTRATION");
   if(proof.health_source_version!==expected)
    throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
   const snapshot={legalName:row.legal_name,providerCode:row.provider_code,
     providerType:row.provider_type,registrationRef:row.registration_ref,
     contactName:row.contact_name,contactPhone:row.contact_phone,
     contactEmail:row.contact_email};
   const sha=digest(snapshot);
   const revision=await tx.query<{id:string}>(
    "INSERT INTO health_provider_revision(root_realm_id,provider_id,revision_no,"+
    "source_version,source_snapshot,source_digest,proof_file_ref,submitted_by) "+
    "VALUES($1,$2,$3,$3,$4::jsonb,$5,$6,$7) RETURNING id",
    [actor.realmId,ref,expected,JSON.stringify(snapshot),sha,file,actor.accountId]);
   await tx.query("UPDATE health_provider SET status='SUBMITTED',version=version+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref]);
   const source:HealthSubmission={kind:"HEALTH_PROVIDER_VERIFICATION",
     providerRef:ref,centerRef:null,revisionRef:revision.rows[0].id,
     revisionNo:expected,digest:sha,requestKey:key};
   const caseRow=await this.review.createCase(tx,actor,source);
   await tx.query("UPDATE health_provider_revision SET approval_case_ref=$3 "+
     "WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,revision.rows[0].id,caseRow.caseRef]);
   await this.complete(tx,actor,cmd.id,ref,null,"HEALTH_PROVIDER_SUBMIT",
     caseRow.caseRef,expected);
   return {caseRef:caseRow.caseRef,reference:caseRow.caseNumber,
     status:"SUBMITTED",revision:expected,replayed:false,
     message:"Submitted for independent Foundation verification."};
  });
 }
 async submitCenter(bearer:string,centerRef:string,body:unknown,own=false){
  const data=input(body,["requestKey","expectedVersion","proofFileRef"]);
  const ref=id(centerRef,"centerRef"),key=id(data.requestKey,"requestKey"),
    expected=vers(data.expectedVersion),file=id(data.proofFileRef,"proofFileRef");
  const action=own?"health.centers.draft.edit":"health.providers.manage";
  const actor=await this.sessions.requireAction(bearer,action);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,action);
   const cmd=await this.command(tx,actor,"HEALTH_CENTER_SUBMIT",key,{ref,expected,file});
   if(cmd.ref)return {caseRef:cmd.ref,revision:cmd.version,replayed:true};
   const found=await tx.query<{provider_id:string;version:number;display_name:string;
    center_code:string;center_type:string;address_line:string;state_ref:string;
    district_ref:string;block_ref:string|null;pin_code:string;
    public_phone:string|null;time_zone:string}>(
    "SELECT c.provider_id,c.version,c.display_name,c.center_code,c.center_type,"+
    "c.address_line,c.state_ref,c.district_ref,c.block_ref,c.pin_code,"+
    "c.public_phone,c.time_zone FROM health_center c "+
    "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
    "WHERE c.id=$1 AND c.root_realm_id=$2 AND c.status='PENDING' "+
    "AND p.status='VERIFIED' FOR UPDATE OF c",
    [ref,actor.realmId]);
   const row=found.rows[0];
   if(!row)throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   if(row.version!==expected)throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   if(own){
    const grant=await tx.query(
     "SELECT id FROM health_center_account_affiliation WHERE root_realm_id=$1 "+
     "AND center_id=$2 AND account_ref=$3 AND status='PENDING_EDIT' FOR SHARE",
     [actor.realmId,ref,actor.accountId]);
    if(!grant.rowCount)throw new ForbiddenException("You are not assigned to this pending center");
   }
   const proof=await this.evidence.prove(tx,actor,row.provider_id,ref,file,
     "HEALTH_CENTER_LICENSE");
   if(proof.health_source_version!==expected)
    throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
   const snapshot={displayName:row.display_name,centerCode:row.center_code,
    centerType:row.center_type,addressLine:row.address_line,
    stateRef:row.state_ref,districtRef:row.district_ref,blockRef:row.block_ref,
    pinCode:row.pin_code,timeZone:row.time_zone,publicPhone:row.public_phone};
   const sha=digest(snapshot);
   const revision=await tx.query<{id:string}>(
    "INSERT INTO health_center_revision(root_realm_id,provider_id,center_id,"+
    "revision_no,source_version,source_snapshot,source_digest,proof_file_ref,submitted_by) "+
    "VALUES($1,$2,$3,$4,$4,$5::jsonb,$6,$7,$8) RETURNING id",
    [actor.realmId,row.provider_id,ref,expected,JSON.stringify(snapshot),
      sha,file,actor.accountId]);
   await tx.query("UPDATE health_center SET status='SUBMITTED',version=version+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,ref]);
   const source:HealthSubmission={kind:"HEALTH_CENTER_VERIFICATION",
     providerRef:row.provider_id,centerRef:ref,revisionRef:revision.rows[0].id,
     revisionNo:expected,digest:sha,requestKey:key};
   const caseRow=await this.review.createCase(tx,actor,source);
   await tx.query("UPDATE health_center_revision SET approval_case_ref=$3 "+
     "WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,revision.rows[0].id,caseRow.caseRef]);
   await this.complete(tx,actor,cmd.id,row.provider_id,ref,
     "HEALTH_CENTER_SUBMIT",caseRow.caseRef,expected);
   return {caseRef:caseRow.caseRef,reference:caseRow.caseNumber,
     status:"SUBMITTED",revision:expected,replayed:false,
     message:"Center submitted for independent review; access and publication remain disabled."};
  });
 }
 private async caseSource(tx:PoolClient,actor:Actor,caseRef:string,kind:HealthReviewKind){
  const found=await tx.query<{id:string;health_provider_id:string;health_center_id:string|null;
    health_provider_revision_id:string|null;health_center_revision_id:string|null;
    health_revision_no:number;health_source_digest:string;status:string}>(
    "SELECT id,health_provider_id,health_center_id,health_provider_revision_id,"+
    "health_center_revision_id,health_revision_no,health_source_digest,status "+
    "FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind=$3 FOR SHARE",
    [actor.realmId,caseRef,kind]);
  const c=found.rows[0];
  if(!c)throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
  return {input:{kind,providerRef:c.health_provider_id,centerRef:c.health_center_id,
    revisionRef:kind==="HEALTH_PROVIDER_VERIFICATION"?
      c.health_provider_revision_id!:c.health_center_revision_id!,
    revisionNo:c.health_revision_no,digest:c.health_source_digest,
    requestKey:randomUUID(),caseRef},state:c.status};
 }
 async apply(bearer:string,caseRef:string,kind:HealthReviewKind){
  const ref=id(caseRef,"caseRef");
  const actor=await this.sessions.requireAction(bearer,"health.providers.verify");
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   const c=await this.caseSource(tx,actor,ref,kind);
   if(c.state==="OWNER_COMPLETED")return {status:"VERIFIED",replayed:true};
   if(c.state!=="PENDING_OWNER")throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   const approval=await this.review.approved(tx,actor,c.input);
   const table=kind==="HEALTH_PROVIDER_VERIFICATION"?
      "health_provider":"health_center";
   const pk=kind==="HEALTH_PROVIDER_VERIFICATION"?
      c.input.providerRef:c.input.centerRef!;
   const current=await tx.query<{version:number}>(
    "SELECT version FROM "+table+" WHERE root_realm_id=$1 AND id=$2 "+
    "AND status='SUBMITTED' FOR UPDATE",[actor.realmId,pk]);
   if(!current.rows[0]||current.rows[0].version!==c.input.revisionNo+1)
    throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
   const rev=await tx.query<{proof_file_ref:string}>(
    kind==="HEALTH_PROVIDER_VERIFICATION"?
     "SELECT proof_file_ref FROM health_provider_revision WHERE root_realm_id=$1 "+
     "AND id=$2 AND approval_case_ref=$3 AND source_digest=$4 FOR SHARE":
     "SELECT proof_file_ref FROM health_center_revision WHERE root_realm_id=$1 "+
     "AND id=$2 AND approval_case_ref=$3 AND source_digest=$4 FOR SHARE",
    [actor.realmId,c.input.revisionRef,ref,c.input.digest]);
   if(!rev.rows[0])throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
   await this.evidence.prove(tx,actor,c.input.providerRef,c.input.centerRef,
     rev.rows[0].proof_file_ref,kind==="HEALTH_PROVIDER_VERIFICATION"?
      "HEALTH_PROVIDER_REGISTRATION":"HEALTH_CENTER_LICENSE");
   if(kind==="HEALTH_CENTER_VERIFICATION"){
    const parent=await tx.query(
      "SELECT id FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
      "AND status='VERIFIED' FOR SHARE",
      [actor.realmId,c.input.providerRef]);
    if(!parent.rowCount)throw new ConflictException({code:"HEALTH_PARENT_NOT_VERIFIED"});
   }
   await tx.query("UPDATE "+table+" SET status='VERIFIED',version=version+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,pk]);
   await this.review.finish(tx,actor,ref);
   await this.complete(tx,actor,null,c.input.providerRef,c.input.centerRef,
     "HEALTH_REVIEW_APPLIED",ref,c.input.revisionNo);
   return {status:"VERIFIED",decisionRef:approval,replayed:false,
     message:"Registration verified. Center access and public listing are separate."};
  });
 }
 async resumeReturned(bearer:string,caseRef:string,kind:HealthReviewKind){
  const ref=id(caseRef,"caseRef");
  const actor=await this.sessions.requireAction(bearer,"health.providers.manage");
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.manage");
   const c=await this.caseSource(tx,actor,ref,kind);
   if(c.state!=="RETURNED")
    throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   const table=kind==="HEALTH_PROVIDER_VERIFICATION"?
     "health_provider":"health_center";
   const target=kind==="HEALTH_PROVIDER_VERIFICATION"?
     c.input.providerRef:c.input.centerRef!;
   const change=await tx.query(
    "UPDATE "+table+" SET status='PENDING',version=version+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' "+
    "AND version=$3 RETURNING id",
    [actor.realmId,target,c.input.revisionNo+1]);
   if(!change.rowCount)throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
   await this.complete(tx,actor,null,c.input.providerRef,c.input.centerRef,
      "HEALTH_REVIEW_RETURNED_FOR_CORRECTION",ref,c.input.revisionNo+2);
   return {status:"PENDING",message:"Returned for correction. Update and re-upload current proof before resubmitting."};
  });
 }

 /** Suspensions are explicit and one-way; only a subsequently reviewed
  * original source may restore eligibility. This never silently unpublishes
  * a center and later auto-restores its old access.
  */
 async suspendProvider(bearer:string,providerRef:string,body:unknown){
  const data=input(body,["requestKey","expectedVersion","currentPassword"]);
  const ref=id(providerRef,"providerRef"),key=id(data.requestKey,"requestKey"),
    expected=vers(data.expectedVersion);
  if(typeof data.currentPassword!=="string")
   throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.providers.verify");
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,data.currentPassword as string);
   const cmd=await this.command(tx,actor,"HEALTH_PROVIDER_SUSPEND",key,{ref,expected});
   if(cmd.ref)return {status:"SUSPENDED",version:cmd.version,replayed:true};
   // Center lock first agrees with the center publication lock order.
   await tx.query(
    "SELECT id FROM health_center WHERE root_realm_id=$1 AND provider_id=$2 "+
    "ORDER BY id FOR UPDATE",[actor.realmId,ref]);
   const found=await tx.query<{version:number;status:string}>(
    "SELECT version,status FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
    "FOR UPDATE",[actor.realmId,ref]);
   if(!found.rows[0])throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   if(found.rows[0].version!==expected)
    throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   if(found.rows[0].status!=="VERIFIED")
    throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   await tx.query(
    "UPDATE health_center SET access_state='DISABLED',"+
    "publication_state='UNPUBLISHED',publication_generation=publication_generation+1,"+
    "version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND provider_id=$2",[actor.realmId,ref]);
   await tx.query(
    "UPDATE health_provider SET status='SUSPENDED',version=version+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref]);
   await this.complete(tx,actor,cmd.id,ref,null,"HEALTH_PROVIDER_SUSPEND",ref,expected+1);
   return {status:"SUSPENDED",version:expected+1,replayed:false,
    message:"The provider and all its public centers have been suspended. A fresh review is required for restoration."};
  });
 }
 async suspendCenter(bearer:string,centerRef:string,body:unknown){
  const data=input(body,["requestKey","expectedVersion","currentPassword"]);
  const ref=id(centerRef,"centerRef"),key=id(data.requestKey,"requestKey"),
    expected=vers(data.expectedVersion);
  if(typeof data.currentPassword!=="string")
   throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.providers.verify");
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,data.currentPassword as string);
   const cmd=await this.command(tx,actor,"HEALTH_CENTER_SUSPEND",key,{ref,expected});
   if(cmd.ref)return {status:"SUSPENDED",version:cmd.version,replayed:true};
   const found=await tx.query<{provider_id:string;version:number;status:string}>(
    "SELECT provider_id,version,status FROM health_center "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,ref]);
   if(!found.rows[0])throw new NotFoundException({code:"HEALTH_CENTER_UNAVAILABLE"});
   if(found.rows[0].version!==expected)
    throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   if(found.rows[0].status!=="VERIFIED")
    throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   await tx.query(
    "UPDATE health_center SET status='SUSPENDED',access_state='DISABLED',"+
    "publication_state='UNPUBLISHED',publication_generation=publication_generation+1,"+
    "version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,ref]);
   await this.complete(tx,actor,cmd.id,found.rows[0].provider_id,ref,
    "HEALTH_CENTER_SUSPEND",ref,expected+1);
   return {status:"SUSPENDED",version:expected+1,replayed:false,
    message:"The center is suspended. Its access and public listing have been withdrawn."};
  });
 }

 async access(bearer:string,centerRef:string,body:unknown){
  const data=input(body,["expectedVersion","enabled","currentPassword","requestKey"]);
  const ref=id(centerRef,"centerRef"),expected=vers(data.expectedVersion),
    key=id(data.requestKey,"requestKey");
  if(typeof data.enabled!=="boolean"||typeof data.currentPassword!=="string")
   throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.activate");
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.centers.activate");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,data.currentPassword as string);
   const cmd=await this.command(tx,actor,"HEALTH_CENTER_ACCESS",key,
    {ref,expected,enabled:data.enabled});
   if(cmd.ref)return {status:"PREVIOUSLY_CONFIRMED",version:cmd.version,replayed:true};
   const c=await tx.query<{provider_id:string;version:number;status:string;
     access_state:string;publication_state:string}>(
    "SELECT provider_id,version,status,access_state,publication_state "+
    "FROM health_center WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,ref]);
   if(!c.rows[0])throw new NotFoundException({code:"HEALTH_CENTER_UNAVAILABLE"});
   if(c.rows[0].version!==expected)
    throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   if(data.enabled&&c.rows[0].status!=="VERIFIED")
    throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
   if(data.enabled){
    const p=await tx.query("SELECT id FROM health_provider "+
      "WHERE root_realm_id=$1 AND id=$2 AND status='VERIFIED' FOR SHARE",
      [actor.realmId,c.rows[0].provider_id]);
    if(!p.rowCount)throw new ConflictException({code:"HEALTH_PARENT_NOT_VERIFIED"});
   }
   const next=expected+1;
   await tx.query("UPDATE health_center SET access_state=$3,"+
    "publication_state=CASE WHEN $3='DISABLED' THEN 'UNPUBLISHED' "+
    "ELSE publication_state END,version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,ref,data.enabled?"ENABLED":"DISABLED"]);
   await this.complete(tx,actor,cmd.id,c.rows[0].provider_id,ref,
      "HEALTH_CENTER_ACCESS",ref,next);
   return {status:data.enabled?"ENABLED":"DISABLED",version:next,replayed:false,
     message:data.enabled?"Verified center access enabled. Public listing is still separately controlled.":
       "Center access disabled and public listing withdrawn."};
  });
 }
 /** Public exposure is a separate protected Foundation decision AFTER
  * genuine CG-03 approved center evidence and independent access enabling.
  */
 async publish(bearer:string,centerRef:string,body:unknown){
  const data=input(body,["requestKey","expectedVersion","published","slug","currentPassword"]);
  const ref=id(centerRef,"centerRef"),key=id(data.requestKey,"requestKey"),
    expected=vers(data.expectedVersion);
  if(typeof data.published!=="boolean"||typeof data.currentPassword!=="string")
    throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const slug=data.published?String(data.slug??"").trim().toLowerCase():null;
  if(data.published&&!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug??""))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"publicSlug"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.publish");
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.centers.publish");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,
     data.currentPassword as string);
   const cmd=await this.command(tx,actor,"HEALTH_CENTER_PUBLICATION",key,
     {ref,expected,published:data.published,slug});
   if(cmd.ref)return {status:"PREVIOUSLY_CONFIRMED",version:cmd.version,replayed:true};
   const center=await tx.query<{provider_id:string;version:number;status:string;
     access_state:string;publication_generation:number;public_slug:string|null}>(
     "SELECT provider_id,version,status,access_state,publication_generation,public_slug "+
     "FROM health_center WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
     [actor.realmId,ref]);
   const row=center.rows[0];
   if(!row)throw new NotFoundException({code:"HEALTH_CENTER_UNAVAILABLE"});
   if(row.version!==expected)throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
   if(data.published){
    if(row.status!=="VERIFIED"||row.access_state!=="ENABLED")
      throw new ConflictException({code:"HEALTH_CENTER_NOT_VERIFIED"});
    const parent=await tx.query("SELECT id FROM health_provider "+
      "WHERE root_realm_id=$1 AND id=$2 AND status='VERIFIED' FOR SHARE",
      [actor.realmId,row.provider_id]);
    if(!parent.rowCount)throw new ConflictException({code:"HEALTH_PARENT_NOT_VERIFIED"});
    const approved=await tx.query<{revision_id:string;decision_id:string;
      proof_file_ref:string;source_version:number}>(
      "SELECT revision.id AS revision_id,decision.id AS decision_id,"+
      "revision.proof_file_ref,revision.source_version "+
      "FROM health_center_revision revision "+
      "JOIN cg03_case c ON c.id=revision.approval_case_ref "+
      "AND c.realm_id=revision.root_realm_id AND c.case_kind='HEALTH_CENTER_VERIFICATION' "+
      "AND c.health_center_id=revision.center_id "+
      "AND c.health_center_revision_id=revision.id "+
      "AND c.health_source_digest=revision.source_digest "+
      "JOIN cg03_case_decision decision ON decision.case_id=c.id "+
      "AND decision.realm_id=c.realm_id AND decision.action='APPROVE' "+
      "AND decision.actor_id<>c.proposer_id "+
      "AND decision.fresh_password_verified_at IS NOT NULL "+
      "JOIN cg19_stored_file proof ON proof.id=revision.proof_file_ref "+
      "AND proof.realm_id=revision.root_realm_id "+
      "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
      "AND intent.realm_id=proof.realm_id "+
      "WHERE revision.root_realm_id=$1 AND revision.provider_id=$2 "+
      "AND revision.center_id=$3 AND c.status='OWNER_COMPLETED' "+
      "AND proof.owner_kind='CG14_DRAFT' AND proof.revoked_at IS NULL "+
      "AND proof.scan_status='CLEAN_VERIFIED' AND intent.status='VALIDATED' "+
      "AND intent.classification='HEALTH_CENTER_LICENSE' "+
      "ORDER BY revision.revision_no DESC LIMIT 1 FOR SHARE OF revision,c,decision,proof,intent",
      [actor.realmId,row.provider_id,ref]);
    if(!approved.rows[0])throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
    const generation=row.publication_generation+1;
    await tx.query(
      "INSERT INTO health_center_publication(root_realm_id,center_id,"+
      "verified_center_revision_id,original_final_decision_ref,published_by,generation) "+
      "VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(root_realm_id,center_id) DO UPDATE "+
      "SET verified_center_revision_id=EXCLUDED.verified_center_revision_id,"+
      "original_final_decision_ref=EXCLUDED.original_final_decision_ref,"+
      "published_by=EXCLUDED.published_by,generation=EXCLUDED.generation,changed_at=now()",
      [actor.realmId,ref,approved.rows[0].revision_id,
        approved.rows[0].decision_id,actor.accountId,generation]);
    await tx.query("UPDATE health_center SET publication_state='PUBLISHED',"+
      "public_slug=$3,publication_generation=$4,version=version+1,updated_at=now() "+
      "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref,slug,generation]);
   }else{
    await tx.query("UPDATE health_center SET publication_state='UNPUBLISHED',"+
      "publication_generation=publication_generation+1,version=version+1,updated_at=now() "+
      "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref]);
   }
   const next=expected+1;
   await this.complete(tx,actor,cmd.id,row.provider_id,ref,
     "HEALTH_CENTER_PUBLICATION",ref,next);
   return {status:data.published?"PUBLISHED":"UNPUBLISHED",version:next,
     replayed:false,message:data.published?
       "The verified center listing is published. Doctor appointments are not enabled.":
       "The center listing was withdrawn from public view."};
  });
 }

}
