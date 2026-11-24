import {ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryCatalogService} from "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {inventoryQuantity,inventoryDate} from "../../cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
import {prepareAssistanceStock} from "../../cg-12-inventory-suppliers/application/assistance-stock-source";
import {FinanceVoucherDraftService} from "../../cg-09-finance-accounting/application/finance-voucher-draft.service";
import {BeneficiaryEvidenceService} from "../../cg-19-documents-notifications/application/beneficiary-evidence.service";
import {AssistanceService,aidDigest} from "./assistance.service";
import {moneyMinor} from "../domain/assistance-input";
import {conflict,fields,ref,revision} from "../domain/beneficiary-input";
type Allocation={id:string;assistance_id:string;action:"ISSUE"|"RETURN"|"PAYMENT";quantity:string|null;amount_minor:string|null;stock_operation_ref:string|null;voucher_ref:string|null;voucher_revision:number|null;return_of_ref:string|null;actor_ref:string;request_digest:string;created_at:Date};
@Injectable()
export class AssistanceFulfillmentService{
 constructor(private readonly source:AssistanceService,private readonly identity:FoundationStructureIdentityFacade,private readonly inventory:InventoryCatalogService,private readonly finance:FinanceVoucherDraftService,private readonly evidence:BeneficiaryEvidenceService){}
 private async approved(tx:PoolClient,a:Actor,id:string,expected:number){
  const row=await this.source.guard(tx,a,id,true);
  if(row.state!=="APPROVED"||row.revision!==expected)throw conflict();
  if(!(await tx.query("SELECT 1 FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='ASSISTANCE_REVIEW' AND assistance_review_ref=$3 AND assistance_source_digest=$4 AND status='OWNER_COMPLETED' FOR SHARE",[a.realmId,row.approval_case_ref,row.id,row.source_digest])).rowCount)throw conflict();
  return row;
 }
 private async original(tx:PoolClient,a:Actor,key:string,hash:string,aid:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG06-ALLOCATION:"+a.realmId+":"+a.accountId+":"+key]);
  const row=(await tx.query<Allocation>("SELECT * FROM assistance_fulfillment WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
  if(row&&(row.request_digest!==hash||row.assistance_id!==aid))throw conflict();return row;
 }
 private async stockProof(tx:PoolClient,a:Actor,row:Allocation){
  const s=(await tx.query<{id:string;event_no:string;movement_id:string}>("SELECT e.id,e.event_no,m.id AS movement_id FROM stock_operation_draft o JOIN stock_event e ON e.root_realm_id=o.root_realm_id AND e.operation_id=o.id JOIN stock_movement m ON m.root_realm_id=e.root_realm_id AND m.stock_event_id=e.id AND m.item_id=o.item_id AND m.location_id=o.location_id AND m.signed_qty=CASE WHEN o.kind='ISSUE' THEN -o.quantity ELSE o.quantity END WHERE o.root_realm_id=$1 AND o.id=$2 AND o.status='CONFIRMED' AND e.event_kind=$3 AND m.event_kind=$3 AND o.quantity=$4::numeric",[a.realmId,row.stock_operation_ref,row.action,row.quantity])).rows[0];
  return s??null;
 }
 private async moneyProof(tx:PoolClient,a:Actor,row:Allocation){
  return (await tx.query<{id:string;voucher_number:string}>("SELECT j.id,v.voucher_number FROM finance_voucher v JOIN finance_voucher_posting p ON p.root_realm_id=v.root_realm_id AND p.voucher_id=v.id AND p.voucher_revision=v.version JOIN journal j ON j.root_realm_id=p.root_realm_id AND j.id=p.journal_id AND j.status='POSTED' AND j.posting_kind='VOUCHER' JOIN finance_voucher_payment_verification proof ON proof.root_realm_id=v.root_realm_id AND proof.voucher_id=v.id AND proof.voucher_revision=v.version AND proof.status='VERIFIED' AND proof.amount_minor=v.total_minor WHERE v.root_realm_id=$1 AND v.id=$2 AND v.version=$3 AND v.status='POSTED' AND v.voucher_type='PAYMENT' AND v.total_minor=$4::bigint",[a.realmId,row.voucher_ref,row.voucher_revision,row.amount_minor])).rows[0]??null;
 }
 private async allocationView(tx:PoolClient,a:Actor,r:Allocation){
  const delivery=(await tx.query<{action:string;at:Date}>("SELECT action,at FROM assistance_delivery_event WHERE root_realm_id=$1 AND fulfillment_id=$2 ORDER BY at DESC LIMIT 1",[a.realmId,r.id])).rows[0];
  const stock=r.action==="PAYMENT"?null:await this.stockProof(tx,a,r),money=r.action==="PAYMENT"?await this.moneyProof(tx,a,r):null;
  return {ref:r.id,action:r.action,quantity:r.quantity,amountMinor:r.amount_minor,stockOperationRef:r.stock_operation_ref,voucherRef:r.voucher_ref,ownerReference:stock?.event_no??money?.voucher_number??null,status:delivery?.action??(stock?(r.action==="ISSUE"?"ISSUED_AWAITING_HANDOVER":"RETURN_AWAITING_CONFIRMATION"):money?"PAID_AWAITING_HANDOVER":r.action==="PAYMENT"?"PENDING_PAYMENT":"PENDING_STOCK"),confirmedAt:delivery?.at??null,createdAt:r.created_at};
 }
 async prepareStock(token:string,id:string,raw:unknown,returning=false){
  const x=fields(raw,["requestKey","expectedRevision","quantity","returnOfRef"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),quantity=inventoryQuantity(x.quantity),target=ref(id),original=returning?ref(x.returnOfRef):null;
  if(!returning&&x.returnOfRef!==undefined)throw conflict();
  const action=returning?"RETURN":"ISSUE",hash=aidDigest([target,action,expected,quantity,original]);
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"inventory.stock.issue");await this.identity.assertCurrent(tx,a,"inventory.stock.view");
   const row=await this.approved(tx,a,target,expected);
   if(row.kind!=="MATERIAL"||!row.item_ref||!row.location_ref||!row.unit_code||row.qty_scale===null)throw conflict();
   const prior=await this.original(tx,a,key,hash,target);if(prior)return {...await this.allocationView(tx,a,prior),replayed:true};
   if(!returning)await this.source.context(tx,a,row.branch_ref,row.project_ref,row.activity_ref,row.visit_ref,row.campaign_ref);
   let movement:string|null=null;
   if(original){
    const issued=(await tx.query<Allocation>("SELECT f.* FROM assistance_fulfillment f JOIN assistance_delivery_event d ON d.root_realm_id=f.root_realm_id AND d.fulfillment_id=f.id AND d.action='DELIVERED' WHERE f.root_realm_id=$1 AND f.assistance_id=$2 AND f.id=$3 AND f.action='ISSUE' FOR SHARE OF f",[a.realmId,row.id,original])).rows[0];
    if(!issued)throw conflict();const proof=await this.stockProof(tx,a,issued);if(!proof)throw conflict();movement=proof.movement_id;
   }
   const draft=await prepareAssistanceStock(tx,a,this.inventory,{key,aid:row.id,branch:row.branch_ref,item:row.item_ref,location:row.location_ref,unit:row.unit_code,scale:row.qty_scale,quantity,action,original:movement});
   const allocation=(await tx.query<Allocation>("INSERT INTO assistance_fulfillment(root_realm_id,assistance_id,action,request_key,request_digest,actor_ref,quantity,stock_operation_ref,return_of_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[a.realmId,row.id,action,key,hash,a.accountId,quantity,draft.operationRef,original])).rows[0];
   return {...await this.allocationView(tx,a,allocation),proofRequired:draft.proofRequired,replayed:false};
  });
 }
 async paymentOptions(token:string,id:string){
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   const row=await this.approved(tx,a,id,3);if(row.kind!=="FINANCIAL")throw conflict();
   return this.finance.aidPaymentOptions(tx,a,row.branch_ref);
  });
 }
 async preparePayment(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision","amountMinor","financialYearRef","postingDate","debitAccountRef","paymentAccountRef"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),amount=moneyMinor(x.amountMinor),year=ref(x.financialYearRef),date=inventoryDate(x.postingDate),debit=ref(x.debitAccountRef),payment=ref(x.paymentAccountRef),target=ref(id),hash=aidDigest([target,"PAYMENT",expected,amount,year,date,debit,payment]);
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"finance.vouchers.manage");await this.identity.assertCurrent(tx,a,"finance.vouchers.view");
   const row=await this.approved(tx,a,target,expected);if(row.kind!=="FINANCIAL")throw conflict();
   const prior=await this.original(tx,a,key,hash,target);if(prior)return {...await this.allocationView(tx,a,prior),replayed:true};
   await this.source.context(tx,a,row.branch_ref,row.project_ref,row.activity_ref,row.visit_ref,row.campaign_ref);
   const voucher=await this.finance.prepareAidPayment(tx,a,{key,branch:row.branch_ref,year,date,debit,payment,minor:amount,reference:row.reference});
   const allocation=(await tx.query<Allocation>("INSERT INTO assistance_fulfillment(root_realm_id,assistance_id,action,request_key,request_digest,actor_ref,amount_minor,voucher_ref,voucher_revision) VALUES($1,$2,'PAYMENT',$3,$4,$5,$6,$7,$8) RETURNING *",[a.realmId,row.id,key,hash,a.accountId,amount,voucher.voucherRef,voucher.version])).rows[0];
   return {...await this.allocationView(tx,a,allocation),voucherNumber:voucher.voucherNumber,replayed:false};
  });
 }
 async prepareRecovery(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision","fulfillmentRef","financialYearRef","postingDate"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),allocation=ref(x.fulfillmentRef),year=ref(x.financialYearRef),date=inventoryDate(x.postingDate),target=ref(id),hash=aidDigest([target,"RECOVERY",expected,allocation,year,date]);
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"finance.vouchers.manage");await this.identity.assertCurrent(tx,a,"finance.vouchers.view");
   const row=await this.approved(tx,a,target,expected);
   const f=(await tx.query<Allocation>("SELECT f.* FROM assistance_fulfillment f JOIN assistance_delivery_event d ON d.root_realm_id=f.root_realm_id AND d.fulfillment_id=f.id AND d.action='PAID' WHERE f.root_realm_id=$1 AND f.assistance_id=$2 AND f.id=$3 AND f.action='PAYMENT' FOR SHARE OF f",[a.realmId,row.id,allocation])).rows[0];
   if(!f||!f.voucher_ref||!f.amount_minor)throw conflict();
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG06-RECOVERY:"+a.realmId+":"+a.accountId+":"+key]);
   const prior=(await tx.query<{fulfillment_id:string;request_digest:string;voucher_ref:string}>("SELECT fulfillment_id,request_digest,voucher_ref FROM assistance_recovery WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.fulfillment_id!==allocation||prior.request_digest!==hash)throw conflict();return {voucherRef:prior.voucher_ref,status:"RECOVERY_PENDING",replayed:true};}
   if((await tx.query("SELECT 1 FROM assistance_recovery r JOIN finance_voucher v ON v.root_realm_id=r.root_realm_id AND v.id=r.voucher_ref WHERE r.root_realm_id=$1 AND r.fulfillment_id=$2 AND v.status NOT IN(\'RETURNED\',\'REJECTED\')",[a.realmId,f.id])).rowCount)throw conflict();
   const voucher=await this.finance.prepareAidRecovery(tx,a,{key,originalVoucher:f.voucher_ref,branch:row.branch_ref,year,date,minor:f.amount_minor,reference:row.reference});
   await tx.query("INSERT INTO assistance_recovery(root_realm_id,assistance_id,fulfillment_id,voucher_ref,voucher_revision,actor_ref,request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[a.realmId,row.id,f.id,voucher.voucherRef,voucher.version,a.accountId,key,hash]);
   return {voucherRef:voucher.voucherRef,voucherNumber:voucher.voucherNumber,status:"RECOVERY_PENDING",replayed:false};
  });
 }
 async confirmRecovery(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision","fulfillmentRef","proofRef","proofVersion","handoverConfirmed"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),allocation=ref(x.fulfillmentRef),proof=ref(x.proofRef),pv=revision(x.proofVersion),target=ref(id),hash=aidDigest([target,"RECOVERY",expected,allocation,proof,pv,true]);
  if(x.handoverConfirmed!==true)throw conflict();
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"finance.vouchers.view");
   const row=await this.approved(tx,a,target,expected);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG06-HANDOVER:"+a.realmId+":"+a.accountId+":"+key]);
   const prior=(await tx.query<{request_digest:string;assistance_id:string;fulfillment_id:string;action:string}>("SELECT request_digest,assistance_id,fulfillment_id,action FROM assistance_delivery_event WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==hash||prior.assistance_id!==row.id||prior.fulfillment_id!==allocation||prior.action!=="REVERSED")throw conflict();return {status:"REVERSED",replayed:true};}
   const recovery=(await tx.query<{created_at:Date;journal_ref:string|null}>("SELECT r.created_at,cg06_recovery_journal(r.root_realm_id,r.fulfillment_id) AS journal_ref FROM assistance_recovery r JOIN finance_voucher v ON v.root_realm_id=r.root_realm_id AND v.id=r.voucher_ref AND v.status=\'POSTED\' WHERE r.root_realm_id=$1 AND r.assistance_id=$2 AND r.fulfillment_id=$3 FOR SHARE OF r,v",[a.realmId,row.id,allocation])).rows[0];
   if(!recovery?.journal_ref)throw new ConflictException("Original approved recovery is not posted and verified");
   const file=await this.evidence.guardAssistanceProof(tx,a,row.beneficiary_id,proof,pv,recovery.created_at);
   await tx.query("INSERT INTO assistance_delivery_event(root_realm_id,assistance_id,fulfillment_id,actor_ref,action,request_key,request_digest,journal_ref,proof_ref,proof_revision,proof_source_revision,beneficiary_id) VALUES($1,$2,$3,$4,'REVERSED',$5,$6,$7,$8,$9,$10,$11)",[a.realmId,row.id,allocation,a.accountId,key,hash,recovery.journal_ref,file.ref,file.revision,file.sourceRevision,row.beneficiary_id]);
   return {status:"REVERSED",replayed:false};
  });
 }
 async list(token:string,id:string){
  return this.source.run(token,"beneficiaries.assistance.view",async(tx,a)=>{
   const row=await this.source.guard(tx,a,id);
   // One bounded owner-backed projection instead of per-allocation queries.
   const allocations=(await tx.query(`SELECT f.id AS ref,f.action,f.quantity::text,f.amount_minor::text AS "amountMinor",
    f.stock_operation_ref AS "stockOperationRef",f.voucher_ref AS "voucherRef",f.created_at AS "createdAt",f.actor_ref=$3 AS own,
    l.delivery_proof_required AS "proofRequired",COALESCE(e.event_no,v.voucher_number) AS "ownerReference",
    CASE WHEN rv.status NOT IN('RETURNED','REJECTED') THEN rv.voucher_number END AS "recoveryVoucherNumber",rv.status AS "recoveryStatus",r.created_at AS "recoveryCreatedAt",CASE WHEN r.fulfillment_id IS NOT NULL THEN cg06_recovery_journal(f.root_realm_id,f.id) IS NOT NULL ELSE false END AS "recoveryVerified",d.at AS "confirmedAt",CASE WHEN d.action IS NOT NULL THEN d.action WHEN e.id IS NOT NULL THEN CASE WHEN f.action='ISSUE' THEN 'ISSUED_AWAITING_HANDOVER' ELSE 'RETURN_AWAITING_CONFIRMATION' END
    WHEN v.status='POSTED' AND j.id IS NOT NULL AND pay.id IS NOT NULL THEN 'PAID_AWAITING_HANDOVER' WHEN v.status IN('RETURNED','REJECTED') THEN 'PAYMENT_NOT_APPROVED' WHEN f.action='PAYMENT' THEN 'PENDING_PAYMENT' ELSE 'PENDING_STOCK' END AS status
    FROM assistance_fulfillment f LEFT JOIN stock_operation_draft o ON o.root_realm_id=f.root_realm_id AND o.id=f.stock_operation_ref
    LEFT JOIN inventory_location l ON l.root_realm_id=o.root_realm_id AND l.id=o.location_id
    LEFT JOIN stock_event e ON e.root_realm_id=o.root_realm_id AND e.operation_id=o.id AND e.event_kind=f.action AND o.status='CONFIRMED' AND EXISTS(SELECT 1 FROM stock_movement m WHERE m.root_realm_id=e.root_realm_id AND m.stock_event_id=e.id AND m.item_id=o.item_id AND m.location_id=o.location_id AND m.event_kind=f.action AND m.signed_qty=CASE WHEN f.action='ISSUE' THEN -f.quantity ELSE f.quantity END)
    LEFT JOIN finance_voucher v ON v.root_realm_id=f.root_realm_id AND v.id=f.voucher_ref AND v.version=f.voucher_revision
    LEFT JOIN finance_voucher_posting p ON p.root_realm_id=v.root_realm_id AND p.voucher_id=v.id AND p.voucher_revision=v.version
    LEFT JOIN journal j ON j.root_realm_id=p.root_realm_id AND j.id=p.journal_id AND j.status='POSTED' AND j.posting_kind='VOUCHER'
    LEFT JOIN finance_voucher_payment_verification pay ON pay.root_realm_id=v.root_realm_id AND pay.voucher_id=v.id AND pay.voucher_revision=v.version AND pay.status='VERIFIED' AND pay.amount_minor=f.amount_minor
    LEFT JOIN LATERAL(SELECT x.* FROM assistance_recovery x WHERE x.root_realm_id=f.root_realm_id AND x.fulfillment_id=f.id ORDER BY x.created_at DESC,x.voucher_ref DESC LIMIT 1) r ON true LEFT JOIN finance_voucher rv ON rv.root_realm_id=r.root_realm_id AND rv.id=r.voucher_ref
    LEFT JOIN LATERAL(SELECT action,at FROM assistance_delivery_event d WHERE d.root_realm_id=f.root_realm_id AND d.fulfillment_id=f.id ORDER BY at DESC,id DESC LIMIT 1)d ON true
    WHERE f.root_realm_id=$1 AND f.assistance_id=$2 ORDER BY f.created_at DESC,f.id DESC LIMIT 101`,[a.realmId,row.id,a.accountId])).rows;
   const totals=(await tx.query<{grossQuantity:string;returnedQuantity:string;paidMinor:string;reversedMinor:string;netQuantity:string;netMinor:string;status:string}>(`WITH totals AS (
    SELECT COALESCE(sum(f.quantity) FILTER(WHERE d.action='DELIVERED'),0) AS gross,COALESCE(sum(f.quantity) FILTER(WHERE d.action='RETURNED'),0) AS returned,
    COALESCE(sum(f.amount_minor) FILTER(WHERE d.action='PAID'),0) AS paid,COALESCE(sum(f.amount_minor) FILTER(WHERE d.action='REVERSED'),0) AS reversed
    FROM assistance_delivery_event d JOIN assistance_fulfillment f ON f.root_realm_id=d.root_realm_id AND f.id=d.fulfillment_id WHERE d.root_realm_id=$1 AND d.assistance_id=$2)
    SELECT gross::text AS "grossQuantity",returned::text AS "returnedQuantity",paid::text AS "paidMinor",reversed::text AS "reversedMinor",(gross-returned)::text AS "netQuantity",(paid-reversed)::text AS "netMinor",
    CASE WHEN $3='MATERIAL' AND gross>0 THEN CASE WHEN gross=returned THEN 'RETURNED' WHEN gross-returned=$4::numeric THEN 'DELIVERED' ELSE 'PARTIALLY_DELIVERED' END
    WHEN $3='FINANCIAL' AND paid>0 THEN CASE WHEN paid=reversed THEN 'REVERSED' WHEN paid-reversed=$5::bigint THEN 'PAID' ELSE 'PARTIALLY_PAID' END ELSE $6 END AS status FROM totals`,[a.realmId,row.id,row.kind,row.requested_qty,row.requested_minor,row.state])).rows[0];
   return {items:allocations.slice(0,100),totals,hasMore:allocations.length>100};
  },true);
 }
 async confirm(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision","fulfillmentRef","proofRef","proofVersion","handoverConfirmed"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),allocation=ref(x.fulfillmentRef),proof=ref(x.proofRef),pv=revision(x.proofVersion),target=ref(id);
  if(x.handoverConfirmed!==true)throw conflict();
  const hash=aidDigest([target,expected,allocation,proof,pv,true]);
  return this.source.run(token,"beneficiaries.assistance.deliver",async(tx,a)=>{
   const row=await this.approved(tx,a,target,expected);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG06-HANDOVER:"+a.realmId+":"+a.accountId+":"+key]);
   const prior=(await tx.query<{request_digest:string;assistance_id:string;fulfillment_id:string;action:string}>("SELECT request_digest,assistance_id,fulfillment_id,action FROM assistance_delivery_event WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==hash||prior.assistance_id!==target||prior.fulfillment_id!==allocation)throw conflict();return {status:prior.action,replayed:true};}
   const f=(await tx.query<Allocation>("SELECT * FROM assistance_fulfillment WHERE root_realm_id=$1 AND assistance_id=$2 AND id=$3 FOR SHARE",[a.realmId,row.id,allocation])).rows[0];
   if(!f)throw new NotFoundException("Assistance delivery unavailable");
   if(f.action!=="RETURN")await this.source.context(tx,a,row.branch_ref,row.project_ref,row.activity_ref,row.visit_ref,row.campaign_ref);
   // The actual original owner result and a separate clean handover document are
   // required. Neither an approved request nor an issued staff item is delivered.
   const stock=f.action==="PAYMENT"?null:await this.stockProof(tx,a,f);
   const money=f.action==="PAYMENT"?await this.moneyProof(tx,a,f):null;
   if(!stock&&!money)throw new ConflictException("Original stock or verified posted payment is not yet confirmed");
   const file=await this.evidence.guardAssistanceProof(tx,a,row.beneficiary_id,proof,pv,f.created_at);
   const action=f.action==="ISSUE"?"DELIVERED":f.action==="RETURN"?"RETURNED":"PAID";
   await tx.query("INSERT INTO assistance_delivery_event(root_realm_id,assistance_id,fulfillment_id,actor_ref,action,request_key,request_digest,stock_event_ref,journal_ref,proof_ref,proof_revision,proof_source_revision,beneficiary_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",[a.realmId,row.id,f.id,a.accountId,action,key,hash,stock?.id??null,money?.id??null,file.ref,file.revision,file.sourceRevision,row.beneficiary_id]);
   return {status:action,replayed:false};
  });
 }
}
