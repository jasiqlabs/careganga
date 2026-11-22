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
  if(body.event!=="payment_link.paid")return {accepted:true,ignored:true};
  const payload=body.payload as Record<string,unknown>|undefined;
  const linkObj=(payload?.payment_link as Record<string,unknown>|undefined)?.entity as Record<string,unknown>|undefined;
  const id=linkObj?.id;
  if(typeof id!=="string"||!/^plink_[A-Za-z0-9]{8,}$/.test(id))
   throw new BadRequestException("Unknown verified payment link.");
  // A signed event alone is insufficient. Read the link back from the exact
  // configured merchant and compare status, amount, currency and reference.
  const remote=await this.provider("/"+id,"GET");
  return this.tx(async tx=>{
   const a=(await tx.query<Attempt & {root_realm_id:string;amount_minor:string}>(
    "SELECT a.*,a.root_realm_id,d.amount_minor::text FROM donation_payment_attempt a "+
    "JOIN donation d ON d.root_realm_id=a.root_realm_id AND d.id=a.donation_id "+
    "WHERE a.external_reference=$1 AND a.method='ONLINE' AND a.provider='razorpay' "+
    "FOR UPDATE OF a",[id])).rows[0];
   if(!a)throw new NotFoundException("Payment link is not part of an eligible Foundation donation.");
   const configReady=await this.merchant(tx,a.root_realm_id);
   const d=(await tx.query<Donation>(
    "SELECT id,root_realm_id,amount_minor::text,source_status FROM donation "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.root_realm_id,a.donation_id])).rows[0];
   if(!d||a.merchant_reference!==configReady.key||
    remote.id!==id||remote.reference_id!==a.id.replaceAll("-","")||
    remote.status!=="paid"||remote.currency!=="INR"||
    remote.amount!==Number(d.amount_minor)||remote.amount_paid!==Number(d.amount_minor))
    throw new ConflictException("Payment provider merchant, identity or amount did not match.");
   const eventDigest=createHash("sha256").update(bytes).digest("hex");
   const previous=(await tx.query<{immutable_digest:string}>(
    "SELECT immutable_digest FROM donation_payment_event WHERE root_realm_id=$1 "+
    "AND provider='razorpay' AND merchant_reference=$2 AND external_event_id=$3 FOR SHARE",
    [a.root_realm_id,configReady.key,eventId])).rows[0];
   if(previous){
    if(previous.immutable_digest!==eventDigest)throw fail();
    return {accepted:true,status:d.source_status,replayed:true};
   }
   await tx.query("INSERT INTO donation_payment_event(root_realm_id,donation_id,attempt_id,"+
    "provider,merchant_reference,external_event_id,immutable_digest,amount_minor,currency,"+
    "outcome,signed_verified_at) VALUES($1,$2,$3,'razorpay',$4,$5,$6,$7,'INR','SUCCESS',now())",
    [a.root_realm_id,d.id,a.id,configReady.key,eventId,eventDigest,d.amount_minor]);
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
