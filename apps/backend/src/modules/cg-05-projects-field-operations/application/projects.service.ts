import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {canTransition,choice,clean,date,invalid,optionalRef,parseBranch,parseCreate,parseEdit,parseStatus,priorities,ref,stale,statuses,type ProjectStatus} from "../domain/project-input";

type ProjectRow={id:string;root_realm_id:string;branch_ref:string|null;owner_account_ref:string;status:ProjectStatus;version:number};
type Scope={all:boolean;branches:{value:string;label:string;managerRef:string}[]};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const csvCell=(v:unknown)=>{let s=String(v??"").replace(/[\u0000-\u001f\u007f]/g," ");if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const projection='p.id AS ref,p.code_norm AS code,p.title,p.category,p.summary,p.description,p.status,p.priority,p.owner_account_ref AS "ownerRef",a.display_name AS owner,p.branch_ref AS "branchRef",b.name AS branch,p.state_ref AS "stateRef",s.display_name AS state,p.district_ref AS "districtRef",d.display_name AS district,p.location_label AS location,p.funding_source AS "fundingSource",p.planned_start::text AS "plannedStart",p.planned_end::text AS "plannedEnd",p.planned_budget_minor::text AS "plannedBudgetMinor",p.version,p.updated_at AS "updatedAt",p.completed_at AS "completedAt"';
const joins=" FROM project p JOIN account a ON a.id=p.owner_account_ref AND a.realm_id=p.root_realm_id LEFT JOIN branch b ON b.id=p.branch_ref AND b.root_realm_id=p.root_realm_id LEFT JOIN geography_area s ON s.id=p.state_ref AND s.root_realm_id=p.root_realm_id LEFT JOIN geography_area d ON d.id=p.district_ref AND d.root_realm_id=p.root_realm_id";
@Injectable()
export class ProjectsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 async run<T>(token:string,action:string,work:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>,read=false){
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");await this.identity.assertCurrent(tx,a,action);const v=await work(tx,a);await tx.query("COMMIT");return v;}
  catch(e){await tx.query("ROLLBACK");if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")throw new ConflictException({code:"CG05_DUPLICATE"});if(e&&typeof e==="object"&&"code" in e&&e.code==="40001")throw stale();throw e;}finally{tx.release();}
 }
 private scopeParams(a:VerifiedFoundationActor,s:Scope){return [a.realmId,s.all,s.branches.map(b=>b.value),a.accountId];}
 private async owner(tx:PoolClient,a:VerifiedFoundationActor,branch:string|null,owner:string){
  const b=await this.branches.projectBranch(tx,a,branch);
  if(branch&&owner!==a.accountId&&owner!==b.managerRef)throw new ForbiddenException("Choose the current branch coordinator");
  return this.identity.eligibleOfficeholder(tx,a,owner);
 }
 private async row(tx:PoolClient,a:VerifiedFoundationActor,key:string,write=false){
  const r=(await tx.query<ProjectRow>("SELECT id,root_realm_id,branch_ref,owner_account_ref,status,version FROM project WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref(key)])).rows[0];
  if(!r)throw new NotFoundException("Project unavailable");
  if(write)await this.branches.projectBranch(tx,a,r.branch_ref);
  else{
   const s=await this.branches.projectBranchScope(tx,a);
   if(r.branch_ref){if(!s.branches.some(b=>b.value===r.branch_ref))throw new ForbiddenException("Project unavailable in current scope");}
   else if(!s.all&&r.owner_account_ref!==a.accountId)throw new ForbiddenException("Project unavailable in current scope");
  }
  return r;
 }
 /** Typed owner access for the CG19 project cover adapter. The exact
  * immutable source revision must remain current before bytes are accepted. */
 async guardCover(tx:PoolClient,a:VerifiedFoundationActor,projectRef:string,expectedVersion:number|null,write:boolean){
  await this.identity.assertCurrent(tx,a,"projects.view");
  if(write)await this.identity.assertCurrent(tx,a,"projects.manage");
  const p=await this.row(tx,a,projectRef,false);
  if(write){await this.branches.projectBranch(tx,a,p.branch_ref);if(["CANCELLED","COMPLETED"].includes(p.status))throw stale();}
  if(expectedVersion!==null&&p.version!==expectedVersion)throw stale();
  return p;
 }
 async geography(token:string,stateInput:unknown){const state=optionalRef(stateInput);return this.run(token,"projects.view",async(tx,a)=>this.branches.projectGeographyOptions(tx,a,state),true);}
 async options(token:string,query:Record<string,unknown>){
  const branch=optionalRef(query.branchRef),state=optionalRef(query.stateRef),q=clean(query.q??"",0,80),selected=query.branchRef!==undefined;
  return this.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   const s=await this.branches.projectBranchScope(tx,a);
   const self=await this.identity.eligibleOfficeholder(tx,a,a.accountId);
   let owners:{value:string;label:string}[]=[{value:self.accountRef,label:self.displayName}];
   if(selected&&branch){const b=await this.branches.projectBranch(tx,a,branch);if(b.managerRef&&b.managerRef!==a.accountId){try{const v=await this.identity.eligibleOfficeholder(tx,a,b.managerRef);owners.push({value:v.accountRef,label:v.displayName});}catch(e){if(!(e instanceof ForbiddenException))throw e;}}}
   else if(s.all&&!branch){const list=await this.identity.eligibleOfficeholderOptions(tx,a,q);owners.push(...list.filter(v=>v.value!==a.accountId));}
   return {canManageFoundation:s.all,branches:s.branches.map(({value,label})=>({value,label})),owners,states:await this.branches.projectGeographyOptions(tx,a,null),districts:state?await this.branches.projectGeographyOptions(tx,a,state):[]};
  },true);
 }
 private async replay(tx:PoolClient,a:VerifiedFoundationActor,key:string,hash:string,action:string,target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":CG05:"+key]);
  const e=(await tx.query<{project_id:string;actor_ref:string;payload_digest:string;action:string;result_version:number}>("SELECT project_id,actor_ref,payload_digest,action,result_version FROM project_event WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];
  if(!e)return null;
  if(e.actor_ref!==a.accountId||e.payload_digest!==hash||e.action!==action||target&&target!==e.project_id)throw stale();
  await this.row(tx,a,e.project_id,false);
  return {ref:e.project_id,version:e.result_version,replayed:true};
 }
 private async audit(tx:PoolClient,a:VerifiedFoundationActor,r:ProjectRow,key:string,hash:string,action:string,prior:string|null,reason=""){
  await tx.query("INSERT INTO project_event(root_realm_id,project_id,actor_ref,request_key,payload_digest,action,result_version,prior_status,resulting_status,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[a.realmId,r.id,a.accountId,key,hash,action,r.version,prior,r.status,reason]);
  return {ref:r.id,version:r.version,replayed:false};
 }
 async create(token:string,raw:unknown){
  const v=parseCreate(raw),hash=digest(v);
  return this.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   const old=await this.replay(tx,a,v.key,hash,"CREATE");if(old)return old;
   await this.owner(tx,a,v.branch,v.owner);
   await this.branches.projectGeography(tx,a,v.state,v.district);
   const r=(await tx.query<ProjectRow>("INSERT INTO project(root_realm_id,code_norm,title,category,summary,description,status,priority,owner_account_ref,scope_kind,branch_ref,state_ref,district_ref,location_label,funding_source,planned_start,planned_end,planned_budget_minor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *",[a.realmId,v.code,v.title,v.category,v.summary,v.description,v.status,v.priority,v.owner,v.branch?"BRANCH":"FOUNDATION",v.branch,v.state,v.district,v.location,v.funding,v.start,v.end,v.budget,a.accountId])).rows[0];
   await tx.query("INSERT INTO project_branch_history(root_realm_id,project_id,branch_ref,valid_from,change_key,changed_by) VALUES($1,$2,$3,clock_timestamp(),$4,$5)",[a.realmId,r.id,v.branch,v.key,a.accountId]);
   return this.audit(tx,a,r,v.key,hash,"CREATE",null);
  });
 }
 async edit(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseEdit(raw),hash=digest([target,v]);
  return this.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   const old=await this.replay(tx,a,v.key,hash,"EDIT",target);if(old)return old;
   const r=await this.row(tx,a,target,true);if(r.version!==v.expected||["COMPLETED","CANCELLED"].includes(r.status))throw stale();
   await this.owner(tx,a,r.branch_ref,v.owner);await this.branches.projectGeography(tx,a,v.state,v.district);
   const next=(await tx.query<ProjectRow>("UPDATE project SET code_norm=$3,title=$4,category=$5,summary=$6,description=$7,priority=$8,owner_account_ref=$9,state_ref=$10,district_ref=$11,location_label=$12,funding_source=$13,planned_start=$14,planned_end=$15,planned_budget_minor=$16,version=version+1,updated_at=clock_timestamp() WHERE root_realm_id=$1 AND id=$2 AND version=$17 RETURNING *",[a.realmId,target,v.code,v.title,v.category,v.summary,v.description,v.priority,v.owner,v.state,v.district,v.location,v.funding,v.start,v.end,v.budget,v.expected])).rows[0];
   if(!next)throw stale();return this.audit(tx,a,next,v.key,hash,"EDIT",r.status);
  });
 }
 async status(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseStatus(raw),hash=digest([target,v]);
  return this.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   const old=await this.replay(tx,a,v.key,hash,"STATUS",target);if(old)return old;
   const r=await this.row(tx,a,target,true);if(r.version!==v.expected||!canTransition(r.status,v.status))throw stale();
   const next=(await tx.query<ProjectRow>("UPDATE project SET status=$3,completed_at=CASE WHEN $3='COMPLETED' THEN clock_timestamp() ELSE NULL END,version=version+1,updated_at=clock_timestamp() WHERE root_realm_id=$1 AND id=$2 AND version=$4 RETURNING *",[a.realmId,target,v.status,v.expected])).rows[0];
   if(!next)throw stale();return this.audit(tx,a,next,v.key,hash,"STATUS",r.status,v.reason);
  });
 }
 async branchChange(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseBranch(raw),hash=digest([target,v]);
  return this.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   const old=await this.replay(tx,a,v.key,hash,"BRANCH_MOVE",target);if(old)return old;
   const r=await this.row(tx,a,target,true);if(r.version!==v.expected||r.branch_ref===v.branch||["COMPLETED","CANCELLED"].includes(r.status))throw stale();
   await this.owner(tx,a,v.branch,v.owner);
   const at=(await tx.query<{at:string}>("SELECT clock_timestamp()::text AS at")).rows[0].at;
   const closed=await tx.query("UPDATE project_branch_history SET valid_to=$3 WHERE root_realm_id=$1 AND project_id=$2 AND valid_to IS NULL AND valid_from<$3",[a.realmId,target,at]);if(closed.rowCount!==1)throw stale();
   await tx.query("INSERT INTO project_branch_history(root_realm_id,project_id,branch_ref,valid_from,change_key,changed_by) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,target,v.branch,at,v.key,a.accountId]);
   const next=(await tx.query<ProjectRow>("UPDATE project SET branch_ref=$3,scope_kind=$4,owner_account_ref=$5,version=version+1,updated_at=$6 WHERE root_realm_id=$1 AND id=$2 AND version=$7 RETURNING *",[a.realmId,target,v.branch,v.branch?"BRANCH":"FOUNDATION",v.owner,at,v.expected])).rows[0];
   if(!next)throw stale();return this.audit(tx,a,next,v.key,hash,"BRANCH_MOVE",r.status,v.reason);
  });
 }
 private whereScope="p.root_realm_id=$1 AND ((p.branch_ref IS NULL AND ($2::boolean OR p.owner_account_ref=$4)) OR (b.status='ACTIVE' AND p.branch_ref=ANY($3::uuid[])))";
 async list(token:string,query:Record<string,unknown>,mine=false,exporting=false){
  const q=clean(query.q??"",0,100).toLowerCase(),category=clean(query.category??"",0,80),funding=clean(query.fundingSource??"",0,160),status=choice(query.status??"ALL",["ALL",...statuses]),priority=choice(query.priority??"ALL",["ALL",...priorities]),state=optionalRef(query.stateRef),district=optionalRef(query.districtRef),from=date(query.from),to=date(query.to),offset=Number(query.offset??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||from&&to&&from>to||district&&!state)throw invalid();
  return this.run(token,exporting?"projects.export":"projects.view",async(tx,a)=>{
   if(exporting)await this.identity.assertCurrent(tx,a,"projects.view");
   const s=await this.branches.projectBranchScope(tx,a);
   const scope=this.whereScope+(mine?" AND p.owner_account_ref=$4":"");
   if(state||district)await this.branches.projectGeography(tx,a,state,district);
   const values=[...this.scopeParams(a,s),q,category,status,priority,funding,state,district,from,to];
   const filters=" AND ($5='' OR strpos(lower(p.code_norm),$5)>0 OR strpos(lower(p.title),$5)>0 OR strpos(lower(a.display_name),$5)>0 OR strpos(lower(p.location_label),$5)>0) AND ($6='' OR lower(p.category)=lower($6)) AND ($7='ALL' OR p.status=$7) AND ($8='ALL' OR p.priority=$8) AND ($9='' OR strpos(lower(p.funding_source),lower($9))>0) AND ($10::uuid IS NULL OR p.state_ref=$10) AND ($11::uuid IS NULL OR p.district_ref=$11) AND ($12::date IS NULL OR p.planned_start>=$12) AND ($13::date IS NULL OR p.planned_end<=$13)";
   const page=await tx.query("SELECT "+projection+joins+" WHERE "+scope+filters+" ORDER BY p.updated_at DESC,p.id DESC LIMIT $14 OFFSET $15",[...values,exporting?501:26,offset]);
   const items=page.rows.slice(0,exporting?500:25);
   if(exporting){const columns=["code","title","category","status","priority","owner","branch","state","district","location","fundingSource","plannedStart","plannedEnd","plannedBudgetMinor"];return {csv:[columns,...items.map(row=>columns.map(c=>row[c]))].map(row=>row.map(csvCell).join(",")).join("\r\n"),rows:items.length,hasMore:page.rows.length>500};}
   const counts=(await tx.query("SELECT count(*)::integer AS total,count(*) FILTER(WHERE p.status='ACTIVE')::integer AS active,count(*) FILTER(WHERE p.status='ON_HOLD')::integer AS hold,count(*) FILTER(WHERE p.status='COMPLETED')::integer AS completed,count(*) FILTER(WHERE p.status='CANCELLED')::integer AS cancelled,count(*) FILTER(WHERE p.status IN('DRAFT','PLANNED'))::integer AS planned,COALESCE(sum(p.planned_budget_minor),0)::text AS \"plannedBudgetMinor\""+joins+" WHERE "+scope,this.scopeParams(a,s))).rows[0];
   const categories=(await tx.query("SELECT p.category AS label,count(*)::integer AS count"+joins+" WHERE "+scope+" GROUP BY p.category ORDER BY count DESC,label LIMIT 8",this.scopeParams(a,s))).rows;
   const recent=(await tx.query("SELECT p.title,e.action,e.resulting_status AS status,e.occurred_at AS at"+joins+" JOIN project_event e ON e.root_realm_id=p.root_realm_id AND e.project_id=p.id WHERE "+scope+" ORDER BY e.occurred_at DESC,e.id DESC LIMIT 5",this.scopeParams(a,s))).rows;
   return {items,counts,categories,recent,offset,hasMore:page.rows.length>25};
  },true);
 }
 async detail(token:string,id:string){
  const target=ref(id);
  return this.run(token,"projects.view",async(tx,a)=>{
   await this.row(tx,a,target);
   const item=(await tx.query("SELECT "+projection+joins+" WHERE p.root_realm_id=$1 AND p.id=$2",[a.realmId,target])).rows[0];
   const history=(await tx.query("SELECT e.action,e.prior_status AS \"priorStatus\",e.resulting_status AS status,e.reason,e.occurred_at AS at,a.display_name AS actor FROM project_event e JOIN account a ON a.id=e.actor_ref AND a.realm_id=e.root_realm_id WHERE e.root_realm_id=$1 AND e.project_id=$2 ORDER BY e.result_version DESC LIMIT 50",[a.realmId,target])).rows;
   const branchHistory=(await tx.query("SELECT COALESCE(b.name,'Foundation') AS branch,h.valid_from AS \"validFrom\",h.valid_to AS \"validTo\" FROM project_branch_history h LEFT JOIN branch b ON b.id=h.branch_ref AND b.root_realm_id=h.root_realm_id WHERE h.root_realm_id=$1 AND h.project_id=$2 ORDER BY h.valid_from DESC LIMIT 50",[a.realmId,target])).rows;
   let canManage=false;try{await this.identity.assertCurrent(tx,a,"projects.manage");await this.branches.projectBranch(tx,a,item.branchRef);canManage=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
   return {...item,history,branchHistory,canManage,financeStatus:"NOT_LINKED",publicStatus:"PRIVATE"};
  },true);
 }
}
