import {ForbiddenException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProjectsService} from "./projects.service";
import {ProjectTasksService} from "./project-tasks.service";
import {ProjectActivitiesService} from "./project-activities.service";
import {FieldVisitsService} from "./field-visits.service";
import {invalid} from "../domain/project-input";

type Recent={source:string;title:string;status:string;action:string;at:string};
type Metrics={label:string;value:number|string}[];
type Section={source:string;metrics:Metrics;recent:Recent[]};
const csv=(v:unknown)=>{let s=String(v??"").replace(/[\u0000-\u001f\u007f]/g," ");if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
function metrics(counts:Record<string,unknown>,labels:Record<string,string>):Metrics{return Object.entries(labels).map(([key,label])=>({label,value:Number(counts[key]??0)}));}
function recent(source:string,rows:Record<string,unknown>[]):Recent[]{return rows.map(r=>({source,title:String(r.title??r.project??r.code??""),status:String(r.status??""),action:String(r.action??r.kind??""),at:new Date(String(r.at)).toISOString()}));}

@Injectable()
export class OperationsSummaryService{
 constructor(private readonly projects:ProjectsService,private readonly tasks:ProjectTasksService,private readonly activities:ProjectActivitiesService,private readonly visits:FieldVisitsService,private readonly identity:FoundationStructureIdentityFacade){}
 private async allowed(tx:PoolClient,a:VerifiedFoundationActor,key:string,exporting:boolean){
  try{await this.identity.assertCurrent(tx,a,key+".view");if(exporting)await this.identity.assertCurrent(tx,a,key+".export");return true;}catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 async read(token:string,scope:unknown,exporting=false){
  if(scope!==undefined&&scope!=="MINE"&&scope!=="PERMITTED")throw invalid();
  const mine=scope==="MINE";
  return this.projects.run(token,exporting?"projects.operations.export":"projects.operations.view",async(tx,a)=>{
   if(exporting)await this.identity.assertCurrent(tx,a,"projects.operations.view");
   const asOf=(await tx.query<{at:Date}>("SELECT transaction_timestamp() AS at")).rows[0].at.toISOString();
   const sections:Section[]=[],restricted:string[]=[];
   let finance:unknown=null;
   if(await this.allowed(tx,a,"projects",exporting)){
    const r=await this.projects.listInTx(tx,a,{},mine);
    if(!("counts" in r)||!r.counts||!r.recent)throw Error("Project projection unavailable");
    sections.push({source:"Projects",metrics:metrics(r.counts,{total:"Total",active:"Active",hold:"On hold",completed:"Completed",cancelled:"Cancelled",planned:"Planned or draft"}),recent:recent("Projects",r.recent)});
    finance=r.finance;
   }else restricted.push("Projects");
   if(await this.allowed(tx,a,"projects.tasks",exporting)){
    const r=await this.tasks.listInTx(tx,a,{},mine);
    if(!("counts" in r)||!r.counts||!r.recent)throw Error("Task projection unavailable");
    sections.push({source:"Tasks",metrics:metrics(r.counts,{total:"Total",completed:"Completed",inProgress:"In progress",overdue:"Overdue",upcoming:"Upcoming",cancelled:"Cancelled"}),recent:recent("Tasks",r.recent)});
   }else restricted.push("Tasks");
   if(await this.allowed(tx,a,"projects.activities",exporting)){
    const r=await this.activities.listInTx(tx,a,{},mine);
    if(!("counts" in r)||!r.counts||!r.recent)throw Error("Activity projection unavailable");
    sections.push({source:"Activities",metrics:metrics(r.counts,{total:"Total",completed:"Completed",ongoing:"Ongoing",upcoming:"Upcoming",cancelled:"Cancelled"}),recent:recent("Activities",r.recent)});
   }else restricted.push("Activities");
   if(await this.allowed(tx,a,"projects.visits",exporting)){
    const r=await this.visits.listInTx(tx,a,mine?{tab:"MY"}:{});
    if(!("counts" in r)||!r.counts||!r.recent)throw Error("Visit projection unavailable");
    const counts=Object.fromEntries(r.counts.map(v=>[v.status,v.count]));
    sections.push({source:"Field visits",metrics:[{label:"Total",value:r.total},...metrics(counts,{COMPLETED:"Completed",PENDING_APPROVAL:"Pending approval",REJECTED:"Rejected",IN_PROGRESS:"In progress / checked in",PENDING_PROOF:"Pending proof",RETURNED:"Returned",CANCELLED:"Cancelled"})],recent:recent("Field visits",r.recent)});
   }else restricted.push("Field visits");
   if(!sections.length)throw new ForbiddenException({code:"CG05_SCOPE_DENIED"});
   if(exporting){
    const rows=sections.flatMap(s=>s.metrics.map(m=>[asOf,mine?"MINE":"PERMITTED",s.source,m.label,m.value]));
    await this.projects.auditExport(tx,a,"OPERATIONS",mine,rows.length,{scope:mine?"MINE":"PERMITTED",sources:sections.map(s=>s.source)});
    return {csv:[["Snapshot","Scope","Source","Metric","Value"],...rows].map(r=>r.map(csv).join(",")).join("\r\n"),rows:rows.length,restricted};
   }
   return {asOf,scope:mine?"MINE":"PERMITTED",sections:sections.map(({source,metrics})=>({source,metrics})),restricted,finance,recent:sections.flatMap(s=>s.recent).sort((x,y)=>y.at.localeCompare(x.at)).slice(0,16)};
  },true);
 }
}
