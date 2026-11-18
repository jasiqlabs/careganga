import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade} from "./health-center-support-scope.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Content={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[]};
type Draft={version:number;state:string;content:Content};
const EMPTY:Content={description:"",services:[],facilities:[],
 hoursNote:"",publicEmail:"",faqs:[]};
const uuid=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});return v;};
const field=(v:unknown,max:number,min=0)=>{
 if(typeof v!=="string"||v.trim().length<min||v.length>max||
   /[\u0000-\u001f\u007f]/.test(v)||
   /<[a-z/!][^>]*>/i.test(v))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 return v.trim();
};
function parse(value:unknown):Content{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["description","services","facilities","hoursNote",
  "publicEmail","faqs"].includes(k)))throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const strings=(v:unknown,maxCount:number,maxLength:number)=>{
  if(!Array.isArray(v)||v.length>maxCount)return null;
  const items=v.map(a=>field(a,maxLength,2));
  if(new Set(items.map(a=>a.toLowerCase())).size!==items.length)return null;
  return items;
 };
 const services=strings(x.services,20,100),facilities=strings(x.facilities,20,100);
 if(!services||!facilities||!Array.isArray(x.faqs)||x.faqs.length>15)
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const faqs=x.faqs.map((item:unknown)=>{
  if(!item||typeof item!=="object"||Array.isArray(item)||
    Object.keys(item).some(k=>!["question","answer"].includes(k)))
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const faq=item as {question:unknown;answer:unknown};
  return {question:field(faq.question,160,5),answer:field(faq.answer,800,10)};
 });
 if(new Set(faqs.map(f=>f.question.toLowerCase())).size!==faqs.length)
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
 const publicEmail=field(x.publicEmail,180);
 if(publicEmail&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(publicEmail))
  throw new BadRequestException({code:"HEALTH_CONTENT_INVALID",field:"publicEmail"});
 return {description:field(x.description,1600),services,facilities,
  hoursNote:field(x.hoursNote,320),publicEmail,faqs};
}
@Injectable()
export class HealthCenterContentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly scope:HealthCenterSupportScopeFacade){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await fn(tx);
   await tx.query("COMMIT");active=false;
   return result;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async own(bearer:string,centerRef:string){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
   bearer,"health.centers.draft.edit");
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const result=await tx.query<Draft>(
    "SELECT version,state,content FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR SHARE",[actor.realmId,center]);
   const data=result.rows[0];
   return {centerRef:center,version:data?.version??0,state:data?.state??"DRAFT",
    content:data?.content??EMPTY};
  });
 }
 async save(bearer:string,centerRef:string,body:unknown){
  const center=uuid(centerRef),actor=await this.sessions.requireAction(
    bearer,"health.centers.draft.edit");
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const x=body as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["requestKey","expectedVersion","content"].includes(k))||
    !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||
    Number(x.expectedVersion)>2147483646)
   throw new BadRequestException({code:"HEALTH_CONTENT_INVALID"});
  const key=uuid(x.requestKey),expected=Number(x.expectedVersion),
    value=parse(x.content);
  const inputHash=createHash("sha256").update(JSON.stringify([center,expected,value])).digest("hex");
  return this.run(async tx=>{
   await this.scope.assertCurrent(tx,actor,center);
   const cmd=await tx.query<{id:string}>(
    "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
    "request_key,request_digest) VALUES($1,$2,'CENTER_CONTENT_SAVE',$3,$4) "+
    "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING RETURNING id",
    [actor.realmId,actor.accountId,key,inputHash]);
   if(!cmd.rows[0]){
    const old=await tx.query<{request_digest:string;result_ref:string;result_version:number}>(
     "SELECT request_digest,result_ref,result_version FROM health_network_command "+
     "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key='CENTER_CONTENT_SAVE' "+
     "AND request_key=$3 FOR SHARE",[actor.realmId,actor.accountId,key]);
    if(old.rows[0]?.request_digest!==inputHash||old.rows[0].result_ref!==center)
     throw new ConflictException({code:"HEALTH_CONTENT_REQUEST_CONFLICT"});
    return {centerRef:center,version:old.rows[0].result_version,
     state:"DRAFT",replayed:true};
   }
   const existing=await tx.query<{version:number;state:string}>(
    "SELECT version,state FROM health_center_content_draft "+
    "WHERE root_realm_id=$1 AND center_id=$2 FOR UPDATE",[actor.realmId,center]);
   const row=existing.rows[0];
   if((row?.version??0)!==expected||row?.state==="SUBMITTED")
    throw new ConflictException({code:"HEALTH_CONTENT_VERSION_CHANGED"});
   const saved=await tx.query<{version:number}>(
    "INSERT INTO health_center_content_draft(root_realm_id,center_id,version,"+
    "state,content,updated_by) VALUES($1,$2,1,'DRAFT',$3::jsonb,$4) "+
    "ON CONFLICT(root_realm_id,center_id) DO UPDATE SET "+
    "version=health_center_content_draft.version+1,state='DRAFT',"+
    "content=EXCLUDED.content,updated_by=EXCLUDED.updated_by,updated_at=now() "+
    "RETURNING version",[actor.realmId,center,JSON.stringify(value),actor.accountId]);
   const version=saved.rows[0].version;
   await tx.query(
    "UPDATE health_network_command SET result_ref=$2,result_version=$3 WHERE id=$1",
    [cmd.rows[0].id,center,version]);
   return {centerRef:center,version,state:"DRAFT",replayed:false,
    message:"Your changes are saved as a private draft. Foundation approval is required before publication."};
  });
 }
}
