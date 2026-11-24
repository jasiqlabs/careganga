import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {CampaignLinkSourceFacade} from "../../cg-05-projects-field-operations/application/campaign-link-source.facade";
import {conflict,nextCursor,optionalRef,parseChange,parseLink,parseListQuery,parseProfile,parseRevoke,parseUnlink,ref} from "../domain/beneficiary-input";

type Row={
 id:string;root_realm_id:string;branch_scope_id:string|null;display_ref:string;
 private_name:string;contact_mobile:string|null;representative_name:string|null;
 representative_contact:string|null;state_ref:string;district_ref:string|null;
 beneficiary_type:string;gender:string;age_group:string;consent_kind:string;
 consent_purpose:string;consent_acknowledged_at:Date;consent_revoked_at:Date|null;
 verification_state:string;lifecycle_state:string;profile_revision:number;
 verification_case_ref:string|null;created_at:Date;updated_at:Date;
};
type Scope={all:boolean;branches:{value:string;label:string}[]};
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const columns="id,root_realm_id,branch_scope_id,display_ref,private_name,contact_mobile,representative_name,"+
 "representative_contact,state_ref,district_ref,beneficiary_type,gender,age_group,consent_kind,"+
 "consent_purpose,consent_acknowledged_at,consent_revoked_at,verification_state,lifecycle_state,"+
 "profile_revision,verification_case_ref,created_at,updated_at";
@Injectable()
export class BeneficiariesService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly projects:CampaignLinkSourceFacade){}
 private async run<T>(token:string,action:string,work:(tx:PoolClient,a:Actor)=>Promise<T>):Promise<T>{
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);
   const result=await work(tx,a);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{/* Preserve first error. */}
   const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";
   if(["23505","40001","40P01","55P03","23514","23503"].includes(code))
    throw conflict();
   throw e;
  }finally{tx.release();}
 }
 private async scope(tx:PoolClient,a:Actor):Promise<Scope>{
  return this.branches.projectBranchScope(tx,a);
 }
 private async row(tx:PoolClient,a:Actor,id:string,write=false):Promise<Row>{
  const source=(await tx.query<Row>("SELECT "+columns+" FROM beneficiary WHERE root_realm_id=$1 AND id=$2 "+
   (write?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref(id)])).rows[0];
  if(!source)throw new NotFoundException("Beneficiary unavailable");
  const allowed=await this.scope(tx,a);
  if(source.branch_scope_id===null?!allowed.all:
   !allowed.all&&!allowed.branches.some(b=>b.value===source.branch_scope_id))
   throw new NotFoundException("Beneficiary unavailable");
  if(write)await this.branches.projectBranch(tx,a,source.branch_scope_id);
  return source;
 }
 private view(r:Row){
  const revoked=r.consent_revoked_at!==null;
  return {ref:r.id,reference:r.display_ref,name:revoked?"Consent withdrawn":r.private_name,
   contactMobile:revoked?null:r.contact_mobile,
   representativeName:revoked?null:r.representative_name,
   representativeContact:revoked?null:r.representative_contact,
   branchRef:r.branch_scope_id,stateRef:r.state_ref,districtRef:r.district_ref,
   beneficiaryType:r.beneficiary_type,gender:r.gender,ageGroup:r.age_group,
   consentKind:r.consent_kind,consentPurpose:revoked?null:r.consent_purpose,
   consentAcknowledgedAt:r.consent_acknowledged_at,consentRevoked:revoked,
   verification:r.verification_state,lifecycle:r.lifecycle_state,
   revision:r.profile_revision,createdAt:r.created_at,updatedAt:r.updated_at};
 }
 private async area(tx:PoolClient,a:Actor,branch:string|null,state:string,district:string|null){
  await this.branches.projectGeography(tx,a,state,district);
  await this.branches.projectBranch(tx,a,branch);
  if(!branch)return;
  // A staff-assigned branch may not attach a person to an unrelated state/district.
  const result=(await tx.query<{level:string;id:string}>(
   "WITH RECURSIVE path AS (SELECT g.id,g.parent_area_id,g.level,1 AS depth "+
   "FROM branch b JOIN geography_area g ON g.id=b.geography_area_id AND g.root_realm_id=b.root_realm_id "+
   "WHERE b.root_realm_id=$1 AND b.id=$2 AND b.status='ACTIVE' "+
   "UNION ALL SELECT g.id,g.parent_area_id,g.level,p.depth+1 FROM path p "+
   "JOIN geography_area g ON g.id=p.parent_area_id AND g.root_realm_id=$1 AND g.status='ACTIVE' "+
   "WHERE p.depth<8) SELECT id,level FROM path", [a.realmId,branch])).rows;
  if(!result.some(x=>x.id===state)||
   result.some(x=>x.level==="DISTRICT")&&!!district&&!result.some(x=>x.id===district))
   throw new ForbiddenException("Choose a beneficiary area within the assigned branch");
 }
 private async original(tx:PoolClient,a:Actor,key:string,action:string,hash:string,target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["CG06:"+a.realmId+":"+a.accountId+":"+key]);
  const prev=(await tx.query<{beneficiary_id:string;result_revision:number;payload_digest:string;action:string}>(
   "SELECT beneficiary_id,result_revision,payload_digest,action FROM beneficiary_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [a.realmId,a.accountId,key])).rows[0];
  if(!prev)return null;
  if(prev.action!==action||prev.payload_digest!==hash||target&&target!==prev.beneficiary_id)
   throw conflict();
  await this.row(tx,a,prev.beneficiary_id);
  return {ref:prev.beneficiary_id,revision:prev.result_revision,replayed:true,status:"CONFIRMED"};
 }
 private async recorded(tx:PoolClient,a:Actor,key:string,action:string,hash:string,row:Row){
  await tx.query("INSERT INTO beneficiary_command(root_realm_id,actor_ref,request_key,action,payload_digest,beneficiary_id,result_revision) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7)",
   [a.realmId,a.accountId,key,action,hash,row.id,row.profile_revision]);
  return {ref:row.id,reference:row.display_ref,revision:row.profile_revision,replayed:false,status:"CONFIRMED"};
 }
 async options(token:string,stateInput:unknown){
  const state=optionalRef(stateInput);
  return this.run(token,"beneficiaries.view",async(tx,a)=>{
   const scope=await this.scope(tx,a);
   return {canManageFoundation:scope.all,branches:scope.branches,
    states:await this.branches.projectGeographyOptions(tx,a,null),
    districts:state?await this.branches.projectGeographyOptions(tx,a,state):[]};
  });
 }
 async projectOptions(token:string,branchInput:unknown,searchInput:unknown){
  const branch=optionalRef(branchInput);
  if(searchInput!==undefined&&typeof searchInput!=="string")
   throw new BadRequestException("Check project search");
  const q=(searchInput??"") as string;
  if(q.length>80)throw new BadRequestException("Narrow project search");
  return this.run(token,"beneficiaries.projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   await this.identity.assertCurrent(tx,a,"projects.view");
   const result=await this.projects.options(tx,a,branch,q);
   return result.projects;
  });
 }
 async create(token:string,raw:unknown){
  const v=parseProfile(raw,true),hash=digest(v);
  return this.run(token,"beneficiaries.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   const past=await this.original(tx,a,v.key,"CREATE",hash);if(past)return past;
   await this.area(tx,a,v.branch,v.state,v.district);
   const display=(await tx.query<{code:string}>(
    "SELECT 'BEN-'||lpad(nextval('cg06_beneficiary_display_seq')::text,7,'0') AS code")).rows[0].code;
   const r=(await tx.query<Row>("INSERT INTO beneficiary "+
    "(root_realm_id,branch_scope_id,display_ref,private_name,contact_mobile,representative_name,"+
    "representative_contact,state_ref,district_ref,beneficiary_type,gender,age_group,consent_kind,"+
    "consent_purpose,consent_acknowledged_at,created_by,updated_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,clock_timestamp(),$15,$15) RETURNING "+columns,
    [a.realmId,v.branch,display,v.name,v.contact,v.representative,v.representativeContact,v.state,v.district,
     v.beneficiaryType,v.gender,v.ageGroup,v.consentKind,v.purpose,a.accountId])).rows[0];
   return this.recorded(tx,a,v.key,"CREATE",hash,r);
  });
 }
 async edit(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseProfile(raw,false),hash=digest([target,v]);
  return this.run(token,"beneficiaries.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   const past=await this.original(tx,a,v.key,"EDIT",hash,target);if(past)return past;
   const before=await this.row(tx,a,target,true);
   if(before.profile_revision!==v.expected||before.consent_revoked_at||before.lifecycle_state!=="ACTIVE")
    throw conflict();
   await this.area(tx,a,before.branch_scope_id,v.state,v.district);
   const r=(await tx.query<Row>("UPDATE beneficiary SET private_name=$3,contact_mobile=$4,representative_name=$5,"+
    "representative_contact=$6,state_ref=$7,district_ref=$8,beneficiary_type=$9,gender=$10,age_group=$11,"+
    "consent_kind=$12,consent_purpose=$13,consent_acknowledged_at=clock_timestamp(),"+
    "verification_state='DRAFT',verification_case_ref=NULL,profile_revision=profile_revision+1,"+
    "updated_by=$14,updated_at=clock_timestamp() WHERE root_realm_id=$1 AND id=$2 AND profile_revision=$15 "+
    "RETURNING "+columns,[a.realmId,target,v.name,v.contact,v.representative,v.representativeContact,
    v.state,v.district,v.beneficiaryType,v.gender,v.ageGroup,v.consentKind,v.purpose,a.accountId,v.expected])).rows[0];
   if(!r)throw conflict();
   return this.recorded(tx,a,v.key,"EDIT",hash,r);
  });
 }
 async changeLifecycle(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseChange(raw),hash=digest([target,v]);
  return this.run(token,"beneficiaries.lifecycle.manage",async(tx,a)=>{
   const past=await this.original(tx,a,v.key,"LIFECYCLE",hash,target);if(past)return past;
   const before=await this.row(tx,a,target,true);
   if(before.profile_revision!==v.expected||before.lifecycle_state===v.lifecycle)throw conflict();
   const r=(await tx.query<Row>("UPDATE beneficiary SET lifecycle_state=$3,profile_revision=profile_revision+1,"+
    "updated_by=$4,updated_at=clock_timestamp() WHERE root_realm_id=$1 AND id=$2 "+
    "RETURNING "+columns,[a.realmId,target,v.lifecycle,a.accountId])).rows[0];
   return this.recorded(tx,a,v.key,"LIFECYCLE",hash,r);
  });
 }
 async revokeConsent(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseRevoke(raw),hash=digest([target,v]);
  return this.run(token,"beneficiaries.consent.revoke",async(tx,a)=>{
   const past=await this.original(tx,a,v.key,"REVOKE_CONSENT",hash,target);if(past)return past;
   const before=await this.row(tx,a,target,true);
   if(before.profile_revision!==v.expected||before.consent_revoked_at)throw conflict();
   const r=(await tx.query<Row>("UPDATE beneficiary SET consent_revoked_at=clock_timestamp(),"+
    "verification_state='DRAFT',verification_case_ref=NULL,profile_revision=profile_revision+1,"+
    "updated_by=$3,updated_at=clock_timestamp() WHERE root_realm_id=$1 AND id=$2 RETURNING "+columns,
    [a.realmId,target,a.accountId])).rows[0];
   return this.recorded(tx,a,v.key,"REVOKE_CONSENT",hash,r);
  });
 }
 async link(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseLink(raw),hash=digest([target,v]);
  return this.run(token,"beneficiaries.projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   const past=await this.original(tx,a,v.key,"LINK_PROJECT",hash,target);if(past)return past;
   const b=await this.row(tx,a,target,true);
   if(b.profile_revision!==v.expected||b.consent_revoked_at||b.lifecycle_state!=="ACTIVE")
    throw conflict();
   await this.projects.requireCurrent(tx,a,b.branch_scope_id,v.project,null);
   const already=await tx.query("SELECT id FROM beneficiary_project_link WHERE root_realm_id=$1 "+
    "AND beneficiary_id=$2 AND project_ref=$3 AND ended_at IS NULL",
    [a.realmId,b.id,v.project]);
   if(already.rowCount)throw new ConflictException("Project already linked");
   await tx.query("INSERT INTO beneficiary_project_link(root_realm_id,beneficiary_id,project_ref,"+
    "branch_scope_id,linked_by,source_revision) VALUES($1,$2,$3,$4,$5,$6)",
    [a.realmId,b.id,v.project,b.branch_scope_id,a.accountId,b.profile_revision+1]);
   const updated=(await tx.query<Row>("UPDATE beneficiary SET profile_revision=profile_revision+1,"+
    "updated_at=clock_timestamp(),updated_by=$3 WHERE root_realm_id=$1 AND id=$2 RETURNING "+columns,
    [a.realmId,b.id,a.accountId])).rows[0];
   return this.recorded(tx,a,v.key,"LINK_PROJECT",hash,updated);
  });
 }
 async unlink(token:string,id:string,raw:unknown){
  const target=ref(id),v=parseUnlink(raw),hash=digest([target,v]);
  return this.run(token,"beneficiaries.projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   await this.identity.assertCurrent(tx,a,"projects.view");
   const past=await this.original(tx,a,v.key,"UNLINK_PROJECT",hash,target);if(past)return past;
   const b=await this.row(tx,a,target,true);
   if(b.profile_revision!==v.expected||b.consent_revoked_at)throw conflict();
   const permitted=await tx.query(
    "SELECT l.id FROM beneficiary_project_link l JOIN project p ON p.id=l.project_ref AND p.root_realm_id=l.root_realm_id "+
    "WHERE l.root_realm_id=$1 AND l.beneficiary_id=$2 AND l.id=$3 AND l.ended_at IS NULL "+
    "AND p.branch_ref IS NOT DISTINCT FROM $4::uuid FOR SHARE OF l,p",
    [a.realmId,b.id,v.link,b.branch_scope_id]);
   if(!permitted.rowCount)throw new NotFoundException("Active project link unavailable");
   const link=await tx.query("UPDATE beneficiary_project_link SET ended_at=clock_timestamp(),ended_by=$4 "+
    "WHERE root_realm_id=$1 AND beneficiary_id=$2 AND id=$3 AND ended_at IS NULL RETURNING id",
    [a.realmId,b.id,v.link,a.accountId]);
   if(!link.rowCount)throw new NotFoundException("Active project link unavailable");
   const updated=(await tx.query<Row>("UPDATE beneficiary SET profile_revision=profile_revision+1,"+
    "updated_at=clock_timestamp(),updated_by=$3 WHERE root_realm_id=$1 AND id=$2 RETURNING "+columns,
    [a.realmId,b.id,a.accountId])).rows[0];
   return this.recorded(tx,a,v.key,"UNLINK_PROJECT",hash,updated);
  });
 }
 async detail(token:string,id:string){
  return this.run(token,"beneficiaries.view",async(tx,a)=>{
   const r=await this.row(tx,a,id);
   let links:{ref:string;projectRef:string;projectName:string}[]=[];
   try{
    await this.identity.assertCurrent(tx,a,"projects.view");
    links=(await tx.query<{ref:string;projectRef:string;projectName:string}>(
     "SELECT l.id AS ref,l.project_ref AS \"projectRef\",p.title AS \"projectName\" "+
     "FROM beneficiary_project_link l JOIN project p ON p.root_realm_id=l.root_realm_id AND p.id=l.project_ref "+
     "WHERE l.root_realm_id=$1 AND l.beneficiary_id=$2 AND l.ended_at IS NULL "+
     "AND p.branch_ref IS NOT DISTINCT FROM $3::uuid ORDER BY p.title,l.id LIMIT 100",
     [a.realmId,r.id,r.branch_scope_id])).rows;
   }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   return {...this.view(r),projectLinks:links};
  });
 }
 async list(token:string,query:Record<string,unknown>){
  const q=parseListQuery(query);
  return this.run(token,"beneficiaries.view",async(tx,a)=>{
   const scope=await this.scope(tx,a);
   if(q.branch&&!scope.all&&!scope.branches.some(x=>x.value===q.branch))
    throw new ForbiddenException("Branch unavailable");
   const allowed=scope.branches.map(x=>x.value);
   const rows=(await tx.query<Row>(
    "SELECT "+columns+" FROM beneficiary b WHERE b.root_realm_id=$1 "+
    "AND ($2::boolean OR b.branch_scope_id=ANY($3::uuid[])) "+
    "AND ($4::uuid IS NULL OR b.branch_scope_id=$4) "+
    "AND ($5::uuid IS NULL OR b.state_ref=$5) AND ($6::uuid IS NULL OR b.district_ref=$6) "+
    "AND ($7='' OR ($7='PENDING' AND b.verification_state IN ('DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED')) OR b.verification_state=$7) "+
     "AND ($8='' OR b.lifecycle_state=$8) "+
    "AND ($9='' OR b.beneficiary_type=$9) "+
    "AND ($10='' OR strpos(lower(b.display_ref),lower($10))>0 OR "+
    "(b.consent_revoked_at IS NULL AND (strpos(lower(b.private_name),lower($10))>0 OR b.contact_mobile=$10))) "+
    "AND ($11::uuid IS NULL OR EXISTS (SELECT 1 FROM beneficiary_project_link l "+
    "WHERE l.root_realm_id=b.root_realm_id AND l.beneficiary_id=b.id AND l.project_ref=$11 AND l.ended_at IS NULL)) "+
    "AND ($12::timestamptz IS NULL OR (b.created_at,b.id)<($12::timestamptz,$13::uuid)) "+
    "ORDER BY b.created_at DESC,b.id DESC LIMIT 31",
    [a.realmId,scope.all,allowed,q.branch,q.state,q.district,q.status,q.lifecycle,q.type,q.q,
     q.project,q.before?.date??null,q.before?.id??null])).rows;
   const items=rows.slice(0,30);
   return {items:items.map(r=>this.view(r)),hasMore:rows.length>30,
    nextCursor:rows.length>30&&items.length?nextCursor(items[items.length-1].created_at,items[items.length-1].id):null};
  });
 }
}
