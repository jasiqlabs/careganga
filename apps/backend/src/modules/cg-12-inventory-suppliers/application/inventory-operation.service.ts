import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryAdjustmentApprovalService} from "../../cg-03-registration-approvals/application/inventory-adjustment-approval.service";
import {InventoryMovementEvidenceService} from "../../cg-19-documents-notifications/application/inventory-movement-evidence.service";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {InventoryMaterialSource,materialHash} from "./inventory-material-source";
import {InventoryOperationSource,operationAction,type OperationKind,type OperationRow} from "./inventory-operation-source";
import {inventoryInput,inventoryRef,inventoryText,inventoryQuantity,receiptInvalid,sourceChanged} from "./inventory-receipt-draft-source";
import {lockStockBalances,applyStockMovements,type StockDelta} from "./inventory-stock-command";
const opt=(v:unknown)=>v===undefined||v===null?null:inventoryRef(v);
const shortage=()=>new ConflictException({code:"CG12_STOCK_SHORTAGE"});
export function parseOperation(raw:unknown){
 const x=inventoryInput(raw,["requestKey","kind","locationRef","destinationRef","requestRef","requestLineRef","expectedRequestVersion","itemRef","quantity","originalMovementRef","reason"]);
 const kind=x.kind as OperationKind;
 if(!["ISSUE","RETURN","TRANSFER","ADJUSTMENT"].includes(kind))throw receiptInvalid();
 const loc=inventoryRef(x.locationRef),dest=opt(x.destinationRef),request=opt(x.requestRef),line=opt(x.requestLineRef),original=opt(x.originalMovementRef),version=x.expectedRequestVersion??null;
 if((dest!==null)!==(kind==="TRANSFER")||dest===loc||(original!==null)!==(kind==="RETURN")||(request!==null)!==(line!==null)||(request!==null&&kind!=="ISSUE")||(request===null&&version!==null)||(request!==null&&(typeof version!=="number"||!Number.isSafeInteger(version)||version<1)))throw receiptInvalid();
 return {key:inventoryRef(x.requestKey),kind,loc,dest,request,line,original,version:version as number|null,item:inventoryRef(x.itemRef),quantity:kind==="ADJUSTMENT"&&x.quantity==="0"?"0":inventoryQuantity(x.quantity),reason:inventoryText(x.reason,3,300)};
}
type Event={id:string;event_no:string;payload_digest:string};
@Injectable()
export class InventoryOperationService{
 constructor(private readonly catalog:InventoryCatalogService,private readonly source:InventoryOperationSource,private readonly material:InventoryMaterialSource,private readonly approval:InventoryAdjustmentApprovalService,private readonly evidence:InventoryMovementEvidenceService,private readonly identity:FoundationStructureIdentityFacade){}
 private async view(tx:PoolClient,a:VerifiedFoundationActor,r:OperationRow){
  const p=await tx.query("SELECT i.name,i.sku_norm AS sku,l.label AS location,d.label AS destination,m.request_no AS request,c.id AS \"caseRef\",c.case_number AS \"caseReference\",c.status AS \"caseStatus\",c.revision AS \"caseRevision\",s.proof_ref AS \"proofRef\",s.proof_revision AS \"proofVersion\",e.event_no AS reference FROM inventory_item i JOIN inventory_location l ON l.root_realm_id=i.root_realm_id AND l.id=$3 LEFT JOIN inventory_location d ON d.root_realm_id=i.root_realm_id AND d.id=$4 LEFT JOIN material_request m ON m.root_realm_id=i.root_realm_id AND m.id=$5 LEFT JOIN cg03_case c ON c.realm_id=i.root_realm_id AND c.stock_adjustment_id=$6 AND c.case_kind='STOCK_ADJUSTMENT_REVIEW' LEFT JOIN stock_adjustment_submission s ON s.root_realm_id=i.root_realm_id AND s.operation_id=$6 LEFT JOIN stock_event e ON e.root_realm_id=i.root_realm_id AND e.operation_id=$6 WHERE i.root_realm_id=$1 AND i.id=$2",[a.realmId,r.item_id,r.location_id,r.destination_id,r.request_id,r.id]);
  const labels=r.recipient_id?await this.identity.accountLabels(tx,a,[r.recipient_id]):{};
  return {...p.rows[0],ref:r.id,kind:r.kind,locationRef:r.location_id,own:r.actor_ref===a.accountId,status:r.status,quantity:r.quantity,unit:r.unit_code,systemQuantity:r.system_quantity,reason:r.reason,recipient:r.recipient_id?labels[r.recipient_id]??"Staff account":null};
 }
 async drafts(token:string,location:unknown,review=false){
  const loc=inventoryRef(location);
  return this.catalog.run(token,review?"inventory.stock.adjust.review":"inventory.stock.view",async(tx,a)=>{
   await this.catalog.store(tx,a,loc,false);
   const rs=await tx.query<OperationRow>("SELECT * FROM stock_operation_draft WHERE root_realm_id=$1 AND location_id=$2 AND "+(review?"kind='ADJUSTMENT' AND actor_ref<>$3 AND status='SUBMITTED'":"actor_ref=$3")+" ORDER BY created_at DESC,id DESC LIMIT 30",[a.realmId,loc,a.accountId]);
   const out=[];for(const r of rs.rows){try{const g=await this.source.guard(tx,a,r.id,"READ",review);out.push({...await this.view(tx,a,r),proofRequired:g.proofRequired,reviewRequired:g.reviewRequired});}catch(e){if(!(e instanceof ForbiddenException)&&!(e instanceof NotFoundException))throw e;}}return out;
  });
 }
 async held(token:string,location:unknown){
  const loc=inventoryRef(location);
  return this.catalog.run(token,"inventory.stock.issue",async(tx,a)=>{
   await this.catalog.store(tx,a,loc);
   const q=await tx.query("SELECT r.id AS \"requestRef\",r.request_no AS reference,r.version,r.requester_id AS recipient,l.id AS \"lineRef\",l.item_id AS \"itemRef\",i.name,i.sku_norm AS sku,l.unit_code AS unit,l.held_qty::text AS held FROM material_request r JOIN material_request_line l ON l.root_realm_id=r.root_realm_id AND l.request_id=r.id JOIN inventory_item i ON i.root_realm_id=l.root_realm_id AND i.id=l.item_id WHERE r.root_realm_id=$1 AND r.location_id=$2 AND r.status IN('HELD','PARTIAL') AND l.held_qty>0 ORDER BY r.created_at,r.id,l.id LIMIT 100",[a.realmId,loc]);
   const names=await this.identity.accountLabels(tx,a,q.rows.map(x=>x.recipient));return q.rows.map(x=>({...x,recipient:names[x.recipient]??"Staff account"}));
  });
 }
 async create(token:string,raw:unknown){
  const v=parseOperation(raw);
  return this.catalog.run(token,operationAction(v.kind),async(tx,a)=>{
   let policy;for(const l of [v.loc,...(v.dest?[v.dest]:[])].sort()){const s=await this.catalog.store(tx,a,l);if(l===v.loc)policy=s;}
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+v.key]);
   const prior=(await tx.query<OperationRow>("SELECT * FROM stock_operation_draft WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,v.key])).rows[0];
   if(prior){if(prior.actor_ref!==a.accountId||prior.digest!==materialHash([v,prior.system_quantity,prior.balance_version]))throw sourceChanged();return {...await this.view(tx,a,prior),proofRequired:!!policy?.delivery_proof_required,reviewRequired:!!policy?.adjustment_review_required};}
   const item=(await tx.query<{unit_code:string;qty_scale:number;status:string}>("SELECT unit_code,qty_scale,status FROM inventory_item WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,v.item])).rows[0];
   if(!item||(v.kind!=="RETURN"&&item.status!=="ACTIVE"))throw sourceChanged();
   const qty=v.kind==="ADJUSTMENT"&&v.quantity==="0"?"0":inventoryQuantity(v.quantity,item.qty_scale);
   let recipient:string|null=v.kind==="ISSUE"?a.accountId:null,system:string|null=null,version:number|null=null;
   if(v.request){const req=await this.material.row(tx,a,v.request,false);if(req.location_id!==v.loc||req.version!==v.version||!["HELD","PARTIAL"].includes(req.status))throw sourceChanged();const l=await tx.query("SELECT 1 FROM material_request_line WHERE root_realm_id=$1 AND request_id=$2 AND id=$3 AND item_id=$4 AND held_qty>=$5::numeric",[a.realmId,v.request,v.line,v.item,qty]);if(!l.rowCount)throw shortage();recipient=req.requester_id;}
   if(v.original&&!(await tx.query("SELECT 1 FROM stock_movement WHERE root_realm_id=$1 AND id=$2 AND location_id=$3 AND item_id=$4 AND event_kind='ISSUE' AND -signed_qty>=$5::numeric",[a.realmId,v.original,v.loc,v.item,qty])).rowCount)throw sourceChanged();
   if(v.kind==="ADJUSTMENT"){
    await lockStockBalances(tx,a.realmId,[{itemRef:v.item,locationRef:v.loc,unit:item.unit_code,scale:item.qty_scale,delta:"0",lineNo:1}]);
    const s=(await tx.query<{on_hand_qty:string;version:number}>("SELECT on_hand_qty::text,version FROM stock_balance WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 AND on_hand_qty<>$4::numeric AND reserved_qty<=$4::numeric",[a.realmId,v.item,v.loc,qty])).rows[0];if(!s)throw shortage();system=s.on_hand_qty;version=s.version;
   }
   const row=(await tx.query<OperationRow>("INSERT INTO stock_operation_draft(root_realm_id,request_key,actor_ref,kind,location_id,destination_id,request_id,recipient_id,original_movement_id,request_line_id,item_id,unit_code,qty_scale,quantity,system_quantity,balance_version,expected_request_version,reason,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *",[a.realmId,v.key,a.accountId,v.kind,v.loc,v.dest,v.request,recipient,v.original,v.line,v.item,item.unit_code,item.qty_scale,qty,system,version,v.version,v.reason,materialHash([v,system,version])])).rows[0];
   return {...await this.view(tx,a,row),proofRequired:!!policy?.delivery_proof_required,reviewRequired:!!policy?.adjustment_review_required};
  });
 }
 async confirm(token:string,ref:string,raw:unknown){
  const x=inventoryInput(raw,["proofRef","proofVersion"]),proof=opt(x.proofRef),pv=x.proofVersion??null;
  if((proof===null)!==(pv===null)||(pv!==null&&(typeof pv!=="number"||!Number.isSafeInteger(pv)||pv<1)))throw receiptInvalid();
  const proofVersion=pv as number|null;
  return this.catalog.run(token,"inventory.stock.view",async(tx,a)=>{
   const {row:r,proofRequired,reviewRequired}=await this.source.guard(tx,a,ref,"CONFIRM");
   const hash=materialHash([r.digest,proof,proofVersion]);
   const old=(await tx.query<Event>("SELECT id,event_no,payload_digest FROM stock_event WHERE root_realm_id=$1 AND operation_id=$2",[a.realmId,r.id])).rows[0];
   if(old){if(old.payload_digest!==hash)throw sourceChanged();return {ref:old.id,reference:old.event_no,status:"CONFIRMED",replayed:true};}
   if(!["DRAFT","SUBMITTED"].includes(r.status))throw sourceChanged();
   if(proofRequired&&!proof)throw new ConflictException({code:"CG12_PROOF_REQUIRED"});
   if(proof)await this.evidence.guardVerified(tx,a,r.id,proof,proofVersion!);
   let approvedCase:string|null=null;
   if(r.kind==="ADJUSTMENT"&&(reviewRequired||r.status==="SUBMITTED")){
    if(r.status==="DRAFT")return this.approval.submit(tx,a,r,proof,proofVersion);
    const pending=(await tx.query("SELECT 1 FROM stock_adjustment_submission s JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.id=s.case_id WHERE s.root_realm_id=$1 AND s.operation_id=$2 AND s.proof_ref IS NOT DISTINCT FROM $3::uuid AND s.proof_revision IS NOT DISTINCT FROM $4::integer AND c.status IN('SUBMITTED','IN_REVIEW')",[a.realmId,r.id,proof,proofVersion])).rowCount;
    if(pending)return {ref:r.id,status:"SUBMITTED",replayed:true};
    approvedCase=(await this.approval.approved(tx,a,r,proof,proofVersion)).id;
   }
   if(r.kind!=="RETURN"&&!(await tx.query("SELECT 1 FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,r.item_id])).rowCount)throw sourceChanged();
   if(r.request_id){const req=await this.material.row(tx,a,r.request_id,false,true);if(req.version!==r.expected_request_version||req.location_id!==r.location_id||req.requester_id!==r.recipient_id||!["HELD","PARTIAL"].includes(req.status))throw sourceChanged();}
   if(r.original_movement_id){
    const original=await tx.query("SELECT id FROM stock_movement WHERE root_realm_id=$1 AND id=$2 AND event_kind='ISSUE' AND location_id=$3 AND item_id=$4 FOR UPDATE",[a.realmId,r.original_movement_id,r.location_id,r.item_id]);if(!original.rowCount)throw sourceChanged();
    if(!(await tx.query("SELECT 1 FROM stock_movement m WHERE m.root_realm_id=$1 AND m.id=$2 AND -m.signed_qty>= $3::numeric+COALESCE((SELECT SUM(n.signed_qty) FROM stock_event e JOIN stock_movement n ON n.root_realm_id=e.root_realm_id AND n.stock_event_id=e.id WHERE e.root_realm_id=$1 AND e.original_movement_id=$2 AND e.event_kind='RETURN'),0)",[a.realmId,r.original_movement_id,r.quantity])).rowCount)throw shortage();
   }
   const delta:StockDelta={itemRef:r.item_id,locationRef:r.location_id,unit:r.unit_code,scale:r.qty_scale,delta:r.kind==="RETURN"?r.quantity:"-"+r.quantity,lineNo:1};
   const deltas=[delta,...(r.destination_id?[{...delta,locationRef:r.destination_id,delta:r.quantity,lineNo:2}]:[])];
   await lockStockBalances(tx,a.realmId,deltas);
   if(r.kind==="ADJUSTMENT"){const s=(await tx.query<{delta:string}>("SELECT ($4::numeric-on_hand_qty)::text AS delta FROM stock_balance WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 AND version=$5 AND on_hand_qty=$6::numeric AND $4::numeric>=reserved_qty",[a.realmId,r.item_id,r.location_id,r.quantity,r.balance_version,r.system_quantity])).rows[0];if(!s)throw sourceChanged();delta.delta=s.delta;}
   if(r.request_line_id){
    if(!(await tx.query("UPDATE stock_hold SET quantity=quantity-$3::numeric WHERE root_realm_id=$1 AND request_line_id=$2 AND quantity>=$3::numeric RETURNING request_line_id",[a.realmId,r.request_line_id,r.quantity])).rowCount)throw shortage();
    if(!(await tx.query("UPDATE material_request_line SET held_qty=held_qty-$3::numeric,issued_qty=issued_qty+$3::numeric WHERE root_realm_id=$1 AND id=$2 AND held_qty>=$3::numeric RETURNING id",[a.realmId,r.request_line_id,r.quantity])).rowCount)throw shortage();
    delta.reservedDelta="-"+r.quantity;
    await tx.query("INSERT INTO stock_hold_event(root_realm_id,request_line_id,request_key,actor_ref,delta,kind) VALUES($1,$2,$3,$4,-$5::numeric,'ISSUE')",[a.realmId,r.request_line_id,r.request_key,a.accountId,r.quantity]);
    await tx.query("UPDATE material_request SET status=CASE WHEN EXISTS(SELECT 1 FROM material_request_line WHERE root_realm_id=$1 AND request_id=$2 AND issued_qty<approved_qty) THEN 'PARTIAL' ELSE 'FULFILLED' END,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,r.request_id]);
   }
   const e=(await tx.query<Event>("INSERT INTO stock_event(root_realm_id,event_no,source_owner,source_ref,source_event_key,payload_digest,event_kind,actor_ref,operation_id,recipient_id,request_id,original_movement_id,effective_date,reason,movement_proof_ref,movement_proof_revision) VALUES($1,'CG-ST-'||to_char(nextval('stock_event_public_sequence'),'FM000000000000'),'CG12',$2,$3,$4,$5,$6,$2,$7,$8,$9,CURRENT_DATE,$10,$11,$12) RETURNING id,event_no,payload_digest",[a.realmId,r.id,r.request_key,hash,r.kind,a.accountId,r.recipient_id,r.request_id,r.original_movement_id,r.reason,proof,proofVersion])).rows[0];
   await applyStockMovements(tx,a.realmId,e.id,r.kind,deltas);
   await tx.query("INSERT INTO inventory_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,1)",[a.realmId,a.accountId,r.kind,e.id,r.request_key,hash]);
   await tx.query("UPDATE stock_operation_draft SET status='CONFIRMED' WHERE root_realm_id=$1 AND id=$2",[a.realmId,r.id]);
   if(approvedCase)await this.approval.finish(tx,a,approvedCase);
   return {ref:e.id,reference:e.event_no,status:"CONFIRMED",replayed:false};
  });
 }
}
