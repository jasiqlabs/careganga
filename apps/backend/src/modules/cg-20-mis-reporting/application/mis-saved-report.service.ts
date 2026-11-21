import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {MisReportSourceService,parseSafeReport,type SafeReportRequest}
 from "./mis-report-source.service";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException({code:"MIS_SAVED_INVALID",message:"Choose an existing saved report."});
 return v;};
const version=(v:unknown)=>{if(typeof v!=="number"||!Number.isSafeInteger(v)||
 v<1||v>1000000)throw new BadRequestException({code:"MIS_SAVED_INVALID",
  message:"Reload this report before saving changes."});return v;};
const name=(v:unknown)=>{
 if(typeof v!=="string"||/[\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"MIS_SAVED_NAME_INVALID",field:"name",
   message:"Enter a report name using ordinary text."});
 const trimmed=v.replace(/\s+/g," ").trim();
 if(trimmed.length<3||trimmed.length>100)
  throw new BadRequestException({code:"MIS_SAVED_NAME_INVALID",field:"name",
   message:"Enter a report name of 3 to 100 characters."});
 return trimmed;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Saved={
 id:string;root_realm_id:string;owner_account_ref:string;
 display_name:string;definition_ref:string;current_revision:number;
 version:number;visibility:"PRIVATE";state:"ACTIVE"|"RETIRED";
 source_key?:string;created_at:Date;updated_at:Date
};
type Definition={safe_request:SafeReportRequest;source_key:string;
 view_kind:string;revision:number};
function decode(v:unknown){
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new ConflictException({code:"MIS_SAVED_SOURCE_INVALID"});
 return parseSafeReport(v);
}
@Injectable()
export class MisSavedReportService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly sources:MisReportSourceService){}
 private async tx<T>(work:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   await c.query("SET LOCAL statement_timeout='10s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await work(c);
   await c.query("COMMIT");active=false;return result;
  }catch(e){if(active)await c.query("ROLLBACK").catch(()=>undefined);
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"MIS_SAVED_CONFLICT",
     message:"This report name or request was already used. Refresh your saved reports."});
   throw e;
  }finally{c.release();}
 }
 private async current(token:string,manage=false){
  const actor=await this.sessions.requireAction(token,"mis.reports.view");
  if(manage)await this.sessions.requireAction(token,"mis.reports.manage");
  return actor;
 }
 private async getOwned(tx:PoolClient,root:string,owner:string,id:string,lock=false){
  const r=await tx.query<Saved>(
   "SELECT * FROM cg20_saved_report WHERE root_realm_id=$1 "+
   "AND owner_account_ref=$2 AND id=$3"+(lock?" FOR UPDATE":""),
   [root,owner,id]);
  const row=r.rows[0];
  if(!row)throw new NotFoundException({code:"MIS_SAVED_NOT_FOUND",
   message:"This saved report is no longer available."});
  return row;
 }
 private async definition(tx:PoolClient,row:Saved){
  const r=await tx.query<Definition>(
   "SELECT safe_request,source_key,view_kind,revision FROM cg20_report_definition "+
   "WHERE root_realm_id=$1 AND id=$2 AND revision=$3",
   [row.root_realm_id,row.definition_ref,row.current_revision]);
  if(!r.rows[0])throw new ConflictException({code:"MIS_SAVED_SOURCE_INVALID"});
  return decode(r.rows[0].safe_request);
 }
 private async request(tx:PoolClient,root:string,owner:string,key:string,
  digest:string){
  const r=await tx.query<{payload_digest:string;action_kind:string;
   saved_ref:string;saved_version:number}>(
   "SELECT payload_digest,action_kind,saved_ref,saved_version "+
   "FROM cg20_saved_request WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [root,owner,key]);
  if(!r.rows[0])return null;
  if(r.rows[0].payload_digest!==digest)
   throw new ConflictException({code:"MIS_SAVED_RETRY_CONFLICT",
    message:"This request was already used for a different report change."});
  return r.rows[0];
 }
 private async record(tx:PoolClient,root:string,owner:string,key:string,
  digest:string,action:string,savedRef:string,savedVersion:number){
  await tx.query(
   "INSERT INTO cg20_saved_request(root_realm_id,actor_ref,request_key,"+
   "payload_digest,action_kind,saved_ref,saved_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
   [root,owner,key,digest,action,savedRef,savedVersion]);
 }
 private summary(row:Saved){
  return {ref:row.id,name:row.display_name,version:row.version,
   revision:row.current_revision,state:row.state,
   visibility:row.visibility,updatedAt:row.updated_at,
   sourceKey:row.source_key??null};
 }
 /** No N+1 source reads on owner-scoped list. Open/preview/export reauthorize
  * the original finance/healthcare facade before revealing report data.
  */
 async list(token:string){
  const actor=await this.current(token);
  const r=await this.db.query<Saved>(
   "SELECT s.*,d.source_key FROM cg20_saved_report s "+
   "JOIN cg20_report_definition d ON d.root_realm_id=s.root_realm_id "+
   "AND d.id=s.definition_ref AND d.revision=s.current_revision "+
   "WHERE s.root_realm_id=$1 AND s.owner_account_ref=$2 "+
   "ORDER BY s.updated_at DESC,s.id DESC LIMIT 51",
   [actor.realmId,actor.accountId]);
  return {items:r.rows.slice(0,50).map(x=>this.summary(x)),
   hasMore:r.rows.length>50};
 }
 async get(token:string,idInput:string){
  const actor=await this.current(token),id=ref(idInput);
  const record=await this.tx(async tx=>{
   const r=await this.getOwned(tx,actor.realmId,actor.accountId,id);
   if(r.state!=="ACTIVE")throw new NotFoundException({code:"MIS_SAVED_NOT_FOUND"});
   return {r,q:await this.definition(tx,r)};
  });
  // Deny stale private source fields if the actor's original owner grant changed.
  await this.sources.preview(token,record.q);
  return {...this.summary(record.r),request:record.q};
 }
 /** Used by CG-20 US-004/005: current source grant is re-evaluated on EVERY
  * operation, not copied from a previous schedule or draft.
  */
 async authorizedRequest(token:string,idInput:string){
  const item=await this.get(token,idInput);
  return {request:item.request,version:item.version,revision:item.revision,
   name:item.name,ref:item.ref};
 }
 async create(token:string,raw:unknown,createdFrom?:string){
  const actor=await this.current(token,true);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const b=raw as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["name","request","requestKey"].includes(k)))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const title=name(b.name),key=ref(b.requestKey),request=parseSafeReport(b.request);
  await this.sources.preview(token,request);
  const action=createdFrom?"COPY":"CREATE";
  const digest=hash({action,title,request,createdFrom:createdFrom??null});
  return this.tx(async tx=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":mis-saved:"+actor.accountId+":"+key]);
   const old=await this.request(tx,actor.realmId,actor.accountId,key,digest);
   if(old){
    const existing=await this.getOwned(tx,actor.realmId,actor.accountId,old.saved_ref);
    return {...this.summary(existing),replayed:true};
   }
   const id=randomUUID();
   await tx.query(
    "INSERT INTO cg20_report_definition(root_realm_id,id,revision,source_key,"+
    "view_kind,safe_request,request_digest,created_by) "+
    "VALUES($1,$2,1,$3,$4,$5::jsonb,$6,$7)",
    [actor.realmId,id,request.kind,request.view,JSON.stringify(request),
     hash(request),actor.accountId]);
   const created=await tx.query<Saved>(
    "INSERT INTO cg20_saved_report(root_realm_id,owner_account_ref,display_name,"+
    "definition_ref,current_revision) VALUES($1,$2,$3,$4,1) RETURNING *",
    [actor.realmId,actor.accountId,title,id]);
   await this.record(tx,actor.realmId,actor.accountId,key,digest,
    action,created.rows[0].id,1);
   return {...this.summary(created.rows[0]),replayed:false};
  });
 }
 async revise(token:string,idInput:string,raw:unknown){
  const actor=await this.current(token,true),id=ref(idInput);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const b=raw as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["name","request","requestKey","expectedVersion"].includes(k)))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const title=name(b.name),key=ref(b.requestKey),expected=version(b.expectedVersion);
  const request=parseSafeReport(b.request);
  await this.sources.preview(token,request);
  const digest=hash({action:"REVISE",id,title,expected,request});
  return this.tx(async tx=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":mis-saved:"+actor.accountId+":"+key]);
   const replay=await this.request(tx,actor.realmId,actor.accountId,key,digest);
   const prior=await this.getOwned(tx,actor.realmId,actor.accountId,id,true);
   if(replay&&replay.saved_ref===id)return {...this.summary(prior),replayed:true};
   if(prior.state!=="ACTIVE"||prior.version!==expected)
    throw new ConflictException({code:"MIS_SAVED_CHANGED",
     message:"This report was changed. Reload its current version."});
   const next=prior.current_revision+1;
   await tx.query(
    "INSERT INTO cg20_report_definition(root_realm_id,id,revision,source_key,"+
    "view_kind,safe_request,request_digest,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)",
    [actor.realmId,prior.definition_ref,next,request.kind,request.view,
     JSON.stringify(request),hash(request),actor.accountId]);
   const changed=await tx.query<Saved>(
    "UPDATE cg20_saved_report SET current_revision=$4,display_name=$5,"+
    "version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND owner_account_ref=$3 AND version=$6 RETURNING *",
    [actor.realmId,id,actor.accountId,next,title,expected]);
   if(!changed.rows[0])throw new ConflictException({code:"MIS_SAVED_CHANGED"});
   await this.record(tx,actor.realmId,actor.accountId,key,digest,
    "REVISE",id,changed.rows[0].version);
   return {...this.summary(changed.rows[0]),replayed:false};
  });
 }
 async copy(token:string,idInput:string,raw:unknown){
  const actor=await this.current(token,true),id=ref(idInput);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const b=raw as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["name","requestKey"].includes(k)))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const title=name(b.name),key=ref(b.requestKey);
  const record=await this.authorizedRequest(token,id);
  // Source-specific rights checked on reauthorization, copy stays PRIVATE.
  return this.create(token,{name:title,request:record.request,requestKey:key},id);
 }
 async retire(token:string,idInput:string,raw:unknown){
  const actor=await this.current(token,true),id=ref(idInput);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const b=raw as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["requestKey","expectedVersion"].includes(k)))
   throw new BadRequestException({code:"MIS_SAVED_INVALID"});
  const key=ref(b.requestKey),expected=version(b.expectedVersion),
   digest=hash({action:"RETIRE",id,expected});
  return this.tx(async tx=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":mis-saved:"+actor.accountId+":"+key]);
   const replay=await this.request(tx,actor.realmId,actor.accountId,key,digest);
   const prior=await this.getOwned(tx,actor.realmId,actor.accountId,id,true);
   if(replay&&replay.saved_ref===id)return {...this.summary(prior),replayed:true};
   if(prior.state!=="ACTIVE"||prior.version!==expected)
    throw new ConflictException({code:"MIS_SAVED_CHANGED",
     message:"This report has changed. Refresh before retiring it."});
   const changed=await tx.query<Saved>(
    "UPDATE cg20_saved_report SET state='RETIRED',retired_at=now(),"+
    "version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND owner_account_ref=$3 AND version=$4 RETURNING *",
    [actor.realmId,id,actor.accountId,expected]);
   if(!changed.rows[0])throw new ConflictException({code:"MIS_SAVED_CHANGED"});
   // A retired definition cannot silently trigger future scheduled work.
   await tx.query(
    "UPDATE cg20_report_schedule SET state='PAUSED',revision=revision+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND saved_ref=$2 AND state='ACTIVE'",
    [actor.realmId,id]);
   await this.record(tx,actor.realmId,actor.accountId,key,digest,
    "RETIRE",id,changed.rows[0].version);
   return {...this.summary(changed.rows[0]),replayed:false};
  });
 }
}
