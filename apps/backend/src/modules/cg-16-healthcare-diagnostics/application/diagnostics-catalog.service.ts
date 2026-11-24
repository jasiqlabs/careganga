import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthLabCatalogSourceFacade,CG14_CURRENT_LAB_EVIDENCE_SQL} from "../../cg-14-healthcare-network/application/health-lab-catalog-source.facade";
import {DiagnosticsPriceReviewSource} from "./diagnostics-price-review.service";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE=/^[A-Z0-9][A-Z0-9-]{1,23}$/;
const SAMPLES=["BLOOD","URINE","STOOL","SALIVA","SWAB","TISSUE","OTHER","NOT_APPLICABLE"] as const;
type Actor=VerifiedFoundationActor;
type TestDraft={testCode:string;name:string;categoryRef:string;sampleType:string;
 parametersDescription:string;clinicalDescription:string;status:"ACTIVE"|"INACTIVE";
 activeFromUtc:string|null;activeToUtc:string|null};
type PackageLine={testRef:string;quantity:number};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function obj(v:unknown,fields:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"LAB_CATALOG_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>!fields.includes(k)))
  throw new BadRequestException({code:"LAB_CATALOG_INVALID"});
 return x;
}
function string(v:unknown,field:string,min:number,max:number):string{
 if(typeof v!=="string"||/[\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 const s=v.trim().replace(/\s+/g," ");
 if(s.length<min||s.length>max)
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 return s;
}
function optional(v:unknown,field:string,max:number):string{
 if(v===undefined||v===null||v==="")return "";
 return string(v,field,0,max);
}
function code(v:unknown,field:string):string{
 const s=string(v,field,2,24).toUpperCase();
 if(!CODE.test(s))throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 return s;
}
function uuid(v:unknown,field:string):string{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 return v;
}
function integer(v:unknown,field:string,min=0,max=2147483647):number{
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 return v;
}
function status(v:unknown):"ACTIVE"|"INACTIVE"{
 if(v!=="ACTIVE"&&v!=="INACTIVE")
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"status"});
 return v;
}
function parseTest(x:Record<string,unknown>):TestDraft{
 const sampleType=string(x.sampleType,"sampleType",1,32);
 const activeFromUtc=x.activeFromUtc===undefined||x.activeFromUtc===null?null:
  iso(x.activeFromUtc,"activeFromUtc").toISOString();
 const activeToUtc=x.activeToUtc===undefined||x.activeToUtc===null?null:
  iso(x.activeToUtc,"activeToUtc").toISOString();
 if(activeToUtc&&activeFromUtc&&activeToUtc<=activeFromUtc)
  throw new BadRequestException({code:"LAB_CATALOG_TEST_EXPIRED",field:"activeToUtc"});
 if(!SAMPLES.includes(sampleType as typeof SAMPLES[number]))
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"sampleType"});
 return {
  testCode:code(x.testCode,"testCode"),name:string(x.name,"name",2,160),
  categoryRef:uuid(x.categoryRef,"categoryRef"),sampleType,
  parametersDescription:optional(x.parametersDescription,"parametersDescription",2000),
  clinicalDescription:optional(x.clinicalDescription,"clinicalDescription",2000),
  status:x.status===undefined?"ACTIVE":status(x.status),
  activeFromUtc,activeToUtc
 };
}
function parts(v:unknown):PackageLine[]{
 if(!Array.isArray(v)||v.length===0||v.length>20)
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"tests"});
 const results=v.map(e=>{
  const x=obj(e,["testRef","quantity"]);
  return {testRef:uuid(x.testRef,"testRef"),quantity:integer(x.quantity,"quantity",1,100)};
 });
 if(new Set(results.map(x=>x.testRef)).size!==results.length)
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"tests"});
 return results;
}
function iso(v:unknown,field:string):Date{
 if(typeof v!=="string"||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 const d=new Date(v);
 if(!Number.isFinite(d.getTime())||d.toISOString()!==v)
  throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field});
 return d;
}
function pgError(e:unknown):never{
 const err=e&&typeof e==="object"&&"code" in e?String(e.code):"";
 if(err==="23505"||err==="23P01"||err==="40001"||err==="40P01")
  throw new ConflictException({code:"LAB_CATALOG_CONFLICT"});
 if(err==="23503"||err==="23514"||err==="22P02")
  throw new BadRequestException({code:"LAB_CATALOG_INVALID"});
 if(err==="55P03"||err==="57014")
  throw new ServiceUnavailableException({code:"LAB_CATALOG_UNAVAILABLE"});
 throw e;
}
type Cmd={replay:string|null};
@Injectable()
export class DiagnosticsCatalogService{
 constructor(
  @Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly lab:HealthLabCatalogSourceFacade,
  private readonly priceReviews:DiagnosticsPriceReviewSource
 ){}
 private async run<T>(handler:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SET LOCAL statement_timeout='12s'");
   const result=await handler(tx);
   await tx.query("COMMIT");active=false;return result;
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};return pgError(e);}
  finally{tx.release();}
 }
 private async current(tx:PoolClient,actor:Actor,action:string){
  await this.identity.assertCurrent(tx,actor,action);
 }
 private async command(tx:PoolClient,actor:Actor,action:string,
  rawKey:unknown,payload:unknown):Promise<Cmd>{
  const key=uuid(rawKey,"requestKey"),hash=digest({action,payload});
  const inserted=await tx.query(
   "INSERT INTO lab_catalog_command(root_realm_id,actor_ref,request_key,action,payload_digest) "+
   "VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING request_key",
   [actor.realmId,actor.accountId,key,action,hash]);
  if(inserted.rowCount)return {replay:null};
  const existing=await tx.query<{
   action:string;payload_digest:string;result_ref:string|null
  }>("SELECT action,payload_digest,result_ref FROM lab_catalog_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,key]);
  if(existing.rows[0]?.action!==action||existing.rows[0]?.payload_digest!==hash)
   throw new ConflictException({code:"LAB_CATALOG_REQUEST_CONFLICT"});
  if(!existing.rows[0]?.result_ref)
   throw new ServiceUnavailableException({code:"LAB_CATALOG_UNAVAILABLE"});
  return {replay:existing.rows[0].result_ref};
 }
 private async done(tx:PoolClient,actor:Actor,key:unknown,ref:string){
  await tx.query("UPDATE lab_catalog_command SET result_ref=$4 "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key,ref]);
  await tx.query(
   "INSERT INTO lab_catalog_event(root_realm_id,actor_ref,request_key,"+
   "action,resource_ref,payload_digest) SELECT root_realm_id,actor_ref,request_key,"+
   "action,$4,payload_digest FROM lab_catalog_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key,ref]);
 }
 async categories(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.view");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.view");
   const rows=await tx.query(
    "SELECT id AS \"categoryRef\",code,display_name AS name,status,revision "+
    "FROM test_category WHERE root_realm_id=$1 ORDER BY display_name,id LIMIT 100",
    [actor.realmId]);
   return {categories:rows.rows};
  });
 }
 async createCategory(bearer:string,raw:unknown){
  const x=obj(raw,["requestKey","code","name"]);
  const data={code:code(x.code,"code"),name:string(x.name,"name",2,100)};
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.manage");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.manage");
   const cmd=await this.command(tx,actor,"CATEGORY_CREATE",x.requestKey,data);
   if(cmd.replay)return {categoryRef:cmd.replay,replayed:true};
   const r=await tx.query<{id:string}>(
    "INSERT INTO test_category(root_realm_id,code,display_name) "+
    "VALUES($1,$2,$3) RETURNING id",
    [actor.realmId,data.code,data.name]);
   await this.done(tx,actor,x.requestKey,r.rows[0].id);
   return {categoryRef:r.rows[0].id,replayed:false};
  });
 }
 async tests(bearer:string,filter:unknown){
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.view");
  const x=obj(filter,["q","status","categoryRef","sampleType","offset"]);
  const q=x.q===undefined?"":string(x.q,"q",0,80);
  const desired=x.status===undefined?"":status(x.status);
  const category=x.categoryRef===undefined?"":uuid(x.categoryRef,"categoryRef");
  const sample=x.sampleType===undefined?"":string(x.sampleType,"sampleType",1,32);
  if(sample&&!SAMPLES.includes(sample as typeof SAMPLES[number]))throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"sampleType"});
  if(x.offset!==undefined&&(typeof x.offset!=="string"||!/^(0|[1-9][0-9]{0,4})$/.test(x.offset)))
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"offset"});
  const offset=integer(Number(x.offset??0),"offset",0,10000);
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.view");
   const r=await tx.query(
    "SELECT t.id AS \"testRef\",t.unique_test_code AS code,t.name,"+
    "t.category_ref AS \"categoryRef\",c.display_name AS category,"+
    "t.sample_type AS \"sampleType\",t.parameters_description AS \"parametersDescription\","+
    "t.clinical_description AS \"clinicalDescription\",t.status,t.revision,"+
    "t.active_from AS \"activeFromUtc\",t.active_to AS \"activeToUtc\" "+
    "FROM diagnostic_test t JOIN test_category c ON c.root_realm_id=t.root_realm_id "+
    "AND c.id=t.category_ref WHERE t.root_realm_id=$1 "+
    "AND ($2='' OR t.name ILIKE $2 ESCAPE '\\' OR t.unique_test_code ILIKE $2 ESCAPE '\\') "+
    "AND ($3='' OR t.status=$3) AND ($4='' OR t.category_ref::text=$4) "+
    "AND ($5='' OR t.sample_type=$5) ORDER BY t.name,t.id LIMIT 101 OFFSET $6",
    [actor.realmId,q?"%"+q.replace(/[\\%_]/g,"\\$&")+"%":"",desired,category,sample,offset]);
   return {tests:r.rows.slice(0,100),nextOffset:r.rows.length>100&&offset<10000?offset+100:null};
  });
 }
 async exportSelected(bearer:string,raw:unknown){
  const x=obj(raw,["testRefs"]);
  if(!Array.isArray(x.testRefs)||x.testRefs.length===0||
   x.testRefs.length>100)
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"tests"});
  const refs=x.testRefs.map(v=>uuid(v,"testRef"));
  if(new Set(refs).size!==refs.length)
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"tests"});
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.view");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.view");
   const rows=await tx.query<{
    testRef:string;code:string;name:string;category:string;
    sampleType:string;status:string
   }>(
    "SELECT t.id AS \"testRef\",t.unique_test_code AS code,t.name,"+
    "c.display_name AS category,t.sample_type AS \"sampleType\",t.status "+
    "FROM diagnostic_test t JOIN test_category c ON "+
    "c.root_realm_id=t.root_realm_id AND c.id=t.category_ref "+
    "WHERE t.root_realm_id=$1 AND t.id=ANY($2::uuid[]) "+
    "ORDER BY t.name,t.id LIMIT 100",
    [actor.realmId,refs]);
   if(rows.rowCount!==refs.length)
    throw new ForbiddenException("Refresh your authorized test list before exporting.");
   return {tests:rows.rows,exportedCount:rows.rows.length};
  });
 }
 async createTest(bearer:string,raw:unknown){
  const x=obj(raw,["requestKey","testCode","name","categoryRef","sampleType",
   "parametersDescription","clinicalDescription","activeFromUtc","activeToUtc"]);
  const data=parseTest(x);
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.manage");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.manage");
   const cmd=await this.command(tx,actor,"TEST_CREATE",x.requestKey,data);
   if(cmd.replay)return {testRef:cmd.replay,replayed:true};
   const category=await tx.query("SELECT id FROM test_category "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",
    [actor.realmId,data.categoryRef]);
   if(!category.rowCount)throw new BadRequestException({code:"LAB_CATALOG_CATEGORY_UNAVAILABLE"});
   const r=await tx.query<{id:string;active_from:Date;active_to:Date|null}>(
    "INSERT INTO diagnostic_test(root_realm_id,unique_test_code,name,category_ref,"+
    "sample_type,parameters_description,clinical_description,active_from,"+
    "active_to,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),$9,$10) "+
    "RETURNING id,active_from,active_to",
    [actor.realmId,data.testCode,data.name,data.categoryRef,data.sampleType,
     data.parametersDescription,data.clinicalDescription,data.activeFromUtc,
     data.activeToUtc,actor.accountId]);
   await tx.query("INSERT INTO diagnostic_test_revision(root_realm_id,test_ref,"+
    "revision_no,snapshot,changed_by) VALUES($1,$2,1,$3::jsonb,$4)",
    [actor.realmId,r.rows[0].id,JSON.stringify({...data,
     activeFromUtc:r.rows[0].active_from.toISOString(),
     activeToUtc:r.rows[0].active_to?.toISOString()??null}),actor.accountId]);
   await this.done(tx,actor,x.requestKey,r.rows[0].id);
   return {testRef:r.rows[0].id,replayed:false};
  });
 }
 async updateTest(bearer:string,rawRef:string,raw:unknown){
  const testRef=uuid(rawRef,"testRef");
  const x=obj(raw,["requestKey","expectedVersion","name","categoryRef",
   "sampleType","parametersDescription","clinicalDescription","status","testCode",
   "activeFromUtc","activeToUtc"]);
  const expected=integer(x.expectedVersion,"expectedVersion",1,2147483646);
  const data=parseTest(x);
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.manage");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.manage");
   const cmd=await this.command(tx,actor,"TEST_UPDATE",x.requestKey,{testRef,expected,data});
   if(cmd.replay)return {testRef:cmd.replay,replayed:true};
   const before=await tx.query<{revision:number;unique_test_code:string;
    active_from:Date;active_to:Date|null}>(
    "SELECT revision,unique_test_code,active_from,active_to FROM diagnostic_test "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,testRef]);
   if(!before.rows[0])throw new NotFoundException("Diagnostic test unavailable");
   if(before.rows[0].revision!==expected)
    throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
   if(data.testCode!==before.rows[0].unique_test_code)
    throw new BadRequestException({code:"LAB_CATALOG_CODE_IMMUTABLE"});
   const category=await tx.query("SELECT id FROM test_category "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",
    [actor.realmId,data.categoryRef]);
   if(!category.rowCount)throw new BadRequestException({code:"LAB_CATALOG_CATEGORY_UNAVAILABLE"});
   const activeFromUtc=data.activeFromUtc??before.rows[0].active_from.toISOString();
   const activeToUtc=x.activeToUtc===undefined?
    before.rows[0].active_to?.toISOString()??null:data.activeToUtc;
   if(activeToUtc&&activeToUtc<=activeFromUtc)
    throw new BadRequestException({code:"LAB_CATALOG_TEST_EXPIRED",field:"activeToUtc"});
   const updated=await tx.query<{active_from:Date;active_to:Date|null}>(
    "UPDATE diagnostic_test SET name=$3,category_ref=$4,sample_type=$5,"+
    "parameters_description=$6,clinical_description=$7,status=$8,revision=revision+1,"+
    "active_from=$9,active_to=$10,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 RETURNING active_from,active_to",
    [actor.realmId,testRef,data.name,data.categoryRef,data.sampleType,
     data.parametersDescription,data.clinicalDescription,data.status,
     activeFromUtc,activeToUtc]);
   await tx.query("INSERT INTO diagnostic_test_revision(root_realm_id,test_ref,"+
    "revision_no,snapshot,changed_by) VALUES($1,$2,$3,$4::jsonb,$5)",
    [actor.realmId,testRef,expected+1,JSON.stringify({...data,
      activeFromUtc:updated.rows[0].active_from.toISOString(),
      activeToUtc:updated.rows[0].active_to?.toISOString()??null}),actor.accountId]);
   await this.done(tx,actor,x.requestKey,testRef);
   return {testRef,revision:expected+1,replayed:false};
  });
 }
 async packages(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.view");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.view");
   const rows=await tx.query(
    "SELECT p.id AS \"packageRef\",p.unique_package_code AS code,p.name,p.description,"+
    "p.status,p.active_from AS \"activeFromUtc\",p.active_to AS \"activeToUtc\",p.revision,COUNT(l.test_ref)::int AS \"testCount\" "+
    "FROM diagnostic_package p LEFT JOIN diagnostic_package_line l ON "+
    "l.root_realm_id=p.root_realm_id AND l.package_ref=p.id "+
    "AND l.package_revision=p.revision "+
    "WHERE p.root_realm_id=$1 GROUP BY p.id ORDER BY p.name,p.id LIMIT 100",
    [actor.realmId]);
   return {packages:rows.rows};
  });
 }
 async createPackage(bearer:string,raw:unknown){
  const x=obj(raw,["requestKey","packageCode","name","description","tests","activeFromUtc","activeToUtc"]);
  const data={packageCode:code(x.packageCode,"packageCode"),
   name:string(x.name,"name",2,160),
   description:optional(x.description,"description",2000),tests:parts(x.tests),
   activeFromUtc:x.activeFromUtc===undefined||x.activeFromUtc===null?null:
    iso(x.activeFromUtc,"activeFromUtc").toISOString(),
   activeToUtc:x.activeToUtc===undefined||x.activeToUtc===null?null:
    iso(x.activeToUtc,"activeToUtc").toISOString()};
  if(data.activeToUtc&&data.activeFromUtc&&data.activeToUtc<=data.activeFromUtc)
   throw new BadRequestException({code:"LAB_CATALOG_PACKAGE_INVALID",field:"activeToUtc"});
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.manage");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.manage");
   const cmd=await this.command(tx,actor,"PACKAGE_CREATE",x.requestKey,data);
   if(cmd.replay)return {packageRef:cmd.replay,replayed:true};
   if(data.activeToUtc&&new Date(data.activeToUtc).getTime()<=Date.now())
    throw new BadRequestException({code:"LAB_CATALOG_PACKAGE_INVALID",field:"activeToUtc"});
   const actual=await tx.query<{id:string;revision:number;
    active_from:Date;active_to:Date|null}>(
    "SELECT t.id,t.revision,t.active_from,t.active_to FROM diagnostic_test t JOIN test_category c "+
    "ON c.root_realm_id=t.root_realm_id AND c.id=t.category_ref "+
    "WHERE t.root_realm_id=$1 AND t.id=ANY($2::uuid[]) "+
    "AND t.status='ACTIVE' AND c.status='ACTIVE' "+
    "AND t.active_from<=now() AND (t.active_to IS NULL OR t.active_to>now()) "+
    "FOR SHARE OF t,c",
    [actor.realmId,data.tests.map(t=>t.testRef)]);
   if(actual.rowCount!==data.tests.length)
    throw new BadRequestException({code:"LAB_CATALOG_PACKAGE_INVALID"});
   const revisions=new Map(actual.rows.map(t=>[t.id,t.revision]));
   const pack=await tx.query<{id:string;active_from:Date;active_to:Date|null}>(
    "INSERT INTO diagnostic_package(root_realm_id,unique_package_code,"+
    "name,description,active_from,active_to,created_by) "+
    "VALUES($1,$2,$3,$4,COALESCE($5::timestamptz,now()),$6,$7) "+
    "RETURNING id,active_from,active_to",
    [actor.realmId,data.packageCode,data.name,data.description,data.activeFromUtc,
     data.activeToUtc,actor.accountId]);
   const ref=pack.rows[0].id;
   // A scheduled package cannot outlive any of its original approved
   // components; otherwise it would expose a withdrawn/expired test.
   for(const component of actual.rows){
    if(component.active_from.getTime()>pack.rows[0].active_from.getTime()||
       component.active_to&&(!pack.rows[0].active_to||
        component.active_to.getTime()<pack.rows[0].active_to.getTime()))
     throw new BadRequestException({code:"LAB_CATALOG_TEST_EXPIRED",field:"tests"});
   }
   for(let i=0;i<data.tests.length;i++){
    const line=data.tests[i];
    await tx.query("INSERT INTO diagnostic_package_line(root_realm_id,package_ref,"+
     "package_revision,test_ref,test_revision_at_approval,quantity,order_index) "+
     "VALUES($1,$2,1,$3,$4,$5,$6)",
     [actor.realmId,ref,line.testRef,revisions.get(line.testRef),line.quantity,i]);
   }
   await tx.query("INSERT INTO diagnostic_package_revision(root_realm_id,package_ref,"+
    "revision_no,snapshot,changed_by) VALUES($1,$2,1,$3::jsonb,$4)",
    [actor.realmId,ref,JSON.stringify({...data,
     activeFromUtc:pack.rows[0].active_from.toISOString(),
     activeToUtc:pack.rows[0].active_to?.toISOString()??null,
     tests:data.tests.map(t=>({...t,testRevision:revisions.get(t.testRef)}))}),actor.accountId]);
   await this.done(tx,actor,x.requestKey,ref);
   return {packageRef:ref,replayed:false};
  });
 }
 async eligibleCenters(bearer:string,own=false){
  const actor=await this.sessions.requireAction(bearer,
   own?"diagnostics.pricing.view":"diagnostics.catalog.view");
  return this.run(async tx=>{
   await this.current(tx,actor,own?"diagnostics.pricing.view":"diagnostics.catalog.view");
   const r=await tx.query(
    "SELECT c.id AS \"centerRef\",c.display_name AS name,c.center_code AS code,"+
    "p.legal_name AS \"providerName\",c.publication_state AS \"publicationState\", "+
    "c.public_slug AS \"publicSlug\" "+
    "FROM health_center c JOIN health_provider p ON "+
    "p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
    "JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id "+
    "AND cap.center_id=c.id AND cap.capability_code='DIAGNOSTICS' "+
    (own?"JOIN health_center_account_affiliation f ON "+
     "f.root_realm_id=c.root_realm_id AND f.center_id=c.id "+
     "AND f.account_ref=$2 AND f.status='ACTIVE' ":"")+
    "WHERE c.root_realm_id=$1 AND c.status='VERIFIED' AND "+
    "c.access_state='ENABLED' AND p.status='VERIFIED' "+
    "AND "+CG14_CURRENT_LAB_EVIDENCE_SQL+
    "ORDER BY c.display_name,c.id LIMIT 50",
    own?[actor.realmId,actor.accountId]:[actor.realmId]);
   return {centers:r.rows};
  });
 }
 private async center(tx:PoolClient,actor:Actor,ref:string,own:boolean,
  action:string){
  await this.current(tx,actor,action);
  return this.lab.assertLab(tx,actor.realmId,ref,own?actor:undefined,own,
   action==="diagnostics.pricing.view"?"diagnostics.pricing.view":"diagnostics.pricing.manage");
 }
 private async eligibleItem(tx:PoolClient,root:string,kind:"TEST"|"PACKAGE",itemRef:string){
  const query=kind==="TEST"?
   "SELECT t.id FROM diagnostic_test t JOIN test_category c "+
   "ON c.root_realm_id=t.root_realm_id AND c.id=t.category_ref "+
   "WHERE t.root_realm_id=$1 AND t.id=$2 AND t.status='ACTIVE' "+
   "AND c.status='ACTIVE' AND t.active_from<=now() "+
   "AND (t.active_to IS NULL OR t.active_to>now()) FOR SHARE OF t,c":
   "SELECT p.id FROM diagnostic_package p WHERE p.root_realm_id=$1 "+
   "AND p.id=$2 AND p.status='ACTIVE' AND p.active_from<=now() "+
   "AND (p.active_to IS NULL OR p.active_to>now()) "+
   " AND EXISTS(SELECT 1 FROM diagnostic_package_line l WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id AND l.package_revision=p.revision) AND NOT EXISTS(SELECT 1 FROM diagnostic_package_line l LEFT JOIN diagnostic_test t ON t.root_realm_id=l.root_realm_id AND t.id=l.test_ref LEFT JOIN test_category c ON c.root_realm_id=t.root_realm_id AND c.id=t.category_ref WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id AND l.package_revision=p.revision AND (t.status IS DISTINCT FROM 'ACTIVE' OR t.active_from>now() OR (t.active_to IS NOT NULL AND t.active_to<=now()) OR c.status IS DISTINCT FROM 'ACTIVE')) "+
   "FOR SHARE OF p";
  const row=await tx.query(query,[root,itemRef]);
  if(!row.rowCount)throw new BadRequestException({code:"LAB_CATALOG_ITEM_UNAVAILABLE"});
 }
 async eligibleItems(bearer:string,ref:string,own=false){
  const centerRef=uuid(ref,"centerRef");
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.view");
  return this.run(async tx=>{
   await this.center(tx,actor,centerRef,own,"diagnostics.pricing.view");
   const r=await tx.query(
    "SELECT 'TEST' AS kind,t.id AS \"itemRef\",t.name,t.unique_test_code AS code "+
    "FROM diagnostic_test t JOIN test_category c ON c.root_realm_id=t.root_realm_id "+
    "AND c.id=t.category_ref WHERE t.root_realm_id=$1 "+
    "AND t.status='ACTIVE' AND c.status='ACTIVE' "+
    "AND t.active_from<=now() AND (t.active_to IS NULL OR t.active_to>now()) "+
    "UNION ALL "+
    "SELECT 'PACKAGE' AS kind,p.id AS \"itemRef\",p.name,p.unique_package_code AS code "+
    "FROM diagnostic_package p WHERE p.root_realm_id=$1 AND p.status='ACTIVE' "+
    "AND p.active_from<=now() AND (p.active_to IS NULL OR p.active_to>now()) "+
    " AND EXISTS(SELECT 1 FROM diagnostic_package_line l WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id AND l.package_revision=p.revision) AND NOT EXISTS(SELECT 1 FROM diagnostic_package_line l LEFT JOIN diagnostic_test t ON t.root_realm_id=l.root_realm_id AND t.id=l.test_ref LEFT JOIN test_category c ON c.root_realm_id=t.root_realm_id AND c.id=t.category_ref WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id AND l.package_revision=p.revision AND (t.status IS DISTINCT FROM 'ACTIVE' OR t.active_from>now() OR (t.active_to IS NOT NULL AND t.active_to<=now()) OR c.status IS DISTINCT FROM 'ACTIVE')) "+
    "ORDER BY name,\"itemRef\" LIMIT 100",[actor.realmId]);
   return {items:r.rows};
  });
 }
 async mappings(bearer:string,ref:string,own=false){
  const centerRef=uuid(ref,"centerRef");
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.view");
  return this.run(async tx=>{
   await this.center(tx,actor,centerRef,own,"diagnostics.pricing.view");
   const r=await tx.query(
    "SELECT m.id AS \"mappingRef\",m.center_ref AS \"centerRef\","+
    "m.test_or_package_kind AS kind,COALESCE(t.name,p.name) AS name,"+
    "COALESCE(t.unique_test_code,p.unique_package_code) AS code,"+
    "m.test_ref AS \"testRef\",m.package_ref AS \"packageRef\","+
    "m.publication_state AS status,m.revision "+
    "FROM lab_center_test_mapping m "+
    "LEFT JOIN diagnostic_test t ON t.root_realm_id=m.root_realm_id AND t.id=m.test_ref "+
    "LEFT JOIN diagnostic_package p ON p.root_realm_id=m.root_realm_id AND p.id=m.package_ref "+
    "WHERE m.root_realm_id=$1 AND m.center_ref=$2 ORDER BY name,m.id LIMIT 100",
    [actor.realmId,centerRef]);
   return {mappings:r.rows};
  });
 }
 async mapItem(bearer:string,ref:string,raw:unknown,own=false){
  const centerRef=uuid(ref,"centerRef");
  const x=obj(raw,["requestKey","kind","itemRef"]);
  const kind=x.kind==="TEST"?"TEST":x.kind==="PACKAGE"?"PACKAGE":null;
  if(!kind)throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"kind"});
  const itemRef=uuid(x.itemRef,"itemRef");
  const actor=await this.sessions.requireAction(bearer,own?
   "diagnostics.pricing.manage":"diagnostics.catalog.manage");
  return this.run(async tx=>{
   await this.center(tx,actor,centerRef,own,own?
    "diagnostics.pricing.manage":"diagnostics.catalog.manage");
   const cmd=await this.command(tx,actor,"MAP_CREATE",x.requestKey,{centerRef,kind,itemRef});
   if(cmd.replay)return {mappingRef:cmd.replay,replayed:true};
   await this.eligibleItem(tx,actor.realmId,kind,itemRef);
   const m=await tx.query<{id:string}>(
    "INSERT INTO lab_center_test_mapping(root_realm_id,center_ref,"+
    "test_or_package_kind,test_ref,package_ref,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [actor.realmId,centerRef,kind,kind==="TEST"?itemRef:null,
     kind==="PACKAGE"?itemRef:null,actor.accountId]);
   await this.done(tx,actor,x.requestKey,m.rows[0].id);
   return {mappingRef:m.rows[0].id,replayed:false};
  });
 }
 async prices(bearer:string,ref:string,mapping:unknown,own=false){
  const centerRef=uuid(ref,"centerRef");
  const mapRef=mapping===undefined?"":uuid(mapping,"mappingRef");
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.view");
  return this.run(async tx=>{
   await this.center(tx,actor,centerRef,own,"diagnostics.pricing.view");
   const r=await tx.query(
    "SELECT pr.id AS \"priceRef\",pr.center_test_mapping_ref AS \"mappingRef\","+
    "pr.version_no AS version,pr.effective_from AS \"effectiveFromUtc\","+
    "pr.effective_to AS \"effectiveToUtc\",pr.base_price_minor::text AS \"basePriceMinor\","+
    "pr.advertised_patient_price_minor::text AS \"patientPriceMinor\","+
    "pr.price_currency AS currency,pr.status,pr.discount_reason AS \"discountReason\", "+
    "review.id AS \"reviewCaseRef\",review.case_number AS \"reviewReference\", "+
    "review.revision AS \"reviewCaseRevision\",review.status AS \"reviewStatus\" "+
    "FROM lab_center_price_version pr JOIN lab_center_test_mapping m ON "+
    "m.root_realm_id=pr.root_realm_id AND m.id=pr.center_test_mapping_ref "+
    "LEFT JOIN cg03_case review ON review.realm_id=pr.root_realm_id "+
    "AND review.cg16_price_id=pr.id AND review.case_kind='HEALTH_LAB_PRICE_REVIEW' "+
    "WHERE pr.root_realm_id=$1 AND m.center_ref=$2 "+
    "AND ($3='' OR pr.center_test_mapping_ref::text=$3) "+
    "ORDER BY pr.created_at DESC,pr.id DESC LIMIT 100",
    [actor.realmId,centerRef,mapRef]);
   return {prices:r.rows};
  });
 }
 private async assertPackagePriceWindow(tx:PoolClient,root:string,
  kind:"TEST"|"PACKAGE",ref:string,from:Date,until:Date|null){
  // Price validity never outlives its source test/package or any member test.
  // All medical/source rows are original CG16, not copied lab inventory.
  const p=await tx.query<{active_from:Date;active_to:Date|null}>(
   kind==="TEST"?
   "SELECT active_from,active_to FROM diagnostic_test "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE":
   "SELECT active_from,active_to FROM diagnostic_package "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",
   [root,ref]);
  const row=p.rows[0];
  if(!row||from.getTime()<row.active_from.getTime()||
    row.active_to&&(!until||until.getTime()>row.active_to.getTime()))
   throw new BadRequestException({code:"LAB_CATALOG_RATE_OUTSIDE_WINDOW",
    field:"effectiveToUtc"});
  if(kind==="PACKAGE"){
   // Package member dates may have been shortened after this package's
   // originally frozen revision. Check every ACTUAL current component
   // against the proposed commercial interval, not only against NOW.
   const invalid=await tx.query(
    "SELECT 1 FROM diagnostic_package_line l "+
    "JOIN diagnostic_package pkg ON pkg.root_realm_id=l.root_realm_id "+
    "AND pkg.id=l.package_ref AND pkg.revision=l.package_revision "+
    "LEFT JOIN diagnostic_test t ON t.root_realm_id=l.root_realm_id "+
    "AND t.id=l.test_ref "+
    "LEFT JOIN test_category cat ON cat.root_realm_id=t.root_realm_id "+
    "AND cat.id=t.category_ref "+
    "WHERE l.root_realm_id=$1 AND l.package_ref=$2 "+
    "AND (t.status IS DISTINCT FROM 'ACTIVE' OR "+
    "cat.status IS DISTINCT FROM 'ACTIVE' OR "+
    "t.active_from>$3::timestamptz OR "+
    "(t.active_to IS NOT NULL AND "+
    "($4::timestamptz IS NULL OR t.active_to<$4::timestamptz))) "+
    "LIMIT 1",[root,ref,from,until]);
   if(invalid.rowCount)
    throw new BadRequestException({code:"LAB_CATALOG_RATE_OUTSIDE_WINDOW",
     field:"effectiveToUtc"});
  }
 }
 async proposePrice(bearer:string,ref:string,raw:unknown,own=false){
  const centerRef=uuid(ref,"centerRef");
  const x=obj(raw,["requestKey","mappingRef","expectedMappingVersion",
   "effectiveFromUtc","effectiveToUtc","basePriceMinor","patientPriceMinor",
   "currency","discountReason"]);
  const mappingRef=uuid(x.mappingRef,"mappingRef");
  const data={
   centerRef,mappingRef,
   expected:integer(x.expectedMappingVersion,"expectedMappingVersion",1,2147483646),
   from:iso(x.effectiveFromUtc,"effectiveFromUtc").toISOString(),
   to:x.effectiveToUtc===undefined||x.effectiveToUtc===null?
    null:iso(x.effectiveToUtc,"effectiveToUtc").toISOString(),
   base:integer(x.basePriceMinor,"basePriceMinor",0,999999999),
   patient:integer(x.patientPriceMinor,"patientPriceMinor",0,999999999),
   currency:x.currency===undefined?"INR":x.currency,
   reason:optional(x.discountReason,"discountReason",240)
  };
  if(data.currency!=="INR"||data.patient>data.base||
    data.to&&data.to<=data.from)
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"price"});
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.manage");
  return this.run(async tx=>{
   await this.center(tx,actor,centerRef,own,"diagnostics.pricing.manage");
   const cmd=await this.command(tx,actor,"PRICE_PROPOSE",x.requestKey,data);
   if(cmd.replay)return {priceRef:cmd.replay,replayed:true};
   const m=await tx.query<{revision:number;test_or_package_kind:"TEST"|"PACKAGE";
    test_ref:string|null;package_ref:string|null;publication_state:string}>(
    "SELECT revision,test_or_package_kind,test_ref,package_ref,publication_state "+
    "FROM lab_center_test_mapping WHERE root_realm_id=$1 AND id=$2 "+
    "AND center_ref=$3 FOR UPDATE",[actor.realmId,mappingRef,centerRef]);
   if(!m.rows[0]||m.rows[0].publication_state!=="ACTIVE")
    throw new BadRequestException({code:"LAB_CATALOG_ITEM_UNAVAILABLE"});
   if(m.rows[0].revision!==data.expected)
    throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
   await this.eligibleItem(tx,actor.realmId,m.rows[0].test_or_package_kind,
    (m.rows[0].test_ref??m.rows[0].package_ref)!);
   await this.assertPackagePriceWindow(tx,actor.realmId,
    m.rows[0].test_or_package_kind,(m.rows[0].test_ref??m.rows[0].package_ref)!,
    new Date(data.from),data.to?new Date(data.to):null);
   const p=await tx.query<{id:string}>(
    "INSERT INTO lab_center_price_version(root_realm_id,center_test_mapping_ref,"+
    "version_no,effective_from,effective_to,base_price_minor,"+
    "advertised_patient_price_minor,price_currency,discount_reason,proposed_by) "+
    "VALUES($1,$2,(SELECT COALESCE(MAX(version_no),0)+1 FROM "+
    "lab_center_price_version WHERE root_realm_id=$1 AND center_test_mapping_ref=$2),"+
    "$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    [actor.realmId,mappingRef,data.from,data.to,data.base,data.patient,
     data.currency,data.reason||null,actor.accountId]);
   const review=await this.priceReviews.create(tx,actor,p.rows[0].id,
    uuid(x.requestKey,"requestKey"));
   await this.done(tx,actor,x.requestKey,p.rows[0].id);
   return {priceRef:p.rows[0].id,status:"PROPOSED",
    reviewReference:review.reference,reviewCaseRef:review.caseRef,replayed:false};
  });
 }
 async approvePrice(bearer:string,rawRef:string,raw:unknown){
  const priceRef=uuid(rawRef,"priceRef");
  const x=obj(raw,["requestKey","expectedVersion","expectedCaseRevision",
   "currentPassword"]);
  const expected=integer(x.expectedVersion,"expectedVersion",1);
  const expectedCaseRevision=integer(x.expectedCaseRevision,"expectedCaseRevision",1);
  const requestKey=uuid(x.requestKey,"requestKey");
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||
     x.currentPassword.length>1024)
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"currentPassword"});
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.approve");
  await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.pricing.approve");
   await this.current(tx,actor,"approvals.review");
   const info=await tx.query<{center_ref:string;center_test_mapping_ref:string}>(
    "SELECT m.center_ref,pr.center_test_mapping_ref "+
    "FROM lab_center_price_version pr JOIN lab_center_test_mapping m "+
    "ON m.root_realm_id=pr.root_realm_id AND m.id=pr.center_test_mapping_ref "+
    "WHERE pr.root_realm_id=$1 AND pr.id=$2",
    [actor.realmId,priceRef]);
   if(!info.rows[0])throw new NotFoundException("The price proposal is unavailable");
   await this.lab.assertLab(tx,actor.realmId,info.rows[0].center_ref);
   const mapping=await tx.query<{
    publication_state:string;test_or_package_kind:"TEST"|"PACKAGE";
    test_ref:string|null;package_ref:string|null
   }>("SELECT publication_state,test_or_package_kind,test_ref,package_ref "+
    "FROM lab_center_test_mapping WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,info.rows[0].center_test_mapping_ref]);
   if(mapping.rows[0]?.publication_state!=="ACTIVE")
    throw new ConflictException({code:"LAB_CATALOG_ITEM_UNAVAILABLE"});
   await this.eligibleItem(tx,actor.realmId,mapping.rows[0].test_or_package_kind,
    (mapping.rows[0].test_ref??mapping.rows[0].package_ref)!);
   const cmd=await this.command(tx,actor,"PRICE_APPROVE",requestKey,
    {priceRef,expected,expectedCaseRevision});
   if(cmd.replay)return {priceRef:cmd.replay,status:"APPROVED",replayed:true};
   const proposal=await tx.query<{
    version_no:number;status:string;proposed_by:string;
    effective_from:Date;effective_to:Date|null
   }>("SELECT version_no,status,proposed_by,effective_from,effective_to "+
    "FROM lab_center_price_version WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,priceRef]);
   if(!proposal.rows[0]||proposal.rows[0].version_no!==expected||
     proposal.rows[0].status!=="PROPOSED")
    throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
   if(proposal.rows[0].proposed_by===actor.accountId)
    throw new ForbiddenException("A different authorized reviewer must approve this price");
   await this.assertPackagePriceWindow(tx,actor.realmId,
    mapping.rows[0].test_or_package_kind,
    (mapping.rows[0].test_ref??mapping.rows[0].package_ref)!,
    proposal.rows[0].effective_from,proposal.rows[0].effective_to);
   if(proposal.rows[0].effective_to&&
     proposal.rows[0].effective_to.getTime()<=Date.now())
    throw new ConflictException({code:"LAB_CATALOG_PRICE_EXPIRED"});
   // No amount, price interval or financial state changes before the
   // immutable CG03 source-pinned case is approved with fresh password.
   const caseDecision=await this.priceReviews.decide(tx,actor,{
    priceRef,priceVersion:expected,expectedCaseRevision,requestKey,
    currentPassword:String(x.currentPassword),action:"APPROVE"
   });
   const prior=await tx.query<{id:string;effective_from:Date;effective_to:Date|null}>(
    "SELECT id,effective_from,effective_to FROM lab_center_price_version "+
    "WHERE root_realm_id=$1 AND center_test_mapping_ref=$2 AND status='APPROVED' "+
    "AND tstzrange(effective_from,effective_to,'[)') && "+
    "tstzrange($3::timestamptz,$4::timestamptz,'[)') "+
    "ORDER BY effective_from,id FOR UPDATE",
    [actor.realmId,info.rows[0].center_test_mapping_ref,
     proposal.rows[0].effective_from,proposal.rows[0].effective_to]);
   if(prior.rows.length>1)
    throw new ConflictException({code:"LAB_CATALOG_CONFLICT"});
   if(prior.rows.length===1){
    const old=prior.rows[0],proposedStart=proposal.rows[0].effective_from;
    // Never redate old accepted care or let a new price start before the
    // original effective price. Only a future replacement can end it early.
    if(old.effective_from.getTime()>=proposedStart.getTime()||
      proposedStart.getTime()<=Date.now()+1000)
     throw new ConflictException({code:"LAB_CATALOG_RATE_OVERLAP"});
    await tx.query(
     "INSERT INTO lab_center_price_window_event(root_realm_id,old_price_ref,"+
     "replacement_price_ref,previous_effective_to,new_effective_to,actor_ref) "+
     "VALUES($1,$2,$3,$4,$5,$6)",
     [actor.realmId,old.id,priceRef,old.effective_to,proposedStart,actor.accountId]);
    await tx.query(
     "UPDATE lab_center_price_version SET effective_to=$3 "+
     "WHERE root_realm_id=$1 AND id=$2 AND status='APPROVED'",
     [actor.realmId,old.id,proposedStart]);
   }
   await tx.query(
    "UPDATE lab_center_price_version SET status='APPROVED',"+
    "approved_by=$3,reviewed_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,priceRef,actor.accountId]);
   await this.priceReviews.finish(tx,actor,caseDecision.caseRef);
   await this.done(tx,actor,requestKey,priceRef);
   return {priceRef,status:"APPROVED",reviewReference:caseDecision.caseNumber,
    replayed:false};
  });
 }
 async rejectPrice(bearer:string,rawRef:string,raw:unknown){
  const priceRef=uuid(rawRef,"priceRef");
  const x=obj(raw,["requestKey","expectedVersion","expectedCaseRevision",
   "currentPassword"]);
  const requestKey=uuid(x.requestKey,"requestKey");
  const expected=integer(x.expectedVersion,"expectedVersion",1);
  const expectedCaseRevision=integer(x.expectedCaseRevision,"expectedCaseRevision",1);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||
    x.currentPassword.length>1024)
   throw new BadRequestException({code:"LAB_CATALOG_FIELD_INVALID",field:"currentPassword"});
  const actor=await this.sessions.requireAction(bearer,"diagnostics.pricing.approve");
  await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.limitFoundationRootProof(actor);
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.pricing.approve");
   await this.current(tx,actor,"approvals.review");
   const price=await tx.query<{version_no:number;status:string}>(
    "SELECT version_no,status FROM lab_center_price_version "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,priceRef]);
   if(!price.rows[0])throw new NotFoundException("This price proposal is unavailable");
   const cmd=await this.command(tx,actor,"PRICE_REJECT",requestKey,
    {priceRef,expected,expectedCaseRevision});
   if(cmd.replay)return {priceRef:cmd.replay,status:"REJECTED",replayed:true};
   if(price.rows[0].status!=="PROPOSED"||price.rows[0].version_no!==expected)
    throw new ConflictException({code:"LAB_CATALOG_VERSION_CHANGED"});
   const review=await this.priceReviews.decide(tx,actor,{
    priceRef,priceVersion:expected,expectedCaseRevision,requestKey,
    currentPassword:String(x.currentPassword),action:"REJECT"
   });
   await tx.query("UPDATE lab_center_price_version SET status='REJECTED' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PROPOSED'",
    [actor.realmId,priceRef]);
   await this.done(tx,actor,requestKey,priceRef);
   return {priceRef,status:"REJECTED",reviewReference:review.caseNumber,
    replayed:false};
  });
 }
 async summary(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"diagnostics.catalog.view");
  return this.run(async tx=>{
   await this.current(tx,actor,"diagnostics.catalog.view");
   const data=await tx.query<{
    total_tests:string;active_tests:string;categories:string;packages:string
   }>("SELECT "+
    "(SELECT count(*) FROM diagnostic_test WHERE root_realm_id=$1) AS total_tests,"+
    "(SELECT count(*) FROM diagnostic_test t JOIN test_category cat "+
    "ON cat.root_realm_id=t.root_realm_id AND cat.id=t.category_ref "+
    "WHERE t.root_realm_id=$1 AND t.status='ACTIVE' "+
    "AND cat.status='ACTIVE' AND t.active_from<=now() "+
    "AND (t.active_to IS NULL OR t.active_to>now())) AS active_tests,"+
    "(SELECT count(*) FROM test_category WHERE root_realm_id=$1 AND status='ACTIVE') AS categories,"+
    "(SELECT count(*) FROM diagnostic_package WHERE root_realm_id=$1 "+
    "AND status='ACTIVE' AND active_from<=now() "+
    "AND (active_to IS NULL OR active_to>now())) AS packages",
    [actor.realmId]);
   const stats=data.rows[0];
   // A current offer must have a real approved unexpired tariff and CG14
   // published, verified center with original protected approval/proof.
   // Test master counts by themselves are never advertised as published.
   const offers=await tx.query<{published_offers:string;average_minor:string|null}>(
    "SELECT count(DISTINCT m.id) AS published_offers, "+
    "ROUND(AVG(price.advertised_patient_price_minor))::text AS average_minor "+
    "FROM lab_center_test_mapping m "+
    "JOIN lab_center_price_version price ON price.root_realm_id=m.root_realm_id "+
    "AND price.center_test_mapping_ref=m.id AND price.status='APPROVED' "+
    "AND price.effective_from<=now() "+
    "AND (price.effective_to IS NULL OR price.effective_to>now()) "+
    "JOIN cg03_case pricingReview ON pricingReview.realm_id=price.root_realm_id "+
    "AND pricingReview.case_kind='HEALTH_LAB_PRICE_REVIEW' "+
    "AND pricingReview.cg16_price_id=price.id "+
    "AND pricingReview.cg16_price_version=price.version_no "+
    "AND pricingReview.status='OWNER_COMPLETED' "+
    "AND pricingReview.proposer_id=price.proposed_by "+
    "JOIN cg03_case_decision pricingDecision ON "+
    "pricingDecision.realm_id=pricingReview.realm_id "+
    "AND pricingDecision.case_id=pricingReview.id "+
    "AND pricingDecision.action='APPROVE' "+
    "AND pricingDecision.actor_id=price.approved_by "+
    "AND pricingDecision.actor_id<>pricingReview.proposer_id "+
    "AND pricingDecision.fresh_password_verified_at IS NOT NULL "+
    "AND pricingDecision.accepted_case_revision=pricingReview.revision-1 "+
    "JOIN health_center c ON c.root_realm_id=m.root_realm_id "+
    "AND c.id=m.center_ref AND c.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND c.publication_state='PUBLISHED' "+
    "JOIN health_provider p ON p.root_realm_id=c.root_realm_id "+
    "AND p.id=c.provider_id AND p.status='VERIFIED' "+
    "JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id "+
    "AND cap.center_id=c.id AND cap.capability_code='DIAGNOSTICS' "+
    "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
    "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
    "JOIN health_center_revision rev ON rev.id=pub.verified_center_revision_id "+
    "AND rev.root_realm_id=c.root_realm_id AND rev.provider_id=p.id "+
    "AND rev.center_id=c.id "+
    "AND c.diagnostic_license_valid_through IS NOT NULL "+
    "AND c.diagnostic_license_valid_through >= "+
    "(now() AT TIME ZONE c.time_zone)::date "+
    "AND rev.source_snapshot->>'diagnosticLicenseValidThrough' = "+
    "to_char(c.diagnostic_license_valid_through,'YYYY-MM-DD') "+
    "JOIN cg03_case review ON review.id=rev.approval_case_ref "+
    "AND review.realm_id=c.root_realm_id AND review.status='OWNER_COMPLETED' "+
    "AND review.case_kind='HEALTH_CENTER_VERIFICATION' "+
    "AND review.health_center_id=c.id "+
    "AND review.health_center_revision_id=rev.id "+
    "AND review.health_source_digest=rev.source_digest "+
    "JOIN cg03_case_decision decision ON decision.id=pub.original_final_decision_ref "+
    "AND decision.realm_id=review.realm_id AND decision.case_id=review.id "+
    "AND decision.action='APPROVE' "+
    "AND decision.fresh_password_verified_at IS NOT NULL "+
    "AND decision.actor_id<>review.proposer_id "+
    "JOIN cg19_stored_file proof ON proof.id=rev.proof_file_ref "+
    "AND proof.realm_id=c.root_realm_id AND proof.owner_kind='CG14_DRAFT' "+
    "AND proof.health_center_id=c.id AND proof.health_provider_id=p.id "+
    "AND proof.revoked_at IS NULL AND proof.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
    "AND intent.realm_id=proof.realm_id AND intent.status='VALIDATED' "+
    "AND intent.classification='HEALTH_CENTER_LICENSE' "+
    "WHERE m.root_realm_id=$1 AND m.publication_state='ACTIVE' "+
    "AND ((m.test_or_package_kind='TEST' AND EXISTS("+
    "SELECT 1 FROM diagnostic_test t JOIN test_category cat "+
    "ON cat.root_realm_id=t.root_realm_id AND cat.id=t.category_ref "+
    "WHERE t.root_realm_id=m.root_realm_id AND t.id=m.test_ref "+
    "AND t.status='ACTIVE' AND cat.status='ACTIVE' "+
    "AND t.active_from<=now() AND (t.active_to IS NULL OR t.active_to>now()))) OR "+
    "(m.test_or_package_kind='PACKAGE' AND EXISTS("+
    "SELECT 1 FROM diagnostic_package pkg WHERE pkg.root_realm_id=m.root_realm_id "+
    "AND pkg.id=m.package_ref AND pkg.status='ACTIVE' AND pkg.active_from<=now() "+
    "AND (pkg.active_to IS NULL OR pkg.active_to>now()) "+
    " AND EXISTS(SELECT 1 FROM diagnostic_package_line l WHERE l.root_realm_id=pkg.root_realm_id AND l.package_ref=pkg.id AND l.package_revision=pkg.revision) AND NOT EXISTS(SELECT 1 FROM diagnostic_package_line l LEFT JOIN diagnostic_test t ON t.root_realm_id=l.root_realm_id AND t.id=l.test_ref LEFT JOIN test_category c ON c.root_realm_id=t.root_realm_id AND c.id=t.category_ref WHERE l.root_realm_id=pkg.root_realm_id AND l.package_ref=pkg.id AND l.package_revision=pkg.revision AND (t.status IS DISTINCT FROM 'ACTIVE' OR t.active_from>now() OR (t.active_to IS NOT NULL AND t.active_to<=now()) OR c.status IS DISTINCT FROM 'ACTIVE')) "+
    ")))",
    [actor.realmId]);
   return {totalTests:Number(stats.total_tests),activeTests:Number(stats.active_tests),
    categories:Number(stats.categories),packages:Number(stats.packages),
    publishedOffers:Number(offers.rows[0]?.published_offers??0),
    averagePublishedPatientPriceMinor:offers.rows[0]?.average_minor??null};
  });
 }
}
