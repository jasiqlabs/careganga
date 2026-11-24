import {ForbiddenException,Injectable} from "@nestjs/common";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";

type ProjectSource={id:string;branch_ref:string|null;status:string;version:number};
type EventSource={id:string;branch_ref:string|null;project_id:string|null;status:string;version:number};
type Choice={value:string;label:string;projectRef?:string|null};
@Injectable()
export class CampaignLinkSourceFacade{
 constructor(private readonly branches:BranchSourceFacade,
  private readonly identity:FoundationStructureIdentityFacade){}
 /** Current CG05 owner project filter guard; a CG06 list filter never makes
  * project membership enumerable to a staff user without projects.view. */
 async requireCurrentProjectForFilter(tx:PoolClient,a:Actor,projectRef:string){
  await this.identity.assertCurrent(tx,a,"projects.view");
  const source=(await tx.query<{branch_ref:string|null;status:string}>(
   "SELECT branch_ref,status FROM project WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [a.realmId,projectRef])).rows[0];
  if(!source||source.status!=="ACTIVE")
   throw new ForbiddenException("Choose a current permitted Foundation project");
  await this.branches.projectBranch(tx,a,source.branch_ref);
 }
 /** Read-only selector; never grants project or beneficiary mutation authority. */
 async beneficiaryProjectFilterOptions(tx:PoolClient,a:Actor,branch:string|null,q:string){
  await this.identity.assertCurrent(tx,a,"projects.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  if(branch)await this.branches.projectBranch(tx,a,branch);
  return (await tx.query<{value:string;label:string}>(`
   SELECT p.id AS value,p.code_norm||' · '||p.title AS label
   FROM project p WHERE p.root_realm_id=$1 AND p.status='ACTIVE'
   AND ((p.branch_ref IS NULL AND $2::boolean) OR p.branch_ref=ANY($3::uuid[]))
   AND ($4::uuid IS NULL OR p.branch_ref=$4)
   AND ($5='' OR strpos(lower(p.title),$5)>0 OR strpos(lower(p.code_norm),$5)>0)
   ORDER BY p.title,p.id LIMIT 80`,[a.realmId,scope.all,scope.branches.map(x=>x.value),branch,q.toLowerCase()])).rows;
 }
 /** CG05-owned original projects/events are eligibility references, not CG07 replicas. */
 async requireCurrent(tx:PoolClient,a:Actor,branch:string|null,project:string|null,event:string|null){
  await this.branches.projectBranch(tx,a,branch);
  let projectSource:ProjectSource|null=null,eventSource:EventSource|null=null;
  if(project){
   await this.identity.assertCurrent(tx,a,"projects.view");
   projectSource=(await tx.query<ProjectSource>(
    "SELECT id,branch_ref,status,version FROM project WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [a.realmId,project])).rows[0]??null;
   if(!projectSource||projectSource.status!=="ACTIVE"||projectSource.branch_ref!==branch)
    throw new ForbiddenException("Choose a current active Foundation project in the campaign branch.");
  }
  if(event){
   await this.identity.assertCurrent(tx,a,"projects.activities.view");
   eventSource=(await tx.query<EventSource>(
    "SELECT id,branch_ref,project_id,status,version FROM project_activity WHERE root_realm_id=$1 AND id=$2 AND kind='EVENT' FOR SHARE",
    [a.realmId,event])).rows[0]??null;
   if(!eventSource||!["SCHEDULED","ONGOING"].includes(eventSource.status)||
     eventSource.branch_ref!==branch||eventSource.project_id!==project)
    throw new ForbiddenException("Choose a current Foundation event for the selected campaign project and branch.");
  }
  return {project:projectSource?{ref:projectSource.id,version:projectSource.version}:null,
    event:eventSource?{ref:eventSource.id,version:eventSource.version}:null};
 }
 async options(tx:PoolClient,a:Actor,branch:string|null,q:string){
  await this.branches.projectBranch(tx,a,branch);
  const params=[a.realmId,branch,q.toLowerCase()];
  let canProjects=false,canEvents=false;
  try{await this.identity.assertCurrent(tx,a,"projects.view");canProjects=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
  try{await this.identity.assertCurrent(tx,a,"projects.activities.view");canEvents=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
  const projects=canProjects?(await tx.query<{value:string;label:string}>(`
   SELECT p.id AS value,p.code_norm||' · '||p.title AS label FROM project p
   WHERE p.root_realm_id=$1 AND p.branch_ref IS NOT DISTINCT FROM $2::uuid AND p.status='ACTIVE'
    AND ($3='' OR strpos(lower(p.title),$3)>0 OR strpos(lower(p.code_norm),$3)>0)
   ORDER BY p.title,p.id LIMIT 80`,params)).rows:[];
  const events=canEvents?(await tx.query<{value:string;label:string;projectRef:string|null}>(`
   SELECT e.id AS value,e.activity_code||' · '||e.title AS label,e.project_id AS "projectRef"
   FROM project_activity e LEFT JOIN project p ON p.root_realm_id=e.root_realm_id AND p.id=e.project_id
   WHERE e.root_realm_id=$1 AND e.kind='EVENT' AND e.status IN('SCHEDULED','ONGOING')
    AND e.branch_ref IS NOT DISTINCT FROM $2::uuid
    AND (e.project_id IS NULL OR (p.status='ACTIVE' AND p.branch_ref IS NOT DISTINCT FROM $2::uuid))
    AND ($3='' OR strpos(lower(e.title),$3)>0 OR strpos(lower(e.activity_code),$3)>0)
   ORDER BY e.scheduled_start DESC,e.id LIMIT 80`,params)).rows:[];
  return {projects,events};
 }
}
