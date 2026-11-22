import {ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {currentTaskEmployee,taskEmployeeFrom,lockCurrentTaskEmployee} from "../../cg-10-human-resources/application/hr-project-task-source";
import {ProjectsService} from "./projects.service";
import {choice,clean,date,invalid,optionalRef,priorities,ref,stale} from "../domain/project-input";
import {parseTaskCreate,parseTaskEdit,parseTaskAssign,parseTaskProgress,taskStatuses,taskTransition,type TaskStatus,type TaskAssigneeKind} from "../domain/task-input";

type Actor=VerifiedFoundationActor;
type Parent={id:string;branch_ref:string|null;owner_account_ref:string;status:string;planned_start:string|null;planned_end:string|null;manager_ref:string|null};
type Binding={kind:TaskAssigneeKind;account:string|null;employee:string|null;branch:string|null};
type Task={id:string;project_id:string;status:TaskStatus;version:number;due_at:string|null;planned_start:string|null;effective_now?:boolean;assignee_kind:TaskAssigneeKind;assignee_account_ref:string|null;assignee_employee_ref:string|null;assignee_branch_ref:string|null};
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const csvCell=(v:unknown)=>{let s=String(v??"").replace(/[\u0000-\u001f\u007f]/g," ");if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const terminal=(status:string)=>["COMPLETED","CANCELLED"].includes(status);
/** Original current account permission, not a grant manufactured by CG05. */
const grants=(a:string,capability:string)=>`EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
 WHERE ar.account_id=${a}.id AND ar.realm_id=${a}.realm_id AND ar.revoked_at IS NULL AND
 (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='${capability}')))`;
const eligible=(a:string)=>`${a}.status='ACTIVE' AND ${grants(a,"projects.tasks.view")} AND (${grants(a,"projects.tasks.progress")} OR ${grants(a,"projects.tasks.manage")})`;
const operatorScope=(a:string)=>`(p.branch_ref IS NULL OR b.manager_account_ref=${a}.id OR p.owner_account_ref=${a}.id OR ${grants(a,"foundation.branches.admin")})`;
const live=`(t.assignee_account_ref IS NOT NULL AND t.assigned_at<=now()
 AND EXISTS(SELECT 1 FROM account aa WHERE aa.realm_id=t.root_realm_id AND aa.id=t.assignee_account_ref AND ${eligible("aa")}
 AND ((t.assignee_kind='ACCOUNT' AND t.assignee_branch_ref IS NOT DISTINCT FROM p.branch_ref
 AND ${operatorScope("aa")} AND NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=t.root_realm_id AND e.account_ref=aa.id))
 OR (t.assignee_kind='EMPLOYEE' AND EXISTS(SELECT 1 FROM ${taskEmployeeFrom}
 WHERE e.root_realm_id=t.root_realm_id AND e.id=t.assignee_employee_ref AND e.account_ref=aa.id
 AND h.branch_ref=t.assignee_branch_ref AND (p.branch_ref IS NULL OR h.branch_ref=p.branch_ref)
 AND ${currentTaskEmployee})))))`;
const joins=` FROM project_task t JOIN project p ON p.id=t.project_id AND p.root_realm_id=t.root_realm_id
 LEFT JOIN branch b ON b.id=p.branch_ref AND b.root_realm_id=p.root_realm_id
 LEFT JOIN account a ON a.id=t.assignee_account_ref AND a.realm_id=t.root_realm_id`;
const overdue="t.due_at<(now() AT TIME ZONE 'Asia/Kolkata')::date AND t.status IN('ASSIGNED','IN_PROGRESS')";
const upcoming="t.due_at>=(now() AT TIME ZONE 'Asia/Kolkata')::date AND t.status IN('ASSIGNED','IN_PROGRESS')";
const projection=`t.id AS ref,t.task_code AS code,t.project_id AS "projectRef",p.title AS project,p.code_norm AS "projectCode",t.title,t.task_type AS "taskType",
 t.description,t.priority,t.planned_start::text AS "startDate",t.due_at::text AS "dueDate",t.status,t.assignee_kind AS "assigneeKind",
 a.display_name AS assignee,p.location_label AS location,b.name AS branch,t.version,t.updated_at AS "updatedAt",
 t.completed_at AS "completedAt",(${overdue}) IS TRUE AS overdue,(${live}) AS "assignmentCurrent"`;

@Injectable()
export class ProjectTasksService {
 constructor(private readonly projects:ProjectsService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async has(tx:PoolClient,a:Actor,key:string){
  try{await this.identity.assertCurrent(tx,a,key);return true;}catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async parent(tx:PoolClient,a:Actor,key:string){
  const p=(await tx.query<Parent>("SELECT id,branch_ref,owner_account_ref,status,planned_start::text,planned_end::text,NULL::uuid AS manager_ref FROM project WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,ref(key)])).rows[0];
  if(!p)throw new NotFoundException("Project unavailable");
  if(p.branch_ref){
   const b=(await tx.query<{manager_account_ref:string}>("SELECT manager_account_ref FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,p.branch_ref])).rows[0];
   if(!b)throw new NotFoundException("Project unavailable");p.manager_ref=b.manager_account_ref;
  }
  return p;
 }
 private async manageParent(tx:PoolClient,a:Actor,p:Parent){
  await this.identity.assertCurrent(tx,a,"projects.tasks.manage");await this.branches.projectBranch(tx,a,p.branch_ref);
  if(terminal(p.status))throw stale();
 }
 private async scoped(tx:PoolClient,a:Actor,p:Parent){
  const s=await this.branches.projectBranchScope(tx,a);
  return p.branch_ref?s.branches.some(b=>b.value===p.branch_ref):s.all||p.owner_account_ref===a.accountId;
 }
 private due(p:Parent,due:string|null,start:string|null=null){
  if(start&&(p.planned_start&&start<p.planned_start||p.planned_end&&start>p.planned_end||due&&start>due))throw invalid();
  if(due&&(p.planned_start&&due<p.planned_start||p.planned_end&&due>p.planned_end))throw invalid();
 }
 private async account(tx:PoolClient,a:Actor,target:string){
  const found=await tx.query<{id:string}>(`SELECT aa.id FROM account aa WHERE aa.realm_id=$1 AND aa.id=$2 AND ${eligible("aa")} FOR SHARE OF aa`,[a.realmId,target]);
  if(!found.rowCount)throw new ForbiddenException("Choose a current eligible task assignee");
  await tx.query("SELECT ar.account_id FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL AND r.active FOR SHARE OF ar,r",[a.realmId,target]);
  if(!(await tx.query(`SELECT 1 FROM account aa WHERE aa.realm_id=$1 AND aa.id=$2 AND ${eligible("aa")}`,[a.realmId,target])).rowCount)throw new ForbiddenException("Choose a current eligible task assignee");
 }
 private async binding(tx:PoolClient,a:Actor,p:Parent,kind:TaskAssigneeKind,target:string|null):Promise<Binding>{
  if(kind==="UNASSIGNED")return {kind,account:null,employee:null,branch:null};
  if(!target)throw invalid();
  if(kind==="EMPLOYEE"){
   const e=await lockCurrentTaskEmployee(tx,a.realmId,target,p.branch_ref);
   if(!e)throw new ForbiddenException("Choose an active employee in the current project branch");
   await this.account(tx,a,e.accountRef);
   return {kind,account:e.accountRef,employee:e.employeeRef,branch:e.branchRef};
  }
  await this.account(tx,a,target);
  if((await tx.query("SELECT 1 FROM hr_employee WHERE root_realm_id=$1 AND account_ref=$2",[a.realmId,target])).rowCount)throw new ForbiddenException("Choose the original employee assignment");
  if(p.branch_ref&&target!==p.manager_ref&&target!==p.owner_account_ref){
   const q=await tx.query(`SELECT 1 FROM account aa WHERE aa.realm_id=$1 AND aa.id=$2 AND ${grants("aa","foundation.branches.admin")}`,[a.realmId,target]);
   if(!q.rowCount)throw new ForbiddenException("Choose a current permitted branch operator");
  }
  return {kind,account:target,employee:null,branch:p.branch_ref};
 }
 private async currentBinding(tx:PoolClient,a:Actor,p:Parent,t:Task){
  if(!t.assignee_account_ref||t.assignee_kind==="UNASSIGNED")return false;
  try{
   const b=await this.binding(tx,a,p,t.assignee_kind,t.assignee_kind==="EMPLOYEE"?t.assignee_employee_ref:t.assignee_account_ref);
   return b.account===t.assignee_account_ref&&b.employee===t.assignee_employee_ref&&b.branch===t.assignee_branch_ref;
  }catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async get(tx:PoolClient,a:Actor,key:string,write=false){
  const target=ref(key);
  const hint=(await tx.query<{project_id:string}>("SELECT project_id FROM project_task WHERE root_realm_id=$1 AND id=$2",[a.realmId,target])).rows[0];
  if(!hint)throw new NotFoundException("Task unavailable");
  const p=await this.parent(tx,a,hint.project_id);
  const t=(await tx.query<Task>("SELECT *,due_at::text AS due_at,planned_start::text AS planned_start,(planned_start IS NULL OR planned_start<=CURRENT_DATE) AS effective_now FROM project_task WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,target,p.id])).rows[0];
  if(!t)throw new NotFoundException("Task unavailable");
  const scope=await this.scoped(tx,a,p),own=t.assignee_account_ref===a.accountId;
  if(!scope&&!own)throw new NotFoundException("Task unavailable");
  const assignmentCurrent=await this.currentBinding(tx,a,p,t);
  if(!scope&&!(own&&assignmentCurrent))throw new ForbiddenException("Your task assignment is no longer current");
  const canManage=scope&&!terminal(p.status)&&!terminal(t.status)&&await this.has(tx,a,"projects.tasks.manage")&&
   (p.branch_ref!==null||await this.has(tx,a,"foundation.branches.admin"));
  const canProgress=assignmentCurrent&&t.effective_now===true&&!terminal(p.status)&&!terminal(t.status)&&
   (canManage||own&&await this.has(tx,a,"projects.tasks.progress"));
  return {t,p,canManage,canProgress,assignmentCurrent};
 }
 private async replay(tx:PoolClient,a:Actor,key:string,hash:string,kind:string,projectId?:string,taskId?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":CG05:TASK:"+key]);
  const e=(await tx.query<{task_id:string;project_id:string;actor_ref:string;payload_digest:string;event_kind:string;result_version:number}>("SELECT task_id,project_id,actor_ref,payload_digest,event_kind,result_version FROM project_task_event WHERE root_realm_id=$1 AND event_key=$2",[a.realmId,key])).rows[0];
  if(!e)return null;
  if(e.actor_ref!==a.accountId||e.payload_digest!==hash||e.event_kind!==kind||projectId&&e.project_id!==projectId||taskId&&e.task_id!==taskId)throw stale();
  await this.get(tx,a,e.task_id);
  return {ref:e.task_id,version:e.result_version,replayed:true};
 }
 private async event(tx:PoolClient,a:Actor,t:Task,key:string,hash:string,kind:string,prior:TaskStatus|null,reason=""){
  await tx.query("INSERT INTO project_task_event(root_realm_id,project_id,task_id,event_key,payload_digest,event_kind,actor_ref,old_status,new_status,assignee_kind,assignee_account_ref,assignee_employee_ref,assignee_branch_ref,result_version,redacted_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",[a.realmId,t.project_id,t.id,key,hash,kind,a.accountId,prior,t.status,t.assignee_kind,t.assignee_account_ref,t.assignee_employee_ref,t.assignee_branch_ref,t.version,reason]);
  return {ref:t.id,version:t.version,replayed:false};
 }
 async create(token:string,projectId:string,raw:unknown){
  const target=ref(projectId),v=parseTaskCreate(raw),hash=digest([target,v]);
  return this.projects.run(token,"projects.tasks.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.tasks.view");const prior=await this.replay(tx,a,v.key,hash,"CREATE",target);if(prior)return prior;
   const p=await this.parent(tx,a,target);await this.manageParent(tx,a,p);this.due(p,v.dueDate,v.startDate);
   const b=await this.binding(tx,a,p,v.kind,v.target);
   const t=(await tx.query<Task>("INSERT INTO project_task(root_realm_id,project_id,title,task_type,description,priority,planned_start,due_at,status,assignee_kind,assignee_account_ref,assignee_employee_ref,assignee_branch_ref,assigned_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $11::uuid IS NULL THEN NULL ELSE now() END,$14) RETURNING *",[a.realmId,p.id,v.title,v.taskType,v.description,v.priority,v.startDate,v.dueDate,b.account?"ASSIGNED":"DRAFT",b.kind,b.account,b.employee,b.branch,a.accountId])).rows[0];
   return this.event(tx,a,t,v.key,hash,"CREATE",null);
  });
 }
 async edit(token:string,key:string,raw:unknown){
  const target=ref(key),v=parseTaskEdit(raw),hash=digest([target,v]);
  return this.projects.run(token,"projects.tasks.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.tasks.view");const prior=await this.replay(tx,a,v.key,hash,"EDIT",undefined,target);if(prior)return prior;
   const {p,t,canManage}=await this.get(tx,a,target,true);if(!canManage)throw new ForbiddenException("Task editing unavailable");
   if(t.version!==v.expected)throw stale();this.due(p,v.dueDate,v.startDate);
   const next=(await tx.query<Task>("UPDATE project_task SET title=$3,task_type=$4,description=$5,priority=$6,planned_start=$7,due_at=$8,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$9 RETURNING *",[a.realmId,t.id,v.title,v.taskType,v.description,v.priority,v.startDate,v.dueDate,v.expected])).rows[0];
   if(!next)throw stale();return this.event(tx,a,next,v.key,hash,"EDIT",t.status);
  });
 }
 async assign(token:string,key:string,raw:unknown){
  const target=ref(key),v=parseTaskAssign(raw),hash=digest([target,v]);
  return this.projects.run(token,"projects.tasks.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.tasks.view");const prior=await this.replay(tx,a,v.key,hash,"ASSIGN",undefined,target);if(prior)return prior;
   const {p,t,canManage}=await this.get(tx,a,target,true);if(!canManage)throw new ForbiddenException("Task assignment unavailable");
   if(t.version!==v.expected)throw stale();this.due(p,t.due_at,t.planned_start);const b=await this.binding(tx,a,p,v.kind,v.target);
   const next=(await tx.query<Task>("UPDATE project_task SET status='ASSIGNED',assignee_kind=$3,assignee_account_ref=$4,assignee_employee_ref=$5,assignee_branch_ref=$6,assigned_at=now(),version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$7 RETURNING *",[a.realmId,t.id,b.kind,b.account,b.employee,b.branch,v.expected])).rows[0];
   if(!next)throw stale();return this.event(tx,a,next,v.key,hash,"ASSIGN",t.status,v.reason);
  });
 }
 async progress(token:string,key:string,raw:unknown){
  const target=ref(key),v=parseTaskProgress(raw),hash=digest([target,v]);
  return this.projects.run(token,"projects.tasks.view",async(tx,a)=>{
   if(!await this.has(tx,a,"projects.tasks.manage")&&!await this.has(tx,a,"projects.tasks.progress"))throw new ForbiddenException("Task progress unavailable");
   const prior=await this.replay(tx,a,v.key,hash,"PROGRESS",undefined,target);if(prior)return prior;
   const {p,t,canManage,canProgress}=await this.get(tx,a,target,true);
   if(v.status==="CANCELLED"?!canManage:!canProgress)throw new ForbiddenException("This task action is not currently permitted");
   if(t.version!==v.expected||!taskTransition(t.status,v.status))throw stale();
   if(v.status!=="CANCELLED")this.due(p,t.due_at,t.planned_start);
   const next=(await tx.query<Task>("UPDATE project_task SET status=$3,completed_at=CASE WHEN $3='COMPLETED' THEN now() ELSE NULL END,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$4 RETURNING *",[a.realmId,t.id,v.status,v.expected])).rows[0];
   if(!next)throw stale();return this.event(tx,a,next,v.key,hash,"PROGRESS",t.status,v.reason);
  });
 }
 async detail(token:string,key:string){
  return this.projects.run(token,"projects.tasks.view",async(tx,a)=>{
   const {t,canManage,canProgress}=await this.get(tx,a,key);
   const row=(await tx.query("SELECT "+projection+joins+" WHERE t.root_realm_id=$1 AND t.id=$2",[a.realmId,t.id])).rows[0];
   const history=(await tx.query("SELECT e.event_kind AS action,e.old_status AS \"priorStatus\",e.new_status AS status,e.redacted_reason AS reason,e.occurred_at AS at,actor.display_name AS actor,assignee.display_name AS assignee FROM project_task_event e JOIN account actor ON actor.realm_id=e.root_realm_id AND actor.id=e.actor_ref LEFT JOIN account assignee ON assignee.realm_id=e.root_realm_id AND assignee.id=e.assignee_account_ref WHERE e.root_realm_id=$1 AND e.task_id=$2 ORDER BY e.result_version DESC LIMIT 50",[a.realmId,t.id])).rows;
   return {...row,history,canManage,canProgress,approvalStatus:"NOT_REQUIRED"};
  },true);
 }
 async options(token:string,query:Record<string,unknown>){
  const projectId=optionalRef(query.projectRef),q=clean(query.q??"",0,80).toLowerCase();
  return this.projects.run(token,"projects.tasks.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.tasks.view");const s=await this.branches.projectBranchScope(tx,a);
   const projects=(await tx.query("SELECT id AS value,code_norm||' · '||title AS label FROM project WHERE root_realm_id=$1 AND status NOT IN('COMPLETED','CANCELLED') AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[])) ORDER BY title,id LIMIT 101",[a.realmId,s.all,s.branches.map(b=>b.value)])).rows;
   if(!projectId)return {projects:projects.slice(0,100),hasMoreProjects:projects.length>100,assignees:[]};
   const p=await this.parent(tx,a,projectId);await this.manageParent(tx,a,p);
   const operators=(await tx.query(`SELECT aa.id AS value,aa.display_name AS label,'ACCOUNT' AS kind FROM account aa
   WHERE aa.realm_id=$1 AND ${eligible("aa")} AND ($2='' OR strpos(lower(aa.display_name),$2)>0)
   AND NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=aa.realm_id AND e.account_ref=aa.id)
   AND ($3::uuid IS NULL OR aa.id=$4 OR aa.id=$5 OR ${grants("aa","foundation.branches.admin")}) ORDER BY aa.display_name,aa.id LIMIT 50`,[a.realmId,q,p.branch_ref,p.manager_ref,p.owner_account_ref])).rows;
   const employees=(await tx.query(`SELECT e.id AS value,aa.display_name||' · '||e.employee_code AS label,'EMPLOYEE' AS kind FROM ${taskEmployeeFrom} JOIN account aa ON aa.realm_id=e.root_realm_id AND aa.id=e.account_ref
   WHERE e.root_realm_id=$1 AND ${currentTaskEmployee} AND ${eligible("aa")} AND ($2='' OR strpos(lower(aa.display_name),$2)>0 OR strpos(lower(e.employee_code),$2)>0)
   AND ($3::uuid IS NULL OR h.branch_ref=$3) ORDER BY aa.display_name,e.id LIMIT 50`,[a.realmId,q,p.branch_ref])).rows;
   return {projects:projects.slice(0,100),hasMoreProjects:projects.length>100,assignees:[...operators,...employees]};
  },true);
 }
 async list(token:string,query:Record<string,unknown>,mine=false,exporting=false,parentRef?:string){
  return this.projects.run(token,exporting?"projects.tasks.export":"projects.tasks.view",(tx,a)=>this.listInTx(tx,a,query,mine,exporting,parentRef),true);
 }
 async listInTx(tx:PoolClient,a:Actor,query:Record<string,unknown>,mine=false,exporting=false,parentRef?:string,summaryOnly=false){
  await this.identity.assertCurrent(tx,a,exporting?"projects.tasks.export":"projects.tasks.view");
  if(exporting)await this.identity.assertCurrent(tx,a,"projects.tasks.view");
  const projectId=parentRef?ref(parentRef):optionalRef(query.projectRef),q=clean(query.q??"",0,100).toLowerCase(),type=clean(query.taskType??"",0,80),assignee=clean(query.assignee??"",0,100).toLowerCase(),location=clean(query.location??"",0,100).toLowerCase();
  const tab=choice(query.tab??"ALL",["ALL","MY","COMPLETED","IN_PROGRESS","OVERDUE","UPCOMING","CANCELLED"] as const);
  const status=choice(query.status??"ALL",["ALL",...taskStatuses]),priority=choice(query.priority??"ALL",["ALL",...priorities]);
  const from=date(query.from),to=date(query.to),startFrom=date(query.startFrom),startTo=date(query.startTo),offset=Number(query.offset??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||from&&to&&from>to||startFrom&&startTo&&startFrom>startTo)throw invalid();

   const s=await this.branches.projectBranchScope(tx,a);
   const scope=`t.root_realm_id=$1 AND (p.branch_ref IS NULL OR b.status='ACTIVE') AND
   ((NOT $5::boolean AND ((p.branch_ref IS NULL AND ($2::boolean OR p.owner_account_ref=$4)) OR p.branch_ref=ANY($3::uuid[]))) OR (t.assignee_account_ref=$4 AND ${live}))`;
   const values=[a.realmId,s.all,s.branches.map(b=>b.value),a.accountId,mine,projectId,q,type,priority,status,assignee,location,from,to,startFrom,startTo];
   const filter=" AND ($6::uuid IS NULL OR t.project_id=$6) AND ($7='' OR strpos(lower(t.title),$7)>0 OR strpos(lower(t.description),$7)>0 OR strpos(lower(t.task_code),$7)>0 OR strpos(lower(p.title),$7)>0 OR strpos(lower(p.code_norm),$7)>0) AND ($8='' OR lower(t.task_type)=lower($8)) AND ($9='ALL' OR t.priority=$9) AND ($10='ALL' OR t.status=$10) AND ($11='' OR strpos(lower(COALESCE(a.display_name,'')),$11)>0) AND ($12='' OR strpos(lower(p.location_label),$12)>0) AND ($13::date IS NULL OR t.due_at>=$13) AND ($14::date IS NULL OR t.due_at<=$14) AND ($15::date IS NULL OR t.planned_start>=$15) AND ($16::date IS NULL OR t.planned_start<=$16)";
   const tabFilter=tab==="MY"?" AND t.assignee_account_ref=$4 AND "+live:tab==="OVERDUE"?" AND "+overdue:tab==="UPCOMING"?" AND "+upcoming:["COMPLETED","IN_PROGRESS","CANCELLED"].includes(tab)?" AND t.status='"+tab+"'":"";
   const where=" WHERE "+scope+filter;
   const mayManage=!summaryOnly&&!exporting&&await this.has(tx,a,"projects.tasks.manage");
   const rowManage=mayManage?"((p.branch_ref IS NULL AND $2::boolean) OR p.branch_ref=ANY($3::uuid[])) AND p.status NOT IN(\'COMPLETED\',\'CANCELLED\') AND t.status NOT IN(\'COMPLETED\',\'CANCELLED\')":"false";
   const page=summaryOnly&&!exporting?{rows:[]}:await tx.query("SELECT "+projection+",("+rowManage+") AS \"canManage\""+joins+where+tabFilter+" ORDER BY t.due_at ASC NULLS LAST,t.updated_at DESC,t.id LIMIT $17 OFFSET $18",[...values,exporting?501:26,offset]);
   const items=page.rows.slice(0,exporting?500:25);
   if(exporting){await this.projects.auditExport(tx,a,"TASKS",mine,items.length,{query,parentRef});const columns=["code","projectCode","project","title","taskType","priority","startDate","dueDate","status","assignee","branch","location","overdue"];return {csv:[columns,...items.map(row=>columns.map(c=>row[c]))].map(row=>row.map(csvCell).join(",")).join("\r\n"),rows:items.length,hasMore:page.rows.length>500};}
   const counts=(await tx.query(`SELECT count(*)::integer AS total,count(*) FILTER(WHERE t.assignee_account_ref=$4 AND ${live})::integer AS mine,count(*) FILTER(WHERE t.status='COMPLETED')::integer AS completed,
    count(*) FILTER(WHERE t.status='IN_PROGRESS')::integer AS "inProgress",count(*) FILTER(WHERE ${overdue})::integer AS overdue,
    count(*) FILTER(WHERE ${upcoming})::integer AS upcoming,count(*) FILTER(WHERE t.status='CANCELLED')::integer AS cancelled`+joins+where,values)).rows[0];
   const statusCounts=summaryOnly?[]:(await tx.query("SELECT t.status AS label,count(*)::int AS count"+joins+where+" GROUP BY t.status ORDER BY t.status",values)).rows;
   const priorityCounts=summaryOnly?[]:(await tx.query("SELECT t.priority AS label,count(*)::int AS count"+joins+where+" GROUP BY t.priority ORDER BY t.priority",values)).rows;
   const overdueItems=summaryOnly?[]:(await tx.query("SELECT "+projection+joins+where+" AND "+overdue+" ORDER BY t.due_at,t.id LIMIT 5",values)).rows;
   const recent=(await tx.query("SELECT t.id AS ref,t.task_code AS code,t.title,e.event_kind AS action,e.new_status AS status,e.occurred_at AS at,actor.display_name AS actor,e.redacted_reason AS reason"+joins+" JOIN project_task_event e ON e.root_realm_id=t.root_realm_id AND e.task_id=t.id JOIN account actor ON actor.realm_id=e.root_realm_id AND actor.id=e.actor_ref"+where+" ORDER BY e.occurred_at DESC,e.id DESC LIMIT 8",values)).rows;
   const filterScope=[a.realmId,s.all,s.branches.map(b=>b.value),a.accountId,mine];
   const choices=summaryOnly?{projects:[],types:[],assignees:[],locations:[]}:(await tx.query(`WITH permitted AS (SELECT p.id AS project_id,p.title AS project,t.task_type,a.display_name AS assignee,p.location_label AS location`+joins+" WHERE "+scope+`)
    SELECT (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT DISTINCT project_id AS value,project AS label FROM permitted ORDER BY project,project_id LIMIT 100) x) AS projects,
    (SELECT COALESCE(jsonb_agg(x.task_type),'[]'::jsonb) FROM (SELECT DISTINCT task_type FROM permitted ORDER BY task_type LIMIT 100) x) AS types,
    (SELECT COALESCE(jsonb_agg(x.assignee),'[]'::jsonb) FROM (SELECT DISTINCT assignee FROM permitted WHERE assignee IS NOT NULL ORDER BY assignee LIMIT 100) x) AS assignees,
    (SELECT COALESCE(jsonb_agg(x.location),'[]'::jsonb) FROM (SELECT DISTINCT location FROM permitted WHERE location<>'' ORDER BY location LIMIT 100) x) AS locations`,filterScope)).rows[0];
   return {items,counts,statusCounts,priorityCounts,overdueItems,recent,filterOptions:choices,offset,hasMore:page.rows.length>25};
 }
}
