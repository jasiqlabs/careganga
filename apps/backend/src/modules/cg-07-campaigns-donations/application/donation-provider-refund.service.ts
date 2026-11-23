import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException,UnauthorizedException} from "@nestjs/common";
import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {DonationRefundPostingFacade} from "../../cg-09-finance-accounting/application/donation-refund-posting.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PAY=/^pay_[A-Za-z0-9]{8,}$/;
const REFUND=/^rfnd_[A-Za-z0-9]{8,}$/;
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const conflict=()=>new ConflictException("Original gateway refund changed. Check its existing status; do not initiate another payout.");
type Source={id:string;donation_id:string;amount_minor:string;requested_by:string;
 status:string;settlement_method:string;branch_ref:string|null;donation_number:string};
type Captured={id:string;provider_payment_id:string;merchant_reference:string;amount_minor:string};
type ProviderRow={refund_request_id:string;donation_id:string;captured_payment_id:string;
 provider_receipt:string;request_key:string;request_digest:string;authorized_by:string;
 amount_minor:string;state:string;provider_refund_id:string|null;signed_event_id:string|null;
 signed_digest:string|null;finance_digest:string|null;approval_request_key:string|null};
type Merchant={key:string;secret:string;webhook:string};

@Injectable()
export class DonationProviderRefundService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly owner:ProtectedAccessOwnerService,
  private readonly finance:DonationRefundPostingFacade){}
 private async tx<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");const result=await fn(tx);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private credentials():Merchant{
  const key=process.env.CG07_RAZORPAY_KEY_ID??"",
   secret=process.env.CG07_RAZORPAY_KEY_SECRET??"",
   webhook=process.env.CG07_RAZORPAY_WEBHOOK_SECRET??"";
  if(!/^rzp_(live|test)_[A-Za-z0-9]{8,}$/.test(key)||secret.length<16||
   webhook.length<16||!process.env.CG07_RAZORPAY_SECRET_REF||
   (process.env.NODE_ENV==="production"&&!key.startsWith("rzp_live_")))
   throw new ServiceUnavailableException("Foundation gateway credentials have not been verified.");
  return {key,secret,webhook};
 }
 private async merchant(tx:PoolClient,root:string){
  const c=this.credentials();
  const q=await tx.query(
   "SELECT id FROM integration_connection WHERE foundation_realm_id=$1 "+
   "AND scope_kind='FOUNDATION' AND provider='razorpay' AND purpose='donations' "+
   "AND secret_reference=$2 AND verification_status='VERIFIED' "+
   "AND last_checked_credential_revision=credential_revision",
   [root,process.env.CG07_RAZORPAY_SECRET_REF]);
  if(q.rowCount!==1)throw new ServiceUnavailableException("Current Foundation merchant is not verified.");
  return c;
 }
 private async provider(path:string,method:"GET"|"POST",body?:Record<string,unknown>){
  const c=this.credentials();
  const response=await fetch("https://api.razorpay.com/v1/"+path,{
   method,headers:{Authorization:"Basic "+Buffer.from(c.key+":"+c.secret).toString("base64"),
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new ServiceUnavailableException("Razorpay refund outcome is unavailable.");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))throw conflict();
  return data as Record<string,unknown>;
 }
 private async current(tx:PoolClient,root:string,refundRef:string){
  // Parent-first lock: the original donation/refund triggers also lock donation first.
  const pointer=(await tx.query<{donation_id:string}>(
   "SELECT donation_id FROM donation_refund_request WHERE root_realm_id=$1 AND id=$2",
   [root,refundRef])).rows[0];
  if(!pointer)throw new NotFoundException("Original refund request unavailable.");
  const original=(await tx.query<{id:string;branch_ref:string|null;source_status:string}>(
   "SELECT id,branch_ref,source_status FROM donation WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
   [root,pointer.donation_id])).rows[0];
  if(!original||original.source_status!=="RECEIVED_POSTED")throw conflict();
  const r=(await tx.query<Source>(
   "SELECT r.id,r.donation_id,r.amount_minor::text,r.requested_by,r.status,"+
   "r.settlement_method,d.branch_ref,d.donation_number FROM donation_refund_request r "+
   "JOIN donation d ON d.root_realm_id=r.root_realm_id AND d.id=r.donation_id "+
   "WHERE r.root_realm_id=$1 AND r.id=$2 FOR UPDATE OF r",
   [root,refundRef])).rows[0];
  if(!r||r.donation_id!==original.id)throw conflict();
  return r;
 }
 private async scoped(tx:PoolClient,a:Actor,r:Source){
  if(r.branch_ref===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
  else await this.branches.requireFinanceActiveBranch(tx,a,r.branch_ref,"finance.journals.post");
 }
 private async reviewer(bearer:string,fn:(tx:PoolClient,a:Actor)=>Promise<unknown>){
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.limitFoundationRootProof(actor);
  return this.tx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
   return fn(tx,actor);
  });
 }
 private validRemote(v:Record<string,unknown>,p:ProviderRow){
  return typeof v.id==="string"&&REFUND.test(v.id)&&
   v.receipt===p.provider_receipt&&v.payment_id===p.captured_payment_id&&
   v.amount===Number(p.amount_minor)&&v.currency==="INR"&&
   ["pending","processed","failed"].includes(String(v.status));
 }
 /** Reserve before issuing one provider request. If the network result is lost
  * never repeat POST: reconcile by the unique original receipt instead. */
 async initiate(bearer:string,refundRef:string,raw:unknown){
  if(!ID.test(refundRef)||!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>!["requestKey","currentPassword"].includes(k)))
   throw new BadRequestException("Choose an original refund and reviewer confirmation.");
  const input=raw as Record<string,unknown>;
  if(typeof input.requestKey!=="string"||!ID.test(input.requestKey)||
   typeof input.currentPassword!=="string"||input.currentPassword.length<8||
   Buffer.byteLength(input.currentPassword)>1024)
   throw new BadRequestException("Independent reviewer password and request reference required.");
  const reserved=await this.reviewer(bearer,async(tx,a)=>{
   const r=await this.current(tx,a.realmId,refundRef);
   await this.scoped(tx,a,r);
   if(r.requested_by===a.accountId)throw new ForbiddenException("A different Foundation reviewer must authorize gateway refunds.");
   if(r.status!=="REQUESTED"||r.settlement_method!=="ONLINE")throw conflict();
   await this.sessions.requireFreshFoundationRootProof(tx,a,input.currentPassword as string);
   const c=await this.merchant(tx,a.realmId);
   const captured=(await tx.query<Captured>(
    "SELECT e.id,e.provider_payment_id,e.merchant_reference,e.amount_minor::text "+
    "FROM donation_payment_event e JOIN donation_finance_effect f "+
    "ON f.root_realm_id=e.root_realm_id AND f.donation_id=e.donation_id "+
    "JOIN journal j ON j.root_realm_id=f.root_realm_id AND j.id=f.journal_id "+
    "WHERE e.root_realm_id=$1 AND e.donation_id=$2 AND e.outcome='SUCCESS' "+
    "AND e.provider='razorpay' AND e.provider_payment_id IS NOT NULL "+
    "AND f.status='POSTED' AND j.status='POSTED' AND j.source_ref=e.donation_id "+
    "FOR SHARE OF e,f,j",[a.realmId,r.donation_id])).rows;
   if(captured.length!==1||!PAY.test(captured[0].provider_payment_id)||
    captured[0].merchant_reference!==c.key||
    BigInt(r.amount_minor)<100n||BigInt(r.amount_minor)>BigInt(Number.MAX_SAFE_INTEGER)||
    BigInt(r.amount_minor)>BigInt(captured[0].amount_minor))
    throw new ConflictException("An exact captured Razorpay payment of at least INR 1 is required.");
   const original=captured[0],receipt="CG07RF"+r.id.replaceAll("-","");
   const d=digest(["CG07_PROVIDER_REFUND",r.id,r.donation_id,
    original.id,original.provider_payment_id,r.amount_minor,input.requestKey,receipt]);
   const existing=(await tx.query<ProviderRow>(
    "SELECT * FROM donation_provider_refund WHERE root_realm_id=$1 AND refund_request_id=$2 FOR UPDATE",
    [a.realmId,r.id])).rows[0];
   if(existing){
    if(existing.request_key!==input.requestKey||existing.request_digest!==d||
     existing.authorized_by!==a.accountId)throw conflict();
    return {existing:true,state:existing.state,p:existing};
   }
   const p=(await tx.query<ProviderRow>(
    "INSERT INTO donation_provider_refund(root_realm_id,refund_request_id,donation_id,"+
    "captured_event_id,captured_payment_id,provider_receipt,amount_minor,request_key,"+
    "request_digest,authorized_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [a.realmId,r.id,r.donation_id,original.id,original.provider_payment_id,
     receipt,r.amount_minor,input.requestKey,d,a.accountId])).rows[0];
   return {existing:false,state:"RESERVED",p};
  }) as {existing:boolean;state:string;p:ProviderRow};
  if(reserved.existing)return {status:reserved.state,replayed:true,
   message:"Check the existing refund. Never initiate a duplicate Razorpay payout."};
  // Durable UNKNOWN transition BEFORE the single external POST.
  await this.tx(async tx=>tx.query(
   "UPDATE donation_provider_refund SET state='OUTCOME_UNKNOWN',updated_at=now() "+
   "WHERE refund_request_id=$1 AND request_key=$2 AND state='RESERVED'",
   [refundRef,input.requestKey]));
  let result:Record<string,unknown>;
  try{
   result=await this.provider("payments/"+reserved.p.captured_payment_id+"/refund","POST",{
    amount:Number(reserved.p.amount_minor),speed:"normal",receipt:reserved.p.provider_receipt});
   if(!this.validRemote(result,reserved.p))throw conflict();
  }catch{
   return {status:"OUTCOME_UNKNOWN",message:"Merchant refund result is uncertain. Do not retry payout; reconcile the original receipt."};
  }
  await this.tx(async tx=>{
   const row=(await tx.query<ProviderRow>(
    "SELECT * FROM donation_provider_refund WHERE refund_request_id=$1 AND request_key=$2 FOR UPDATE",
    [refundRef,input.requestKey])).rows[0];
   if(!row||row.request_digest!==reserved.p.request_digest||
    (row.provider_refund_id&&row.provider_refund_id!==result.id))throw conflict();
   if(["RESERVED","OUTCOME_UNKNOWN"].includes(row.state))
    await tx.query("UPDATE donation_provider_refund SET state='PROVIDER_PENDING',"+
     "provider_refund_id=$3,updated_at=now() WHERE refund_request_id=$1 "+
     "AND request_key=$2 AND state IN('RESERVED','OUTCOME_UNKNOWN')",
     [refundRef,input.requestKey,result.id]);
  });
  return {status:"REFUND_RECONCILIATION_PENDING",
   message:"Refund requested at merchant. Only signed processed confirmation followed by CG09 posting changes verified net."};
 }
 /** Merchant-first reconciliation fetch is READ-ONLY. It cannot manufacture
  * a signed processed event, retry CREATE or post finance. */
 async reconcile(bearer:string,refundRef:string){
  if(!ID.test(refundRef))throw new BadRequestException("Select original refund.");
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  const p=await this.tx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   const r=await this.current(tx,actor.realmId,refundRef);
   await this.scoped(tx,actor,r);
   await this.merchant(tx,actor.realmId);
   const q=await tx.query<ProviderRow>(
    "SELECT * FROM donation_provider_refund WHERE root_realm_id=$1 AND refund_request_id=$2",
    [actor.realmId,refundRef]);
   return q.rows[0];
  });
  if(!p)throw new NotFoundException("No verified original gateway refund request.");
  if(p.provider_refund_id){
   const remote=await this.provider("refunds/"+p.provider_refund_id,"GET");
   if(!this.validRemote(remote,p)||remote.id!==p.provider_refund_id)throw conflict();
   return {status:p.state,merchantStatus:remote.status,
    message:p.state==="FINANCE_POSTED"?"Verified CG09 correction posted.":
     "Merchant state checked. Await the original signed processed webhook and independent CG09 posting."};
  }
  const list=await this.provider("payments/"+p.captured_payment_id+"/refunds?count=100&skip=0","GET");
  if(!Array.isArray(list.items)||list.items.length>100)
   return {status:"OUTCOME_UNKNOWN",message:"Merchant refund lookup is incomplete. Contact the gateway; do not retry."};
  const matches=list.items.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)&&
   (x as Record<string,unknown>).receipt===p.provider_receipt);
  if(matches.length!==1||!this.validRemote(matches[0] as Record<string,unknown>,p))
   return {status:"OUTCOME_UNKNOWN",message:"Original receipt is not uniquely confirmed. Never repeat the refund."};
  const found=matches[0] as Record<string,unknown>;
  await this.tx(async tx=>tx.query(
   "UPDATE donation_provider_refund SET provider_refund_id=$3,state='PROVIDER_PENDING',updated_at=now() "+
   "WHERE refund_request_id=$1 AND request_key=$2 AND state IN('RESERVED','OUTCOME_UNKNOWN') "+
   "AND (provider_refund_id IS NULL OR provider_refund_id=$3)",
   [refundRef,p.request_key,found.id]));
  return {status:"REFUND_RECONCILIATION_PENDING",merchantStatus:found.status,
   message:"Found original merchant refund. Signed processed webhook and CG09 posting are still required."};
 }
 /** A signed Razorpay event is independently checked against the merchant GET.
  * No forged browser status, refund ID or receipt can mark money refunded. */
 async webhook(req:object){
  const x=req as {rawBody?:Buffer;headers?:Record<string,string|undefined>};
  const bytes=x.rawBody,signature=x.headers?.["x-razorpay-signature"],
   eventId=x.headers?.["x-razorpay-event-id"];
  if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length>200000||
   typeof signature!=="string"||!/^[a-f0-9]{64}$/i.test(signature)||
   typeof eventId!=="string"||!/^[A-Za-z0-9_-]{8,160}$/.test(eventId))
   throw new UnauthorizedException("Merchant refund signature unavailable.");
  const expected=createHmac("sha256",this.credentials().webhook).update(bytes).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
   throw new UnauthorizedException("Merchant refund signature invalid.");
  let parsed:unknown;
  try{parsed=JSON.parse(bytes.toString("utf8"));}catch{throw new BadRequestException("Merchant refund event invalid.");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw conflict();
  const event=parsed as Record<string,unknown>;
  if(!["refund.processed","refund.failed"].includes(String(event.event)))return {accepted:true,ignored:true};
  const entity=((event.payload as Record<string,unknown>|undefined)?.refund as
    Record<string,unknown>|undefined)?.entity as Record<string,unknown>|undefined;
  const refundId=entity?.id;
  if(typeof refundId!=="string"||!REFUND.test(refundId))throw conflict();
  const remote=await this.provider("refunds/"+refundId,"GET");
  const receipt=remote.receipt;
  if(typeof receipt!=="string"||!/^CG07RF[a-f0-9]{32}$/.test(receipt))
   throw new NotFoundException("Original Foundation refund source unavailable.");
  // No trust in the signed body's source fields until merchant GET confirms them.
  if(entity?.id!==refundId||entity.payment_id!==remote.payment_id||
   entity.amount!==remote.amount||entity.currency!==remote.currency||
   entity.receipt!==remote.receipt||entity.status!==remote.status||
   remote.status!==(event.event==="refund.processed"?"processed":"failed"))
   throw conflict();
  const source=(await this.db.query<{root_realm_id:string;refund_request_id:string;donation_id:string}>(
   "SELECT root_realm_id,refund_request_id,donation_id FROM donation_provider_refund "+
   "WHERE provider_receipt=$1 LIMIT 2",[receipt])).rows;
  if(source.length!==1)throw new NotFoundException("Original merchant refund not uniquely matched.");
  return this.tx(async tx=>{
   const root=source[0].root_realm_id,refundRef=source[0].refund_request_id;
   const r=await this.current(tx,root,refundRef);
   const p=(await tx.query<ProviderRow>(
    "SELECT * FROM donation_provider_refund WHERE root_realm_id=$1 AND refund_request_id=$2 FOR UPDATE",
    [root,refundRef])).rows[0];
   if(!p||r.donation_id!==p.donation_id||r.settlement_method!=="ONLINE"||
    !this.validRemote(remote,p)||p.provider_receipt!==receipt||
    (p.provider_refund_id&&p.provider_refund_id!==refundId))throw conflict();
   const merchant=await this.merchant(tx,root);
   const captured=(await tx.query<{merchant_reference:string}>(
    "SELECT merchant_reference FROM donation_payment_event WHERE root_realm_id=$1 "+
    "AND id=(SELECT captured_event_id FROM donation_provider_refund "+
    "WHERE root_realm_id=$1 AND refund_request_id=$2)",[root,refundRef])).rows[0];
   if(captured?.merchant_reference!==merchant.key)throw conflict();
   const signedDigest=createHash("sha256").update(bytes).digest("hex");
   if(p.signed_event_id){
    if(p.signed_event_id!==eventId||p.signed_digest!==signedDigest||
     p.provider_refund_id!==refundId)throw conflict();
    return {accepted:true,replayed:true,status:p.state};
   }
   if(r.status!=="REQUESTED"||!["RESERVED","OUTCOME_UNKNOWN","PROVIDER_PENDING"].includes(p.state))
    throw conflict();
   await tx.query("UPDATE donation_provider_refund SET state=$3,provider_refund_id=$4,"+
    "signed_event_id=$5,signed_digest=$6,processed_at=$7,updated_at=now() "+
    "WHERE root_realm_id=$1 AND refund_request_id=$2",
    [root,refundRef,event.event==="refund.processed"?"PROVIDER_PROCESSED":"PROVIDER_FAILED",
     refundId,event.event==="refund.processed"?eventId:null,
     event.event==="refund.processed"?signedDigest:null,
     event.event==="refund.processed"?new Date():null]);
   return {accepted:true,status:event.event==="refund.processed"?
    "REFUND_RECONCILIATION_PENDING":"PROVIDER_FAILED"};
  });
 }
 /** Only signed processed refund + exact CG09 original clearing account,
  * independent current reviewer and fresh proof can reverse verified net. */
 async finalize(bearer:string,refundRef:string,raw:unknown){
  if(!ID.test(refundRef)||!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(x=>!["requestKey","currentPassword","yearRef","postingDate"].includes(x)))
   throw new BadRequestException("Select original processed provider refund.");
  const v=raw as Record<string,unknown>;
  if(typeof v.requestKey!=="string"||!ID.test(v.requestKey)||
   typeof v.yearRef!=="string"||!ID.test(v.yearRef)||
   typeof v.postingDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v.postingDate)||
   typeof v.currentPassword!=="string"||v.currentPassword.length<8||
   Buffer.byteLength(v.currentPassword)>1024)
   throw new BadRequestException("Original finance year, date and reviewer proof are required.");
  return this.reviewer(bearer,async(tx,a)=>{
   const r=await this.current(tx,a.realmId,refundRef);
   await this.scoped(tx,a,r);
   if(r.requested_by===a.accountId||r.settlement_method!=="ONLINE")
    throw new ForbiddenException("An independent provider refund reviewer is required.");
   const p=(await tx.query<ProviderRow>(
    "SELECT * FROM donation_provider_refund WHERE root_realm_id=$1 AND refund_request_id=$2 FOR UPDATE",
    [a.realmId,refundRef])).rows[0];
   if(!p)throw new NotFoundException("Original signed gateway refund unavailable.");
   if(p.state==="FINANCE_POSTED"&&r.status==="FINANCE_REVERSED"&&
    p.approval_request_key===v.requestKey)
    return {status:"FINANCE_REVERSED",replayed:true};
   if(p.state!=="PROVIDER_PROCESSED"||r.status!=="REQUESTED"||
    !p.signed_event_id||!p.signed_digest||!p.provider_refund_id)throw conflict();
   await this.merchant(tx,a.realmId);
   await this.sessions.requireFreshFoundationRootProof(tx,a,String(v.currentPassword));
   const accounts=await this.finance.providerAccounts(tx,a,r.donation_id);
   const financialDigest=digest(["CG07_PROVIDER_POST",r.id,p.provider_refund_id,p.signed_digest,
    p.amount_minor,v.requestKey,v.yearRef,v.postingDate,
    accounts.clearingAccountRef,accounts.incomeAccountRef]);
   const journal=await this.finance.postProvider(tx,a,{
    refundRef:r.id,donationRef:r.donation_id,amountMinor:p.amount_minor,
    yearRef:String(v.yearRef),date:String(v.postingDate),
    eventKey:String(v.requestKey),digest:financialDigest,
    providerRefundId:p.provider_refund_id});
   await tx.query("UPDATE donation_provider_refund SET state='FINANCE_POSTED',"+
    "posted_by=$3,approval_request_key=$4,finance_digest=$5,updated_at=now() "+
    "WHERE root_realm_id=$1 AND refund_request_id=$2 AND state='PROVIDER_PROCESSED'",
    [a.realmId,r.id,a.accountId,v.requestKey,financialDigest]);
   const changed=await tx.query("UPDATE donation_refund_request "+
    "SET status='FINANCE_REVERSED',approved_by=$3,approval_request_key=$4,"+
    "voucher_reference=$5,cash_account_ref=$6,income_account_ref=$7,"+
    "financial_year_ref=$8,posting_date=$9,reversal_journal_ref=$10,"+
    "password_verified_at=now(),verified_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='REQUESTED' AND settlement_method='ONLINE'",
    [a.realmId,r.id,a.accountId,v.requestKey,p.provider_receipt,
     accounts.clearingAccountRef,accounts.incomeAccountRef,v.yearRef,v.postingDate,journal]);
   if(changed.rowCount!==1)throw conflict();
   return {status:"FINANCE_REVERSED",replayed:false,
    message:"Signed processed gateway refund and exact original CG09 finance correction posted. Separate CG19 correction may now be issued."};
  });
 }
}
