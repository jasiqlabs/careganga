import {ConflictException,ForbiddenException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {materialHash} from "./inventory-material-source";
import {inventoryQuantity} from "./inventory-receipt-draft-source";
/** CG12 prepares the SAME original operation consumed by its warehouse UI and confirm transaction. */
export async function prepareAssistanceStock(tx:PoolClient,a:Actor,catalog:InventoryCatalogService,v:{
 key:string;aid:string;branch:string|null;item:string;location:string;unit:string;scale:number;quantity:string;action:"ISSUE"|"RETURN";original:string|null;
}){
 const store=await catalog.store(tx,a,v.location);
 if(store.branch_ref!==v.branch)throw new ForbiddenException("Choose a warehouse in the approved branch");
 const item=(await tx.query<{unit_code:string;qty_scale:number;status:string}>("SELECT unit_code,qty_scale,status FROM inventory_item WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,v.item])).rows[0];
 if(!item||item.unit_code!==v.unit||item.qty_scale!==v.scale||(v.action==="ISSUE"&&item.status!=="ACTIVE"))throw new ConflictException("Original aid item changed");
 const quantity=inventoryQuantity(v.quantity,v.scale);
 const hash=materialHash(["CG06_AID",v,quantity,a.accountId]);
 const operation=(await tx.query<{id:string}>("INSERT INTO stock_operation_draft(root_realm_id,request_key,actor_ref,kind,location_id,item_id,unit_code,qty_scale,quantity,recipient_id,original_movement_id,reason,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Approved Foundation assistance',$12) RETURNING id",[a.realmId,v.key,a.accountId,v.action,v.location,v.item,v.unit,v.scale,quantity,v.action==="ISSUE"?a.accountId:null,v.original,hash])).rows[0];
 if(!operation)throw new ConflictException("Original warehouse operation unavailable");
 return {operationRef:operation.id,proofRequired:store.delivery_proof_required};
}
