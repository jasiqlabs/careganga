import {Inject,Injectable,HttpException,HttpStatus,
 ServiceUnavailableException} from "@nestjs/common";
import {createHmac,timingSafeEqual} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";

/** Client-controlled forwarded IP headers NEVER establish the throttle identity.
 * A deployment ingress may explicitly sign a trusted socket-derived address.
 * With no verified proof, fall back to the actual HTTP transport peer.
 * Reverse-proxy operators must strip caller-supplied x-cg14-proxy-* headers.
 */
type PeerRequest={socket?:{remoteAddress?:string};
 headers?:Record<string,string|string[]|undefined>};
type Kind="centers"|"doctors"|"doctor"|"center"|"facets"|"sitemap"|"availability";
const LIMITS:Readonly<Record<Kind,number>>=Object.freeze({
 centers:1200,doctors:1200,doctor:1200,center:1200,
 facets:1200,sitemap:120,availability:400
});
const secret=()=>{
 const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException(
  "Public directory ingress verification is unavailable.");
 return createHmac("sha256",key).update("careganga-cg14-public-throttle-v1").digest();
};
const one=(v:string|string[]|undefined)=>typeof v==="string"?v:"";
function verifiedAddress(req:PeerRequest,scope:Kind):string{
 const remote=req.socket?.remoteAddress;
 if(!remote||remote.length>80||!/^[0-9a-fA-F:.]{2,80}$/.test(remote))
  throw new ServiceUnavailableException("Current directory could not verify its requester.");
 const headers=req.headers??{};
 const address=one(headers["x-cg14-proxy-client"]);
 const timestamp=one(headers["x-cg14-proxy-ts"]);
 const signature=one(headers["x-cg14-proxy-proof"]);
 const present=!!(address||timestamp||signature);
 const configured=Buffer.from(process.env.CG14_PUBLIC_PROXY_KEY??"","base64");
 if(!present)return remote;
 // Never allow a spoofed proxy assertion to select an arbitrary rate bucket.
 if(configured.length!==32||!address||!/^[0-9a-fA-F:.]{2,45}$/.test(address)||
  !/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>60000||
  !/^[0-9a-f]{64}$/i.test(signature))
  throw new HttpException("Trusted public directory ingress unavailable.",
   HttpStatus.FORBIDDEN);
 const expected=createHmac("sha256",configured)
  .update("cg14:"+scope+":"+timestamp+":"+address).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
  throw new HttpException("Trusted public directory ingress unavailable.",
   HttpStatus.FORBIDDEN);
 return address;
}
@Injectable()
export class HealthPublicRequestThrottleService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 async hit(req:object,scope:Kind){
  const address=verifiedAddress(req as PeerRequest,scope);
  // HMAC digest is unlinkable without the protected deployment secret and
  // route-specific, so one public endpoint cannot inspect another's buckets.
  const bucket=createHmac("sha256",secret())
   .update(scope+":"+address).digest("hex");
  const result=await this.db.query<{attempt_count:number}>(
   "INSERT INTO health_public_request_bucket(bucket_digest,window_started_at,attempt_count) "+
   "VALUES($1,now(),1) ON CONFLICT(bucket_digest) DO UPDATE SET "+
   "attempt_count=CASE WHEN health_public_request_bucket.window_started_at<"+
   "now()-interval '60 seconds' THEN 1 ELSE "+
   "LEAST(health_public_request_bucket.attempt_count+1,2147483647) END,"+
   "window_started_at=CASE WHEN health_public_request_bucket.window_started_at<"+
   "now()-interval '60 seconds' THEN now() "+
   "ELSE health_public_request_bucket.window_started_at END "+
   "RETURNING attempt_count",[bucket]);
  if((result.rows[0]?.attempt_count??LIMITS[scope]+1)>LIMITS[scope])
   throw new HttpException({code:"HEALTH_PUBLIC_RATE_LIMIT"},
    HttpStatus.TOO_MANY_REQUESTS);
  // Bounded opportunistic expiry; no scheduled idle worker/PII retention.
  if(Math.random()<0.01)
   try{await this.db.query(
    "WITH old AS (SELECT bucket_digest FROM health_public_request_bucket "+
    "WHERE window_started_at<now()-interval '24 hours' "+
    "ORDER BY window_started_at LIMIT 100) "+
    "DELETE FROM health_public_request_bucket b USING old "+
    "WHERE b.bucket_digest=old.bucket_digest"
   );}catch{/* Housekeeping failures never expose private data. */}
 }
}
