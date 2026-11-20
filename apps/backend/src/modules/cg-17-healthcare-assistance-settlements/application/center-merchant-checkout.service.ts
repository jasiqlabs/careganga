import {BadRequestException,ConflictException,ForbiddenException,
 Inject,Injectable,NotFoundException,ServiceUnavailableException}
 from "@nestjs/common";
import {createHash,createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {ConsultationChargeSourceFacade}
 from "../../cg-15-patients-appointments/application/consultation-charge-source.facade";
import {CenterMerchantProvisioningService,type CenterMerchantSecret,type Binding}
 from "./center-merchant-provisioning.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ORDER=/^order_[A-Za-z0-9]{8,60}$/,PAY=/^pay_[A-Za-z0-9]{8,60}$/,
 REFUND=/^rfnd_[A-Za-z0-9]{8,60}$/;
const money=(s:unknown)=>typeof s==="string"&&/^[1-9][0-9]{0,10}$/.test(s)&&
 BigInt(s)<=10000000000n;
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CENTER_PAYMENT_REFERENCE_INVALID"});
 return v;
};
type Charge={id:string;root_realm_id:string;center_ref:string;
 source_ref:string;patient_ref:string;due_minor:string;
 source_digest:string;currency:string;charge_state:string};
type Attempt={id:string;root_realm_id:string;center_ref:string;
 charge_ref:string;binding_ref:string;order_receipt:string;
 external_order_ref:string|null;amount_minor:string;currency:string;
 status:string;provider_payment_ref:string|null;accepted_by_account:string;
 request_key:string;request_digest:string;created_at:Date};
type ProviderOrder={id:string;amount:number;currency:string;receipt:string;
 status:string;amount_paid?:number};
type ProviderPayment={id:string;order_id:string;amount:number;
 currency:string;status:string;method:string;captured:boolean};
type ProviderRefund={id:string;payment_id:string;amount:number;status:string};
type Event={event:string;payload?:{
 payment?:{entity?:{id?:unknown;order_id?:unknown}};
 refund?:{entity?:{id?:unknown;payment_id?:unknown}}
}};
const auth=(cred:CenterMerchantSecret)=>
 "Basic "+Buffer.from(cred.keyId+":"+cred.keySecret).toString("base64");
const providerGet=async<T>(url:string,credential:CenterMerchantSecret)=>{
 try{
  const response=await fetch("https://api.razorpay.com/v1/"+url,{
   headers:{Authorization:auth(credential)},signal:AbortSignal.timeout(8000)});
  if(!response.ok||Number(response.headers.get("content-length")||0)>24000)
   throw Error("Provider lookup rejected");
  return await response.json() as T;
 }catch{throw new ServiceUnavailableException({
  code:"CENTER_PAYMENT_PROVIDER_UNAVAILABLE"});}
};
const display=(a:Attempt,keyId:string)=>({
 attemptRef:a.id,chargeRef:a.charge_ref,centerRef:a.center_ref,
 state:a.status,checkoutAvailable:a.status==="PENDING",
 provider:"RAZORPAY" as const,
 orderRef:a.status==="PENDING"?a.external_order_ref:null,
 publicKeyId:a.status==="PENDING"?keyId:null,
 amountMinor:a.amount_minor,currency:"INR" as const,
 collected:a.status==="CONFIRMED",
 message:a.status==="UNKNOWN"||a.status==="INITIALIZING"?
  "Provider result uncertain. Check original payment; do not start a second order.":
  a.status==="PENDING"?"Checkout opened; payment is not yet confirmed.":
  a.status==="CONFIRMED"?"Actual provider capture confirmed.":"No verified payment"
});
@Injectable()
export class CenterMerchantCheckoutService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly scope:HealthCenterSupportScopeFacade,
  private readonly cg15:ConsultationChargeSourceFacade,
  private readonly merchants:CenterMerchantProvisioningService){}
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>){
  const c=await this.pool.connect();let open=false;
  try{await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='14s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await fn(c);await c.query("COMMIT");open=false;return value;
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
      (e.code==="23505"||e.code==="23P01"))
    throw new ConflictException({code:"CENTER_PAYMENT_ALREADY_PENDING"});
   throw e;
  }finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,center:string|undefined,
  action:"view"|"start"){
  if(center){
   const required=action==="view"?
    "healthcare.assistance.collections.view":
    "healthcare.assistance.collections.record";
   const a=await this.sessions.requireAction(token,required);
   await this.scope.assertCurrent(c,a,center,required);
   return a;
  }
  const a=await this.sessions.verifySession(token);
  await this.identity.assertPatientSessionCurrent(c,a);
  return a;
 }
 private async original(c:PoolClient,root:string,booking:string){
  const charge=await c.query<Charge>(
   "SELECT id,root_realm_id,center_ref,source_ref,patient_ref,"+
   "due_minor::text,source_digest,currency,charge_state "+
   "FROM patient_charge WHERE root_realm_id=$1 AND source_ref=$2 "+
   "AND source_kind='CG15_CONSULTATION' AND line_ref='CONSULTATION' "+
   "AND charge_state='ACCEPTED' FOR SHARE",[root,booking]);
  const row=charge.rows[0];
  if(!row||row.currency!=="INR")
   throw new NotFoundException({code:"CENTER_PAYMENT_CHARGE_UNAVAILABLE"});
  return row;
 }
 private async remaining(c:PoolClient,root:string,ref:string){
  const [col,refunded]=await Promise.all([
   c.query<{total:string}>(
    "SELECT COALESCE(SUM(amount_minor),0)::text AS total "+
    "FROM center_collection WHERE root_realm_id=$1 AND charge_ref=$2 "+
    "AND verification_state IN('VERIFIED_CASH','VERIFIED_PROVIDER')",
    [root,ref]),
   c.query<{total:string}>(
    "SELECT COALESCE(SUM(refund_minor),0)::text AS total "+
    "FROM center_collection_adjustment WHERE root_realm_id=$1 AND charge_ref=$2",
    [root,ref])]);
  const paid=BigInt(col.rows[0].total)-BigInt(refunded.rows[0].total);
  if(paid<0n)throw new ConflictException({code:"CENTER_PAYMENT_LEDGER_INCONSISTENT"});
  return paid;
 }
 async current(token:string,rawBooking:string,rawCenter?:string){
  const booking=id(rawBooking),center=rawCenter? id(rawCenter):undefined;
  return this.tx(async c=>{
   const a=await this.actor(c,token,center,"view");
   const source=await this.cg15.booking(c,a,booking,center,true);
   const charge=await this.original(c,a.realmId,booking);
   if(charge.center_ref!==source.centerRef||charge.patient_ref!==source.patientRef)
    throw new ConflictException({code:"CENTER_PAYMENT_SOURCE_CHANGED"});
   const pending=await c.query<Attempt>(
    "SELECT *,amount_minor::text FROM center_payment_attempt "+
    "WHERE root_realm_id=$1 AND charge_ref=$2 "+
    "ORDER BY created_at DESC,id DESC LIMIT 1",[a.realmId,charge.id]);
   const recorded=pending.rows[0];
   if(!recorded)return {onlineAvailable:false,
    reason:"NO_ORDER_YET",patientPayableMinor:charge.due_minor,
    paidMinor:(await this.remaining(c,a.realmId,charge.id)).toString()};
   let keyId="";
   try{
    const proof=await this.merchants.verified(c,a.realmId,charge.center_ref);
    if(proof.binding.id===recorded.binding_ref)keyId=proof.credentials.keyId;
   }catch{}
   return {...display(recorded,keyId),
    checkoutAvailable:recorded.status==="PENDING"&&!!keyId,
    paidMinor:(await this.remaining(c,a.realmId,charge.id)).toString()};
  });
 }
 async start(token:string,rawBooking:string,raw:unknown,rawCenter?:string){
  const booking=id(rawBooking),center=rawCenter?id(rawCenter):undefined;
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>k!=="requestKey"))
   throw new BadRequestException({code:"CENTER_PAYMENT_REQUEST_INVALID"});
  const requestKey=id((raw as {requestKey?:unknown}).requestKey);
  const inputHash=sha(["CG17_CENTER_RAZORPAY_V1",booking,center??"PATIENT"]);
  const setup=await this.tx(async c=>{
   const actor=await this.actor(c,token,center,"start");
   const source=await this.cg15.booking(c,actor,booking,center,false);
   const charge=await this.original(c,actor.realmId,booking);
   if(charge.center_ref!==source.centerRef||
      charge.patient_ref!==source.patientRef)
    throw new ConflictException({code:"CENTER_PAYMENT_SOURCE_CHANGED"});
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":CG17_CENTER_COLLECTION:"+charge.id]);
   const existing=await c.query<Attempt>(
    "SELECT *,amount_minor::text FROM center_payment_attempt "+
    "WHERE root_realm_id=$1 AND accepted_by_account=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,requestKey]);
   if(existing.rows[0]){
    const row=existing.rows[0];
    if(row.charge_ref!==charge.id||row.request_digest!==inputHash)
     throw new ConflictException({code:"CENTER_PAYMENT_REQUEST_KEY_CONFLICT"});
    let visibleKey="";
    try{
     const v=await this.merchants.verified(c,actor.realmId,charge.center_ref);
     if(v.binding.id===row.binding_ref)visibleKey=v.credentials.keyId;
    }catch{}
    return {replay:display(row,visibleKey),pending:false} as const;
   }
   const merchant=await this.merchants.verified(c,actor.realmId,charge.center_ref,true);
   const paid=await this.remaining(c,actor.realmId,charge.id);
   const remaining=BigInt(charge.due_minor)-paid;
   if(remaining<=0n)
    throw new ConflictException({code:"CENTER_PAYMENT_ALREADY_COLLECTED"});
   const attemptId=randomUUID(),receipt="cg17_"+attemptId.replaceAll("-","");
   const row=await c.query<Attempt>(
    "INSERT INTO center_payment_attempt(id,root_realm_id,center_ref,"+
    "charge_ref,binding_ref,order_receipt,amount_minor,"+
    "accepted_by_account,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *,amount_minor::text",
    [attemptId,actor.realmId,charge.center_ref,charge.id,
     merchant.binding.id,receipt,remaining.toString(),
     actor.accountId,requestKey,inputHash]);
   return {pending:true,attempt:row.rows[0],
    credentials:merchant.credentials} as const;
  });
  if(!setup.pending)return setup.replay;
  const {attempt,credentials}=setup;
  let result:ProviderOrder|null=null,definitiveFailure=false;
  try{
   const res=await fetch("https://api.razorpay.com/v1/orders",{
    method:"POST",headers:{Authorization:auth(credentials),
     "Content-Type":"application/json"},
    body:JSON.stringify({
     amount:Number(attempt.amount_minor),currency:"INR",
     receipt:attempt.order_receipt,
     notes:{cg17_attempt:attempt.id,cg17_center:attempt.center_ref}}),
    signal:AbortSignal.timeout(9000)});
   if(res.status>=400&&res.status<500)definitiveFailure=true;
   if(res.ok){
    const body:unknown=await res.json();
    if(body&&typeof body==="object"&&!Array.isArray(body)){
     const v=body as Partial<ProviderOrder>;
     if(typeof v.id==="string"&&ORDER.test(v.id)&&
       v.amount===Number(attempt.amount_minor)&&
       v.currency==="INR"&&v.receipt===attempt.order_receipt&&
       v.status==="created")result=v as ProviderOrder;
    }
   }
  }catch{/* Never create a new order when provider result was unknown. */}
  return this.tx(async c=>{
   const row=await c.query<Attempt>(
    "SELECT *,amount_minor::text FROM center_payment_attempt "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [attempt.root_realm_id,attempt.id]);
   const current=row.rows[0];
   if(!current||current.status!=="INITIALIZING")
    throw new ConflictException({code:"CENTER_PAYMENT_STATUS_CHANGED"});
   let enabled=false;
   try{
    const v=await this.merchants.verified(c,current.root_realm_id,current.center_ref);
    enabled=v.binding.id===current.binding_ref;
   }catch{}
   const status=result&&enabled?"PENDING":
    definitiveFailure?"FAILED":"UNKNOWN";
   const saved=await c.query<Attempt>(
    "UPDATE center_payment_attempt SET status=$3,external_order_ref=$4,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND status='INITIALIZING' RETURNING *,amount_minor::text",
    [attempt.root_realm_id,attempt.id,status,result?.id??null]);
   if(!saved.rows[0])
    throw new ConflictException({code:"CENTER_PAYMENT_STATUS_CHANGED"});
   return {...display(saved.rows[0],enabled?credentials.keyId:""),
    checkoutAvailable:status==="PENDING",
    uncertain:status==="UNKNOWN"};
  });
 }
 /** Only a verified provider HMAC and a fresh authenticated server lookup
  * can mark money collected. Browser redirect, checkout signature and typed
  * reference are not proof of captured payment.
  */
 async webhook(centerRaw:string,raw:Buffer|undefined,signature:unknown,
  eventRaw:unknown){
  const center=id(centerRaw);
  if(!Buffer.isBuffer(raw)||raw.length<3||raw.length>24000||
    typeof signature!=="string"||!/^[a-f0-9]{64}$/i.test(signature)||
    typeof eventRaw!=="string"||!/^[A-Za-z0-9_-]{6,128}$/.test(eventRaw))
   throw new BadRequestException({code:"CENTER_PAYMENT_WEBHOOK_INVALID"});
  const credentials=this.merchants.secrets(center);
  if(!credentials)throw new ForbiddenException({code:"CENTER_MERCHANT_NOT_VERIFIED"});
  const expected=createHmac("sha256",credentials.webhookSecret).update(raw).digest();
  const provided=Buffer.from(signature,"hex");
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))
   throw new ForbiddenException({code:"CENTER_PAYMENT_WEBHOOK_SIGNATURE_INVALID"});
  let payload:Event;
  try{payload=JSON.parse(raw.toString("utf8")) as Event;}
  catch{throw new BadRequestException({code:"CENTER_PAYMENT_WEBHOOK_INVALID"});}
  const event=payload?.event;
  if(typeof event!=="string"||event.length>64)
   throw new BadRequestException({code:"CENTER_PAYMENT_WEBHOOK_INVALID"});
  const digest=createHash("sha256").update(raw).digest("hex");
  // No trust in webhook amount/paid fields: fetch current provider source.
  if(event!=="payment.captured"&&event!=="refund.processed")
   return {received:true,recorded:false,confirmed:false};
  const paymentId=event==="payment.captured"?
   payload.payload?.payment?.entity?.id:
   payload.payload?.refund?.entity?.payment_id;
  const refundId=event==="refund.processed"?
   payload.payload?.refund?.entity?.id:null;
  if(typeof paymentId!=="string"||!PAY.test(paymentId)||
    event==="refund.processed"&&(typeof refundId!=="string"||!REFUND.test(refundId)))
   throw new BadRequestException({code:"CENTER_PAYMENT_WEBHOOK_INVALID"});
  const payment=await providerGet<ProviderPayment>(
   "payments/"+encodeURIComponent(paymentId),credentials);
  if(payment.id!==paymentId||payment.status!=="captured"||
     payment.captured!==true||!ORDER.test(payment.order_id)||
     payment.currency!=="INR"||!Number.isSafeInteger(payment.amount)||
     payment.amount<=0)
   throw new ConflictException({code:"CENTER_PAYMENT_NOT_CAPTURED"});
  const order=await providerGet<ProviderOrder>(
   "orders/"+encodeURIComponent(payment.order_id),credentials);
  if(order.id!==payment.order_id||order.currency!=="INR"||
    !Number.isSafeInteger(order.amount)||order.amount!==payment.amount||
    typeof order.receipt!=="string"||!/^cg17_[a-f0-9]{32}$/.test(order.receipt))
   throw new ConflictException({code:"CENTER_PAYMENT_ORDER_MISMATCH"});
  let refund:ProviderRefund|null=null;
  if(event==="refund.processed"){
   refund=await providerGet<ProviderRefund>(
    "refunds/"+encodeURIComponent(refundId as string),credentials);
   if(refund.id!==refundId||refund.payment_id!==paymentId||
     refund.status!=="processed"||!Number.isSafeInteger(refund.amount)||
     refund.amount<=0||refund.amount>payment.amount)
    throw new ConflictException({code:"CENTER_PAYMENT_REFUND_UNVERIFIED"});
  }
  return this.tx(async c=>{
   const binding=await c.query<Binding>(
    "SELECT * FROM center_merchant_binding WHERE center_ref=$1 "+
    "AND provider='RAZORPAY' AND public_key_id=$2 "+
    "AND provider_merchant_ref=$3 AND verification_state='VERIFIED' "+
    "AND revoked_at IS NULL FOR SHARE",
    [center,credentials.keyId,credentials.merchantRef]);
   const m=binding.rows[0];
   if(!m||m.original_proof_ref!==credentials.ownershipProof)
    throw new ForbiddenException({code:"CENTER_MERCHANT_NOT_VERIFIED"});
   const attemptQ=await c.query<Attempt>(
    "SELECT *,amount_minor::text FROM center_payment_attempt "+
    "WHERE root_realm_id=$1 AND center_ref=$2 AND binding_ref=$3 "+
    "AND order_receipt=$4",[m.root_realm_id,center,m.id,order.receipt]);
   const attempt=attemptQ.rows[0];
   if(!attempt||BigInt(attempt.amount_minor)!==BigInt(payment.amount))
    throw new ConflictException({code:"CENTER_PAYMENT_ATTEMPT_MISMATCH"});
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [m.root_realm_id+":CG17_CENTER_COLLECTION:"+attempt.charge_ref]);
   const locked=await c.query<Attempt>(
    "SELECT *,amount_minor::text FROM center_payment_attempt "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [m.root_realm_id,attempt.id]);
   const current=locked.rows[0];
   if(!current||current.binding_ref!==m.id||
     current.external_order_ref!==null&&
      current.external_order_ref!==order.id)
    throw new ConflictException({code:"CENTER_PAYMENT_ORDER_MISMATCH"});
   const duplicate=await c.query<{event_digest:string;result:string}>(
    "SELECT event_digest,result FROM cg17_merchant_event "+
    "WHERE root_realm_id=$1 AND binding_ref=$2 AND provider_event_ref=$3",
    [m.root_realm_id,m.id,eventRaw]);
   if(duplicate.rows[0]){
    if(duplicate.rows[0].event_digest!==digest)
     throw new ConflictException({code:"CENTER_PAYMENT_EVENT_TAMPERED"});
    return {received:true,recorded:true,
     confirmed:duplicate.rows[0].result==="VERIFIED_CAPTURE"};
   }
   const charge=await this.originalByRef(c,m.root_realm_id,center,
    current.charge_ref);
   if(event==="payment.captured"){
    if(!["INITIALIZING","PENDING","UNKNOWN","CONFIRMED"].includes(current.status))
     throw new ConflictException({code:"CENTER_PAYMENT_ATTEMPT_NOT_ALLOWED"});
    const existing=await c.query<{id:string;external_payment_ref:string}>(
     "SELECT id,external_payment_ref FROM center_collection "+
     "WHERE root_realm_id=$1 AND attempt_ref=$2 AND "+
     "verification_state='VERIFIED_PROVIDER'",
     [m.root_realm_id,current.id]);
    if(existing.rows[0]&&
       existing.rows[0].external_payment_ref!==paymentId)
     throw new ConflictException({code:"CENTER_PAYMENT_MULTIPLE_CAPTURE_CONFLICT"});
    if(!existing.rows[0]){
     const paid=await this.remaining(c,m.root_realm_id,charge.id);
     if(paid+BigInt(payment.amount)>BigInt(charge.due_minor))
      throw new ConflictException({code:"CENTER_PAYMENT_OVERPAYMENT_REVIEW"});
     const method=payment.method==="upi"?"UPI":
      payment.method==="card"?"CARD":
      payment.method==="netbanking"?"BANK":null;
     if(!method)throw new ConflictException({code:"CENTER_PAYMENT_METHOD_REVIEW"});
     const sourceDigest=sha(["CG17_CHARGE_COLLECTION_ORIGINAL",
      charge.id,charge.source_digest,charge.due_minor]);
     await c.query(
      "INSERT INTO center_collection(root_realm_id,center_ref,charge_ref,"+
      "method,amount_minor,verification_state,attempt_ref,"+
      "external_payment_ref,accepted_by_account,request_key,"+
      "request_digest,source_digest) "+
      "VALUES($1,$2,$3,$4,$5,'VERIFIED_PROVIDER',$6,$7,$8,$9,$10,$11)",
      [m.root_realm_id,center,charge.id,method,
       payment.amount,current.id,paymentId,current.accepted_by_account,
       current.id,sha(["CG17_RAZORPAY_CAPTURE",current.id,paymentId]),
       sourceDigest]);
    }
    await c.query(
     "UPDATE center_payment_attempt SET status='CONFIRMED',"+
     "external_order_ref=$3,provider_payment_ref=$4,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2",
     [m.root_realm_id,current.id,order.id,paymentId]);
    await c.query("INSERT INTO cg17_merchant_event(root_realm_id,binding_ref,"+
     "attempt_ref,provider_event_ref,event_kind,event_digest,result) "+
     "VALUES($1,$2,$3,$4,$5,$6,'VERIFIED_CAPTURE')",
     [m.root_realm_id,m.id,current.id,eventRaw,event,digest]);
    return {received:true,recorded:true,confirmed:true};
   }
   // Refund has separate immutable evidence; no client-entered refund proof.
   const capture=await c.query<{id:string;amount_minor:string}>(
    "SELECT id,amount_minor::text FROM center_collection "+
    "WHERE root_realm_id=$1 AND attempt_ref=$2 "+
    "AND external_payment_ref=$3 AND verification_state='VERIFIED_PROVIDER'",
    [m.root_realm_id,current.id,paymentId]);
   if(!capture.rows[0])
    throw new ConflictException({code:"CENTER_PAYMENT_CAPTURE_NOT_RECORDED"});
   const prior=await c.query<{total:string}>(
    "SELECT COALESCE(SUM(refund_minor),0)::text AS total "+
    "FROM center_collection_adjustment WHERE root_realm_id=$1 "+
    "AND collection_ref=$2",
    [m.root_realm_id,capture.rows[0].id]);
   if(BigInt(prior.rows[0].total)+BigInt(refund!.amount)>
      BigInt(capture.rows[0].amount_minor))
    throw new ConflictException({code:"CENTER_PAYMENT_REFUND_OVERFLOW"});
   await c.query(
    "INSERT INTO center_collection_adjustment(root_realm_id,collection_ref,"+
    "charge_ref,kind,refund_minor,reason,verified_by_account,"+
    "request_key,request_digest,provider_refund_ref,provider_verified_at) "+
    "VALUES($1,$2,$3,'PROVIDER_REFUND',$4,"+
    "'Confirmed provider refund',NULL,$5,$6,$7,now())",
    [m.root_realm_id,capture.rows[0].id,current.charge_ref,
     refund!.amount,randomUUID(),sha(["CG17_PROVIDER_REFUND",
      current.id,refund!.id,refund!.amount]),refund!.id]);
   await c.query("INSERT INTO cg17_merchant_event(root_realm_id,binding_ref,"+
    "attempt_ref,provider_event_ref,event_kind,event_digest,result) "+
    "VALUES($1,$2,$3,$4,$5,$6,'IGNORED')",
    [m.root_realm_id,m.id,current.id,eventRaw,event,digest]);
   return {received:true,recorded:true,confirmed:false,refunded:true};
  });
 }
 private async originalByRef(c:PoolClient,root:string,center:string,ref:string){
  const res=await c.query<Charge>(
   "SELECT id,root_realm_id,center_ref,source_ref,patient_ref,"+
   "due_minor::text,source_digest,currency,charge_state "+
   "FROM patient_charge WHERE root_realm_id=$1 AND center_ref=$2 "+
   "AND id=$3 AND charge_state='ACCEPTED' FOR SHARE",
   [root,center,ref]);
  if(!res.rows[0]||res.rows[0].currency!=="INR")
   throw new ConflictException({code:"CENTER_PAYMENT_CHARGE_UNAVAILABLE"});
  return res.rows[0];
 }
}
