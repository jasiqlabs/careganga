import {BadRequestException,ConflictException,ForbiddenException,
 Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MERCHANT=/^[A-Za-z0-9_-]{6,80}$/;
const PROOF=/^[A-Za-z0-9:_/-]{8,128}$/;
const key=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException({code:"CENTER_MERCHANT_REFERENCE_INVALID"});
 return v;};
export type CenterMerchantSecret=Readonly<{
 keyId:string;keySecret:string;webhookSecret:string;
 merchantRef:string;ownershipProof:string
}>;
export type Binding={id:string;root_realm_id:string;center_ref:string;
 provider_merchant_ref:string;protected_credential_ref:string;
 public_key_id:string;verification_state:string;revision:number;
 proposed_by:string;verified_by:string|null;verified_at:Date|null;
 original_proof_ref:string|null;revoked_at:Date|null};
const display=(m:Binding|null)=>m?{
 bindingRef:m.id,provider:"RAZORPAY" as const,
 merchantRef:m.provider_merchant_ref,verificationState:m.verification_state,
 onlineAvailable:m.verification_state==="VERIFIED"&&m.revoked_at===null,
 verifiedAt:m.verified_at?.toISOString()??null
}: {onlineAvailable:false,verificationState:"NOT_CONFIGURED" as const};
@Injectable()
export class CenterMerchantProvisioningService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly sessions:SessionService,
  private readonly scope:HealthCenterSupportScopeFacade){}
 /** No user-controllable env name, no global fallback, no secret in database.
  * The deployment ops team must provision actual center-owned Razorpay keys,
  * verify the named owner externally, and attach a retained approval ref.
  */
 secrets(center:string):CenterMerchantSecret|null{
  key(center);
  const prefix="CAREGANGA_CG17_CENTER_"+center.replaceAll("-","").toUpperCase()+"_";
  const get=(suffix:string)=>process.env[prefix+suffix]?.trim()??"";
  const x={
   keyId:get("RAZORPAY_KEY_ID"),keySecret:get("RAZORPAY_KEY_SECRET"),
   webhookSecret:get("RAZORPAY_WEBHOOK_SECRET"),
   merchantRef:get("RAZORPAY_MERCHANT_REF"),
   ownershipProof:get("OWNERSHIP_PROOF_REF")
  };
  if(get("OWNERSHIP_VERIFIED")!=="true"||
    !/^rzp_(?:live|test)_[A-Za-z0-9]+$/.test(x.keyId)||
    (process.env.NODE_ENV==="production"&&!x.keyId.startsWith("rzp_live_"))||
    x.keySecret.length<20||x.webhookSecret.length<16||
    !MERCHANT.test(x.merchantRef)||!PROOF.test(x.ownershipProof))
   return null;
  return x;
 }
 async verified(c:PoolClient,root:string,center:string,lock=false){
  const q=await c.query<Binding>(
   "SELECT * FROM center_merchant_binding WHERE root_realm_id=$1 "+
   "AND center_ref=$2 AND verification_state='VERIFIED' "+
   "AND revoked_at IS NULL "+(lock?"FOR SHARE":""),
   [root,center]);
  const x=q.rows[0],secrets=this.secrets(center);
  if(!x||!secrets||x.provider_merchant_ref!==secrets.merchantRef||
    x.public_key_id!==secrets.keyId||
    x.original_proof_ref!==secrets.ownershipProof||
    x.protected_credential_ref!=="SERVER_ENV_CENTER_SCOPED")
   throw new ConflictException({code:"CENTER_ONLINE_MERCHANT_UNAVAILABLE"});
  return {binding:x,credentials:secrets};
 }
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>){
  const c=await this.pool.connect();let open=false;
  try{await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const val=await fn(c);await c.query("COMMIT");open=false;return val;
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CENTER_MERCHANT_ALREADY_REGISTERED"});
   throw e;
  }finally{c.release();}
 }
 async status(token:string,rawCenter:string){
  const center=key(rawCenter);
  return this.tx(async c=>{
   const a=await this.sessions.requireAction(token,
    "healthcare.assistance.merchant.manage");
   await this.scope.assertCurrent(c,a,center,
    "healthcare.assistance.merchant.manage");
   const q=await c.query<Binding>(
    "SELECT * FROM center_merchant_binding WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND verification_state<>'REVOKED' LIMIT 1",
    [a.realmId,center]);
   const m=q.rows[0]??null,provisioned=this.secrets(center);
   return {...display(m),credentialProvisioned:!!provisioned&&
    (!m||m.public_key_id===provisioned.keyId),
    canAcceptOnline:!!m&&m.verification_state==="VERIFIED"&&
     !!provisioned&&m.public_key_id===provisioned.keyId};
  });
 }
 async propose(token:string,rawCenter:string,raw:unknown){
  const center=key(rawCenter);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(x=>!["merchantRef"].includes(x)))
   throw new BadRequestException({code:"CENTER_MERCHANT_INPUT_INVALID"});
  const merchantRef=(raw as {merchantRef?:unknown}).merchantRef;
  if(typeof merchantRef!=="string"||!MERCHANT.test(merchantRef))
   throw new BadRequestException({code:"CENTER_MERCHANT_INPUT_INVALID"});
  return this.tx(async c=>{
   const a=await this.sessions.requireAction(token,
    "healthcare.assistance.merchant.manage");
   await this.scope.assertCurrent(c,a,center,
    "healthcare.assistance.merchant.manage");
   const config=this.secrets(center);
   if(!config||merchantRef!==config.merchantRef)
    throw new ConflictException({code:"CENTER_MERCHANT_PROVISIONING_NOT_VERIFIED"});
   const existing=await c.query<Binding>(
    "SELECT * FROM center_merchant_binding WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND verification_state<>'REVOKED' FOR UPDATE",
    [a.realmId,center]);
   if(existing.rows[0]){
    const x=existing.rows[0];
    if(x.provider_merchant_ref!==merchantRef||
       x.public_key_id!==config.keyId)
     throw new ConflictException({code:"CENTER_MERCHANT_ALREADY_REGISTERED"});
    return {...display(x),replayed:true};
   }
   const q=await c.query<Binding>(
    "INSERT INTO center_merchant_binding(root_realm_id,center_ref,provider,"+
    "provider_merchant_ref,protected_credential_ref,public_key_id,proposed_by) "+
    "VALUES($1,$2,'RAZORPAY',''||$3,'SERVER_ENV_CENTER_SCOPED',$4,$5) "+
    "RETURNING *",
    [a.realmId,center,merchantRef,config.keyId,a.accountId]);
   return {...display(q.rows[0]),replayed:false};
  });
 }
 async verify(token:string,rawCenter:string,raw:unknown){
  const center=key(rawCenter);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(x=>x!=="expectedRevision")||
    typeof (raw as {expectedRevision?:unknown}).expectedRevision!=="number"||
    !Number.isSafeInteger((raw as {expectedRevision:number}).expectedRevision))
   throw new BadRequestException({code:"CENTER_MERCHANT_REVIEW_INVALID"});
  const version=(raw as {expectedRevision:number}).expectedRevision;
  const actor=await this.sessions.requireAction(token,
   "healthcare.assistance.merchant.verify");
  const config=this.secrets(center);
  if(!config)
   throw new ConflictException({code:"CENTER_MERCHANT_PROVISIONING_NOT_VERIFIED"});
  // A signed-in independent reviewer must authenticate the credential against
  // its actual issuer before publishing the merchant binding as VERIFIED.
  let verified=false;
  try{
   const auth=Buffer.from(config.keyId+":"+config.keySecret).toString("base64");
   const res=await fetch("https://api.razorpay.com/v1/payments?count=1",{
    method:"GET",headers:{Authorization:"Basic "+auth},
    signal:AbortSignal.timeout(7000)});
   verified=res.ok;
  }catch{verified=false;}
  if(!verified)
   throw new ServiceUnavailableException({code:"CENTER_MERCHANT_PROVIDER_NOT_VERIFIED"});
  return this.tx(async c=>{
   await this.scope.assertCurrent(c,actor,center,
    "healthcare.assistance.merchant.verify");
   const row=await c.query<Binding>(
    "SELECT * FROM center_merchant_binding WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND verification_state<>'REVOKED' FOR UPDATE",
    [actor.realmId,center]);
   const x=row.rows[0];
   if(!x)throw new NotFoundException({code:"CENTER_MERCHANT_UNAVAILABLE"});
   if(x.verification_state==="VERIFIED"&&x.revision===version)
    return {...display(x),replayed:true};
   if(x.verification_state!=="PENDING_VERIFICATION"||x.revision!==version||
      x.proposed_by===actor.accountId||x.public_key_id!==config.keyId||
      x.provider_merchant_ref!==config.merchantRef)
    throw new ConflictException({code:"CENTER_MERCHANT_REVIEW_CHANGED"});
   const update=await c.query<Binding>(
    "UPDATE center_merchant_binding SET verification_state='VERIFIED',"+
    "verified_by=$3,verified_at=now(),original_proof_ref=$4,"+
    "revision=revision+1 WHERE root_realm_id=$1 AND id=$2 "+
    "AND revision=$5 RETURNING *",
    [actor.realmId,x.id,actor.accountId,config.ownershipProof,version]);
   if(!update.rows[0])throw new ConflictException({code:"CENTER_MERCHANT_REVIEW_CHANGED"});
   return {...display(update.rows[0]),replayed:false};
  });
 }
 async revoke(token:string,rawCenter:string,raw:unknown){
  const center=key(rawCenter);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(x=>x!=="expectedRevision")||
    typeof (raw as {expectedRevision?:unknown}).expectedRevision!=="number"||
    !Number.isSafeInteger((raw as {expectedRevision:number}).expectedRevision))
   throw new BadRequestException({code:"CENTER_MERCHANT_REVIEW_INVALID"});
  const version=(raw as {expectedRevision:number}).expectedRevision;
  return this.tx(async c=>{
   const actor=await this.sessions.requireAction(token,
    "healthcare.assistance.merchant.verify");
   await this.scope.assertCurrent(c,actor,center,
    "healthcare.assistance.merchant.verify");
   const q=await c.query<Binding>(
    "UPDATE center_merchant_binding SET verification_state='REVOKED',"+
    "revoked_by=$3,revoked_at=now(),revision=revision+1 "+
    "WHERE root_realm_id=$1 AND center_ref=$2 "+
    "AND verification_state IN('PENDING_VERIFICATION','VERIFIED') "+
    "AND revision=$4 RETURNING *",
    [actor.realmId,center,actor.accountId,version]);
   if(!q.rows[0])throw new ConflictException({code:"CENTER_MERCHANT_REVISION_CHANGED"});
   return {...display(q.rows[0]),replayed:false};
  });
 }
}
