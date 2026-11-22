import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryReceiptEvidenceService} from "../../cg-19-documents-notifications/application/inventory-receipt-evidence.service";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {InventoryReceiptDraftSource,inventoryDate,inventoryInput,inventoryQuantity,inventoryRef,inventoryText,receiptInvalid,sourceChanged,type ReceiptDraftRow} from "./inventory-receipt-draft-source";
import {applyStockMovements,lockStockBalances,type StockDelta} from "./inventory-stock-command";
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type ReceiptLine={itemRef:string;unit:string;quantity:string};
export function parseReceiptDraft(raw:unknown){
 const v=inventoryInput(raw,["requestKey","supplierRef","locationRef","receiptDate","sourceNote","lines"]);
 if(!Array.isArray(v.lines)||v.lines.length<1||v.lines.length>50)throw receiptInvalid();
 const lines=v.lines.map(line=>{
  const x=inventoryInput(line,["itemRef","unit","quantity"]);
  if(typeof x.unit!=="string"||!["PIECE","KG","LITER"].includes(x.unit))throw receiptInvalid();
  return {itemRef:inventoryRef(x.itemRef),unit:x.unit,quantity:inventoryQuantity(x.quantity,x.unit==="PIECE"?0:3)};
 }).sort((x,y)=>x.itemRef.localeCompare(y.itemRef));
 if(new Set(lines.map(x=>x.itemRef)).size!==lines.length)throw receiptInvalid();
 return {requestKey:inventoryRef(v.requestKey),supplierRef:inventoryRef(v.supplierRef),locationRef:inventoryRef(v.locationRef),receiptDate:inventoryDate(v.receiptDate),sourceNote:inventoryText(v.sourceNote??"",0,160),lines};
}
type ReceiptInput=ReturnType<typeof parseReceiptDraft>;
type StockEvent={id:string;event_no:string;event_kind:string;actor_ref:string;payload_digest:string;receipt_draft_id:string;reversal_of_ref:string|null;proof_ref:string|null;proof_revision:number|null};
const frozenDigest=(v:Omit<ReceiptInput,"requestKey">)=>digest([v.supplierRef,v.locationRef,v.receiptDate,v.sourceNote,v.lines.map(l=>[l.itemRef,l.unit,l.quantity])]);
@Injectable()
export class InventoryStockService{
 constructor(private readonly catalog:InventoryCatalogService,private readonly source:InventoryReceiptDraftSource,private readonly evidence:InventoryReceiptEvidenceService,private readonly identity:FoundationStructureIdentityFacade){}
 private async supplier(tx:PoolClient,root:string,ref:string){
  const q=await tx.query("SELECT id FROM inventory_supplier WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[root,ref]);
  if(!q.rowCount)throw receiptInvalid();
 }
 private async receiptDeltas(tx:PoolClient,root:string,loc:string,lines:readonly ReceiptLine[]){
  const result:StockDelta[]=[];
  for(let i=0;i<lines.length;i++){
   const l=lines[i],item=(await tx.query<{unit_code:string;qty_scale:number}>("SELECT unit_code,qty_scale FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[root,l.itemRef])).rows[0];
   if(!item||item.unit_code!==l.unit)throw receiptInvalid();
   result.push({itemRef:l.itemRef,locationRef:loc,unit:l.unit,scale:item.qty_scale,delta:inventoryQuantity(l.quantity,item.qty_scale),lineNo:i+1});
  }
  return result;
 }
 private async draftLines(tx:PoolClient,a:VerifiedFoundationActor,ref:string){
  const q=await tx.query<{itemRef:string;unit:string;quantity:string;name:string;sku:string}>("SELECT l.item_id AS \"itemRef\",l.unit_code AS unit,l.quantity::text AS quantity,i.name,i.sku_norm AS sku FROM inventory_receipt_line l JOIN inventory_item i ON i.id=l.item_id AND i.root_realm_id=l.root_realm_id WHERE l.root_realm_id=$1 AND l.receipt_id=$2 ORDER BY l.line_no LIMIT 50",[a.realmId,ref]);
  return q.rows.map(x=>({...x,quantity:inventoryQuantity(x.quantity.replace(/(\.\d*?[1-9])0+$/,"$1").replace(/\.0+$/,""),3)}));
 }
 private async describeDraft(tx:PoolClient,a:VerifiedFoundationActor,row:ReceiptDraftRow,proofRequired:boolean){
  const labels=(await tx.query<{supplier:string;location:string}>("SELECT s.display_name AS supplier,l.label AS location FROM inventory_receipt_draft d JOIN inventory_supplier s ON s.id=d.supplier_id AND s.root_realm_id=d.root_realm_id JOIN inventory_location l ON l.id=d.location_id AND l.root_realm_id=d.root_realm_id WHERE d.root_realm_id=$1 AND d.id=$2",[a.realmId,row.id])).rows[0];
  const lines=await this.draftLines(tx,a,row.id);
  return {ref:row.id,status:row.status,version:row.source_version,receiptDate:row.receipt_date,sourceNote:row.source_note,supplier:labels.supplier,location:labels.location,locationRef:row.location_id,proofRequired,lines};
 }
 async createDraft(token:string,raw:unknown){
  const v=parseReceiptDraft(raw),hash=frozenDigest(v);
  return this.catalog.run(token,"inventory.stock.receive",async(tx,a)=>{
   const loc=await this.catalog.store(tx,a,v.locationRef);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+v.requestKey]);
   const old=(await tx.query<ReceiptDraftRow>("SELECT id,root_realm_id,supplier_id,location_id,receipt_date::text,source_note,created_by,request_key,payload_digest,source_version,status FROM inventory_receipt_draft WHERE root_realm_id=$1 AND request_key=$2 FOR SHARE",[a.realmId,v.requestKey])).rows[0];
   if(old){if(old.created_by!==a.accountId||old.payload_digest!==hash||old.location_id!==v.locationRef)throw sourceChanged();return this.describeDraft(tx,a,old,loc.receipt_proof_required);}
   await this.supplier(tx,a.realmId,v.supplierRef);
   const deltas=await this.receiptDeltas(tx,a.realmId,v.locationRef,v.lines);
   const row=(await tx.query<ReceiptDraftRow>("INSERT INTO inventory_receipt_draft(root_realm_id,supplier_id,location_id,receipt_date,source_note,created_by,request_key,payload_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,root_realm_id,supplier_id,location_id,receipt_date::text,source_note,created_by,request_key,payload_digest,source_version,status",[a.realmId,v.supplierRef,v.locationRef,v.receiptDate,v.sourceNote,a.accountId,v.requestKey,hash])).rows[0];
   for(const d of deltas)await tx.query("INSERT INTO inventory_receipt_line(root_realm_id,receipt_id,item_id,line_no,unit_code,qty_scale,quantity) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,row.id,d.itemRef,d.lineNo,d.unit,d.scale,d.delta]);
   return this.describeDraft(tx,a,row,loc.receipt_proof_required);
  });
 }
 async draft(token:string,ref:string){
  return this.catalog.run(token,"inventory.stock.receive",async(tx,a)=>{
   const {row,proofRequired}=await this.source.guard(tx,a,ref,"CONFIRM");
   return this.describeDraft(tx,a,row,proofRequired);
  });
 }
 async drafts(token:string,locationInput:string){
  const location=inventoryRef(locationInput);return this.catalog.run(token,"inventory.stock.receive",async(tx,a)=>{
   await this.catalog.store(tx,a,location);
   const q=await tx.query("SELECT d.id AS ref,d.receipt_date::text AS \"receiptDate\",s.display_name AS supplier,d.created_at AS \"createdAt\" FROM inventory_receipt_draft d JOIN inventory_supplier s ON s.id=d.supplier_id AND s.root_realm_id=d.root_realm_id WHERE d.root_realm_id=$1 AND d.location_id=$2 AND d.created_by=$3 AND d.status='DRAFT' ORDER BY d.created_at DESC,d.id LIMIT 25",[a.realmId,location,a.accountId]);
   return {items:q.rows};
  });
 }
 async confirm(token:string,refInput:string,raw:unknown){
  const ref=inventoryRef(refInput),x=inventoryInput(raw,["proofRef","proofVersion"]);
  const proof=x.proofRef===null||x.proofRef===undefined?null:inventoryRef(x.proofRef),pv=x.proofVersion===null||x.proofVersion===undefined?null:x.proofVersion;
  if((proof===null)!==(pv===null)||(pv!==null&&(typeof pv!=="number"||!Number.isSafeInteger(pv)||pv<1)))throw receiptInvalid();
  return this.catalog.run(token,"inventory.stock.receive",async(tx,a)=>{
   const {row,proofRequired}=await this.source.guard(tx,a,ref,"CONFIRM");
   const hash=digest([row.payload_digest,proof,pv]),previous=(await tx.query<StockEvent>("SELECT * FROM stock_event WHERE root_realm_id=$1 AND receipt_draft_id=$2 AND event_kind='RECEIPT'",[a.realmId,ref])).rows[0];
   if(previous){if(previous.actor_ref!==a.accountId||previous.payload_digest!==hash)throw sourceChanged();return {ref:previous.id,reference:previous.event_no,status:"CONFIRMED",replayed:true};}
   if(row.status!=="DRAFT")throw sourceChanged();
   // Recheck policy and evidence in the same transaction, not on the UI's earlier upload acknowledgement.
   if(proofRequired&&proof===null)throw new ConflictException({code:"CG12_RECEIPT_PROOF"});
   if(proof!==null)await this.evidence.guardVerified(tx,a,ref,proof,pv as number);
   await this.supplier(tx,a.realmId,row.supplier_id);
   const lines=await this.draftLines(tx,a,ref);
   if(!lines.length||frozenDigest({supplierRef:row.supplier_id,locationRef:row.location_id,receiptDate:row.receipt_date,sourceNote:row.source_note,lines})!==row.payload_digest)throw sourceChanged();
   const deltas=await this.receiptDeltas(tx,a.realmId,row.location_id,lines);
   await lockStockBalances(tx,a.realmId,deltas);
   const event=(await tx.query<StockEvent>("INSERT INTO stock_event(root_realm_id,event_no,source_owner,source_ref,source_event_key,payload_digest,event_kind,actor_ref,receipt_draft_id,effective_date,proof_ref,proof_revision) VALUES($1,'CG-ST-'||to_char(nextval('stock_event_public_sequence'),'FM000000000000'),'CG12',$2,$3,$4,'RECEIPT',$5,$2,$6,$7,$8) RETURNING *",[a.realmId,ref,row.request_key,hash,a.accountId,row.receipt_date,proof,pv])).rows[0];
   await applyStockMovements(tx,a.realmId,event.id,"RECEIPT",deltas);
   await tx.query("UPDATE inventory_receipt_draft SET status='CONFIRMED' WHERE root_realm_id=$1 AND id=$2 AND status='DRAFT'",[a.realmId,ref]);
   return {ref:event.id,reference:event.event_no,status:"CONFIRMED",replayed:false};
  });
 }
 async reverseReceipt(token:string,refInput:string,raw:unknown){
  const ref=inventoryRef(refInput),x=inventoryInput(raw,["requestKey","reason"]),key=inventoryRef(x.requestKey),reason=inventoryText(x.reason,3,300),hash=digest([ref,reason]);
  return this.catalog.run(token,"inventory.stock.reverse",async(tx,a)=>{
   const q=await tx.query<StockEvent&{location_id:string}>("SELECT e.*,d.location_id FROM stock_event e JOIN inventory_receipt_draft d ON d.id=e.receipt_draft_id AND d.root_realm_id=e.root_realm_id WHERE e.root_realm_id=$1 AND e.id=$2 AND e.event_kind='RECEIPT' FOR UPDATE OF e",[a.realmId,ref]);
   const original=q.rows[0];if(!original)throw new NotFoundException("Receipt unavailable");
   await this.catalog.store(tx,a,original.location_id);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+key]);
   const prior=(await tx.query<StockEvent>("SELECT * FROM stock_event WHERE root_realm_id=$1 AND source_event_key=$2",[a.realmId,key])).rows[0];
   if(prior){if(prior.event_kind!=="RECEIPT_REVERSAL"||prior.actor_ref!==a.accountId||prior.reversal_of_ref!==ref||prior.payload_digest!==hash)throw sourceChanged();return {ref:prior.id,reference:prior.event_no,replayed:true};}
   if((await tx.query("SELECT 1 FROM stock_event WHERE root_realm_id=$1 AND reversal_of_ref=$2 AND event_kind='RECEIPT_REVERSAL'",[a.realmId,ref])).rowCount)throw new ConflictException({code:"CG12_RECEIPT_REVERSED"});
   const lines=(await tx.query<StockDelta>("SELECT item_id AS \"itemRef\",location_id AS \"locationRef\",unit_code AS unit,qty_scale AS scale,(-signed_qty)::text AS delta,source_line_no AS \"lineNo\" FROM stock_movement WHERE root_realm_id=$1 AND stock_event_id=$2 ORDER BY source_line_no",[a.realmId,ref])).rows;
   if(!lines.length)throw sourceChanged();
   await lockStockBalances(tx,a.realmId,lines);
   const event=(await tx.query<StockEvent>("INSERT INTO stock_event(root_realm_id,event_no,source_owner,source_ref,source_event_key,payload_digest,event_kind,actor_ref,receipt_draft_id,reversal_of_ref,effective_date,reason) VALUES($1,'CG-ST-'||to_char(nextval('stock_event_public_sequence'),'FM000000000000'),'CG12',$2,$3,$4,'RECEIPT_REVERSAL',$5,$6,$2,CURRENT_DATE,$7) RETURNING *",[a.realmId,ref,key,hash,a.accountId,original.receipt_draft_id,reason])).rows[0];
   await applyStockMovements(tx,a.realmId,event.id,"RECEIPT_REVERSAL",lines);
   return {ref:event.id,reference:event.event_no,replayed:false};
  });
 }
 async events(token:string,locationInput:unknown,searchInput:unknown,offsetInput:unknown,kindInput:unknown,fromInput?:unknown,toInput?:unknown){
  const loc=inventoryRef(locationInput),search=inventoryText(searchInput??"",0,80).toLowerCase(),offset=Number(offsetInput??0),kind=kindInput??"ALL",from=fromInput?inventoryDate(fromInput):null,to=toInput?inventoryDate(toInput):null;
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||typeof kind!=="string"||!["ALL","RECEIPT","RECEIPT_REVERSAL"].includes(kind)||(from&&to&&from>to))throw receiptInvalid();
  return this.catalog.run(token,"inventory.stock.view",async(tx,a)=>{
   await this.catalog.store(tx,a,loc,false);
   const q=await tx.query<{actorRef:string;[k:string]:unknown}>(`
    SELECT e.id AS ref,e.event_no AS reference,e.event_kind AS kind,e.effective_date::text AS date,e.occurred_at AS "recordedAt",
     e.actor_ref AS "actorRef",m.source_line_no AS line,m.signed_qty::text AS quantity,m.unit_code AS unit,i.name AS item,i.sku_norm AS sku,l.label AS location,
     s.display_name AS supplier,CASE WHEN e.event_kind='RECEIPT' AND EXISTS(SELECT 1 FROM stock_event rev WHERE rev.root_realm_id=e.root_realm_id AND rev.reversal_of_ref=e.id AND rev.event_kind='RECEIPT_REVERSAL') THEN 'REVERSED' ELSE 'CONFIRMED' END AS status
    FROM stock_movement m JOIN stock_event e ON e.id=m.stock_event_id AND e.root_realm_id=m.root_realm_id
    JOIN inventory_item i ON i.id=m.item_id AND i.root_realm_id=m.root_realm_id JOIN inventory_location l ON l.id=m.location_id AND l.root_realm_id=m.root_realm_id
    LEFT JOIN inventory_receipt_draft d ON d.id=e.receipt_draft_id AND d.root_realm_id=e.root_realm_id
    LEFT JOIN inventory_supplier s ON s.id=d.supplier_id AND s.root_realm_id=d.root_realm_id
    WHERE m.root_realm_id=$1 AND m.location_id=$2 AND ($3='' OR strpos(lower(e.event_no),$3)>0 OR strpos(lower(i.name),$3)>0 OR strpos(lower(i.sku_norm),$3)>0 OR strpos(lower(COALESCE(s.display_name,'')),$3)>0)
     AND ($4='ALL' OR e.event_kind=$4) AND ($5::date IS NULL OR e.effective_date>=$5) AND ($6::date IS NULL OR e.effective_date<=$6)
    ORDER BY e.occurred_at DESC,e.id DESC,m.source_line_no LIMIT 26 OFFSET $7`,[a.realmId,loc,search,kind,from,to,offset]);
   const page=q.rows.slice(0,25),labels=await this.identity.accountLabels(tx,a,page.map(x=>x.actorRef));
   return {items:page.map(({actorRef,...row})=>({...row,actor:labels[actorRef]??"Staff account"})),hasMore:q.rows.length>25,offset};
  });
 }
 async summary(token:string,locationInput:unknown){
  const loc=inventoryRef(locationInput);return this.catalog.run(token,"inventory.stock.view",async(tx,a)=>{
   await this.catalog.store(tx,a,loc);
   const q=await tx.query(`
    SELECT COUNT(*)::integer AS total,
    COUNT(*) FILTER(WHERE COALESCE(b.on_hand_qty,0)-COALESCE(b.reserved_qty,0)>0)::integer AS "inStock",
    COUNT(*) FILTER(WHERE COALESCE(b.on_hand_qty,0)-COALESCE(b.reserved_qty,0)=0)::integer AS "outOfStock",
    COUNT(*) FILTER(WHERE COALESCE(b.on_hand_qty,0)-COALESCE(b.reserved_qty,0)<COALESCE(p.threshold,i.low_stock_threshold))::integer AS "lowStock"
    FROM inventory_item i LEFT JOIN stock_balance b ON b.root_realm_id=i.root_realm_id AND b.item_id=i.id AND b.location_id=$2
    LEFT JOIN inventory_item_location_policy p ON p.root_realm_id=i.root_realm_id AND p.item_id=i.id AND p.location_id=$2
    WHERE i.root_realm_id=$1 AND i.status='ACTIVE'`,[a.realmId,loc]);
   return q.rows[0];
  });
 }
}
