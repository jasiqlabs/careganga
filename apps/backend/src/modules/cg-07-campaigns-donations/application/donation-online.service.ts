import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException,UnauthorizedException} from "@nestjs/common";
import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {donationUuid} from "../domain/donation-input";
import {publicCampaignSources} from "./campaign-public-source";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=()=>new ConflictException("This payment request changed. Keep the same reference and check status.");
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Donation={id:string;root_realm_id:string;amount_minor:string;source_status:string;
 branch_ref:string|null;campaign_id:string|null;donation_number:string};
type Attempt={id:string;donation_id:string;status:string;request_key:string;source_digest:string;
 external_reference:string|null;checkout_url:string|null;merchant_reference:string|null;expires_at:Date|null};
type ProviderLink={id:string;reference_id:string;status:string;short_url?:string;
 amount:number;amount_paid?:number;currency:string;accept_partial?:boolean;expire_by?:number};
type Settings={id:string;key:string;secret:string;webhook:string};
const urlAllowed=(url:unknown):url is string=>{
 if(typeof url!=="string"||url.length>500)return false;
 try{const x=new URL(url);return x.protocol==="https:"&&x.hostname==="rzp.io"&&
  x.username===""&&x.password===""&&x.hash===""&&x.pathname.length>1;}
 catch{return false;}
};
function config():Settings{
 const id=process.env.CG07_RAZORPAY_KEY_ID??"",secret=process.env.CG07_RAZORPAY_KEY_SECRET??"",
  webhook=process.env.CG07_RAZORPAY_WEBHOOK_SECRET??"";
 if(!/^rzp_(live|test)_[A-Za-z0-9]{8,}$/.test(id)||secret.length<16||
    webhook.length<16||!process.env.CG07_RAZORPAY_SECRET_REF||
    (process.env.NODE_ENV==="production"&&!id.startsWith("rzp_live_")))
  throw new ServiceUnavailableException("Foundation online donations are not configured.");
 return {id,key:id,secret,webhook};
}
@Injectable()
export class DonationOnlineService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 private async tx<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");const x=await fn(tx);await tx.query("COMMIT");return x;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async merchant(tx:PoolClient,root:string){
  const c=config();
  const q=await tx.query<{id:string}>(
   "SELECT id FROM integration_connection WHERE foundation_realm_id=$1 "+
   "AND scope_kind='FOUNDATION' AND provider='razorpay' AND purpose='donations' "+
   "AND secret_reference=$2 AND verification_status='VERIFIED' "+
   "AND last_checked_credential_revision=credential_revision",
   [root,process.env.CG07_RAZORPAY_SECRET_REF]);
  if(q.rowCount!==1)throw new ServiceUnavailableException("The Foundation payment merchant is not verified.");
  return c;
 }
 private async provider(path:string,method:"GET"|"POST",body?:Record<string,unknown>){
  const c=config();
  const r=await fetch("https://api.razorpay.com/v1/payment_links"+path,{
   method,headers:{Authorization:"Basic "+Buffer.from(c.key+":"+c.secret).toString("base64"),
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined,cache:"no-store",
   signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new ServiceUnavailableException("Foundation payment provider result is unavailable.");
  const raw:unknown=await r.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw fail();
  return raw as Record<string,unknown>;
 }
 
 /** A provider timeout cannot justify another payment-link CREATE. */
 private async recover(attempt:Attempt,donation:Donation){
  const ref=attempt.id.replaceAll("-","");
  let list:Record<string,unknown>;
  try{list=await this.provider("?reference_id="+encodeURIComponent(ref),"GET");}
  catch{return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original provider outcome is uncertain; do not pay twice."};}
  if(!Array.isArray(list.items)||list.items.length!==1)
   return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original link is not yet confirmed by the merchant."};
  const link=list.items[0] as Record<string,unknown>;
  if(typeof link.id!=="string"||!/^plink_[A-Za-z0-9]{8,}$/.test(link.id)||
   link.reference_id!==ref||link.currency!=="INR"||
   link.amount!==Number(donation.amount_minor)||link.accept_partial!==false)
   return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original provider link details do not match."};
  const usable=["created","issued"].includes(String(link.status))&&urlAllowed(link.short_url);
  const settled=link.status==="paid"&&link.amount_paid===Number(donation.amount_minor);
  if(!usable&&!settled)return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original merchant outcome is not confirmed."};
  return this.tx(async tx=>{
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,source_status FROM donation WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [donation.root_realm_id,donation.id])).rows[0];
   const a=(await tx.query<Attempt>(
    "SELECT * FROM donation_payment_attempt WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [donation.root_realm_id,attempt.id])).rows[0];
   if(!d||!a)throw fail();
   if(a.status==="LINK_READY"&&urlAllowed(a.checkout_url)&&a.expires_at&&a.expires_at.getTime()>Date.now())
    return {status:"LINK_READY",checkoutUrl:a.checkout_url,replayed:true};
   if(!["DRAFT","OUTCOME_UNKNOWN"].includes(a.status)||d.source_status!=="REQUESTED")
    return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original payment state changed. Check status."};
   if(usable&&a.expires_at&&a.expires_at.getTime()>Date.now()){
    await tx.query("UPDATE donation_payment_attempt SET status='LINK_READY',external_reference=$3,checkout_url=$4 "+
     "WHERE root_realm_id=$1 AND id=$2",[d.root_realm_id,a.id,link.id,link.short_url]);
    await tx.query("UPDATE donation SET source_status='LINK_READY',version=version+1,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2",[d.root_realm_id,d.id]);
    return {status:"LINK_READY",checkoutUrl:link.short_url,replayed:true,expiresAt:a.expires_at.toISOString()};
   }
   if(!settled)return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,message:"Original link expired without verified payment."};
   await tx.query("UPDATE donation_payment_attempt SET status='RECONCILIATION_PENDING',external_reference=$3 "+
    "WHERE root_realm_id=$1 AND id=$2",[d.root_realm_id,a.id,link.id]);
   await tx.query("UPDATE donation SET source_status='RECONCILIATION_PENDING',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",[d.root_realm_id,d.id]);
   return {status:"RECONCILIATION_PENDING",checkoutUrl:null,
    message:"Provider reports payment, but signed verification and CG09 finance posting are still pending."};
  });
 }
 private async throttleLink(proof:string){
  const bucket=createHash("sha256").update("cg07-link:"+proof).digest("hex");
  const v=await this.db.query<{attempt_count:number}>(
   "INSERT INTO cg07_public_request_bucket(bucket_digest,window_started_at,attempt_count) "+
   "VALUES($1,now(),1) ON CONFLICT(bucket_digest) DO UPDATE SET "+
   "attempt_count=CASE WHEN cg07_public_request_bucket.window_started_at<now()-interval '60 seconds' "+
   "THEN 1 ELSE LEAST(cg07_public_request_bucket.attempt_count+1,2147483647) END,"+
   "window_started_at=CASE WHEN cg07_public_request_bucket.window_started_at<now()-interval '60 seconds' "+
   "THEN now() ELSE cg07_public_request_bucket.window_started_at END RETURNING attempt_count",[bucket]);
  if((v.rows[0]?.attempt_count??999)>12)
   throw new ServiceUnavailableException("Too many original payment-link checks. Try again shortly.");
 }

 /** An online link is an EXTERNAL REQUEST, never payment confirmation. */
 async link(raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>
    !["statusToken","requestKey"].includes(k)))throw new BadRequestException("Check donation payment request.");
  const v=raw as Record<string,unknown>,key=donationUuid(v.requestKey),proof=v.statusToken;
  if(typeof proof!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(proof))
   throw new NotFoundException("Private donation proof unavailable.");
  await this.throttleLink(proof);
  const tokenDigest=createHash("sha256").update(proof).digest("hex");
  const reserved=await this.tx(async tx=>{
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,amount_minor::text,source_status,branch_ref,campaign_id,donation_number "+
    "FROM donation WHERE status_token_digest=$1 AND status_token_expires_at>now() FOR UPDATE",
    [tokenDigest])).rows[0];
   if(!d)throw new NotFoundException("Donation proof expired or unavailable.");
   const merchant=await this.merchant(tx,d.root_realm_id);
   const reqDigest=hash(["RAZORPAY_LINK",d.id,key,d.amount_minor,merchant.key]);
   const otherMethod=await tx.query(
    "SELECT 1 FROM donation_payment_attempt WHERE root_realm_id=$1 AND donation_id=$2 "+
    "AND method<>'ONLINE' AND status NOT IN('FAILED','EXPIRED') LIMIT 1",
    [d.root_realm_id,d.id]);
   if(otherMethod.rowCount)throw new ConflictException(
    "A physical payment is already pending. Do not generate a second payment link.");
   const attempts=(await tx.query<Attempt>(
    "SELECT * FROM donation_payment_attempt WHERE root_realm_id=$1 AND donation_id=$2 "+
    "AND method='ONLINE' ORDER BY created_at DESC,id DESC FOR UPDATE",
    [d.root_realm_id,d.id])).rows;
   const old=attempts.find(x=>x.request_key===key);
   if(old){
    if(old.source_digest!==reqDigest)throw fail();
    return {attempt:old,donation:d,created:false};
   }
   if(attempts.some(a=>!["FAILED","EXPIRED"].includes(a.status)))
    throw new ConflictException("A previous payment link is still active or its outcome is uncertain. Check its status.");
   if(d.source_status!=="REQUESTED")throw fail();
   if(d.campaign_id){
    const valid=(await tx.query<{slug:string}>(
     "SELECT lower(code_norm) AS slug FROM campaign WHERE root_realm_id=$1 AND id=$2 "+
     "AND source_status='APPROVED' FOR SHARE",[d.root_realm_id,d.campaign_id])).rows[0];
    if(!valid||(await publicCampaignSources(tx,valid.slug)).length!==1)
     throw new ConflictException("The campaign is no longer eligible for new payment links.");
   }
   const attempt=(await tx.query<Attempt>(
    "INSERT INTO donation_payment_attempt(root_realm_id,donation_id,request_key,source_digest,"+
    "method,provider,merchant_reference,status,expires_at,link_started_at) "+
    "VALUES($1,$2,$3,$4,'ONLINE','razorpay',$5,'DRAFT',now()+interval '1 hour',now()) RETURNING *",
    [d.root_realm_id,d.id,key,reqDigest,merchant.key])).rows[0];
   return {attempt,donation:d,created:true};
  });
  const {attempt,donation}=reserved;
  if(!reserved.created){
   if(attempt.status==="LINK_READY"&&urlAllowed(attempt.checkout_url)&&
     attempt.expires_at&&attempt.expires_at.getTime()>Date.now())
    return {status:"LINK_READY",checkoutUrl:attempt.checkout_url,expiresAt:attempt.expires_at.toISOString(),replayed:true};
   if(["DRAFT","OUTCOME_UNKNOWN"].includes(attempt.status))return this.recover(attempt,donation);
   return {status:attempt.status,checkoutUrl:null,message:"Original provider state changed; check your donation status."};
  }
  let link:Record<string,unknown>;
  const reference=attempt.id.replaceAll("-","");
  try{
   link=await this.provider("","POST",{
    amount:Number(donation.amount_minor),currency:"INR",accept_partial:false,
    reference_id:reference,description:"CareGanga Foundation donation "+donation.donation_number,
    expire_by:Math.floor(Date.now()/1000)+3600,notify:{sms:false,email:false}
   });
  }catch{
   await this.db.query("UPDATE donation_payment_attempt SET status='OUTCOME_UNKNOWN' "+
    "WHERE id=$1 AND status='DRAFT'",[attempt.id]).catch(()=>undefined);
   return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,
    message:"The provider result is uncertain. The Foundation must reconcile the original request."};
  }
  if(typeof link.id!=="string"||!/^plink_[A-Za-z0-9]{8,}$/.test(link.id)||
    link.reference_id!==reference||link.currency!=="INR"||
    link.amount!==Number(donation.amount_minor)||link.accept_partial!==false||
    !["created","issued"].includes(String(link.status))||!urlAllowed(link.short_url)){
   await this.db.query("UPDATE donation_payment_attempt SET status='OUTCOME_UNKNOWN' "+
    "WHERE id=$1 AND status='DRAFT'",[attempt.id]).catch(()=>undefined);
   return {status:"OUTCOME_UNKNOWN",checkoutUrl:null,
    message:"Payment provider details do not match this donation. Contact Foundation Finance."};
  }
  return this.tx(async tx=>{
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,source_status FROM donation WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [donation.root_realm_id,donation.id])).rows[0];
   const original=(await tx.query<Attempt>(
    "SELECT * FROM donation_payment_attempt WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [donation.root_realm_id,attempt.id])).rows[0];
   if(!d||!original||original.status!=="DRAFT"||d.source_status!=="REQUESTED")throw fail();
   await tx.query("UPDATE donation_payment_attempt SET status='LINK_READY',external_reference=$3,"+
    "checkout_url=$4 WHERE root_realm_id=$1 AND id=$2 AND status='DRAFT'",
    [d.root_realm_id,original.id,link.id,link.short_url]);
   await tx.query("UPDATE donation SET source_status='LINK_READY',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='REQUESTED'",[d.root_realm_id,d.id]);
   return {status:"LINK_READY",checkoutUrl:link.short_url,expiresAt:attempt.expires_at?.toISOString(),
    replayed:false};
  });
 }
 /** Explicit donor status refresh only: no idle polling, no new charge, no
  * receipt and no promotion to VERIFIED_EXTERNAL without a signed event.
  * An authenticated merchant read may establish EXPIRED/FAILED or that a
  * signed success needs reconciliation; it cannot establish received money. */
 async refreshDonorStatus(proof:string):Promise<void>{
  if(!/^[A-Za-z0-9_-]{43}$/.test(proof))return;
  await this.throttleLink(proof);
  const tokenDigest=createHash("sha256").update(proof).digest("hex");
  const candidate=(await this.db.query<{
    id:string;root_realm_id:string;amount_minor:string;source_status:string;
    attempt_id:string;external_reference:string;merchant_reference:string}>(
   "SELECT d.id,d.root_realm_id,d.amount_minor::text,d.source_status,"+
   "a.id AS attempt_id,a.external_reference,a.merchant_reference "+
   "FROM donation d JOIN LATERAL ("+
   " SELECT id,external_reference,merchant_reference FROM donation_payment_attempt a "+
   " WHERE a.root_realm_id=d.root_realm_id AND a.donation_id=d.id "+
   " AND a.method='ONLINE' AND a.status IN('LINK_READY','PAYMENT_PENDING','RECONCILIATION_PENDING') "+
   " ORDER BY a.created_at DESC,a.id DESC LIMIT 1) a ON true "+
   "WHERE d.status_token_digest=$1 AND d.status_token_expires_at>now() "+
   "AND d.source_status IN('LINK_READY','PAYMENT_PENDING','RECONCILIATION_PENDING') LIMIT 1",
   [tokenDigest])).rows[0];
  if(!candidate||!/^plink_[A-Za-z0-9]{8,}$/.test(candidate.external_reference))return;
  const remote=await this.provider("/"+candidate.external_reference,"GET");
  if(remote.id!==candidate.external_reference||
   remote.reference_id!==candidate.attempt_id.replaceAll("-","")||
   remote.currency!=="INR"||remote.amount!==Number(candidate.amount_minor)||
   remote.accept_partial!==false)return;
  let next:"RECONCILIATION_PENDING"|"EXPIRED"|"FAILED"|null=null;
  if(remote.status==="paid"&&remote.amount_paid===Number(candidate.amount_minor))
   next="RECONCILIATION_PENDING";
  else if(remote.status==="expired"&&remote.amount_paid===0)next="EXPIRED";
  else if(remote.status==="cancelled"&&remote.amount_paid===0)next="FAILED";
  if(!next)return;
  await this.tx(async tx=>{
   // Fixed lock order shared by the link path: donation first, then attempt.
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,amount_minor::text,source_status FROM donation "+
    "WHERE root_realm_id=$1 AND id=$2 AND status_token_digest=$3 "+
    "AND status_token_expires_at>now() FOR UPDATE",
    [candidate.root_realm_id,candidate.id,tokenDigest])).rows[0];
   if(!d||!["LINK_READY","PAYMENT_PENDING","RECONCILIATION_PENDING"].includes(d.source_status))return;
   const a=(await tx.query<Attempt>(
    "SELECT * FROM donation_payment_attempt WHERE root_realm_id=$1 AND id=$2 "+
    "AND donation_id=$3 FOR UPDATE",
    [d.root_realm_id,candidate.attempt_id,d.id])).rows[0];
   if(!a||!["LINK_READY","PAYMENT_PENDING","RECONCILIATION_PENDING"].includes(a.status)||
    a.external_reference!==candidate.external_reference||d.amount_minor!==candidate.amount_minor)return;
   const merchant=await this.merchant(tx,d.root_realm_id);
   if(a.merchant_reference!==merchant.key)return;
   if(d.source_status==="RECONCILIATION_PENDING"&&next!=="RECONCILIATION_PENDING")return;
   if(d.source_status===next)return;
   await tx.query("UPDATE donation_payment_attempt SET status=$3 "+
    "WHERE root_realm_id=$1 AND id=$2 AND status IN('LINK_READY','PAYMENT_PENDING','RECONCILIATION_PENDING')",
    [d.root_realm_id,a.id,next]);
   await tx.query("UPDATE donation SET source_status=$3,version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status IN('LINK_READY','PAYMENT_PENDING','RECONCILIATION_PENDING')",
    [d.root_realm_id,d.id,next]);
  });
 }
  /** The signed payment-link event is not a refundable source until the
  * original captured payment ID independently resolves on the same merchant.
  * Do not accept a caller-provided payment ID as finance/refund proof. */
 private async verifiedCapturedPayment(paymentId:string,amountMinor:string){
  if(!/^pay_[A-Za-z0-9]{8,}$/.test(paymentId))throw fail();
  const c=config();
  const response=await fetch("https://api.razorpay.com/v1/payments/"+paymentId,{
   method:"GET",headers:{Authorization:"Basic "+Buffer.from(c.key+":"+c.secret).toString("base64")},
   cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)throw new ServiceUnavailableException("Captured payment proof cannot be verified.");
  const payment:unknown=await response.json();
  if(!payment||typeof payment!=="object"||Array.isArray(payment))throw fail();
  const p=payment as Record<string,unknown>;
  if(p.id!==paymentId||p.status!=="captured"||p.captured!==true||
   p.currency!=="INR"||p.amount!==Number(amountMinor))
   throw new ConflictException("Original payment is not an independently verified capture.");
  return paymentId;
 }
 /** No browser redirect ever verifies money. Exactly signed *raw* bytes and
  * authenticated merchant API facts establish VERIFIED_EXTERNAL, not POSTED. */
 async webhook(req:object){
  const x=req as {rawBody?:Buffer;headers?:Record<string,string|undefined>};
  const bytes=x.rawBody,signature=x.headers?.["x-razorpay-signature"],
   eventId=x.headers?.["x-razorpay-event-id"];
  if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length>200000||
   typeof signature!=="string"||!/^[0-9a-f]{64}$/i.test(signature)||
   typeof eventId!=="string"||!/^[a-zA-Z0-9_-]{8,160}$/.test(eventId))
   throw new UnauthorizedException("Payment event not authenticated.");
  const expected=createHmac("sha256",config().webhook).update(bytes).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
   throw new UnauthorizedException("Payment event not authenticated.");
  let event:unknown;
  try{event=JSON.parse(bytes.toString("utf8"));}catch{throw new BadRequestException("Payment event invalid.");}
  if(!event||typeof event!=="object"||Array.isArray(event))throw fail();
  const body=event as Record<string,unknown>;
  const eventKind=body.event;
  if(!["payment_link.paid","payment_link.expired","payment_link.cancelled"].includes(String(eventKind)))
   return {accepted:true,ignored:true};
  const terminal=eventKind==="payment_link.expired"||eventKind==="payment_link.cancelled";
  const payload=body.payload as Record<string,unknown>|undefined;
  const linkObj=(payload?.payment_link as Record<string,unknown>|undefined)?.entity as Record<string,unknown>|undefined;
  const id=linkObj?.id;
  if(typeof id!=="string"||!/^plink_[A-Za-z0-9]{8,}$/.test(id))
   throw new BadRequestException("Unknown verified payment link.");
  // A signed event alone is insufficient. Read the link back from the exact
  // configured merchant and compare status, amount, currency and reference.
  const remote=await this.provider("/"+id,"GET");
  // For an actual paid event, preserve the ORIGINAL captured payment reference
  // which Razorpay requires for an eventual authenticated partial/full refund.
  const paymentEntity=(payload?.payment as Record<string,unknown>|undefined)?.entity as Record<string,unknown>|undefined;
  const signedPaymentId=eventKind==="payment_link.paid"?paymentEntity?.id:null;
  if(eventKind==="payment_link.paid"){
   if(typeof signedPaymentId!=="string"||!/^pay_[A-Za-z0-9]{8,}$/.test(signedPaymentId)||
    paymentEntity?.status!=="captured"||paymentEntity.captured!==true||
    paymentEntity.amount!==remote.amount||paymentEntity.currency!=="INR")
    throw new ConflictException("Original signed captured payment is not an exact match.");
   await this.verifiedCapturedPayment(signedPaymentId,String(remote.amount));
  }
  return this.tx(async tx=>{
   // Read merchant reference without a row lock; lock donation BEFORE attempt.
   const matches=(await tx.query<Attempt & {root_realm_id:string}>(
    "SELECT a.*,a.root_realm_id FROM donation_payment_attempt a "+
    "WHERE a.external_reference=$1 AND a.method='ONLINE' AND a.provider='razorpay' "+
    "LIMIT 2",[id])).rows;
   if(matches.length!==1)throw new NotFoundException("Provider link has no unique Foundation source.");
   const original=matches[0];
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,amount_minor::text,source_status FROM donation "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[original.root_realm_id,original.donation_id])).rows[0];
   const a=(await tx.query<Attempt & {root_realm_id:string}>(
    "SELECT a.*,a.root_realm_id FROM donation_payment_attempt a "+
    "WHERE a.root_realm_id=$1 AND a.id=$2 AND a.donation_id=$3 "+
    "AND a.method='ONLINE' AND a.provider='razorpay' FOR UPDATE OF a",
    [original.root_realm_id,original.id,original.donation_id])).rows[0];
   if(!d||!a||a.donation_id!==d.id||a.external_reference!==id)
    throw new NotFoundException("Original payment source changed.");
   const configReady=await this.merchant(tx,d.root_realm_id);
   if(!d||a.merchant_reference!==configReady.key||
    remote.id!==id||remote.reference_id!==a.id.replaceAll("-","")||
    remote.status!==(eventKind==="payment_link.paid"?"paid":
       eventKind==="payment_link.expired"?"expired":"cancelled")||
    remote.currency!=="INR"||remote.amount!==Number(d.amount_minor)||
    remote.amount_paid!==(terminal?0:Number(d.amount_minor)))
    throw new ConflictException("Payment provider merchant, identity or amount did not match.");
   if(terminal&&["VERIFIED_EXTERNAL","RECEIVED_POSTED"].includes(d.source_status))
    return {accepted:true,ignored:true,status:d.source_status};
   const eventDigest=createHash("sha256").update(bytes).digest("hex");
   const previous=(await tx.query<{immutable_digest:string}>(
    "SELECT immutable_digest FROM donation_payment_event WHERE root_realm_id=$1 "+
    "AND provider='razorpay' AND merchant_reference=$2 AND external_event_id=$3 FOR SHARE",
    [a.root_realm_id,configReady.key,eventId])).rows[0];
   if(previous){
    if(previous.immutable_digest!==eventDigest)throw fail();
    return {accepted:true,status:d.source_status,replayed:true};
   }
   if(!terminal){
    const captured=(await tx.query<{donation_id:string;attempt_id:string}>(
     "SELECT donation_id,attempt_id FROM donation_payment_event WHERE "+
     "root_realm_id=$1 AND provider='razorpay' AND provider_payment_id=$2 "+
     "AND outcome='SUCCESS' FOR SHARE",[a.root_realm_id,signedPaymentId])).rows[0];
    if(captured){
     if(captured.donation_id!==d.id||captured.attempt_id!==a.id)
      throw new ConflictException("Captured payment is bound to a different original donation.");
     return {accepted:true,status:d.source_status,replayed:true};
    }
   }
   await tx.query("INSERT INTO donation_payment_event(root_realm_id,donation_id,attempt_id,"+
    "provider,merchant_reference,external_event_id,immutable_digest,amount_minor,currency,"+
    "outcome,signed_verified_at,provider_payment_id) VALUES($1,$2,$3,'razorpay',$4,$5,$6,$7,'INR',$8,now(),$9)",
    [a.root_realm_id,d.id,a.id,configReady.key,eventId,eventDigest,d.amount_minor,
     terminal?"FAILED":"SUCCESS",terminal?null:signedPaymentId]);
   if(terminal){
    const next=eventKind==="payment_link.expired"?"EXPIRED":"FAILED";
    if(d.source_status!==next){
     await tx.query("UPDATE donation_payment_attempt SET status=$3 WHERE root_realm_id=$1 AND id=$2",
      [a.root_realm_id,a.id,next]);
     await tx.query("UPDATE donation SET source_status=$3,version=version+1,updated_at=now() "+
      "WHERE root_realm_id=$1 AND id=$2",[a.root_realm_id,d.id,next]);
    }
    return {accepted:true,status:next,replayed:false};
   }
   if(d.source_status!=="RECEIVED_POSTED"){
    await tx.query("UPDATE donation_payment_attempt SET status='VERIFIED_EXTERNAL' "+
     "WHERE root_realm_id=$1 AND id=$2",[a.root_realm_id,a.id]);
    await tx.query("UPDATE donation SET source_status='VERIFIED_EXTERNAL',version=version+1,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2",[a.root_realm_id,d.id]);
   }
   return {accepted:true,status:"VERIFIED_EXTERNAL",replayed:false};
  });
 }
}
