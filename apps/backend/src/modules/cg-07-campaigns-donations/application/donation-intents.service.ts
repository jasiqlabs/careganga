import {BadRequestException,ConflictException,HttpException,HttpStatus,Inject,Injectable,
 NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createHash,createHmac,randomBytes} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {publicCampaignSources} from "./campaign-public-source";
import {parseDonationIntent} from "../domain/donation-input";
type DonationRow={id:string;request_digest:string;source_status:string;amount_minor:string;
 currency:string;campaign_id:string|null;status_token_expires_at:Date;created_at:Date};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const changed=()=>new ConflictException({code:"CG07_DONATION_REPLAY_CHANGED",
 message:"This donation request was already submitted with different details."});
const secret=()=>{
 const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Donation privacy service is temporarily unavailable.");
 return key;
};
const derived=(label:string)=>createHmac("sha256",secret()).update("careganga-cg07-"+label+"-v1").digest();
const tokenFor=(root:string,key:string)=>createHmac("sha256",derived("status-token"))
 .update(root+":"+key).digest("base64url");
function privateDonor(source:object):string{
 const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",derived("donor-private"),nonce);
 const payload=Buffer.from(JSON.stringify(source),"utf8");
 const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
 return [nonce.toString("base64url"),cipher.getAuthTag().toString("base64url"),
  encrypted.toString("base64url")].join(".");
}
@Injectable()
export class DonationIntentsService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 private async limit(req:object,scope:"create"|"status"){
  const remote=(req as {socket?:{remoteAddress?:string}}).socket?.remoteAddress;
  if(typeof remote!=="string"||remote.length>80||!/^[0-9a-fA-F:.]{2,80}$/.test(remote))
   throw new ServiceUnavailableException("Donation request verification is unavailable.");
  const bucket=createHmac("sha256",derived("public-throttle")).update(scope+":"+remote).digest("hex");
  const result=await this.db.query<{attempt_count:number}>(`
   INSERT INTO cg07_public_request_bucket(bucket_digest,window_started_at,attempt_count)
   VALUES($1,now(),1) ON CONFLICT(bucket_digest) DO UPDATE SET
    attempt_count=CASE WHEN cg07_public_request_bucket.window_started_at<now()-interval '60 seconds'
     THEN 1 ELSE LEAST(cg07_public_request_bucket.attempt_count+1,2147483647) END,
    window_started_at=CASE WHEN cg07_public_request_bucket.window_started_at<now()-interval '60 seconds'
     THEN now() ELSE cg07_public_request_bucket.window_started_at END RETURNING attempt_count`,[bucket]);
  if((result.rows[0]?.attempt_count??999)>(scope==="create"?60:240))
   throw new HttpException({code:"CG07_DONATION_RATE_LIMIT"},HttpStatus.TOO_MANY_REQUESTS);
 }
 private async tx<T>(work:(db:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.db.connect();
  try{await client.query("BEGIN");const value=await work(client);await client.query("COMMIT");return value;}
  catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}finally{client.release();}
 }
 private async foundation(client:PoolClient):Promise<string>{
  const r=await client.query<{id:string}>(
   "SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 2");
  if(r.rows.length!==1)throw new ServiceUnavailableException("Donation Foundation is not configured.");
  return r.rows[0].id;
 }
 async create(req:object,raw:unknown){
  const v=parseDonationIntent(raw);
  await this.limit(req,"create");
  const reqDigest=digest(["CG07_DONATION_REQUEST_V1",v]);
  return this.tx(async client=>{
   const root=await this.foundation(client);
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG07:PUBLIC:DONATION:"+root+":"+v.requestKey]);
   const statusToken=tokenFor(root,v.requestKey);
   const tokenDigest=createHash("sha256").update(statusToken).digest("hex");
   const old=(await client.query<DonationRow>(
    "SELECT id,request_digest,source_status,amount_minor::text,currency,campaign_id,status_token_expires_at,created_at "+
    "FROM donation WHERE root_realm_id=$1 AND request_key=$2 FOR SHARE",
    [root,v.requestKey])).rows[0];
   if(old){
    if(old.request_digest!==reqDigest)throw changed();
    if(old.status_token_expires_at.getTime()<=Date.now())
     throw new ConflictException("Donation status proof has expired. Contact the Foundation for a protected lookup.");
    return {status:old.source_status,amountMinor:old.amount_minor,currency:old.currency,
      statusToken,expiresAt:old.status_token_expires_at.toISOString(),replayed:true};
   }
   let campaignId:string|null=null,branchId:string|null=null;
   if(v.campaignSlug){
    // The original independently approved CG03 + effective CG18 campaign
    // must be current; an operational APPROVED campaign alone is insufficient.
    const visible=await publicCampaignSources(client,v.campaignSlug);
    if(visible.length!==1)throw new NotFoundException("This campaign is no longer accepting new contributions.");
    const campaign=(await client.query<{id:string;branch_ref:string|null}>(
     "SELECT id,branch_ref FROM campaign WHERE root_realm_id=$1 AND lower(code_norm)=$2 "+
     "AND source_status='APPROVED' FOR SHARE",[root,v.campaignSlug])).rows[0];
    if(!campaign)throw new NotFoundException("This campaign is no longer accepting new contributions.");
    campaignId=campaign.id;branchId=campaign.branch_ref;
   }
   const snapshot=privateDonor(v.donor);
   const created=(await client.query<DonationRow>(
    "INSERT INTO donation(root_realm_id,request_key,request_digest,campaign_id,branch_ref,"+
    "donation_kind,amount_minor,donor_private_ciphertext,status_token_digest,status_token_expires_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '30 days') "+
    "RETURNING id,request_digest,source_status,amount_minor::text,currency,campaign_id,"+
    "status_token_expires_at,created_at",
    [root,v.requestKey,reqDigest,campaignId,branchId,campaignId?"CAMPAIGN":"GENERAL",
      v.amountMinor,snapshot,tokenDigest])).rows[0];
   return {status:created.source_status,amountMinor:created.amount_minor,currency:created.currency,
    statusToken,expiresAt:created.status_token_expires_at.toISOString(),replayed:false};
  });
 }
 async status(req:object,raw:unknown){
  await this.limit(req,"status");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=="statusToken"))throw new BadRequestException("Enter the original donation status proof.");
  const token=(raw as Record<string,unknown>).statusToken;
  if(typeof token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(token))
   throw new NotFoundException("Donation status proof unavailable.");
  const hash=createHash("sha256").update(token).digest("hex");
  const result=await this.db.query<{source_status:string;amount_minor:string;currency:string;created_at:Date}>(
   "SELECT source_status,amount_minor::text,currency,created_at FROM donation "+
   "WHERE status_token_digest=$1 AND status_token_expires_at>now()",[hash]);
  const row=result.rows[0];
  if(!row)throw new NotFoundException("Donation status proof expired or unavailable.");
  return {status:row.source_status,amountMinor:row.amount_minor,currency:row.currency,
   createdAt:row.created_at.toISOString(),received:row.source_status==="RECEIVED_POSTED",
   message:row.source_status==="RECEIVED_POSTED"?"Foundation finance has confirmed this donation.":
    "This donation is not yet a confirmed Foundation receipt."};
 }
}
