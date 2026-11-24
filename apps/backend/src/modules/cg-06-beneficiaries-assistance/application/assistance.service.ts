import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {CampaignLinkSourceFacade} from "../../cg-05-projects-field-operations/application/campaign-link-source.facade";
import {InventoryCatalogService} from "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {inventoryQuantity} from "../../cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
import {BeneficiariesService} from "./beneficiaries.service";
import {conflict,ref} from "../domain/beneficiary-input";
import {parseAssistance} from "../domain/assistance-input";
export type Aid={id:string;root_realm_id:string;reference:string;branch_ref:string|null;beneficiary_id:string;beneficiary_revision:number;category:string;kind:"MATERIAL"|"FINANCIAL";item_ref:string|null;location_ref:string|null;unit_code:string|null;qty_scale:number|null;requested_qty:string|null;requested_minor:string|null;requested_on:string;responsible_ref:string;project_ref:string|null;activity_ref:string|null;visit_ref:string|null;campaign_ref:string|null;created_by:string;source_digest:string;state:string;revision:number;approval_case_ref:string|null};
export const aidDigest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class AssistanceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,private readonly beneficiaries:BeneficiariesService,private readonly projects:CampaignLinkSourceFacade,private readonly inventory:InventoryCatalogService){}
 async run<T>(token:string,action:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,snapshot=false):Promise<T>{
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query(snapshot?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");await this.identity.assertCurrent(tx,a,action);await this.identity.assertCurrent(tx,a,"beneficiaries.view");const result=await fn(tx,a);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";if(["23505","23503","23514","40001","40P01","55P03"].includes(code))throw conflict();throw e;}finally{tx.release();}
 }
 async guard(tx:PoolClient,a:Actor,id:string,write=false){
  await this.identity.assertCurrent(tx,a,"beneficiaries.view");
  await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.view");
  // Lock beneficiary before the aid row, using the same order as request creation.
  const initial=(await tx.query<Aid>("SELECT * FROM assistance_case WHERE root_realm_id=$1 AND id=$2",[a.realmId,ref(id)])).rows[0];
  if(!initial)throw new NotFoundException("Assistance unavailable");
  const b=await this.beneficiaries.guardVerificationSource(tx,a,initial.beneficiary_id,write);
  await this.branches.projectBranch(tx,a,initial.branch_ref);
  if(b.consentRevoked||b.branchRef!==initial.branch_ref)throw new NotFoundException("Assistance unavailable");
  if(write&&(b.lifecycle!=="ACTIVE"||b.verification!=="VERIFIED"))throw conflict();
  const current=(await tx.query<Aid>("SELECT * FROM assistance_case WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,initial.id])).rows[0];
  if(!current)throw conflict();
  return current;
 }
 async context(tx:PoolClient,a:Actor,branch:string|null,project:string|null,activity:string|null,visit:string|null,campaign:string|null){
  await this.projects.requireCurrent(tx,a,branch,project,null);
  if(activity){await this.identity.assertCurrent(tx,a,"projects.activities.view");if(!(await tx.query("SELECT 1 FROM project_activity WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 AND branch_ref IS NOT DISTINCT FROM $4::uuid AND status IN('SCHEDULED','ONGOING','COMPLETED') FOR SHARE",[a.realmId,activity,project,branch])).rowCount)throw conflict();}
  if(visit){await this.identity.assertCurrent(tx,a,"projects.visits.view");if(!(await tx.query("SELECT 1 FROM field_visit WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 AND branch_ref IS NOT DISTINCT FROM $4::uuid AND status='COMPLETED' FOR SHARE",[a.realmId,visit,project,branch])).rowCount)throw conflict();}
  if(campaign){await this.identity.assertCurrent(tx,a,"campaigns.view");if(!(await tx.query("SELECT 1 FROM campaign WHERE root_realm_id=$1 AND id=$2 AND branch_ref IS NOT DISTINCT FROM $3::uuid AND source_status IN('APPROVED','PUBLISHED','PAUSED','CLOSED') AND (project_source_ref IS NULL OR project_source_ref=$4) FOR SHARE",[a.realmId,campaign,branch,project])).rowCount)throw conflict();}
 }
 async event(tx:PoolClient,a:Actor,id:string,key:string,action:string,hash:string,version:number){
  await tx.query("INSERT INTO assistance_event(root_realm_id,assistance_id,actor_ref,request_key,action,request_digest,source_revision) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,id,a.accountId,key,action,hash,version]);
 }
 async create(token:string,raw:unknown){
  const v=parseAssistance(raw);
  return this.run(token,"beneficiaries.assistance.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.view");
   const hash=aidDigest(v);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG06-AID:"+a.realmId+":"+a.accountId+":"+v.key]);
   const previous=(await tx.query<Aid>("SELECT * FROM assistance_case WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
   if(previous){if(previous.source_digest!==hash)throw conflict();const current=await this.guard(tx,a,previous.id);return {...this.view(current),replayed:true};}
   const b=await this.beneficiaries.guardVerificationSource(tx,a,v.beneficiary,true);
   if(b.consentRevoked||b.lifecycle!=="ACTIVE"||b.verification!=="VERIFIED"||b.revision!==v.expected)throw conflict();
   const scope=await this.branches.projectBranch(tx,a,b.branchRef),responsible=v.responsible??a.accountId;
   if(b.branchRef&&responsible!==a.accountId&&responsible!==scope.managerRef)throw new ForbiddenException("Choose a current responsible officer in this branch");
   await this.identity.eligibleOfficeholder(tx,a,responsible);
   await this.context(tx,a,b.branchRef,v.project,v.activity,v.visit,v.campaign);
   let unit:string|null=null,scale:number|null=null,quantity=v.quantity;
   if(v.kind==="MATERIAL"){
    await this.identity.assertCurrent(tx,a,"inventory.catalog.view");
    const store=await this.inventory.store(tx,a,v.location!);
    if(store.branch_ref!==b.branchRef)throw new ForbiddenException("Choose a warehouse in the beneficiary branch");
    const item=(await tx.query<{unit_code:string;qty_scale:number}>("SELECT unit_code,qty_scale FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,v.item])).rows[0];
    if(!item)throw conflict();unit=item.unit_code;scale=item.qty_scale;quantity=inventoryQuantity(quantity,scale);
   }
   const row=(await tx.query<Aid>(`INSERT INTO assistance_case(root_realm_id,branch_ref,beneficiary_id,beneficiary_revision,category,kind,item_ref,location_ref,unit_code,qty_scale,requested_qty,requested_minor,requested_on,responsible_ref,project_ref,activity_ref,visit_ref,campaign_ref,created_by,request_key,source_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,[a.realmId,b.branchRef,v.beneficiary,v.expected,v.category,v.kind,v.item,v.location,unit,scale,quantity,v.minor,v.date,responsible,v.project,v.activity,v.visit,v.campaign,a.accountId,v.key,hash])).rows[0];
   await this.event(tx,a,row.id,v.key,"REQUESTED",hash,1);
   return {...this.view(row),replayed:false};
  });
 }
 view(r:Aid){return {ref:r.id,reference:r.reference,category:r.category,kind:r.kind,quantity:r.requested_qty,unit:r.unit_code,amountMinor:r.requested_minor,requestedOn:r.requested_on,state:r.state,revision:r.revision,approvalCaseRef:r.approval_case_ref};}
 async list(token:string,beneficiary:string){
  return this.run(token,"beneficiaries.assistance.view",async(tx,a)=>{
   const b=await this.beneficiaries.guardVerificationSource(tx,a,ref(beneficiary),false);
   await this.branches.projectBranch(tx,a,b.branchRef);
   if(b.consentRevoked)throw new NotFoundException("Assistance unavailable");
   const rows=(await tx.query<Aid>("SELECT * FROM assistance_case WHERE root_realm_id=$1 AND beneficiary_id=$2 AND branch_ref IS NOT DISTINCT FROM $3::uuid ORDER BY created_at DESC,id DESC LIMIT 51",[a.realmId,beneficiary,b.branchRef])).rows;
   return {items:rows.slice(0,50).map(r=>this.view(r)),hasMore:rows.length>50};
  });
 }
 async history(token:string,id:string){return this.run(token,"beneficiaries.assistance.view",async(tx,a)=>{const row=await this.guard(tx,a,id);return {case:this.view(row),events:(await tx.query("SELECT action,source_revision AS revision,at FROM assistance_event WHERE root_realm_id=$1 AND assistance_id=$2 ORDER BY source_revision",[a.realmId,row.id])).rows};});}
 async options(token:string,id:string){
  return this.run(token,"beneficiaries.assistance.manage",async(tx,a)=>{
   const b=await this.beneficiaries.guardVerificationSource(tx,a,ref(id),false);if(b.consentRevoked||b.lifecycle!=="ACTIVE"||b.verification!=="VERIFIED")throw conflict();
   const branch=await this.branches.projectBranch(tx,a,b.branchRef);
   let stores:{ref:string;name:string;branchRef:string|null}[]=[],items:{value:string;label:string;unit:string;scale:number}[]=[];
   try{await this.identity.assertCurrent(tx,a,"inventory.catalog.view");stores=(await this.inventory.permittedRewardStores(tx,a)).filter(x=>x.branchRef===b.branchRef);
    items=(await tx.query<{value:string;label:string;unit:string;scale:number}>("SELECT id AS value,sku_norm||' · '||name AS label,unit_code AS unit,qty_scale AS scale FROM inventory_item WHERE root_realm_id=$1 AND status='ACTIVE' ORDER BY name,id LIMIT 200",[a.realmId])).rows;
   }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   const projectOptions=await this.projects.options(tx,a,b.branchRef,"");
   const officers=await this.identity.accountLabels(tx,a,[a.accountId,...(branch.managerRef?[branch.managerRef]:[])]);
   type Choice={value:string;label:string;projectRef:string|null};
   let activities:Choice[]=[],visits:Choice[]=[],campaigns:Choice[]=[];
   const optional=async(action:string,sql:string)=>{try{await this.identity.assertCurrent(tx,a,action);return (await tx.query<Choice>(sql,[a.realmId,b.branchRef])).rows;}catch(e){if(!(e instanceof ForbiddenException))throw e;return [];}};
   activities=await optional("projects.activities.view","SELECT id AS value,activity_code||' · '||title AS label,project_id AS \"projectRef\" FROM project_activity WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid AND status IN('SCHEDULED','ONGOING','COMPLETED') AND project_id IS NOT NULL ORDER BY scheduled_start DESC,id LIMIT 80");
   visits=await optional("projects.visits.view","SELECT id AS value,visit_code AS label,project_id AS \"projectRef\" FROM field_visit WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid AND status='COMPLETED' ORDER BY completed_at DESC,id LIMIT 80");
   campaigns=await optional("campaigns.view","SELECT id AS value,code_norm||' · '||title AS label,project_source_ref AS \"projectRef\" FROM campaign WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid AND source_status IN('APPROVED','PUBLISHED','PAUSED','CLOSED') ORDER BY title,id LIMIT 80");
   return {stores:stores.map(x=>({value:x.ref,label:x.name})),items,projects:projectOptions.projects,activities,visits,campaigns,responsible:Object.entries(officers).map(([value,label])=>({value,label})),selfRef:a.accountId};
  });
 }
}
