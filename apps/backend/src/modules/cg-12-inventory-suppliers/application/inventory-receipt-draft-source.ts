import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryCatalogService} from "./inventory-catalog.service";
export const receiptInvalid=()=>new BadRequestException({code:"CG12_RECEIPT_INVALID"});
export const sourceChanged=()=>new ConflictException({code:"CG12_SOURCE_CHANGED"});
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function inventoryRef(v:unknown){if(typeof v!=="string"||!idPattern.test(v))throw receiptInvalid();return v.toLowerCase();}
export function inventoryInput(v:unknown,keys:string[]){if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw receiptInvalid();return v as Record<string,unknown>;}
export function inventoryText(v:unknown,min:number,max:number){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))throw receiptInvalid();return v.trim();}
export function inventoryQuantity(v:unknown,scale=3){
 if(typeof v!=="string"||!/^\d{1,15}(?:\.\d{1,3})?$/.test(v))throw receiptInvalid();
 const [whole,frac=""]=v.split(".");
 if(frac.length>scale||!/[1-9]/.test(v))throw receiptInvalid();
 const integer=whole.replace(/^0+(?=\d)/,""),decimal=frac.replace(/0+$/,"");
 return integer+(decimal?"."+decimal:"");
}
export function inventoryDate(v:unknown){
 if(typeof v!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw receiptInvalid();return v;
}
export type ReceiptDraftRow={id:string;root_realm_id:string;supplier_id:string;location_id:string;receipt_date:string;source_note:string;created_by:string;request_key:string;payload_digest:string;source_version:number;status:string};
@Injectable()
export class InventoryReceiptDraftSource {
 constructor(private readonly catalog:InventoryCatalogService,private readonly identity:FoundationStructureIdentityFacade){}
 async guard(tx:PoolClient,a:VerifiedFoundationActor,ref:string,mode:"READ"|"DRAFT"|"CONFIRM"){
  await this.identity.assertCurrent(tx,a,mode==="READ"?"inventory.stock.view":"inventory.stock.receive");
  const q=await tx.query<ReceiptDraftRow>("SELECT id,root_realm_id,supplier_id,location_id,receipt_date::text,source_note,created_by,request_key,payload_digest,source_version,status FROM inventory_receipt_draft WHERE root_realm_id=$1 AND id=$2 "+(mode==="CONFIRM"?"FOR UPDATE":"FOR SHARE"),[a.realmId,inventoryRef(ref)]);
  const row=q.rows[0];if(!row)throw new NotFoundException("Receipt unavailable");
  if((mode!=="READ"||row.status==="DRAFT")&&row.created_by!==a.accountId)throw new ForbiddenException("This receipt was prepared by another staff account");
  if(mode==="DRAFT"&&row.status!=="DRAFT")throw sourceChanged();
  const store=await this.catalog.store(tx,a,row.location_id,mode!=="READ"&&row.status==="DRAFT");
  return {row,proofRequired:store.receipt_proof_required};
 }
}
