import {HttpException,HttpStatus,Inject,Injectable,ServiceUnavailableException}
 from "@nestjs/common";
import {createHmac,randomBytes} from "node:crypto";
import {isIP} from "node:net";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
const CODE=/^[A-Za-z0-9_-]{32}$/;
type ResolveResult={eligible:boolean;programmeName:string|null;notice:string};

/** The visitor never authenticates by presenting this identifier. All
 * applicant/referrer attribution must be frozen by the original CG04 commit.
 * No raw IP, private CG04 person data or lookup codes are persisted here.
 */
@Injectable()
export class ReferralResolveService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 private throttleDigest(ip:string):string{
  if(isIP(ip)===0)throw new ServiceUnavailableException("Referral validation unavailable.");
  const raw=process.env.CG13_RESOLVE_HMAC_KEY_BASE64??"";
  const secret=Buffer.from(raw,"base64");
  if(secret.length!==32||secret.toString("base64")!==raw)
   throw new ServiceUnavailableException("Referral validation unavailable.");
  return createHmac("sha256",secret).update("cg13-referral-resolve:v1:"+ip).digest("hex");
 }
 private async countAttempt(key:string){
  const result=await this.db.query<{attempt_count:number}>(
   "INSERT INTO cg13_referral_resolve_attempt(key_digest,window_started_at,attempt_count) "+
   "VALUES($1,now(),1) ON CONFLICT(key_digest) DO UPDATE SET "+
   "attempt_count=CASE WHEN cg13_referral_resolve_attempt.window_started_at<now()-interval '15 minutes' "+
   "THEN 1 ELSE LEAST(cg13_referral_resolve_attempt.attempt_count::bigint+1,2147483647)::integer END,"+
   "window_started_at=CASE WHEN cg13_referral_resolve_attempt.window_started_at<now()-interval '15 minutes' "+
   "THEN now() ELSE cg13_referral_resolve_attempt.window_started_at END "+
   "RETURNING attempt_count",[key]);
  if(Number(result.rows[0]?.attempt_count)>25)
   throw new HttpException({code:"CG13_RESOLVE_RATE_LIMIT"},HttpStatus.TOO_MANY_REQUESTS);
  // Bounded opportunistic expiry prevents a new unbounded visitor-log master.
  if(randomBytes(1)[0]===0){
   await this.db.query(
    "DELETE FROM cg13_referral_resolve_attempt WHERE key_digest IN "+
    "(SELECT key_digest FROM cg13_referral_resolve_attempt "+
    "WHERE window_started_at<now()-interval '48 hours' "+
    "ORDER BY window_started_at,key_digest LIMIT 40)").catch(()=>undefined);
  }
 }
 async resolve(raw:unknown,remoteIp:string):Promise<ResolveResult>{
  // IP comes ONLY from framework request.ip (the configured reverse proxy),
  // never from user-submitted X-Forwarded-For or arbitrary form fields.
  await this.countAttempt(this.throttleDigest(remoteIp));
  const candidate=raw&&typeof raw==="object"&&!Array.isArray(raw)?
   raw as Record<string,unknown>:{};
  const code=Object.keys(candidate).length===1&&typeof candidate.code==="string"?
   candidate.code:"";
  if(!CODE.test(code))return {eligible:false,programmeName:null,
   notice:"This referral code is not currently eligible. You may continue without it."};
  const match=await this.db.query<{name:string}>(
   "SELECT p.display_name AS name FROM referral_code c "+
   "JOIN referral_program p ON p.root_realm_id=c.root_realm_id AND p.id=c.programme_id "+
   "JOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT' "+
   "WHERE c.code_value=$1 AND p.status='ACTIVE' "+
   "AND cg13_referral_code_current(c.root_realm_id,c.code_value) LIMIT 1",[code]);
  const row=match.rows[0];
  return {eligible:!!row,programmeName:row?.name??null,
   notice:row?"Eligible referral programme. Only a verified qualifying activation can earn points.":
    "This referral code is not currently eligible. You may continue without it."};
 }

 /** Public groups only: suppress every cohort below five real credited owners.
  * No codes, contact info, branches or individually ranked referrals.
  */
 async publicLeaderboard(){
  const q=await this.db.query<{programme:string;rank:string;participants:string;
   qualifiedReferrals:string}>(
   "SELECT p.display_name AS programme,"+
   "COALESCE(wallet.current_rank_name,'Unranked') AS rank,"+
   "COUNT(*)::text AS participants,"+
   "SUM(wallet.qualified_referrals)::text AS \"qualifiedReferrals\" "+
   "FROM points_account wallet "+
   "JOIN referral_program p ON p.root_realm_id=wallet.root_realm_id "+
   "AND p.id=wallet.programme_id AND p.status='ACTIVE' "+
   "JOIN access_realm realm ON realm.id=wallet.root_realm_id "+
   "AND realm.realm_key='FOUNDATION_ROOT' "+
   "WHERE wallet.qualified_referrals>0 "+
   "AND EXISTS(SELECT 1 FROM referral_policy_version policy "+
   "WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.id "+
   "AND policy.effective_from<=now()) "+
   "GROUP BY wallet.root_realm_id,p.id,p.display_name,wallet.current_rank_name "+
   "HAVING COUNT(*)>=5 ORDER BY p.display_name,rank LIMIT 50");
  return {groups:q.rows,minimumPublicGroupSize:5,
   notice:"Only aggregated groups of five or more verified referrers are shown. No names or private applicant details are published."};
 }
}
