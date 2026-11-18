import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {readConfig} from "../../../core/config/config";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterSupportScopeFacade} from "./health-center-support-scope.facade";
import {HealthErpGrantApprovalService} from "../../cg-03-registration-approvals/application/health-erp-grant-approval.service";
import type {GrantSubmission} from "./health-erp-grant-review-source.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CAPABILITIES=["LAB_ERP","PHARMACY_ERP","NURSING_ERP","OT_ERP"] as const;
type Capability=typeof CAPABILITIES[number];
const uuid=(x:unknown)=>{
 if(typeof x!=="string"||!ID.test(x))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 return x;
};
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Grant={state:string;version:number;pending_revision_id:string;
 approved_revision_id:string|null;original_decision_ref:string|null};
type Revision={id:string;root_realm_id:string;provider_id:string;center_id:string;
 capability:Capability;revision_no:number;source_digest:string;original_case_ref:string|null;
 effective_from:Date;effective_until:Date|null};
function permission(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedVersion","capability",
   "effectiveFrom","effectiveUntil"].includes(k))||
  !CAPABILITIES.includes(x.capability as Capability)||
  !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||
  Number(x.expectedVersion)>2147483646)
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 const date=(v:unknown,optional=false):Date|null=>{
  if((v===null||v===undefined)&&optional)return null;
  if(typeof v!=="string"||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))
   throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  const d=new Date(v);
  if(!Number.isFinite(d.getTime())||d.toISOString()!==v)
   throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  return d;
 };
 const from=date(x.effectiveFrom)!;
 const until=date(x.effectiveUntil,true);
 if(from.getTime()<Date.now()-86400000||from.getTime()>Date.now()+366*86400000||
    until&&until.getTime()<=from.getTime())
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 return {key:uuid(x.requestKey),expected:Number(x.expectedVersion),
  capability:x.capability as Capability,from,until};
}
function control(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["currentPassword","expectedVersion"].includes(k))||
  typeof x.currentPassword!=="string"||x.currentPassword.length<8||
  Buffer.byteLength(x.currentPassword,"utf8")>1024||
  (x.expectedVersion!==undefined&&
   (!Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1)))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 return {password:x.currentPassword,
  expected:x.expectedVersion===undefined?null:Number(x.expectedVersion)};
}
@Injectable()
export class HealthCenterErpGrantService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly centerScope:HealthCenterSupportScopeFacade,
  private readonly approval:HealthErpGrantApprovalService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");active=false;return result;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 private async center(tx:PoolClient,root:string,center:string){
  const row=await tx.query<{provider_id:string;status:string;access_state:string}>(
   "SELECT provider_id,status,access_state FROM health_center "+
   "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[root,center]);
  if(!row.rows[0]||row.rows[0].status!=="VERIFIED"||
    row.rows[0].access_state!=="ENABLED")
   throw new NotFoundException("Current verified center unavailable");
  return row.rows[0];
 }
 private deployment(cap:Capability){
  const deployment=readConfig().erpDeploymentCapabilities;
  const name=cap==="LAB_ERP"?"lab":cap==="PHARMACY_ERP"?"pharmacy":
   cap==="NURSING_ERP"?"nursing":"ot";
  return deployment[name];
 }
 async own(bearer:string,rawCenter:string){
  const center=uuid(rawCenter),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.centerScope.assertCurrent(tx,actor,center);
   const r=await tx.query<{capability:Capability;state:string;version:number;
    pending_revision_id:string;approved_revision_id:string|null;
    review_status:string|null}>(
    "SELECT g.capability,g.state,g.version,g.pending_revision_id,"+
    "g.approved_revision_id,review.status AS review_status "+
    "FROM health_center_erp_grant g "+
    "LEFT JOIN cg03_case review ON review.realm_id=g.root_realm_id "+
    "AND review.health_erp_revision_id=g.pending_revision_id "+
    "AND review.case_kind='HEALTH_CENTER_ERP_GRANT' "+
    "WHERE g.root_realm_id=$1 AND g.center_id=$2 ORDER BY g.capability",
    [actor.realmId,center]);
   return {capabilities:CAPABILITIES.map(cap=>{
    const row=r.rows.find(x=>x.capability===cap),deployment=this.deployment(cap);
    return {capability:cap,state:row?.state??"NOT_REQUESTED",
     version:row?.version??0,reviewStatus:row?.review_status??null,
     deployment:deployment.status,requestedGlobal:deployment.requested,
     effective:false,canUseOperations:false,
     message:deployment.status==="OFF"?
      "Optional ERP is disabled for this deployment.":
      "Optional ERP is not installed. Approval never enables unbuilt operations."};
   })};
  });
 }
 async request(bearer:string,rawCenter:string,body:unknown){
  const center=uuid(rawCenter),input=permission(body);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  const digest=sha(["CG14_ERP_GRANT_V1",center,input.capability,
    input.expected,input.from.toISOString(),input.until?.toISOString()??null]);
  return this.run(async tx=>{
   await this.centerScope.assertCurrent(tx,actor,center);
   const c=await this.center(tx,actor.realmId,center);
   // First request requires a stable lock even when the grant row is absent.
   await tx.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
    [actor.realmId+":"+center,input.capability]);
   const oldCommand=await tx.query<{request_digest:string;case_ref:string|null;
     revision_no:number}>(
    "SELECT request_digest,case_ref,revision_no FROM health_center_erp_grant_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,input.key]);
   if(oldCommand.rows[0]){
    if(oldCommand.rows[0].request_digest!==digest||!oldCommand.rows[0].case_ref)
     throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
    return {caseRef:oldCommand.rows[0].case_ref,
     version:oldCommand.rows[0].revision_no,state:"REQUESTED",replayed:true};
   }
   const existing=await tx.query<Grant>(
    "SELECT state,version,pending_revision_id,approved_revision_id,original_decision_ref "+
    "FROM health_center_erp_grant WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND capability=$3 FOR UPDATE",[actor.realmId,center,input.capability]);
   const previous=existing.rows[0];
   if((previous?.version??0)!==input.expected)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   if(previous&&["APPROVED","SUSPENDED"].includes(previous.state))
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   if(previous?.state==="REQUESTED"){
    const oldReview=await tx.query<{status:string}>(
     "SELECT status FROM cg03_case WHERE realm_id=$1 AND "+
     "health_erp_revision_id=$2 AND case_kind='HEALTH_CENTER_ERP_GRANT' FOR SHARE",
     [actor.realmId,previous.pending_revision_id]);
    if(!["RETURNED","REJECTED"].includes(oldReview.rows[0]?.status??""))
     throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   }
   const next=input.expected+1;
   const inserted=await tx.query<{id:string}>(
    "INSERT INTO health_center_erp_grant_revision(root_realm_id,provider_id,"+
    "center_id,capability,revision_no,effective_from,effective_until,"+
    "source_digest,submitted_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    [actor.realmId,c.provider_id,center,input.capability,next,input.from,input.until,
     digest,actor.accountId]);
   await tx.query(
    "INSERT INTO health_center_erp_grant(root_realm_id,center_id,capability,"+
    "version,state,pending_revision_id) VALUES($1,$2,$3,$4,'REQUESTED',$5) "+
    "ON CONFLICT(root_realm_id,center_id,capability) DO UPDATE SET "+
    "version=EXCLUDED.version,state='REQUESTED',"+
    "pending_revision_id=EXCLUDED.pending_revision_id,updated_at=now()",
    [actor.realmId,center,input.capability,next,inserted.rows[0].id]);
   const request:GrantSubmission={kind:"HEALTH_CENTER_ERP_GRANT",
    providerRef:c.provider_id,centerRef:center,revisionRef:inserted.rows[0].id,
    revisionNo:next,digest,requestKey:input.key};
   const caseRow=await this.approval.create(tx,actor,request);
   await tx.query("UPDATE health_center_erp_grant_revision SET original_case_ref=$3 "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,inserted.rows[0].id,caseRow.caseRef]);
   await tx.query(
    "INSERT INTO health_center_erp_grant_command(root_realm_id,actor_ref,"+
    "request_key,request_digest,case_ref,revision_no) VALUES($1,$2,$3,$4,$5,$6)",
    [actor.realmId,actor.accountId,input.key,digest,caseRow.caseRef,next]);
   await tx.query(
    "INSERT INTO health_center_erp_grant_event(root_realm_id,center_id,capability,"+
    "actor_ref,action,source_revision_id) VALUES($1,$2,$3,$4,'REQUESTED',$5)",
    [actor.realmId,center,input.capability,actor.accountId,inserted.rows[0].id]);
   return {caseRef:caseRow.caseRef,reference:caseRow.reference,version:next,
    state:"REQUESTED",replayed:false,
    message:"Your optional center capability request is awaiting independent Foundation review. ERP remains unavailable."};
  });
 }
 async apply(bearer:string,rawCase:string,body:unknown){
  const caseRef=uuid(rawCase),request=control(body);
  const actor=await this.sessions.requireAction(bearer,"health.centers.publish");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.centers.publish");
   const c=await tx.query<{health_provider_id:string;health_center_id:string;
    health_erp_revision_id:string;health_revision_no:number;
    health_source_digest:string;status:string}>(
    "SELECT health_provider_id,health_center_id,health_erp_revision_id,"+
    "health_revision_no,health_source_digest,status FROM cg03_case "+
    "WHERE realm_id=$1 AND id=$2 AND case_kind='HEALTH_CENTER_ERP_GRANT'",
    [actor.realmId,caseRef]);
   const caseRow=c.rows[0];
   if(!caseRow||caseRow.status!=="PENDING_OWNER")
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   const parent=await tx.query("SELECT id FROM health_provider WHERE root_realm_id=$1 "+
    "AND id=$2 AND status='VERIFIED' FOR SHARE",
    [actor.realmId,caseRow.health_provider_id]);
   if(!parent.rowCount)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_SOURCE_CHANGED"});
   const center=await this.center(tx,actor.realmId,caseRow.health_center_id);
   if(center.provider_id!==caseRow.health_provider_id)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   const source=await tx.query<Revision>(
    "SELECT * FROM health_center_erp_grant_revision "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND id=$3 "+
    "AND revision_no=$4 AND source_digest=$5 FOR SHARE",
    [actor.realmId,caseRow.health_center_id,caseRow.health_erp_revision_id,
     caseRow.health_revision_no,caseRow.health_source_digest]);
   const rev=source.rows[0];
   if(!rev||rev.original_case_ref!==caseRef)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   const grant=await tx.query<Grant>(
    "SELECT state,version,pending_revision_id,approved_revision_id,"+
    "original_decision_ref FROM health_center_erp_grant WHERE root_realm_id=$1 "+
    "AND center_id=$2 AND capability=$3 FOR UPDATE",
    [actor.realmId,caseRow.health_center_id,rev.capability]);
   const g=grant.rows[0];
   if(g?.state!=="REQUESTED"||g.version!==rev.revision_no||
     g.pending_revision_id!==rev.id)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   const proof=await this.approval.approved(tx,actor,{
    kind:"HEALTH_CENTER_ERP_GRANT",
    providerRef:caseRow.health_provider_id,centerRef:caseRow.health_center_id,
    revisionRef:rev.id,revisionNo:rev.revision_no,digest:rev.source_digest,
    requestKey:caseRef,caseRef});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,request.password);
   const updated=await tx.query(
    "UPDATE health_center_erp_grant SET state='APPROVED',version=version+1,"+
    "approved_revision_id=$4,original_decision_ref=$5,approved_by=$6,"+
    "updated_at=now() WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND capability=$3 AND version=$7 RETURNING version",
    [actor.realmId,caseRow.health_center_id,rev.capability,rev.id,proof,
     actor.accountId,rev.revision_no]);
   if(!updated.rowCount)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   await this.approval.finish(tx,actor,caseRef);
   await tx.query("INSERT INTO health_center_erp_grant_event(root_realm_id,"+
    "center_id,capability,actor_ref,action,source_revision_id) "+
    "VALUES($1,$2,$3,$4,'APPROVED',$5)",
    [actor.realmId,caseRow.health_center_id,rev.capability,actor.accountId,rev.id]);
   return {state:"APPROVED",version:rev.revision_no+1,effective:false,
    message:"The center permission is approved. ERP operations remain disabled until the separately verified module is installed and switched on."};
  });
 }
 async change(bearer:string,rawCenter:string,rawCap:string,action:"SUSPENDED"|"WITHDRAWN",body:unknown){
  const center=uuid(rawCenter),cap=rawCap as Capability;
  if(!CAPABILITIES.includes(cap))
   throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  const input=control(body);
  if(input.expected===null)
   throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  const actor=await this.sessions.requireAction(bearer,"health.centers.publish");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.centers.publish");
   const ref=await tx.query<{provider_id:string}>(
    "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,center]);
   if(!ref.rows[0])throw new NotFoundException("Center unavailable");
   const parent=await tx.query("SELECT id,status FROM health_provider "+
    "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,ref.rows[0].provider_id]);
   if(!parent.rows[0])throw new NotFoundException("Provider unavailable");
   await tx.query("SELECT id FROM health_center WHERE root_realm_id=$1 "+
    "AND id=$2 FOR SHARE",[actor.realmId,center]);
   const old=await tx.query<Grant>(
    "SELECT state,version,pending_revision_id,approved_revision_id,original_decision_ref "+
    "FROM health_center_erp_grant WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND capability=$3 FOR UPDATE",[actor.realmId,center,cap]);
   const g=old.rows[0];
   if(!g||g.version!==input.expected||action==="SUSPENDED"&&g.state!=="APPROVED"||
     action==="WITHDRAWN"&&g.state==="WITHDRAWN")
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.password);
   await tx.query("UPDATE health_center_erp_grant SET state=$4,"+
    "version=version+1,updated_at=now() WHERE root_realm_id=$1 "+
    "AND center_id=$2 AND capability=$3 AND version=$5",
    [actor.realmId,center,cap,action,g.version]);
   await tx.query("INSERT INTO health_center_erp_grant_event(root_realm_id,"+
    "center_id,capability,actor_ref,action,source_revision_id) "+
    "VALUES($1,$2,$3,$4,$5,$6)",
    [actor.realmId,center,cap,actor.accountId,action,
     g.approved_revision_id??g.pending_revision_id]);
   return {capability:cap,state:action,version:g.version+1,
    effective:false,message:"Optional center ERP access is disabled; existing private records are retained."};
  });
 }
 async foundation(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"health.providers.verify");
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   const found=await tx.query<{center_id:string;capability:Capability;state:string;
    version:number;display_name:string;legal_name:string}>(
    "SELECT g.center_id,g.capability,g.state,g.version,c.display_name,"+
    "p.legal_name FROM health_center_erp_grant g "+
    "JOIN health_center c ON c.id=g.center_id AND c.root_realm_id=g.root_realm_id "+
    "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
    "WHERE g.root_realm_id=$1 ORDER BY g.updated_at DESC,g.center_id "+
    "LIMIT 100",[actor.realmId]);
   return {grants:found.rows.map(row=>({centerRef:row.center_id,
    centerName:row.display_name,providerName:row.legal_name,capability:row.capability,
    status:row.state,version:row.version,global:this.deployment(row.capability).status,
    effective:false}))};
  });
 }
}
