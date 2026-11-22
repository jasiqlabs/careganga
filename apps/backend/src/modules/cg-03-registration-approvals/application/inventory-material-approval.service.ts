import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {InventoryCatalogService} from "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {InventoryMaterialSource,materialHash,approvedQuantity,type MaterialRow} from "../../cg-12-inventory-suppliers/application/inventory-material-source";
import {inventoryRef,inventoryInput,inventoryText,receiptInvalid,sourceChanged} from "../../cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
type Case={id:string;case_number:string;process_id:string;current_step:number;proposer_id:string;material_request_id:string;material_revision_id:string;material_revision_no:number;material_digest:string;revision:number;status:string;request_key:string;request_digest:string};
@Injectable()
export class InventoryMaterialApprovalService{
 constructor(private readonly catalog:InventoryCatalogService,private readonly source:InventoryMaterialSource,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:VerifiedFoundationActor,ref:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,ref,a.accountId,action,randomUUID()]);
 }
 async process(token:string){
  return this.catalog.run(token,"inventory.requests.review",async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const q=await tx.query("SELECT 1 FROM cg03_material_process_current c JOIN cg03_process p ON p.realm_id=c.realm_id AND p.id=c.process_id WHERE c.realm_id=$1 AND p.process_kind='MATERIAL_REQUEST_REVIEW'",[a.realmId]);return {configured:!!q.rowCount};
  });
 }
 async configure(token:string,raw:unknown){
  const x=inventoryInput(raw,["currentPassword"]);if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw receiptInvalid();const password=x.currentPassword;
  const actor=await this.sessions.requireAction(token,"approvals.process.manage");await this.sessions.limitFoundationRootProof(actor);
  return this.catalog.run(token,"approvals.process.manage",async(tx,a)=>{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   await this.identity.assertCurrent(tx,a,"inventory.requests.review");await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   if((await tx.query("SELECT 1 FROM cg03_material_process_current WHERE realm_id=$1",[a.realmId])).rowCount)return {configured:true,replayed:true};
   const p=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'MATERIAL_REQUEST_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query("INSERT INTO cg03_material_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return {configured:true,replayed:false};
  });
 }
 async submit(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,rev:string,n:number,digest:string,key:string){
  await this.identity.assertCurrent(tx,a,"inventory.requests.manage");await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
  if(r.requester_id!==a.accountId)throw new ForbiddenException("Requester only");
  await this.source.exact(tx,a,r,rev,n,digest);
  const q=await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,material_request_id,material_revision_id,material_revision_no,material_digest) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Material request',NULL,NULL,$4,$5,$6,$7,'MATERIAL_REQUEST_REVIEW',$8,$9,$4,$5 FROM cg03_material_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id AND p.process_kind='MATERIAL_REQUEST_REVIEW' WHERE cur.realm_id=$1 RETURNING *",[a.realmId,a.accountId,r.request_no,n,digest,materialHash([r.id,rev,digest]),key,r.id,rev]);
  if(!q.rows[0])throw new ConflictException({code:"CG12_REVIEW_UNCONFIGURED"});
  await this.event(tx,a,q.rows[0].id,"SUBMITTED");return q.rows[0];
 }
 async cancel(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow){
  if(r.status!=="SUBMITTED")return;
  const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND material_request_id=$2 AND material_revision_no=$3 AND case_kind='MATERIAL_REQUEST_REVIEW' FOR UPDATE",[a.realmId,r.id,r.current_revision])).rows[0];
  if(!c||c.proposer_id!==a.accountId||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw sourceChanged();
  await this.source.exact(tx,a,r,c.material_revision_id,c.material_revision_no,c.material_digest);
  await tx.query("UPDATE cg03_case SET status='CANCELLED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,c.id]);await this.event(tx,a,c.id,"CANCELLED");
 }
 async decide(token:string,refInput:string,raw:unknown){
  const ref=inventoryRef(refInput),x=inventoryInput(raw,["requestKey","expectedRevision","action","currentPassword","remarks","lines"]);
  const key=inventoryRef(x.requestKey),action=x.action,expected=x.expectedRevision,remarks=inventoryText(x.remarks??"",0,500),password=x.currentPassword;
  if(typeof action!=="string"||!["APPROVE","RETURN","REJECT"].includes(action)||typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<1||typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024||!Array.isArray(x.lines)||x.lines.length>50||(action!=="APPROVE"&&x.lines.length)||(action!=="APPROVE"&&!remarks))throw receiptInvalid();
  const decisions=x.lines.map(v=>{const l=inventoryInput(v,["lineRef","quantity"]);return {lineRef:inventoryRef(l.lineRef),quantity:approvedQuantity(l.quantity,3)};}).sort((a,b)=>a.lineRef.localeCompare(b.lineRef));
  const h=materialHash([ref,expected,action,remarks,decisions]);
  const actor=await this.sessions.requireAction(token,"inventory.requests.review");await this.sessions.limitFoundationRootProof(actor);
  return this.catalog.run(token,"inventory.requests.review",async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const lookup=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='MATERIAL_REQUEST_REVIEW'",[a.realmId,ref])).rows[0];
   if(!lookup)throw new NotFoundException("Material review unavailable");
   const r=await this.source.row(tx,a,lookup.material_request_id,false,true,false);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='MATERIAL_REQUEST_REVIEW' FOR UPDATE",[a.realmId,ref])).rows[0];
   if(!c||c.proposer_id===a.accountId||r.requester_id===a.accountId)throw new ForbiddenException("Another authorized reviewer must decide");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,ref,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==h)throw sourceChanged();return this.source.view(tx,a,r);}
   if(r.status!=="SUBMITTED"||c.revision!==expected||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw sourceChanged();
   await this.source.exact(tx,a,r,c.material_revision_id,c.material_revision_no,c.material_digest);
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step])).rowCount)throw sourceChanged();
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   let state=action==="RETURN"?"RETURNED":"REJECTED";
   if(action==="APPROVE"){
    const lines=await this.source.lines(tx,a.realmId,r.id);
    await this.catalog.store(tx,a,r.location_id);await this.source.liveItems(tx,a.realmId,lines);
    if(decisions.length!==lines.length||new Set(decisions.map(d=>d.lineRef)).size!==lines.length||!decisions.some(d=>d.quantity!=="0"))throw receiptInvalid();
    for(const l of lines){
     const d=decisions.find(d=>d.lineRef===l.id);if(!d)throw receiptInvalid();const qty=approvedQuantity(d.quantity,l.qty_scale);
     if(!(await tx.query("UPDATE material_request_line SET approved_qty=$3::numeric WHERE root_realm_id=$1 AND id=$2 AND requested_qty>=$3::numeric RETURNING id",[a.realmId,l.id,qty])).rowCount)throw receiptInvalid();
    }
    state=(await this.source.reserve(tx,a,r,key,true))?"HELD":"APPROVED_UNRESERVED";
   }
   const next=action==="APPROVE"?"PENDING_OWNER":state;
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,ref,next]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,ref,a.accountId,action,expected,expected+1,key,h,remarks]);
   await this.event(tx,a,ref,action==="APPROVE"?"FINAL_APPROVED":next);
   if(action==="APPROVE"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,ref]);await this.event(tx,a,ref,"OWNER_COMPLETED");}
   await tx.query("UPDATE material_request SET status=$3,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,r.id,state]);
   return this.source.view(tx,a,await this.source.row(tx,a,r.id,false,false,false));
  });
 }
}
