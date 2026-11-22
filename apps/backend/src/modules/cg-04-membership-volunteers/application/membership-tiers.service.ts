import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {categories,conflict,invalid,object,parseTier,pick,plain,statuses,uuid} from "../domain/tier-input";
type Draft=ReturnType<typeof parseTier>;
const action="membership.tier.manage";
const projection='t.id AS ref,t.version,t.plan_code AS "planCode",v.name,v.category,v.status,v.fee_minor::text AS "feeMinor",v.currency,v.duration_unit AS "durationUnit",v.duration_count AS "durationCount",v.description,v.benefits,v.icon,v.color,v.display_order AS "displayOrder",v.effective_from AS "effectiveFrom"';
const safeProjection='t.plan_code AS "planCode",v.name,v.category,v.fee_minor::text AS "feeMinor",v.currency,v.duration_unit AS "durationUnit",v.duration_count AS "durationCount",v.description,v.benefits,v.icon,v.color,v.display_order AS "displayOrder"';
const current=" FROM membership_tier t JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.tier_id=t.id AND v.version_no=t.version";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function cursor(raw:unknown):[number,string]{if(raw===undefined||raw==="")return [-1,""];if(typeof raw!=="string"||!/^\d{1,4}:MEM-[0-9A-F]{32}$/.test(raw))return invalid("filter","Refresh the membership plan list.");const [n,code]=raw.split(":");return [Number(n),code];}
function filters(raw:unknown,publicOnly=false){const x=object(raw,publicOnly?["q","category","cursor"]:["q","category","status","cursor"]);return {q:plain(x.q??"",0,100,"search").toLowerCase(),category:pick(x.category??"ALL",["ALL",...categories],"category"),status:publicOnly?"ACTIVE":pick(x.status??"ALL",["ALL",...statuses],"status"),cursor:cursor(x.cursor)};}
function page(rows:any[],limit:number){const items=rows.slice(0,limit),last=items.at(-1);return {items,nextCursor:rows.length>limit&&last?String(last.displayOrder)+":"+String(last.planCode):null};}
function csv(v:unknown){let s=String(v??"").replace(/[\u0000-\u001f\u007f]/g," ");if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
@Injectable()
export class MembershipTiersService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade){}
 private async run<T>(token:string,work:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>,read=false){
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");await this.identity.assertCurrent(tx,a,action);const result=await work(tx,a);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e){if(e.code==="23505")throw new ConflictException({code:"CG04_TIER_DUPLICATE",message:"A membership plan with that name or request already exists. Refresh and choose a unique name."});if(["40001","40P01","55P03","23503","23514"].includes(String(e.code)))return conflict();}throw e;}finally{tx.release();}
 }
 private async result(tx:PoolClient,root:string,target:string,revision:number){
  const rows=(await tx.query("SELECT "+projection+" FROM membership_tier t JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.tier_id=t.id WHERE t.root_realm_id=$1 AND t.id=$2 AND v.version_no=$3",[root,target,revision])).rows;
  if(rows.length!==1)return conflict();return {...rows[0],version:revision};
 }
 async save(token:string,raw:unknown,target?:string){
  const id=target===undefined?null:uuid(target),d=parseTier(raw,id!==null),digest=hash([id,d]),kind=id?"EDIT":"CREATE";
  return this.run(token,async(tx,a)=>{
   // One root-wide catalogue. No branch selection or private member/finance scope.
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+d.key]);
   const prior=(await tx.query<{actor_ref:string;tier_id:string;result_version:number;payload_digest:string;action:string}>("SELECT * FROM membership_tier_command WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,d.key])).rows[0];
   if(prior){if(prior.actor_ref!==a.accountId||prior.payload_digest!==digest||prior.action!==kind||id&&prior.tier_id!==id)return conflict();return {record:await this.result(tx,a.realmId,prior.tier_id,prior.result_version),replayed:true};}
   let tier:string,revision:number;
   if(id){
    const old=(await tx.query<{id:string;version:number}>("SELECT id,version FROM membership_tier WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,id])).rows[0];if(!old)throw new NotFoundException("Membership plan not available.");
    if(old.version!==d.expected)return conflict();tier=old.id;revision=old.version+1;
    await tx.query("UPDATE membership_tier SET normalized_name=lower(regexp_replace(btrim($3),'[[:space:]]+',' ','g')),status=$4,version=$5,updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,tier,d.name,d.status,revision]);
   }else{
    const row=(await tx.query<{id:string}>("INSERT INTO membership_tier(root_realm_id,normalized_name,status,version,created_by) VALUES($1,lower(regexp_replace(btrim($2),'[[:space:]]+',' ','g')),$3,1,$4) RETURNING id",[a.realmId,d.name,d.status,a.accountId])).rows[0];tier=row.id;revision=1;
   }
   await this.insertVersion(tx,a,tier,revision,d);
   await tx.query("INSERT INTO membership_tier_command(root_realm_id,request_key,actor_ref,tier_id,result_version,payload_digest,action) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,d.key,a.accountId,tier,revision,digest,kind]);
   return {record:await this.result(tx,a.realmId,tier,revision),replayed:false};
  });
 }
 private async insertVersion(tx:PoolClient,a:VerifiedFoundationActor,tier:string,revision:number,d:Draft){
  await tx.query("INSERT INTO membership_tier_version(root_realm_id,tier_id,version_no,status,name,category,fee_minor,currency,duration_unit,duration_count,description,benefits,icon,color,display_order,actor_ref,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,CASE WHEN $4='ACTIVE' THEN now() ELSE NULL END)",[a.realmId,tier,revision,d.status,d.name,d.category,d.feeMinor,d.currency,d.durationUnit,d.durationCount,d.description,JSON.stringify(d.benefits),d.icon,d.color,d.displayOrder,a.accountId]);
 }
 async list(token:string,raw:unknown,exporting=false){
  const f=filters(raw),limit=exporting?500:50;
  return this.run(token,async(tx,a)=>{
   const rows=(await tx.query("SELECT "+projection+current+" WHERE t.root_realm_id=$1 AND ($2='' OR strpos(lower(v.name),$2)>0 OR strpos(lower(v.description),$2)>0 OR strpos((v.fee_minor::numeric/100)::numeric(15,2)::text,$2)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v.benefits) b WHERE strpos(lower(b->>'title'),$2)>0 OR strpos(lower(b->>'description'),$2)>0)) AND ($3='ALL' OR v.category=$3) AND ($4='ALL' OR t.status=$4) AND (v.display_order,t.plan_code)>($5::int,$6::text) ORDER BY v.display_order,t.plan_code LIMIT $7",[a.realmId,f.q,f.category,f.status,...(exporting?[-1,""]:f.cursor),limit+1])).rows;
   if(exporting){if(rows.length>limit)return invalid("filter","More than 500 plans match. Narrow the filters before exporting.");await tx.query("INSERT INTO membership_tier_export_audit(root_realm_id,actor_ref,row_count,filter_digest) VALUES($1,$2,$3,$4)",[a.realmId,a.accountId,rows.length,hash({q:f.q,category:f.category,status:f.status})]);const headings=["Name","Category","Status","Fee (INR)","Validity unit","Validity count","Revision"];return {csv:[headings.map(csv).join(","),...rows.map(r=>[r.name,r.category,r.status,(BigInt(r.feeMinor)/100n).toString()+"."+String(BigInt(r.feeMinor)%100n).padStart(2,"0"),r.durationUnit,r.durationCount,r.version].map(csv).join(","))].join("\r\n"),rows:rows.length};}
   const counts=(await tx.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='ACTIVE')::int AS active,count(*) FILTER(WHERE status='DRAFT')::int AS draft,count(*) FILTER(WHERE status='INACTIVE')::int AS inactive FROM membership_tier WHERE root_realm_id=$1",[a.realmId])).rows[0];
   return {...page(rows,limit),counts};
  },true);
 }
 async publicList(raw:unknown){
  const f=filters(raw,true);
  const rows=(await this.db.query("SELECT "+safeProjection+current+" JOIN access_realm root ON root.id=t.root_realm_id AND root.realm_key='FOUNDATION_ROOT' WHERE t.status='ACTIVE' AND v.status='ACTIVE' AND v.published_at<=now() AND ($1='' OR strpos(lower(v.name),$1)>0 OR strpos(lower(v.description),$1)>0 OR strpos((v.fee_minor::numeric/100)::numeric(15,2)::text,$1)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v.benefits) b WHERE strpos(lower(b->>'title'),$1)>0 OR strpos(lower(b->>'description'),$1)>0)) AND ($2='ALL' OR v.category=$2) AND (v.display_order,t.plan_code)>($3::int,$4::text) ORDER BY v.display_order,t.plan_code LIMIT 51",[f.q,f.category,...f.cursor])).rows;
  return page(rows,50);
 }
}
