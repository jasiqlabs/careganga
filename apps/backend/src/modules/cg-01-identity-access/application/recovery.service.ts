import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { RecoveryDelivery } from "../infrastructure/recovery-delivery";
import { decryptTotpSecret, hashPassword, matchedTotpCounter, verifyPassword } from "../domain/secret-crypto";

const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
const GENERIC_DELIVERY = "If this account can be recovered, its recovery request is being processed. Delivery cannot be confirmed here.";

type RecoveryRow={
  id:string;account_id:string;realm_id:string;expires_at:Date;attempts:number;
  consumed_at:Date|null;status:string;last_totp_counter:string;
  totp_ciphertext:Buffer|null;totp_nonce:Buffer|null;totp_tag:Buffer|null;password_hash:string;
};
@Injectable()
export class RecoveryService {
  constructor(
    @Inject(DATABASE) private readonly db:Pool,
    private readonly delivery:RecoveryDelivery
  ){}
  private idempotency(email:string,requestKey:string):string{
    const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
    if(key.length!==32)throw new Error("Recovery key unavailable");
    return createHmac("sha256",key).update("recovery:"+email+":"+requestKey).digest("hex");
  }
  private async throttle(email:string,remoteAddress:string):Promise<void>{
    // Recovering a specific address cannot bypass login rate limits.
    const key=this.idempotency(email,"throttle:"+remoteAddress);
    const result=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at<now()-interval '1 hour'
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at<now()-interval '1 hour'
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`,[key]);
    if(result.rows[0].attempt_count>5)
      throw new HttpException("Too many requests",HttpStatus.TOO_MANY_REQUESTS);
  }
  async requestRecovery(emailInput:string,requestKey:string,remoteAddress:string):
      Promise<{ message:string; status:"DELIVERY_UNCONFIRMED"|"UNAVAILABLE"; supportReference:string }> {
    const email=emailInput.trim().toLowerCase();
    if(!this.delivery.isConfigured())
      return {message:"Account recovery delivery is currently unavailable. Contact Foundation support.",status:"UNAVAILABLE",supportReference:"CG-UNAVAILABLE"};
    await this.throttle(email,remoteAddress);
    const key=this.idempotency(email,requestKey);
    const actor=await this.db.query<{id:string}>(`
      SELECT id FROM account WHERE normalized_email=$1 AND status='ACTIVE' AND email_verified_at IS NOT NULL
      LIMIT 1`,[email]);
    const supportReference="CG-"+key.slice(0,14).toUpperCase();
    // Idempotent support reference without exposing a database identifier.
    if (!actor.rowCount)
      return {message:GENERIC_DELIVERY,status:"DELIVERY_UNCONFIRMED",supportReference};
    const client=await this.db.connect();
    let token:string|null=null;
    let challengeId:string|null=null;
    try {
      await client.query("BEGIN");
      const existing=await client.query<{id:string}>(`
        SELECT id FROM auth_challenge WHERE request_key=$1 LIMIT 1`,[key]);
      if (!existing.rowCount) {
        token=randomBytes(32).toString("base64url");
        const created=await client.query<{id:string}>(`
          INSERT INTO auth_challenge(account_id,kind,digest,request_key,expires_at)
          VALUES($1,'RECOVERY',$2,$3,now()+interval '15 minutes')
          ON CONFLICT(request_key) DO NOTHING RETURNING id`,[actor.rows[0].id,digest(token),key]);
        if(created.rowCount) challengeId=created.rows[0].id;
      }
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}
    finally{client.release();}
    // If this is a duplicate/lost reply, never resend a new secret or claim known delivery.
    if(token && challengeId){
      const claimed=await this.db.query(`
        UPDATE auth_challenge SET delivery_status='CLAIMED',delivery_attempts=1
        WHERE id=$1 AND delivery_status='PENDING' AND delivery_attempts=0 RETURNING id`,[challengeId]);
      if(claimed.rowCount){
        const result=await this.delivery.submit(email,token);
        try{
          await this.db.query(`
            UPDATE auth_challenge SET delivery_status=$2,
              provider_accepted_at=CASE WHEN $2='PROVIDER_ACCEPTED' THEN now() ELSE NULL END
            WHERE id=$1 AND delivery_status='CLAIMED'`,[challengeId,result]);
        }catch{
          // A durable CLAIMED status expresses unknown outcome after provider activity.
          // Never re-send on retry to "repair" this uncertainty.
        }
      }
    }
    return {message:GENERIC_DELIVERY,status:"DELIVERY_UNCONFIRMED",supportReference};
  }
  async confirmRecovery(body:{token:string;password:string;totp:string;email:string},remoteAddress:string,correlationRef:string):
      Promise<{ status:"PASSWORD_RESET"; message:string }> {
    const tokenDigest=digest(body.token);
    const email=body.email.trim().toLowerCase();
    // Bound costly scrypt work before inspecting even fabricated tokens.
    const key=this.idempotency(email,"confirm:"+remoteAddress);
    const attempts=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at<now()-interval '1 hour'
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at<now()-interval '1 hour'
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`,[key]);
    if(attempts.rows[0].attempt_count>10) throw new HttpException("Retry limited",HttpStatus.TOO_MANY_REQUESTS);
    // The challenge digest is 256-bit random. Check eligibility *before* expensive
    // scrypt work so fabricated tokens cannot monopolize CPU or DB connections.
    // Recheck every condition under the row locks below: this lookup never
    // authorizes a reset and does not weaken one-use/concurrent redemption.
    const preflight=await this.db.query<{id:string}>(`
      SELECT c.id FROM auth_challenge c
      JOIN account a ON a.id=c.account_id
      WHERE c.digest=$1 AND c.kind='RECOVERY' AND a.normalized_email=$2
        AND a.status='ACTIVE' AND c.consumed_at IS NULL
        AND c.expires_at>now() AND c.attempts<5 LIMIT 1`,
      [tokenDigest,email]);
    if(!preflight.rowCount)throw new BadRequestException("Recovery cannot be confirmed");
    const newHash=await hashPassword(body.password);
    const client=await this.db.connect();
    let transactionOpen=false;
    try{
      await client.query("BEGIN");
      transactionOpen=true;
      const found=await client.query<RecoveryRow>(`
        SELECT c.id,c.account_id,c.expires_at,c.attempts,c.consumed_at,
               a.realm_id,a.status,ic.password_hash,ic.last_totp_counter,
               ic.totp_ciphertext,ic.totp_nonce,ic.totp_tag
        FROM auth_challenge c
        JOIN account a ON a.id=c.account_id
        JOIN identity_credential ic ON ic.account_id=a.id
        WHERE c.digest=$1 AND c.kind='RECOVERY' AND a.normalized_email=$2
        FOR UPDATE OF c,a,ic`,[tokenDigest,email]);
      const row=found.rows[0];
      if (!row || row.consumed_at || row.attempts>=5 || row.expires_at<=new Date() || row.status!=="ACTIVE" ||
         !row.totp_ciphertext || !row.totp_nonce || !row.totp_tag) {
        await client.query("ROLLBACK");
        transactionOpen=false;
        throw new BadRequestException("Recovery cannot be confirmed");
      }
      const secret=decryptTotpSecret(row.totp_ciphertext,row.totp_nonce,row.totp_tag);
      const matched=matchedTotpCounter(secret,body.totp);
      secret.fill(0);
      if(matched===null || matched<=Number(row.last_totp_counter)){
        await client.query("UPDATE auth_challenge SET attempts=attempts+1 WHERE id=$1",[row.id]);
        await client.query("COMMIT");
        transactionOpen=false;
        throw new BadRequestException("Recovery cannot be confirmed");
      }
      if(await verifyPassword(body.password,row.password_hash)){
        await client.query("ROLLBACK");
        transactionOpen=false;
        throw new BadRequestException("Use a new password");
      }
      await client.query("UPDATE identity_credential SET password_hash=$2,credential_version=credential_version+1,last_totp_counter=$3,updated_at=now() WHERE account_id=$1",
        [row.account_id,newHash,matched]);
      await client.query("UPDATE account SET access_version=access_version+1,updated_at=now() WHERE id=$1",[row.account_id]);
      await client.query("UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",[row.account_id]);
      await client.query("UPDATE auth_challenge SET consumed_at=now() WHERE id=$1",[row.id]);
      await client.query(`INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,correlation_ref)
        VALUES($1,$2,$2,'identity.password.recovery','SUCCESS',$3)`,[row.realm_id,row.account_id,correlationRef]);
      await client.query("COMMIT");
      transactionOpen=false;
    }catch(e){
      if(transactionOpen){
        try {await client.query("ROLLBACK");}catch { /* original error remains authoritative */ }
      }
      throw e;
    }finally{client.release();}
    return {status:"PASSWORD_RESET",message:"Password updated. Sign in with your new password and authenticator."};
  }
}
