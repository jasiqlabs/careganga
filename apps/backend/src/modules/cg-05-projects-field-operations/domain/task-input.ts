import {choice,clean,date,fields,invalid,optionalRef,priorities,ref,version} from "./project-input";
export const taskStatuses=["DRAFT","ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"] as const;
export type TaskStatus=typeof taskStatuses[number];
export const taskAssigneeKinds=["UNASSIGNED","ACCOUNT","EMPLOYEE"] as const;
export type TaskAssigneeKind=typeof taskAssigneeKinds[number];
const workKeys=["title","taskType","description","priority","startDate","dueDate"] as const;
const assigneeKeys=["assigneeKind","assigneeRef"] as const;
function work(x:Record<string,unknown>){
 const startDate=date(x.startDate),dueDate=date(x.dueDate);if(startDate&&dueDate&&startDate>dueDate)throw invalid();
 return {title:clean(x.title,2,160),taskType:clean(x.taskType,1,80),description:clean(x.description??"",0,2000),priority:choice(x.priority,priorities),startDate,dueDate};
}
function assignee(x:Record<string,unknown>){
 const kind=choice(x.assigneeKind,taskAssigneeKinds),target=optionalRef(x.assigneeRef);
 if((kind==="UNASSIGNED")!==(target===null))throw invalid();
 return {kind,target};
}
export function parseTaskCreate(raw:unknown){
 const x=fields(raw,["requestKey",...workKeys,...assigneeKeys]);return {key:ref(x.requestKey),...work(x),...assignee(x)};
}
export function parseTaskEdit(raw:unknown){
 const x=fields(raw,["requestKey","expectedVersion",...workKeys]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),...work(x)};
}
export function parseTaskAssign(raw:unknown){
 const x=fields(raw,["requestKey","expectedVersion",...assigneeKeys,"reason"]),a=assignee(x);
 if(a.kind==="UNASSIGNED")throw invalid();
 return {key:ref(x.requestKey),expected:version(x.expectedVersion),...a,reason:clean(x.reason,3,500)};
}
export function parseTaskProgress(raw:unknown){
 const x=fields(raw,["requestKey","expectedVersion","status","reason"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),status:choice(x.status,["IN_PROGRESS","COMPLETED","CANCELLED"] as const),reason:clean(x.reason??"",x.status==="CANCELLED"?3:0,500)};
}
export function taskTransition(from:TaskStatus,to:TaskStatus){
 const graph:Record<TaskStatus,readonly TaskStatus[]>={DRAFT:[],ASSIGNED:["IN_PROGRESS","CANCELLED"],IN_PROGRESS:["COMPLETED","CANCELLED"],COMPLETED:[],CANCELLED:[]};
 return graph[from].includes(to);
}
