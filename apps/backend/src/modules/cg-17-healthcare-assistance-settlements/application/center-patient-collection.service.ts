import {BadRequestException,ConflictException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {ConsultationPatientChargeService}
 from "./consultation-patient-charge.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MONEY=/^[1-9][0-9]{0,10}$/;
const RECEIPT=/^[A-Za-z0-9][A-Za-z0-9/_-]{3,59}$/;
const SHA=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CENTER_COLLECTION_REFERENCE_INVALID"});
 return v;
};
const body=(input:unknown,keys:string[])=>{
 if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).some(x=>!keys.includes(x)))
  throw new BadRequestException({code:"CENTER_COLLECTION_DETAILS_INVALID"});
 return input as Record<string,unknown>;
};
const value=(v:unknown)=>{
 if(typeof v!=="string"||!MONEY.test(v)||BigInt(v)>10000000000n)
  throw new BadRequestException({code:"CENTER_COLLECTION_AMOUNT_INVALID"});
 return v;
};
type Charge={id:string;due_minor:string;center_ref:string;patient_ref:string;
 source_digest:string;
 charge_state:string;currency:string};
type Collection={id:string;charge_ref:string;center_ref:string;
 method:"CASH"|"UPI"|"CARD"|"BANK";amount_minor:string;
 verification_state:"VERIFIED_CASH"|"PENDING_EXTERNAL"|"VERIFIED_PROVIDER"|"REJECTED";
 cash_receipt_number:string|null;created_at:Date;accepted_by_account:string;
 request_key:string;request_digest:string;source_digest:string;
 receipt_pdf_state?:string|null;receipt_document_ref?:string|null};
type Adjustment={id:string;collection_ref:string;refund_minor:string;
 cash_refund_receipt:string;kind:"CASH_REFUND"|"CASH_CORRECTION";created_at:Date;
 verified_by_account:string;request_key:string;request_digest:string};
const view=(c:Collection)=>({
 collectionRef:c.id,method:c.method,amountMinor:c.amount_minor,
 state:c.verification_state,
 cashReceiptNumber:c.method==="CASH"?c.cash_receipt_number:null,
 recordedAt:c.created_at.toISOString(),
 receiptPdfState:c.verification_state==="VERIFIED_CASH"?
  c.receipt_pdf_state??"NOT_ISSUED":"NOT_ELIGIBLE",
 receiptDocumentRef:c.verification_state==="VERIFIED_CASH"&&
  c.receipt_pdf_state==="ISSUED"?c.receipt_document_ref??null:null
});
@Injectable()
export class CenterPatientCollectionService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly sessions:SessionService,
  private readonly scope:HealthCenterSupportScopeFacade,
  private readonly charges:ConsultationPatientChargeService){}
 private async tx<T>(perform:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.pool.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await perform(c);
   await c.query("COMMIT");open=false;return result;
  }catch(e){
   if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CENTER_COLLECTION_DUPLICATE_RECEIPT_OR_REQUEST"});
   throw e;
  }finally{c.release();}
 }
 private async actor(c:PoolClient,token:string,center:string,
  action:"healthcare.assistance.collections.view"|
   "healthcare.assistance.collections.record"|
   "healthcare.assistance.collections.refund"){
  const actor=await this.sessions.requireAction(token,action);
  await this.scope.assertCurrent(c,actor,center,action);
  return actor;
 }
 private async charge(c:PoolClient,realm:string,center:string,ref:string){
  const result=await c.query<Charge>(
   "SELECT id,center_ref,patient_ref,due_minor::text,source_digest,charge_state,currency "+
   "FROM patient_charge WHERE root_realm_id=$1 AND center_ref=$2 AND id=$3 "+
   "AND charge_state='ACCEPTED' FOR SHARE",
   [realm,center,ref]);
  if(!result.rows[0]||result.rows[0].currency!=="INR")
   throw new NotFoundException({code:"CENTER_COLLECTION_CHARGE_UNAVAILABLE"});
  return result.rows[0];
 }
 private async totals(c:PoolClient,realm:string,ref:string){
  const [amounts,refunds]=await Promise.all([
   c.query<{cash:string;provider:string;pending:string}>(
    "SELECT COALESCE(SUM(amount_minor) FILTER("+
    "WHERE verification_state='VERIFIED_CASH'),0)::text AS cash,"+
    "COALESCE(SUM(amount_minor) FILTER("+
    "WHERE verification_state='VERIFIED_PROVIDER'),0)::text AS provider,"+
    "COALESCE(SUM(amount_minor) FILTER("+
    "WHERE verification_state='PENDING_EXTERNAL'),0)::text AS pending "+
    "FROM center_collection WHERE root_realm_id=$1 AND charge_ref=$2",
    [realm,ref]),
   c.query<{reversed:string}>(
    "SELECT COALESCE(SUM(a.refund_minor),0)::text AS reversed "+
    "FROM center_collection_adjustment a JOIN center_collection collect "+
    "ON collect.root_realm_id=a.root_realm_id AND collect.id=a.collection_ref "+
    "AND collect.charge_ref=a.charge_ref "+
    "WHERE collect.root_realm_id=$1 AND collect.charge_ref=$2",
    [realm,ref])
  ]);
  const paid=BigInt(amounts.rows[0].cash)+BigInt(amounts.rows[0].provider)-
   BigInt(refunds.rows[0].reversed);
  if(paid<0n)throw new ConflictException({code:"CENTER_COLLECTION_LEDGER_INCONSISTENT"});
  return {collected:paid,pending:BigInt(amounts.rows[0].pending),
   reversed:BigInt(refunds.rows[0].reversed)};
 }
 private async statement(c:PoolClient,realm:string,original:Charge){
  const total=await this.totals(c,realm,original.id),due=BigInt(original.due_minor);
  if(total.collected>due)
   throw new ConflictException({code:"CENTER_COLLECTION_LEDGER_INCONSISTENT"});
  const rows=await c.query<Collection>(
   "SELECT collect.id,collect.charge_ref,collect.center_ref,collect.method,"+
   "collect.amount_minor::text,collect.verification_state,"+
   "collect.cash_receipt_number,collect.created_at,collect.accepted_by_account,"+
   "collect.request_key,collect.request_digest,collect.source_digest,"+
   "document.status AS receipt_pdf_state,"+
   "document.id AS receipt_document_ref FROM center_collection collect "+
   "LEFT JOIN cg19_center_patient_receipt_document document ON "+
   "document.root_realm_id=collect.root_realm_id AND "+
   "document.collection_ref=collect.id +
   "WHERE collect.root_realm_id=$1 AND collect.charge_ref=$2 "+
   "ORDER BY created_at DESC,id DESC LIMIT 51",[realm,original.id]);
  const collectionsHaveMore=rows.rows.length>50;
  const adjustments=await c.query<Adjustment>(
   "SELECT id,collection_ref,refund_minor::text,cash_refund_receipt,kind,"+
   "created_at,verified_by_account,request_key,request_digest "+
   "FROM center_collection_adjustment WHERE root_realm_id=$1 "+
   "AND charge_ref=$2 ORDER BY created_at DESC,id DESC LIMIT 51",
   [realm,original.id]);
  const adjustmentsHaveMore=adjustments.rows.length>50;
  return {chargeRef:original.id,centerRef:original.center_ref,currency:"INR" as const,
   patientDueMinor:original.due_minor,
   collectedMinor:total.collected.toString(),
   outstandingMinor:(due-total.collected).toString(),
   pendingElectronicMinor:total.pending.toString(),
   refundedOrCorrectedMinor:total.reversed.toString(),
   state:due===0n?"NOTHING_DUE":total.collected===due?"COLLECTED":
    total.collected>0n?"PARTIALLY_COLLECTED":"DUE",
   collections:rows.rows.slice(0,50).map(view),
   collectionsHaveMore,
   adjustments:adjustments.rows.slice(0,50).map(x=>({
    adjustmentRef:x.id,collectionRef:x.collection_ref,
    amountMinor:x.refund_minor,kind:x.kind,
    refundReceiptNumber:x.cash_refund_receipt,
    recordedAt:x.created_at.toISOString()})),
   adjustmentsHaveMore,
   foundationIncomeRecorded:false,foundationLiabilityCreated:false
  };
 }
 async centerStatement(token:string,centerRaw:string,chargeRaw:string){
  const center=id(centerRaw),ref=id(chargeRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token,center,"healthcare.assistance.collections.view");
   const source=await this.charge(c,a.realmId,center,ref);
   return this.statement(c,a.realmId,source);
  });
 }
 async patientStatement(token:string,bookingRaw:string){
  const booking=id(bookingRaw);
  // Reuse the verified CG15 patient booking/consent owner (via US002), not
  // a new account/phone/patient authorization or a public patient list.
  const charge=await this.charges.previewBooking(token,booking);
  if(!("accepted" in charge)||charge.accepted!==true||
    !("chargeRef" in charge)||typeof charge.chargeRef!=="string")
   return {state:"NO_ACCEPTED_CHARGE",foundationIncomeRecorded:false};
  const realmActor=await this.sessions.verifySession(token);
  return this.tx(async c=>{
   const original=await this.charge(c,realmActor.realmId,
    String(charge.centerRef),charge.chargeRef);
   const data=await this.statement(c,realmActor.realmId,original);
   return {...data,centerRef:undefined};
  });
 }
 async record(token:string,centerRaw:string,chargeRaw:string,raw:unknown){
  const center=id(centerRaw),ref=id(chargeRaw);
  const x=body(raw,["requestKey","method","amountMinor",
   "cashReceiptNumber","cashReceived","payerReference"]);
  const requestKey=id(x.requestKey),amountMinor=value(x.amountMinor);
  if(!["CASH","UPI","CARD","BANK"].includes(String(x.method)))
   throw new BadRequestException({code:"CENTER_COLLECTION_METHOD_INVALID"});
  const method=x.method as Collection["method"],cash=method==="CASH";
  const receipt=cash?x.cashReceiptNumber:null;
  if(cash&&(!RECEIPT.test(String(receipt))||x.cashReceived!==true)||
    !cash&&(x.cashReceived!==undefined||x.cashReceiptNumber!==undefined))
   throw new BadRequestException({code:"CENTER_COLLECTION_CASH_ATTESTATION_REQUIRED"});
  if(x.payerReference!==undefined&&(typeof x.payerReference!=="string"||
   x.payerReference.length>100||
   /[\u0000-\u001f\u007f]/.test(x.payerReference)))
   throw new BadRequestException({code:"CENTER_COLLECTION_REFERENCE_INVALID"});
  const evidence=x.payerReference??null;
  const hash=SHA(["CG17_CENTER_PAYMENT_V1",center,ref,method,amountMinor,
   receipt,evidence,Boolean(x.cashReceived)]);
  return this.tx(async c=>{
   const a=await this.actor(c,token,center,"healthcare.assistance.collections.record");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [a.realmId+":CG17_CENTER_COLLECTION:"+ref]);
   const original=await this.charge(c,a.realmId,center,ref);
   const prior=await c.query<Collection>(
    "SELECT *,amount_minor::text FROM center_collection "+
    "WHERE root_realm_id=$1 AND accepted_by_account=$2 AND request_key=$3",
    [a.realmId,a.accountId,requestKey]);
   if(prior.rows[0]){
    if(prior.rows[0].request_digest!==hash||prior.rows[0].charge_ref!==ref)
     throw new ConflictException({code:"CENTER_COLLECTION_REQUEST_CONFLICT"});
    return {...view(prior.rows[0]),replayed:true,
     statement:await this.statement(c,a.realmId,original)};
   }
   const totals=await this.totals(c,a.realmId,ref);
   const due=BigInt(original.due_minor);
   if(totals.collected+BigInt(amountMinor)>due)
    throw new ConflictException({code:"CENTER_COLLECTION_OVERPAYMENT"});
   if(!cash){
    const pending=await c.query<{count:string}>(
     "SELECT count(*)::text AS count FROM center_collection "+
     "WHERE root_realm_id=$1 AND charge_ref=$2 "+
     "AND verification_state='PENDING_EXTERNAL'",[a.realmId,ref]);
    if(Number(pending.rows[0].count)>=10)
     throw new ConflictException({code:"CENTER_COLLECTION_PENDING_PROOF_LIMIT"});
   }
   const state=cash?"VERIFIED_CASH":"PENDING_EXTERNAL";
   const saved=await c.query<Collection>(
    "INSERT INTO center_collection(root_realm_id,center_ref,charge_ref,"+
    "method,amount_minor,verification_state,cash_receipt_number,"+
    "payer_reference,cash_attested_at,accepted_by_account,request_key,"+
    "request_digest,source_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,"+
    "CASE WHEN $9::boolean THEN now() ELSE NULL END,$10,$11,$12,$13) "+
    "RETURNING *",
    [a.realmId,center,ref,method,amountMinor,state,receipt,evidence,cash,
     a.accountId,requestKey,hash,
     SHA(["CG17_CHARGE_COLLECTION_ORIGINAL",ref,original.source_digest,
      original.due_minor])]);
   return {...view(saved.rows[0]),replayed:false,
    statement:await this.statement(c,a.realmId,original),
    notice:cash?"Cash attestation recorded. Private receipt issuance "+
      "must be verified separately; Foundation was not paid.":
      "Electronic reference recorded pending independent provider proof. "+
      "No paid status or payment receipt was issued."};
  });
 }
 async refund(token:string,centerRaw:string,collectionRaw:string,raw:unknown){
  const center=id(centerRaw),collection=id(collectionRaw);
  const x=body(raw,["requestKey","refundMinor","refundReceiptNumber",
   "reason","kind","cashReturned"]);
  const requestKey=id(x.requestKey),refundMinor=value(x.refundMinor);
  const receipt=x.refundReceiptNumber,kind=x.kind;
  if(!RECEIPT.test(String(receipt))||!["CASH_REFUND","CASH_CORRECTION"].includes(String(kind))||
   x.cashReturned!==true||typeof x.reason!=="string"||
   x.reason.trim().length<8||x.reason.length>400||
   /[\u0000-\u001f\u007f]/.test(x.reason))
   throw new BadRequestException({code:"CENTER_COLLECTION_REFUND_PROOF_REQUIRED"});
  const hash=SHA(["CG17_CENTER_REFUND_V1",center,collection,kind,
   refundMinor,receipt,x.reason.trim(),true]);
  return this.tx(async c=>{
   const actor=await this.actor(c,token,center,"healthcare.assistance.collections.refund");
   const original=await c.query<Collection>(
    "SELECT *,amount_minor::text FROM center_collection "+
    "WHERE root_realm_id=$1 AND center_ref=$2 AND id=$3 AND method='CASH' "+
    "AND verification_state='VERIFIED_CASH'",[actor.realmId,center,collection]);
   const item=original.rows[0];
   if(!item)throw new NotFoundException({code:"CENTER_COLLECTION_REFUND_UNAVAILABLE"});
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":CG17_CENTER_COLLECTION:"+item.charge_ref]);
   const source=await this.charge(c,actor.realmId,center,item.charge_ref);
   const old=await c.query<Adjustment>(
    "SELECT * FROM center_collection_adjustment "+
    "WHERE root_realm_id=$1 AND verified_by_account=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,requestKey]);
   if(old.rows[0]){
    if(old.rows[0].request_digest!==hash||old.rows[0].collection_ref!==collection)
     throw new ConflictException({code:"CENTER_COLLECTION_REFUND_REQUEST_CONFLICT"});
    return {replayed:true,adjustmentRef:old.rows[0].id,
     statement:await this.statement(c,actor.realmId,source)};
   }
   const previous=await c.query<{refunded:string}>(
    "SELECT COALESCE(SUM(refund_minor),0)::text AS refunded "+
    "FROM center_collection_adjustment "+
    "WHERE root_realm_id=$1 AND collection_ref=$2",[actor.realmId,collection]);
   if(BigInt(previous.rows[0].refunded)+BigInt(refundMinor)>BigInt(item.amount_minor))
    throw new ConflictException({code:"CENTER_COLLECTION_REFUND_EXCEEDS_CASH"});
   const row=await c.query<{id:string}>(
    "INSERT INTO center_collection_adjustment(root_realm_id,collection_ref,"+
    "charge_ref,kind,refund_minor,cash_refund_receipt,reason,"+
    "verified_by_account,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    [actor.realmId,collection,item.charge_ref,kind,refundMinor,receipt,
     x.reason.trim(),actor.accountId,requestKey,hash]);
   return {replayed:false,adjustmentRef:row.rows[0].id,
    statement:await this.statement(c,actor.realmId,source),
    notice:"Original cash refund/correction recorded separately. "+
     "It does not reverse or pay any Foundation liability."};
  });
 }
}
