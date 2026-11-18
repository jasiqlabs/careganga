import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade} from "./health-center-support-scope.facade";
import {HealthCenterContentApprovalService} from "../../cg-03-registration-approvals/application/health-center-content-approval.service";
import type {CenterContentSubmission} from "./health-center-content-review-source.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Content={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[]};
type Draft={version:number;state:string;content:Content};
const EMPTY:Content={description:"",services:[],facilities:[],
 hoursNote:"",publicEmail:"",faqs:[]};
const uuid=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});return v;};
const field=(v:unknown,max:number,min=0)=>{
 if(typeof v!=="string"||v.trim().length<min||v.length>max||
   /[\u0000-\u001f\u007f]/.test(v)||
   /<[a-z/!][^>]*>/i.test(v))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 return v.trim();
};
function parse(value:unknown):Content{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["description","services","facilities","hoursNote",
  "publicEmail","faqs"].includes(k)))throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const strings=(v:unknown,maxCount:number,maxLength:number)=>{
  if(!Array.isArray(v)||v.length>maxCount)return null;
  const items=v.map(a=>field(a,maxLength,2));
  if(new Set(items.map(a=>a.toLowerCase())).size!==items.length)return null;
  return items;
 };
 const services=strings(x.services,20,100),facilities=strings(x.facilities,20,100);
 if(!services||!facilities||!Array.isArray(x.faqs)||x.faqs.length>15)
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const faqs=x.faqs.map((item:unknown)=>{
  if(!item||typeof item!=="object"||Array.isArray(item)||
    Object.keys(item).some(k=>!["question","answer"].includes(k)))
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const faq=item as {question:unknown;answer:unknown};
  return {question:field(faq.question,160,5),answer:field(faq.answer,800,10)};
 });
 if(new Set(faqs.map(f=>f.question.toLowerCase())).size!==faqs.length)
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const publicEmail=field(x.publicEmail,180);
 if(publicEmail&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(publicEmail))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID",field:"publicEmail"});
 return {description:field(x.description,1600),services,facilities,
  hoursNote:field(x.hoursNote,320),publicEmail,faqs};
}
@Injectable()
export class HealthCenterContentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly scope:HealthCenterSupportScopeFacade,
  private readonly review:HealthCenterContentApprovalService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");active=false;
   return result;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async own(bearer:string,centerRef:string){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const result=await tx.query<Draft>(
    "SELECT version,state,content FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR SHARE",[actor.realmId,center]);
   const data=result.rows[0];
   const previous=await tx.query<{approval_case_ref:string|null;status:string|null}>(
    "SELECT rev.approval_case_ref,cg.status FROM health_center_content_revision rev "+
    "LEFT JOIN cg03_case cg ON cg.id=rev.approval_case_ref AND cg.realm_id=rev.root_realm_id "+
    "WHERE rev.root_realm_id=$1 AND rev.center_id=$2 "+
    "ORDER BY rev.revision_no DESC,rev.id DESC LIMIT 1",
    [actor.realmId,center]);
   return {centerRef:center,version:data?.version??0,state:data?.state??"DRAFT",
    content:data?.content??EMPTY,
    reviewCaseRef:previous.rows[0]?.approval_case_ref??null,
    reviewStatus:previous.rows[0]?.status??null};
  });
 }
 async save(bearer:string,centerRef:string,body:unknown){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
    bearer,"health.centers.draft.edit");
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const x=body as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["requestKey","expectedVersion","content"].includes(k))||
    !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||
    Number(x.expectedVersion)>2147483646)
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const key=uuid(x.requestKey),expected=Number(x.expectedVersion),
    value=parse(x.content);
  const inputHash=createHash("sha256").update(JSON.stringify([center,expected,value])).digest("hex");
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const cmd=await tx.query<{id:string}>(
    "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
    "request_key,request_digest) VALUES($1,$2,'CENTER_CONTENT_SAVE',$3,$4) "+
    "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING RETURNING id",
    [actor.realmId,actor.accountId,key,inputHash]);
   if(!cmd.rows[0]){
    const old=await tx.query<{request_digest:string;result_ref:string;result_version:number}>(
     "SELECT request_digest,result_ref,result_version FROM health_network_command "+
     "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key='CENTER_CONTENT_SAVE' "+
     "AND request_key=$3 FOR SHARE",[actor.realmId,actor.accountId,key]);
    if(old.rows[0]?.request_digest!==inputHash||old.rows[0].result_ref!==center)
     throw new ConflictException({code:"HEALTH_CONTENT_REQUEST_CONFLICT"});
    return {centerRef:center,version:old.rows[0].result_version,
     state:"DRAFT",replayed:true};
   }
   const existing=await tx.query<{version:number;state:string}>(
    "SELECT version,state FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR UPDATE",[actor.realmId,center]);
   const row=existing.rows[0];
   if((row?.version??0)!==expected||row?.state==="SUBMITTED")
    throw new ConflictException({code:"HEALTH_CONTENT_VERSION_CHANGED"});
   const saved=await tx.query<{version:number}>(
    "INSERT INTO health_center_content_draft(root_realm_id,center_id,version,"+
    "state,content,updated_by) VALUES($1,$2,1,'DRAFT',$3::jsonb,$4) "+
    "ON CONFLICT(root_realm_id,center_id) DO UPDATE SET "+
    "version=health_center_content_draft.version+1,state='DRAFT',"+
    "content=EXCLUDED.content,updated_by=EXCLUDED.updated_by,updated_at=now() "+
    "RETURNING version",[actor.realmId,center,JSON.stringify(value),actor.accountId]);
   const version=saved.rows[0].version;
   await tx.query(
    "INSERT INTO health_center_content_event(root_realm_id,center_id,actor_ref,"+
    "action_key,source_version) VALUES($1,$2,$3,'DRAFT_SAVED',$4)",
    [actor.realmId,center,actor.accountId,version]);
   await tx.query(
    "UPDATE health_network_command SET result_ref=$2,result_version=$3 WHERE id=$1",
    [cmd.rows[0].id,center,version]);
   return {centerRef:center,version,state:"DRAFT",replayed:false,
    message:"Your changes are saved as a private draft. Foundation approval is required before publication."};
  });
 }

 async submit(bearer:string,centerRef:string,body:unknown){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const x=body as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["requestKey","expectedVersion"].includes(k))||
    !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1)
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const key=uuid(x.requestKey),expected=Number(x.expectedVersion);
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const cmdHash=createHash("sha256").update(JSON.stringify([center,expected])).digest("hex");
   const command=await tx.query<{id:string}>(
    "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
    "request_key,request_digest) VALUES($1,$2,'CENTER_CONTENT_SUBMIT',$3,$4) "+
    "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING RETURNING id",
    [actor.realmId,actor.accountId,key,cmdHash]);
   if(!command.rows[0]){
    const old=await tx.query<{request_digest:string;result_ref:string;result_version:number}>(
     "SELECT request_digest,result_ref,result_version FROM health_network_command "+
     "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key='CENTER_CONTENT_SUBMIT' "+
     "AND request_key=$3 FOR SHARE",[actor.realmId,actor.accountId,key]);
    if(!old.rows[0]||old.rows[0].request_digest!==cmdHash||!old.rows[0].result_ref)
     throw new ConflictException({code:"HEALTH_CONTENT_REQUEST_CONFLICT"});
    return {caseRef:old.rows[0].result_ref,version:old.rows[0].result_version,
     state:"SUBMITTED",replayed:true};
   }
   const centerRow=await tx.query<{provider_id:string}>(
    "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,center]);
   if(!centerRow.rows[0])throw new NotFoundException("Center unavailable");
   const draft=await tx.query<Draft>(
    "SELECT version,state,content FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR UPDATE",
    [actor.realmId,center]);
   const d=draft.rows[0];
   if(!d||d.version!==expected||!["DRAFT","RETURNED"].includes(d.state))
    throw new ConflictException({code:"HEALTH_CONTENT_VERSION_CHANGED"});
   const snapshot=parse(d.content);
   if(snapshot.description.length<20||snapshot.services.length===0)
    throw new BadRequestException({code:"HEALTH_CONTENT_REQUIRED"});
   const digest=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
   const revision=await tx.query<{id:string}>(
    "INSERT INTO health_center_content_revision(root_realm_id,center_id,"+
    "revision_no,source_version,source_snapshot,source_digest,submitted_by) "+
    "VALUES($1,$2,$3,$3,$4::jsonb,$5,$6) RETURNING id",
    [actor.realmId,center,expected,JSON.stringify(snapshot),digest,actor.accountId]);
   await tx.query(
    "UPDATE health_center_content_draft SET state='SUBMITTED',version=version+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND center_id=$2",
    [actor.realmId,center]);
   const input:CenterContentSubmission={kind:"HEALTH_CENTER_CONTENT_REVIEW",
    providerRef:centerRow.rows[0].provider_id,centerRef:center,
    revisionRef:revision.rows[0].id,revisionNo:expected,digest,requestKey:key};
   const original=await this.review.create(tx,actor,input);
   await tx.query(
    "UPDATE health_center_content_revision SET approval_case_ref=$3 "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,revision.rows[0].id,original.caseRef]);
   await tx.query(
    "UPDATE health_network_command SET result_ref=$2,result_version=$3 WHERE id=$1",
    [command.rows[0].id,original.caseRef,expected+1]);
   await tx.query(
    "INSERT INTO health_center_content_event(root_realm_id,center_id,actor_ref,"+
    "action_key,source_version) VALUES($1,$2,$3,'SUBMITTED',$4)",
    [actor.realmId,center,actor.accountId,expected]);
   return {caseRef:original.caseRef,reference:original.reference,
    version:expected+1,state:"SUBMITTED",replayed:false,
    message:"Submitted for independent Foundation review. Public content is unchanged."};
  });
 }
 async apply(bearer:string,caseRef:string){
  const ref=uuid(caseRef),actor=await this.sessions.requireAction(
   bearer,"health.providers.verify");
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   // Discover references without locking; acquire parent → center → draft →
   // original approval locks in that order.
   const source=await tx.query<{health_provider_id:string;health_center_id:string;
    health_content_revision_id:string;health_revision_no:number;
    health_source_digest:string;status:string}>(
    "SELECT health_provider_id,health_center_id,health_content_revision_id,"+
    "health_revision_no,health_source_digest,status FROM cg03_case "+
    "WHERE realm_id=$1 AND id=$2 AND case_kind='HEALTH_CENTER_CONTENT_REVIEW'",
    [actor.realmId,ref]);
   const c=source.rows[0];
   if(!c||c.status!=="PENDING_OWNER")
    throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
   const input:CenterContentSubmission&{caseRef:string}={
    kind:"HEALTH_CENTER_CONTENT_REVIEW",
    providerRef:c.health_provider_id,centerRef:c.health_center_id,
    revisionRef:c.health_content_revision_id,revisionNo:c.health_revision_no,
    digest:c.health_source_digest,requestKey:ref,caseRef:ref};
   const checked=await tx.query<{status:string}>(
    "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,c.health_provider_id]);
   const center=await tx.query<{status:string;access_state:string}>(
    "SELECT status,access_state FROM health_center "+
    "WHERE root_realm_id=$1 AND provider_id=$2 AND id=$3 FOR SHARE",
    [actor.realmId,c.health_provider_id,c.health_center_id]);
   if(checked.rows[0]?.status!=="VERIFIED"||
     center.rows[0]?.status!=="VERIFIED"||center.rows[0]?.access_state!=="ENABLED")
    throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
   const draft=await tx.query<Draft>(
    "SELECT version,state,content FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR UPDATE",
    [actor.realmId,c.health_center_id]);
   if(draft.rows[0]?.state!=="SUBMITTED")
    throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
   const evidence=await tx.query(
    "SELECT id FROM health_center_content_revision "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND id=$3 "+
    "AND revision_no=$4 AND source_digest=$5 FOR SHARE",
    [actor.realmId,c.health_center_id,c.health_content_revision_id,
     c.health_revision_no,c.health_source_digest]);
   if(!evidence.rowCount)
    throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
   const decision=await this.review.approved(tx,actor,input);
   await tx.query(
    "INSERT INTO health_center_content_publication(root_realm_id,center_id,"+
    "approved_revision_id,original_decision_ref,generation,withdrawn_at) "+
    "VALUES($1,$2,$3,$4,1,NULL) ON CONFLICT(root_realm_id,center_id) "+
    "DO UPDATE SET approved_revision_id=EXCLUDED.approved_revision_id,"+
    "original_decision_ref=EXCLUDED.original_decision_ref,"+
    "generation=health_center_content_publication.generation+1,"+
    "withdrawn_at=NULL,published_at=now()",
    [actor.realmId,c.health_center_id,c.health_content_revision_id,decision]);
   await tx.query(
    "UPDATE health_center_content_draft SET state='APPROVED',"+
    "version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND center_id=$2",
    [actor.realmId,c.health_center_id]);
   await this.review.finish(tx,actor,ref);
   await tx.query(
    "INSERT INTO health_center_content_event(root_realm_id,center_id,actor_ref,"+
    "action_key,source_version) VALUES($1,$2,$3,'PUBLISHED',$4)",
    [actor.realmId,c.health_center_id,actor.accountId,c.health_revision_no]);
   return {centerRef:c.health_center_id,published:true,
    message:"Independently approved center content is now published."};
  });
 }
 async reopen(bearer:string,centerRef:string,caseRef:string){
  const center=uuid(centerRef),ref=uuid(caseRef);
  const actor=await this.sessions.requireAction(bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const draft=await tx.query<Draft>(
    "SELECT version,state,content FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR UPDATE",
    [actor.realmId,center]);
   const last=await tx.query<{status:string}>(
    "SELECT status FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND health_center_id=$3 AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
    "FOR SHARE",[actor.realmId,ref,center]);
   if(!last.rows[0]||!["RETURNED","REJECTED"].includes(last.rows[0].status)||
     draft.rows[0]?.state!=="SUBMITTED")
    throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
   await tx.query(
    "UPDATE health_center_content_draft SET state='RETURNED',"+
    "version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND center_id=$2",
    [actor.realmId,center]);
   await tx.query(
    "INSERT INTO health_center_content_event(root_realm_id,center_id,actor_ref,"+
    "action_key,source_version) VALUES($1,$2,$3,'RETURNED',$4)",
    [actor.realmId,center,actor.accountId,draft.rows[0].version]);
   return {centerRef:center,status:"RETURNED",
    version:draft.rows[0].version+1,
    message:"The reviewed changes are returned for correction. Public content remains unchanged."};
  });
 }
 async withdraw(bearer:string,centerRef:string){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
   bearer,"health.providers.verify");
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   const c=await tx.query<{provider_id:string}>(
    "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,center]);
   if(!c.rows[0])throw new NotFoundException("Center unavailable");
   await tx.query("SELECT id FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,c.rows[0].provider_id]);
   await tx.query("SELECT id FROM health_center WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,center]);
   const publication=await tx.query<{generation:number}>(
    "UPDATE health_center_content_publication SET withdrawn_at=now(),"+
    "generation=generation+1 WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND withdrawn_at IS NULL RETURNING generation",
    [actor.realmId,center]);
   if(!publication.rows[0])
    throw new ConflictException({code:"HEALTH_CONTENT_ALREADY_WITHDRAWN"});
   await tx.query(
    "INSERT INTO health_center_content_event(root_realm_id,center_id,actor_ref,"+
    "action_key,source_version) VALUES($1,$2,$3,'WITHDRAWN',$4)",
    [actor.realmId,center,actor.accountId,publication.rows[0].generation]);
   return {centerRef:center,published:false,
    message:"The approved center presentation has been withdrawn from public pages."};
  });
 }

}
