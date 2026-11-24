import {BadRequestException,ConflictException} from "@nestjs/common";

const uuidRe=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const invalid=()=>new BadRequestException({code:"CG06_INVALID_INPUT",message:"Check the beneficiary details and try again."});
export const conflict=()=>new ConflictException({code:"CG06_SOURCE_STALE",message:"This beneficiary changed. Refresh before saving again."});
export function ref(value:unknown):string{if(typeof value!=="string"||!uuidRe.test(value))throw invalid();return value;}
export function optionalRef(value:unknown):string|null{return value===null||value===undefined||value===""?null:ref(value);}
export function text(value:unknown,min:number,max:number):string{
 if(typeof value!=="string"||/[\u0000-\u001f\u007f]/.test(value))throw invalid();
 const v=value.trim().replace(/\s+/g," ");if(v.length<min||v.length>max)throw invalid();return v;
}
export function optionalText(value:unknown,max:number):string|null{return value===null||value===undefined||value===""?null:text(value,2,max);}
export function option<T extends string>(value:unknown,values:readonly T[]):T{
 if(typeof value!=="string"||!values.includes(value as T))throw invalid();return value as T;
}
export function revision(v:unknown):number{
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1||v>=2147483647)throw invalid();return v;
}
export function fields(value:unknown,names:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw invalid();
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!names.includes(k)))throw invalid();return x;
}
const genders=["MALE","FEMALE","OTHER","NOT_SPECIFIED"] as const;
const ageGroups=["CHILD","ADULT","SENIOR","NOT_SPECIFIED"] as const;
const consentKinds=["SELF","GUARDIAN","REPRESENTATIVE"] as const;
const lifecycles=["ACTIVE","INACTIVE"] as const;
export type Profile=ReturnType<typeof parseProfile>;
export function parseProfile(raw:unknown,create:boolean){
 const x=fields(raw,["requestKey","expectedRevision","branchRef","name","contactMobile","representativeName","representativeContact","stateRef","districtRef","blockRef","beneficiaryCategory","beneficiaryType","gender","ageGroup","consentKind","consentPurpose","consentAcknowledged"]);
 if(!create&&x.branchRef!==undefined)throw invalid(); // Scope transfer is never a silent profile edit.
 if(x.consentAcknowledged!==true)throw invalid();
 const contact=x.contactMobile===null||x.contactMobile===undefined||x.contactMobile===""?null:text(x.contactMobile,8,16);
 const representative=optionalText(x.representativeName,160);
 const representativeContact=x.representativeContact===null||x.representativeContact===undefined||x.representativeContact===""?null:text(x.representativeContact,8,16);
 if(contact&&!/^\+[1-9][0-9]{7,14}$/.test(contact)||representativeContact&&!/^\+[1-9][0-9]{7,14}$/.test(representativeContact))throw invalid();
 const ageGroup=option(x.ageGroup??"NOT_SPECIFIED",ageGroups),consentKind=option(x.consentKind,consentKinds);
 if(ageGroup==="CHILD"&&consentKind!=="GUARDIAN"||consentKind!=="SELF"&&!representative)throw invalid();
 const state=ref(x.stateRef),district=optionalRef(x.districtRef),block=optionalRef(x.blockRef);
 if(block&&!district)throw invalid();
 return {key:ref(x.requestKey),expected:create?null:revision(x.expectedRevision),
   branch:create?optionalRef(x.branchRef):null,
   name:text(x.name,2,160),contact,representative,representativeContact,
   state,district,block,category:optionalText(x.beneficiaryCategory,60),beneficiaryType:text(x.beneficiaryType,2,60),
   gender:option(x.gender??"NOT_SPECIFIED",genders),ageGroup,consentKind,
   purpose:text(x.consentPurpose,5,240)};
}
export function parseChange(raw:unknown){
 const v=fields(raw,["requestKey","expectedRevision","lifecycle","reason"]);
 return {key:ref(v.requestKey),expected:revision(v.expectedRevision),
 lifecycle:option(v.lifecycle,lifecycles),reason:text(v.reason,3,300)};
}
export function parseLink(raw:unknown){
 const v=fields(raw,["requestKey","expectedRevision","projectRef"]);
 return {key:ref(v.requestKey),expected:revision(v.expectedRevision),project:ref(v.projectRef)};
}
export function parseUnlink(raw:unknown){
 const v=fields(raw,["requestKey","expectedRevision","linkRef"]);
 return {key:ref(v.requestKey),expected:revision(v.expectedRevision),link:ref(v.linkRef)};
}
export function parseRevoke(raw:unknown){
 const v=fields(raw,["requestKey","expectedRevision","reason"]);
 return {key:ref(v.requestKey),expected:revision(v.expectedRevision),reason:text(v.reason,3,300)};
}
export function parseListQuery(v:Record<string,unknown>){
 const clean=(x:unknown,max:number)=>x===undefined||x===null||x===""?"":text(x,1,max);
 const branch=optionalRef(v.branchRef),state=optionalRef(v.stateRef),district=optionalRef(v.districtRef),block=optionalRef(v.blockRef),project=optionalRef(v.projectRef),campaign=optionalRef(v.campaignRef);
 const status=clean(v.verification,24),lifecycle=clean(v.lifecycle,24),type=clean(v.type,60),category=clean(v.category,60),q=clean(v.q,80);
 if(status&&!["DRAFT","SUBMITTED","UNDER_REVIEW","VERIFIED","RETURNED","REJECTED","PENDING"].includes(status)
 ||lifecycle&&!["ACTIVE","INACTIVE"].includes(lifecycle))throw invalid();
 const gender=clean(v.gender,24),ageGroup=clean(v.ageGroup,24);
 if(gender)option(gender,genders);if(ageGroup)option(ageGroup,ageGroups);
 const date=(x:unknown)=>{const s=clean(x,10);if(!s)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith("0000"))throw invalid();
  const d=new Date(s+"T00:00:00.000Z");if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw invalid();return s;};
 const from=date(v.registeredFrom),to=date(v.registeredTo);
 if(from&&to&&from>to||district&&!state||block&&!district)throw invalid();
 const cursor=clean(v.cursor,240);
 let before:{date:string;id:string}|null=null;
 if(cursor){
  try{const [date,id,extra]=Buffer.from(cursor,"base64url").toString("utf8").split("|");
   if(extra!==undefined||!date||!Number.isFinite(Date.parse(date))||!id||!uuidRe.test(id))throw invalid();
   before={date,id};
  }catch{throw invalid();}
 }
 return {branch,state,district,block,project,campaign,status,lifecycle,type,category,q,before,gender,ageGroup,from,to};
}
export function nextCursor(date:string|Date,id:string):string{
 return Buffer.from((date instanceof Date?date.toISOString():new Date(date).toISOString())+"|"+id).toString("base64url");
}
