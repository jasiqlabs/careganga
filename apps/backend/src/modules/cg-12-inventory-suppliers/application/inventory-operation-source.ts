import {ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {inventoryRef,sourceChanged} from "./inventory-receipt-draft-source";
export type OperationKind="ISSUE"|"RETURN"|"TRANSFER"|"ADJUSTMENT";
export const operationAction=(kind:OperationKind)=>kind==="ISSUE"||kind==="RETURN"?"inventory.stock.issue":kind==="TRANSFER"?"inventory.stock.transfer":"inventory.stock.adjust";
export type OperationRow={id:string;root_realm_id:string;request_key:string;actor_ref:string;kind:OperationKind;location_id:string;destination_id:string|null;request_id:string|null;recipient_id:string|null;original_movement_id:string|null;request_line_id:string|null;item_id:string;unit_code:string;qty_scale:number;quantity:string;system_quantity:string|null;balance_version:number|null;expected_request_version:number|null;reason:string;digest:string;source_version:number;status:string};
@Injectable()
export class InventoryOperationSource{
 constructor(private readonly catalog:InventoryCatalogService,private readonly identity:FoundationStructureIdentityFacade){}
 async guard(tx:PoolClient,a:VerifiedFoundationActor,ref:string,mode:"READ"|"DRAFT"|"CONFIRM",review=false){
  const r=(await tx.query<OperationRow>("SELECT * FROM stock_operation_draft WHERE root_realm_id=$1 AND id=$2 "+(mode==="CONFIRM"?"FOR UPDATE":"FOR SHARE"),[a.realmId,inventoryRef(ref)])).rows[0];
  if(!r)throw new NotFoundException("Stock operation unavailable");
  await this.identity.assertCurrent(tx,a,review?"inventory.stock.adjust.review":operationAction(r.kind));
  if(!review&&r.actor_ref!==a.accountId)throw new ForbiddenException("Only original operator may use this draft");
  if(review&&(r.kind!=="ADJUSTMENT"||r.actor_ref===a.accountId))throw new ForbiddenException("Independent stock adjustment reviewer required");
  if(mode==="DRAFT"&&r.status!=="DRAFT")throw sourceChanged();
  const active=r.status==="DRAFT"||r.status==="SUBMITTED";
  let policy;
  for(const loc of [...new Set([r.location_id,...(r.destination_id?[r.destination_id]:[])])].sort()){
   const s=await this.catalog.store(tx,a,loc,active);
   if(loc===r.location_id)policy=s;
  }
  return {row:r,proofRequired:!!policy?.delivery_proof_required,reviewRequired:!!policy?.adjustment_review_required};
 }
}
