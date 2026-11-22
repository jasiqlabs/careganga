import {BadRequestException,ConflictException} from "@nestjs/common";
export const statuses=["DRAFT","ACTIVE","INACTIVE"] as const;
export const categories=["ANNUAL","LIFETIME","HONORARY","STUDENT","OTHER"] as const;
export const units=["DAY","MONTH","YEAR","LIFETIME"] as const;
export const icons=["CARD","STAR","HEART","CROWN","GRADUATION","SHIELD","USERS"] as const;
export const colors=["BLUE","GREEN","AMBER","PURPLE","TEAL","ROSE","SLATE"] as const;
export function invalid(field:string,message:string):never{throw new BadRequestException({code:"CG04_TIER_INVALID",field,message});}
export function object(raw:unknown,allowed:readonly string[]):Record<string,unknown>{if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k)))return invalid("form","Check membership plan fields.");return raw as Record<string,unknown>;}
export function pick<T extends string>(raw:unknown,allowed:readonly T[],field:string):T{if(typeof raw!=="string"||!allowed.includes(raw as T))return invalid(field,"Choose a valid "+field+".");return raw as T;}
export function plain(raw:unknown,min:number,max:number,field:string):string{if(typeof raw!=="string")return invalid(field,"Enter valid "+field+".");const v=raw.normalize("NFC").trim();if(v.length<min||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(v))return invalid(field,"Enter "+field+" within "+max+" characters, using plain text.");return v;}
export function int(raw:unknown,min:number,max:number,field:string):number{if(typeof raw!=="number"||!Number.isSafeInteger(raw)||raw<min||raw>max)return invalid(field,"Choose "+field+" between "+min+" and "+max+".");return raw;}
export function uuid(raw:unknown):string{if(typeof raw!=="string"||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(raw))return invalid("form","Refresh the membership plan and try again.");return raw.toLowerCase();}
export function fee(raw:unknown):string{if(typeof raw!=="string"||!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(raw))return invalid("price","Enter a non-negative INR price with at most two decimal places.");const [whole,fraction=""]=raw.split(".");const n=BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));if(n>999999999999999n)return invalid("price","The membership price is too large.");return n.toString();}
export function conflict():never{throw new ConflictException({code:"CG04_TIER_CONFLICT",message:"This membership plan changed. Refresh and review the current version before saving."});}
export function parseTier(raw:unknown,editing:boolean){
 const x=object(raw,["requestKey","expectedVersion","name","category","status","price","currency","durationUnit","durationCount","description","benefits","icon","color","displayOrder"]);
 if(x.currency!=="INR")return invalid("currency","Membership plans use Indian rupees (INR).");
 if(!editing&&x.expectedVersion!==undefined)return invalid("form","Create a new plan without an existing revision.");
 const name=plain(x.name,2,100,"plan name").replace(/\s+/gu," ");
 const durationUnit=pick(x.durationUnit,units,"validity"),durationCount=int(x.durationCount,1,3650,"validity period"),category=pick(x.category,categories,"category");
 if((durationUnit==="LIFETIME"&&durationCount!==1)||(category==="LIFETIME"&&durationUnit!=="LIFETIME"))return invalid("validity","Choose lifetime validity for a lifetime plan.");
 if(!Array.isArray(x.benefits)||x.benefits.length>20)return invalid("benefits","Add no more than 20 benefits.");
 const benefits=x.benefits.map(v=>plain(v,1,200,"benefit"));
 if(new Set(benefits.map(v=>v.toLowerCase())).size!==benefits.length)return invalid("benefits","Remove repeated benefits.");
 return {key:uuid(x.requestKey),expected:editing?int(x.expectedVersion,1,2147483646,"revision"):null,name,category,status:pick(x.status,statuses,"status"),feeMinor:fee(x.price),currency:"INR" as const,durationUnit,durationCount,description:plain(x.description??"",0,2000,"description"),benefits,icon:pick(x.icon,icons,"icon"),color:pick(x.color,colors,"color"),displayOrder:int(x.displayOrder,0,9999,"display order")};
}
