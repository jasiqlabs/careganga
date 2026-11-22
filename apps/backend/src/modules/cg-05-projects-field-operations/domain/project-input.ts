import {BadRequestException,ConflictException} from "@nestjs/common";
export const invalid=()=>new BadRequestException({code:"CG05_INVALID",message:"Check the required fields, dates and permitted selections."});
export const stale=()=>new ConflictException({code:"CG05_SOURCE_CHANGED",message:"This record or your current assignment has changed. Refresh the details before trying again."});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function ref(v:unknown){if(typeof v!=="string"||!UUID.test(v))throw invalid();return v.toLowerCase();}
export const optionalRef=(v:unknown)=>v===null||v===undefined||v===""?null:ref(v);
export function fields(raw:unknown,keys:readonly string[]){if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.includes(k)))throw invalid();return raw as Record<string,unknown>;}
export function clean(v:unknown,min:number,max:number){if(typeof v!=="string"||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||v.trim().length<min||v.trim().length>max)throw invalid();return v.trim();}
export function choice<T extends string>(v:unknown,values:readonly T[]):T{if(typeof v!=="string"||!values.includes(v as T))throw invalid();return v as T;}
export function version(v:unknown){if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1||v>=2147483647)throw invalid();return v;}
export function date(v:unknown){if(v===null||v===undefined||v==="")return null;if(typeof v!=="string"||!/^20\d\d-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw invalid();return v;}
export function budget(v:unknown){if(v===null||v===undefined||v==="")return null;if(typeof v!=="string"||!/^\d{1,13}(?:\.\d{1,2})?$/.test(v))throw invalid();const [whole,frac=""]=v.split(".");return (BigInt(whole)*100n+BigInt(frac.padEnd(2,"0"))).toString();}
export const statuses=["DRAFT","PLANNED","ACTIVE","ON_HOLD","COMPLETED","CANCELLED"] as const;
export type ProjectStatus=typeof statuses[number];
export const priorities=["LOW","NORMAL","HIGH","URGENT"] as const;
const baseKeys=["requestKey","code","title","category","summary","description","priority","ownerRef","stateRef","districtRef","location","fundingSource","plannedStart","plannedEnd","plannedBudget"];
function values(x:Record<string,unknown>,allowAutoCode=false){
 const code=allowAutoCode&&(x.code===undefined||x.code===null||x.code==="")?null:clean(x.code,1,40).toUpperCase();if(code!==null&&!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(code))throw invalid();
 const state=optionalRef(x.stateRef),district=optionalRef(x.districtRef),start=date(x.plannedStart),end=date(x.plannedEnd);
 if(district&&!state||start&&end&&start>end)throw invalid();
 return {key:ref(x.requestKey),code,title:clean(x.title,2,160),category:clean(x.category,1,80),summary:clean(x.summary??"",0,500),description:clean(x.description??"",0,4000),priority:choice(x.priority,priorities),owner:ref(x.ownerRef),state,district,location:clean(x.location??"",0,250),funding:clean(x.fundingSource??"",0,160),start,end,budget:budget(x.plannedBudget)};
}
export function parseCreate(raw:unknown){const x=fields(raw,[...baseKeys,"branchRef","status"]);return {...values(x,true),branch:optionalRef(x.branchRef),status:choice(x.status,["DRAFT","PLANNED","ACTIVE"] as const)};}
export function parseEdit(raw:unknown){const x=fields(raw,[...baseKeys,"expectedVersion"]);return {...values(x),expected:version(x.expectedVersion)};}
export function parseStatus(raw:unknown){const x=fields(raw,["requestKey","expectedVersion","status","reason"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),status:choice(x.status,statuses),reason:clean(x.reason,3,500)};}
export function parseBranch(raw:unknown){const x=fields(raw,["requestKey","expectedVersion","branchRef","ownerRef","reason"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),branch:optionalRef(x.branchRef),owner:ref(x.ownerRef),reason:clean(x.reason,3,500)};}
export function canTransition(from:ProjectStatus,to:ProjectStatus){const graph:Record<ProjectStatus,readonly ProjectStatus[]>={DRAFT:["PLANNED","ACTIVE","CANCELLED"],PLANNED:["DRAFT","ACTIVE","CANCELLED"],ACTIVE:["ON_HOLD","COMPLETED","CANCELLED"],ON_HOLD:["ACTIVE","COMPLETED","CANCELLED"],COMPLETED:[],CANCELLED:[]};return graph[from].includes(to);}
