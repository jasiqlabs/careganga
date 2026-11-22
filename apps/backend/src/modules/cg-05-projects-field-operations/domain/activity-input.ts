import {choice,clean,fields,invalid,optionalRef,ref,version} from "./project-input";
export const activityKinds=["ACTIVITY","EVENT"] as const;
export const activityStatuses=["DRAFT","SCHEDULED","ONGOING","COMPLETED","CANCELLED"] as const;
export type ActivityStatus=typeof activityStatuses[number];
const workKeys=["projectRef","kind","title","category","activityType","description","program","branchRef","stateRef","districtRef","venue","ownerRef","scheduledStart","scheduledEnd"] as const;
/** Explicit offset is mandatory: never interpret device-local wall time on the backend. */
export function instant(v:unknown){
 if(typeof v!=="string"||!/^20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(v))throw invalid();
 const ms=Date.parse(v);if(!Number.isFinite(ms))throw invalid();
 const day=v.slice(0,10);if(new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day)throw invalid();
 const [hh,mm,ss="0"]=v.slice(11).split(/[:Z+-]/);
 if(Number(hh)>23||Number(mm)>59||Number(ss)>59)throw invalid();
 return new Date(ms).toISOString();
}
function work(x:Record<string,unknown>){
 const state=optionalRef(x.stateRef),district=optionalRef(x.districtRef),start=instant(x.scheduledStart),end=instant(x.scheduledEnd);
 if(district&&!state||start>end)throw invalid();
 return {project:optionalRef(x.projectRef),kind:choice(x.kind,activityKinds),title:clean(x.title,2,160),category:clean(x.category,1,80),activityType:clean(x.activityType,1,80),description:clean(x.description??"",0,4000),program:clean(x.program??"",0,160),branch:optionalRef(x.branchRef),state,district,venue:clean(x.venue,2,250),owner:ref(x.ownerRef),start,end};
}
export function parseActivityCreate(raw:unknown){const x=fields(raw,["requestKey",...workKeys,"status"]);return {key:ref(x.requestKey),...work(x),status:choice(x.status,["DRAFT","SCHEDULED"] as const)};}
export function parseActivityEdit(raw:unknown){const x=fields(raw,["requestKey","expectedVersion",...workKeys]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),...work(x)};}
export function parseActivityStatus(raw:unknown){const x=fields(raw,["requestKey","expectedVersion","status","reason","outcome"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),status:choice(x.status,activityStatuses),reason:clean(x.reason??"",x.status==="CANCELLED"?3:0,500),outcome:clean(x.outcome??"",0,2000)};}
export function activityTransition(from:ActivityStatus,to:ActivityStatus){const graph:Record<ActivityStatus,readonly ActivityStatus[]>={DRAFT:["SCHEDULED","CANCELLED"],SCHEDULED:["ONGOING","CANCELLED"],ONGOING:["COMPLETED","CANCELLED"],COMPLETED:[],CANCELLED:[]};return graph[from].includes(to);}
