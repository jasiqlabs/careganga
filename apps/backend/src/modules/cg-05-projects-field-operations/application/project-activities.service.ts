import {ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {currentTaskEmployee,taskEmployeeFrom} from "../../cg-10-human-resources/application/hr-project-task-source";
import {ProjectsService} from "./projects.service";
import {choice,clean,date,invalid,optionalRef,ref,stale} from "../domain/project-input";
import {activityKinds,activityStatuses,activityTransition,parseActivityCreate,parseActivityEdit,parseActivityStatus,type ActivityStatus} from "../domain/activity-input";
type Actor=VerifiedFoundationActor;
type ActivityRow={id:string;project_id:string|null;branch_ref:string|null;owner_account_ref:string;kind:"ACTIVITY"|"EVENT";status:ActivityStatus;version:number;scheduled_start:Date;scheduled_end:Date};
type Project={id:string;branch_ref:string|null;owner_account_ref:string;status:string;planned_start:string|null;planned_end:string|null};
type Work=ReturnType<typeof parseActivityCreate>|ReturnType<typeof parseActivityEdit>;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const closed=(s:string)=>s==="COMPLETED"||s==="CANCELLED";
const csv=(v:unknown)=>{let x=String(v??"").replace(/[\u0000-\u001f\u007f]/g," ");if(/^\s*[=+\-@]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';};
const grant=(a:string,k:string)=>`EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active WHERE ar.account_id=${a}.id AND ar.realm_id=${a}.realm_id AND ar.revoked_at IS NULL AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='${k}')))`;
const eligible=(a:string)=>`${a}.status='ACTIVE' AND ${grant(a,"projects.activities.view")} AND (${grant(a,"projects.activities.progress")} OR ${grant(a,"projects.activities.manage")})`;
const effectiveBranch="CASE WHEN x.project_id IS NULL THEN x.branch_ref ELSE p.branch_ref END";
const joins=` FROM project_activity x LEFT JOIN project p ON p.root_realm_id=x.root_realm_id AND p.id=x.project_id
 LEFT JOIN branch b ON b.root_realm_id=x.root_realm_id AND b.id=(${effectiveBranch})
 JOIN account a ON a.realm_id=x.root_realm_id AND a.id=x.owner_account_ref
 LEFT JOIN geography_area st ON st.root_realm_id=x.root_realm_id AND st.id=x.state_ref
 LEFT JOIN geography_area dt ON dt.root_realm_id=x.root_realm_id AND dt.id=x.district_ref`;
const ownerCurrent=`(${eligible("a")} AND x.branch_ref IS NOT DISTINCT FROM (${effectiveBranch})
 AND ((NOT EXISTS(SELECT 1 FROM hr_employee h0 WHERE h0.root_realm_id=x.root_realm_id AND h0.account_ref=a.id)
 AND (x.branch_ref IS NULL OR b.manager_account_ref=a.id OR p.owner_account_ref=a.id OR ${grant("a","foundation.branches.admin")}))
 OR EXISTS(SELECT 1 FROM ${taskEmployeeFrom} WHERE e.root_realm_id=x.root_realm_id AND e.account_ref=a.id AND (x.branch_ref IS NULL OR h.branch_ref=x.branch_ref) AND ${currentTaskEmployee})))`;
const select=`x.id AS ref,x.activity_code AS code,x.project_id AS "projectRef",p.title AS project,x.kind,x.title,x.category,x.activity_type AS "activityType",x.description,x.program_label AS program,x.branch_ref AS "branchRef",b.name AS branch,x.state_ref AS "stateRef",st.display_name AS state,x.district_ref AS "districtRef",dt.display_name AS district,x.venue_label AS venue,a.display_name AS owner,x.owner_account_ref AS "ownerRef",x.scheduled_start AS "scheduledStart",x.scheduled_end AS "scheduledEnd",x.actual_start AS "actualStart",x.actual_end AS "actualEnd",x.outcome,x.status,x.version,x.updated_at AS "updatedAt",(${ownerCurrent}) AS "ownerCurrent",x.branch_ref IS DISTINCT FROM (${effectiveBranch}) AS "scopeChanged"`;
@Injectable()
export class ProjectActivitiesService{
 constructor(private readonly projects:ProjectsService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async has(tx:PoolClient,a:Actor,key:string){try{await this.identity.assertCurrent(tx,a,key);return true;}catch(e){if(e instanceof ForbiddenException)return false;throw e;}}
 private async parent(tx:PoolClient,a:Actor,key:string|null){
  if(!key)return null;
  const p=(await tx.query<Project>("SELECT id,branch_ref,owner_account_ref,status,planned_start::text,planned_end::text FROM project WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,key])).rows[0];
  if(!p)throw new NotFoundException("Project unavailable");
  return p;
 }
 private async validOwner(tx:PoolClient,a:Actor,owner:string,branch:string|null,p:Project|null){
  await this.identity.eligibleOfficeholder(tx,a,owner);
  if(!(await tx.query(`SELECT 1 FROM account aa WHERE aa.realm_id=$1 AND aa.id=$2 AND ${eligible("aa")}`,[a.realmId,owner])).rowCount)throw new ForbiddenException("Choose an eligible current activity owner");
  const employee=await tx.query<{id:string}>("SELECT id FROM hr_employee WHERE root_realm_id=$1 AND account_ref=$2 FOR SHARE",[a.realmId,owner]);
  if(employee.rowCount){
   const e=await tx.query(`SELECT e.id FROM ${taskEmployeeFrom} WHERE e.root_realm_id=$1 AND e.id=$2 AND ($3::uuid IS NULL OR h.branch_ref=$3) AND ${currentTaskEmployee} FOR SHARE OF e,h,b`,[a.realmId,employee.rows[0].id,branch]);
   if(e.rows.length!==1)throw new ForbiddenException("Choose a current employee in the activity branch");
  }else if(branch){
   const q=await tx.query(`SELECT 1 FROM branch br JOIN account aa ON aa.realm_id=br.root_realm_id AND aa.id=$3 WHERE br.root_realm_id=$1 AND br.id=$2 AND br.status='ACTIVE' AND (br.manager_account_ref=aa.id OR aa.id=$4::uuid OR ${grant("aa","foundation.branches.admin")}) FOR SHARE OF br`,[a.realmId,branch,owner,p?.owner_account_ref??null]);
   if(!q.rowCount)throw new ForbiddenException("Choose a current branch operator");
  }
 }
 private async validate(tx:PoolClient,a:Actor,v:Work){
  const p=await this.parent(tx,a,v.project);
  if(p&&(p.branch_ref!==v.branch||closed(p.status)))throw stale();
  await this.branches.projectBranch(tx,a,v.branch);
  await this.branches.projectGeography(tx,a,v.state,v.district);
  if(p&&!(await tx.query("SELECT 1 WHERE ($1::date IS NULL OR ($3::timestamptz AT TIME ZONE 'Asia/Kolkata')::date >= $1) AND ($2::date IS NULL OR ($4::timestamptz AT TIME ZONE 'Asia/Kolkata')::date <= $2)",[p.planned_start,p.planned_end,v.start,v.end])).rowCount)throw invalid();
  await this.validOwner(tx,a,v.owner,v.branch,p);
 }
 private async get(tx:PoolClient,a:Actor,key:string,write=false){
  const x=(await tx.query<ActivityRow>("SELECT * FROM project_activity WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref(key)])).rows[0];
  if(!x)throw new NotFoundException("Activity unavailable");
  const p=await this.parent(tx,a,x.project_id),branch=p?p.branch_ref:x.branch_ref,scope=await this.branches.projectBranchScope(tx,a);
  const scoped=branch?scope.branches.some(b=>b.value===branch):scope.all;
  let owner=false;
  if(x.owner_account_ref===a.accountId&&branch===x.branch_ref){try{await this.validOwner(tx,a,a.accountId,branch,p);owner=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}}
  if(!scoped&&!owner)throw new NotFoundException("Activity unavailable");
  const canManage=scoped&&!closed(x.status)&&await this.has(tx,a,"projects.activities.manage");
  const currentScope=branch===x.branch_ref&&(!p||!closed(p.status));
  const canProgress=!closed(x.status)&&currentScope&&(canManage||owner&&await this.has(tx,a,"projects.activities.progress"));
  return {x,p,branch,canManage,canProgress,scopeChanged:branch!==x.branch_ref};
 }
 private async replay(tx:PoolClient,a:Actor,key:string,digest:string,action:string,target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":CG05:ACTIVITY:"+key]);
  const e=(await tx.query<{activity_id:string;actor_ref:string;payload_digest:string;action:string;result_version:number}>("SELECT activity_id,actor_ref,payload_digest,action,result_version FROM project_activity_event WHERE root_realm_id=$1 AND event_key=$2",[a.realmId,key])).rows[0];
  if(!e)return null;
  if(e.actor_ref!==a.accountId||e.payload_digest!==digest||e.action!==action||target&&e.activity_id!==target)throw stale();
  await this.get(tx,a,e.activity_id);
  return {ref:e.activity_id,version:e.result_version,replayed:true};
 }
 private async record(tx:PoolClient,a:Actor,x:ActivityRow,key:string,digest:string,action:string,prior:ActivityStatus|null,reason=""){
  await tx.query("INSERT INTO project_activity_event(root_realm_id,activity_id,event_key,payload_digest,action,actor_ref,owner_account_ref,prior_status,resulting_status,result_version,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[a.realmId,x.id,key,digest,action,a.accountId,x.owner_account_ref,prior,x.status,x.version,reason]);
  return {ref:x.id,version:x.version,replayed:false};
 }
 async create(token:string,raw:unknown){
  const v=parseActivityCreate(raw),digest=hash(v);
  return this.projects.run(token,"projects.activities.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.activities.view");
   const old=await this.replay(tx,a,v.key,digest,"CREATE");if(old)return old;await this.validate(tx,a,v);
   const x=(await tx.query<ActivityRow>("INSERT INTO project_activity(root_realm_id,project_id,kind,title,category,activity_type,description,program_label,branch_ref,state_ref,district_ref,venue_label,owner_account_ref,scheduled_start,scheduled_end,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *",[a.realmId,v.project,v.kind,v.title,v.category,v.activityType,v.description,v.program,v.branch,v.state,v.district,v.venue,v.owner,v.start,v.end,v.status,a.accountId])).rows[0];
   return this.record(tx,a,x,v.key,digest,"CREATE",null);
  });
 }
 async edit(token:string,key:string,raw:unknown){
  const target=ref(key),v=parseActivityEdit(raw),digest=hash([target,v]);
  return this.projects.run(token,"projects.activities.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.activities.view");const old=await this.replay(tx,a,v.key,digest,"EDIT",target);if(old)return old;
   const {x,canManage}=await this.get(tx,a,target,true);
   if(!canManage)throw new ForbiddenException("Activity editing unavailable");
   if(x.version!==v.expected||x.status==="ONGOING"&&(v.project!==x.project_id||v.kind!==x.kind||v.owner!==x.owner_account_ref))throw stale();
   await this.validate(tx,a,v);
   const next=(await tx.query<ActivityRow>("UPDATE project_activity SET project_id=$3,kind=$4,title=$5,category=$6,activity_type=$7,description=$8,program_label=$9,branch_ref=$10,state_ref=$11,district_ref=$12,venue_label=$13,owner_account_ref=$14,scheduled_start=$15,scheduled_end=$16,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$17 RETURNING *",[a.realmId,target,v.project,v.kind,v.title,v.category,v.activityType,v.description,v.program,v.branch,v.state,v.district,v.venue,v.owner,v.start,v.end,v.expected])).rows[0];
   if(!next)throw stale();return this.record(tx,a,next,v.key,digest,"EDIT",x.status);
  });
 }
 async status(token:string,key:string,raw:unknown){
  const target=ref(key),v=parseActivityStatus(raw),digest=hash([target,v]);
  return this.projects.run(token,"projects.activities.view",async(tx,a)=>{
   if(!await this.has(tx,a,"projects.activities.manage")&&!await this.has(tx,a,"projects.activities.progress"))throw new ForbiddenException("Activity update unavailable");
   const old=await this.replay(tx,a,v.key,digest,"STATUS",target);if(old)return old;
   const {x,p,branch,canManage,canProgress}=await this.get(tx,a,target,true);
   if(v.status==="SCHEDULED"||v.status==="CANCELLED"){if(!canManage)throw new ForbiddenException("Coordinator permission required");}
   else if(!canProgress)throw new ForbiddenException("Current activity progress unavailable");
   if(x.version!==v.expected||!activityTransition(x.status,v.status)||branch!==x.branch_ref)throw stale();
   if(v.status!=="CANCELLED"){if(p&&closed(p.status))throw stale();await this.validOwner(tx,a,x.owner_account_ref,branch,p);}
   const next=(await tx.query<ActivityRow>("UPDATE project_activity SET status=$3,actual_start=CASE WHEN $3='ONGOING' THEN now() ELSE actual_start END,actual_end=CASE WHEN $3='COMPLETED' THEN now() ELSE NULL END,outcome=CASE WHEN $3='COMPLETED' THEN $4 ELSE outcome END,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$5 RETURNING *",[a.realmId,target,v.status,v.outcome,v.expected])).rows[0];
   if(!next)throw stale();return this.record(tx,a,next,v.key,digest,"STATUS",x.status,v.reason);
  });
 }
 async detail(token:string,key:string){
  return this.projects.run(token,"projects.activities.view",async(tx,a)=>{
   const {x,canManage,canProgress}=await this.get(tx,a,key);
   const row=(await tx.query("SELECT "+select+joins+" WHERE x.root_realm_id=$1 AND x.id=$2",[a.realmId,x.id])).rows[0];
   const history=(await tx.query("SELECT e.action,e.prior_status AS \"priorStatus\",e.resulting_status AS status,e.reason,e.occurred_at AS at,actor.display_name AS actor,owner.display_name AS owner FROM project_activity_event e JOIN account actor ON actor.realm_id=e.root_realm_id AND actor.id=e.actor_ref JOIN account owner ON owner.realm_id=e.root_realm_id AND owner.id=e.owner_account_ref WHERE e.root_realm_id=$1 AND e.activity_id=$2 ORDER BY e.result_version DESC LIMIT 50",[a.realmId,x.id])).rows;
   return {...row,history,canManage,canProgress};
  },true);
 }
