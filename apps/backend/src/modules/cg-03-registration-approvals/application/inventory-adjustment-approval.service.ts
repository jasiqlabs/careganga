import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {InventoryCatalogService} from "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {InventoryOperationSource,type OperationRow} from "../../cg-12-inventory-suppliers/application/inventory-operation-source";
import {materialHash} from "../../cg-12-inventory-suppliers/application/inventory-material-source";
import {inventoryInput,inventoryRef,inventoryText,receiptInvalid,sourceChanged} from "../../cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
type Case={id:string;case_number:string;process_id:string;current_step:number;proposer_id:string;stock_adjustment_id:string;stock_adjustment_digest:string;stock_adjustment_version:number;revision:number;status:string};
@Injectable()
export class InventoryAdjustmentApprovalService{
 constructor(private readonly catalog:InventoryCatalogService,private readonly source:InventoryOperationSource,private readonly sessions:SessionService,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:VerifiedFoundationActor,ref:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,ref,a.accountId,action,randomUUID()]);
 }
 async configure(token:string,raw:unknown){
  const x=inventoryInput(raw,["currentPassword"]);if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw receiptInvalid();const password=x.currentPassword;
  const actor=await this.sessions.requireAction(token,"approvals.process.manage");await this.sessions.limitFoundationRootProof(actor);
  return this.catalog.run(token,"approvals.process.manage",async(tx,a)=>{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   if((await tx.query("SELECT 1 FROM cg03_stock_adjustment_process_current WHERE realm_id=$1",[a.realmId])).rowCount)return {configured:true,replayed:true};
   const p=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'STOCK_ADJUSTMENT_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query("INSERT INTO cg03_stock_adjustment_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return {configured:true,replayed:false};
  });
 }
 async submit(tx:PoolClient,a:VerifiedFoundationActor,r:OperationRow,proof:string|null,version:number|null){
  if(r.kind!=="ADJUSTMENT"||r.status!=="DRAFT"||a.accountId!==r.actor_ref)throw sourceChanged();
  await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
  const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,stock_adjustment_id,stock_adjustment_version,stock_adjustment_digest) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,'Stock correction','Stock adjustment',NULL,NULL,1,$3,$4,$5,'STOCK_ADJUSTMENT_REVIEW',$6,1,$3 FROM cg03_stock_adjustment_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id AND p.process_kind='STOCK_ADJUSTMENT_REVIEW' WHERE cur.realm_id=$1 RETURNING *",[a.realmId,a.accountId,r.digest,materialHash([r.id,r.digest,proof,version]),r.request_key,r.id])).rows[0];
  if(!c)throw new ConflictException({code:"CG12_REVIEW_UNCONFIGURED"});
  await tx.query("INSERT INTO stock_adjustment_submission(root_realm_id,operation_id,case_id,proof_ref,proof_revision) VALUES($1,$2,$3,$4,$5)",[a.realmId,r.id,c.id,proof,version]);
  await tx.query("UPDATE stock_operation_draft SET status='SUBMITTED' WHERE root_realm_id=$1 AND id=$2",[a.realmId,r.id]);await this.event(tx,a,c.id,"SUBMITTED");
  return {ref:r.id,caseReference:c.case_number,status:"SUBMITTED"};
 }
 async decide(token:string,refInput:string,raw:unknown){
  const ref=inventoryRef(refInput),x=inventoryInput(raw,["requestKey","expectedRevision","action","currentPassword","remarks"]),key=inventoryRef(x.requestKey),expected=x.expectedRevision,action=x.action,remarks=inventoryText(x.remarks??"",0,500),password=x.currentPassword;
  if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<1||typeof action!=="string"||!["APPROVE","RETURN","REJECT"].includes(action)||typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024||(action!=="APPROVE"&&!remarks))throw receiptInvalid();
  const h=materialHash([ref,expected,action,remarks]),actor=await this.sessions.requireAction(token,"inventory.stock.adjust.review");await this.sessions.limitFoundationRootProof(actor);
  return this.catalog.run(token,"inventory.stock.adjust.review",async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const first=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='STOCK_ADJUSTMENT_REVIEW'",[a.realmId,ref])).rows[0];if(!first)throw new NotFoundException("Stock adjustment unavailable");
   const {row:r}=await this.source.guard(tx,a,first.stock_adjustment_id,"CONFIRM",true);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='STOCK_ADJUSTMENT_REVIEW' FOR UPDATE",[a.realmId,ref])).rows[0];
   if(!c||c.proposer_id===a.accountId||c.stock_adjustment_digest!==r.digest||c.stock_adjustment_version!==1)throw sourceChanged();
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,ref,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==h)throw sourceChanged();return {ref:r.id,caseReference:c.case_number,status:c.status,replayed:true};}
   if(r.status!=="SUBMITTED"||c.revision!==expected||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw sourceChanged();
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step])).rowCount)throw sourceChanged();
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const state=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,ref,state]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,ref,a.accountId,action,expected,expected+1,key,h,remarks]);
   await this.event(tx,a,ref,action==="APPROVE"?"FINAL_APPROVED":state);
   if(action!=="APPROVE")await tx.query("UPDATE stock_operation_draft SET status=$3 WHERE root_realm_id=$1 AND id=$2",[a.realmId,r.id,state]);
   return {ref:r.id,caseReference:c.case_number,status:state,replayed:false};
  });
 }
 async approved(tx:PoolClient,a:VerifiedFoundationActor,r:OperationRow,proof:string|null,version:number|null){
  const c=(await tx.query<Case>("SELECT c.* FROM cg03_case c JOIN stock_adjustment_submission s ON s.case_id=c.id AND s.root_realm_id=c.realm_id WHERE c.realm_id=$1 AND s.operation_id=$2 AND s.proof_ref IS NOT DISTINCT FROM $3::uuid AND s.proof_revision IS NOT DISTINCT FROM $4::integer AND c.case_kind='STOCK_ADJUSTMENT_REVIEW' AND c.stock_adjustment_id=$2 AND c.stock_adjustment_version=1 AND c.stock_adjustment_digest=$5 AND c.status='PENDING_OWNER' FOR UPDATE OF c",[a.realmId,r.id,proof,version,r.digest])).rows[0];if(!c)throw new ConflictException({code:"CG12_REVIEW_REQUIRED"});
  const d=await tx.query("SELECT d.actor_id FROM cg03_case_decision d JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE' JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL JOIN role role ON role.id=ar.role_id AND role.realm_id=reviewer.realm_id AND role.is_protected AND role.active WHERE d.case_id=$1 AND d.realm_id=$2 AND d.action='APPROVE' AND d.actor_id<>$3 AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=$4 LIMIT 1 FOR SHARE OF reviewer,ar,role",[c.id,a.realmId,a.accountId,c.revision]);if(!d.rowCount)throw new ForbiddenException("Current independent approval required");return c;
 }
 async finish(tx:PoolClient,a:VerifiedFoundationActor,ref:string){
  if(!(await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND case_kind='STOCK_ADJUSTMENT_REVIEW' AND status='PENDING_OWNER' RETURNING id",[a.realmId,ref])).rowCount)throw sourceChanged();
  await this.event(tx,a,ref,"OWNER_COMPLETED");
 }
}
