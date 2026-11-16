import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { RecoveryDelivery } from "../infrastructure/recovery-delivery";
import { hashPassword, verifyPassword } from "../domain/secret-crypto";

const GENERIC = "If this account exists and recovery is available, a password reset code will be sent.";
type Channel = "email"|"sms";
type RecoveryAccount = {
  id:string; realm_id:string; normalized_email:string|null; normalized_mobile:string;
  contact_phone:string|null; recovery_contact_changed_at:Date|null;
};

@Injectable()
export class RecoveryService {
  constructor(@Inject(DATABASE) private readonly db:Pool,
    private readonly delivery:RecoveryDelivery) {}
  private secret():Buffer {
    const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
    if(key.length!==32)throw new Error("Credential recovery key unavailable");
    return key;
  }
  private proof(...parts:string[]):string {
    return createHmac("sha256",this.secret()).update(parts.join(":")).digest("hex");
  }
  private async rate(kind:string,value:string,limit:number):Promise<void>{
    const key=this.proof("recovery-rate",kind,value);
    const r=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at<now()-interval '15 minutes'
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at<now()-interval '15 minutes'
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`,[key]);
    if(r.rows[0].attempt_count>limit)
      throw new HttpException("Too many attempts. Please try later.",HttpStatus.TOO_MANY_REQUESTS);
  }
  private async account(identifier:string):Promise<RecoveryAccount|null>{
    const r=await this.db.query<RecoveryAccount>(`
      SELECT id,realm_id,normalized_email,normalized_mobile,contact_phone,
        recovery_contact_changed_at
      FROM account WHERE status='ACTIVE'
        AND (normalized_mobile=$1 OR normalized_email=$1) LIMIT 1`,[identifier]);
    return r.rows[0]??null;
  }
  async requestRecovery(identifierInput:string,channelInput:Channel|undefined,
    requestKey:string,remoteAddress:string):Promise<{message:string;status:"PROCESSED"}>{
    const identifier=identifierInput.trim().toLowerCase();
    await this.rate("network-request",remoteAddress,100);
    await this.rate("identifier-request",identifier,5);
    const account=await this.account(identifier);
    if(!account)return {message:GENERIC,status:"PROCESSED"};
    // Newly edited contact is never immediately accepted as a recovery destination.
    if(account.recovery_contact_changed_at &&
      account.recovery_contact_changed_at.getTime()>Date.now()-24*60*60*1000)
      return {message:GENERIC,status:"PROCESSED"};
    const channel:Channel=channelInput??(identifier.includes("@")?"email":"sms");
    const recipient=channel==="email"?account.normalized_email:account.contact_phone;
    if(!recipient||!this.delivery.isOtpChannelConfigured(channel))
      return {message:GENERIC,status:"PROCESSED"};
    const requestDigest=this.proof("recovery-request",identifier,requestKey);
    const id=randomUUID(),code=String(randomInt(0,1_000_000)).padStart(6,"0");
    const digest=this.proof("recovery-otp",account.id,id,code);
    // Serialize recovery challenges per account. Two concurrent resends must not
    // both send distinct codes and invalidate the one the user enters.
    const client=await this.db.connect();
    let shouldDeliver=false;
    try{
      await client.query("BEGIN");
      try{
        const active=await client.query<{id:string,status:string;recovery_contact_changed_at:Date|null}>(`
          SELECT id,status,recovery_contact_changed_at FROM account WHERE id=$1 FOR UPDATE`,
          [account.id]);
        if(!active.rowCount||active.rows[0].status!=="ACTIVE"||
          (active.rows[0].recovery_contact_changed_at &&
            active.rows[0].recovery_contact_changed_at.getTime()>Date.now()-24*60*60*1000)){
          await client.query("COMMIT");
          return {message:GENERIC,status:"PROCESSED"};
        }
        const recent=await client.query<{id:string}>(`
          SELECT id FROM auth_challenge WHERE account_id=$1 AND kind='RECOVERY'
            AND created_at>now()-interval '60 seconds' LIMIT 1`,[account.id]);
        if(recent.rowCount){
          await client.query("COMMIT");
          return {message:GENERIC,status:"PROCESSED"};
        }
        const saved=await client.query<{id:string}>(`
          INSERT INTO auth_challenge(id,account_id,kind,digest,request_key,expires_at,delivery_channel)
          VALUES($1,$2,'RECOVERY',$3,$4,now()+interval '10 minutes',$5)
          ON CONFLICT(request_key) DO NOTHING RETURNING id`,
          [id,account.id,digest,requestDigest,channel]);
        shouldDeliver=Boolean(saved.rowCount);
        await client.query("COMMIT");
      }catch(e){await client.query("ROLLBACK");throw e;}
    }finally{client.release();}
    if(!shouldDeliver)return {message:GENERIC,status:"PROCESSED"};
    // One-shot send claim; never silently retry an unknown provider result with the same code.
    const claimed=await this.db.query<{id:string}>(`
      UPDATE auth_challenge SET delivery_status='CLAIMED',delivery_attempts=1
      WHERE id=$1 AND delivery_status='PENDING' AND delivery_attempts=0 RETURNING id`,[id]);
    if(!claimed.rowCount)return {message:GENERIC,status:"PROCESSED"};
    const delivery=await this.delivery.sendOtp(recipient,channel,code);
    await this.db.query(`
      UPDATE auth_challenge SET delivery_status=$2,
      provider_accepted_at=CASE WHEN $2='PROVIDER_ACCEPTED' THEN now() ELSE NULL END
      WHERE id=$1 AND delivery_status='CLAIMED'`,[id,delivery]);
    return {message:GENERIC,status:"PROCESSED"};
  }
  async confirmRecovery(input:{identifier:string;otp:string;newPassword:string},
    remoteAddress:string,correlationRef:string):
    Promise<{status:"PASSWORD_RESET";message:string}> {
    const identifier=input.identifier.trim().toLowerCase();
    await this.rate("network-confirm",remoteAddress,100);
    await this.rate("identifier-confirm",identifier,12);
    const newHash=await hashPassword(input.newPassword);
    const client=await this.db.connect();
    let failed=false;
    try{
      await client.query("BEGIN");
      try{
        const r=await client.query<{
          id:string;realm_id:string;account_id:string;password_hash:string;
          attempts:number;digest:string;expires_at:Date;access_version:string;
          recovery_contact_changed_at:Date|null;
        }>(`
          SELECT c.id,a.realm_id,a.id AS account_id,ic.password_hash,c.attempts,
            c.digest,c.expires_at,a.access_version,a.recovery_contact_changed_at
          FROM account a JOIN identity_credential ic ON ic.account_id=a.id
          JOIN auth_challenge c ON c.account_id=a.id AND c.kind='RECOVERY'
          WHERE a.status='ACTIVE'
            AND (a.normalized_mobile=$1 OR a.normalized_email=$1)
            AND c.delivery_status='PROVIDER_ACCEPTED' AND c.consumed_at IS NULL
            AND c.expires_at>now()
          ORDER BY c.created_at DESC,c.id DESC LIMIT 1
          FOR UPDATE OF a,ic,c`,[identifier]);
        const row=r.rows[0];
        if(!row||row.attempts>=5||
          (row.recovery_contact_changed_at &&
           row.recovery_contact_changed_at.getTime()>Date.now()-24*60*60*1000)){
          throw new BadRequestException("Recovery code could not be confirmed");
        }
        const submitted=this.proof("recovery-otp",row.account_id,row.id,input.otp);
        if(!timingSafeEqual(Buffer.from(submitted,"hex"),Buffer.from(row.digest,"hex"))){
          await client.query("UPDATE auth_challenge SET attempts=attempts+1 WHERE id=$1",[row.id]);
          failed=true;
          await client.query("COMMIT");
        }else{
          if(await verifyPassword(input.newPassword,row.password_hash))
            throw new BadRequestException("Choose a different password");
          await client.query(`
            UPDATE identity_credential SET password_hash=$2,
              credential_version=credential_version+1,updated_at=now() WHERE account_id=$1`,
            [row.account_id,newHash]);
          await client.query(`
            UPDATE account SET access_version=access_version+1,updated_at=now() WHERE id=$1`,
            [row.account_id]);
          await client.query(`
            UPDATE auth_session SET revoked_at=now()
            WHERE account_id=$1 AND revoked_at IS NULL`,[row.account_id]);
          await client.query(`
            UPDATE auth_challenge SET consumed_at=now()
            WHERE account_id=$1 AND kind='RECOVERY' AND consumed_at IS NULL`,[row.account_id]);
          await client.query(`
            INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,
              action_key,outcome,correlation_ref)
            VALUES($1,$2,$2,'identity.password.recovery','SUCCESS',$3)`,
            [row.realm_id,row.account_id,correlationRef]);
          await client.query("COMMIT");
        }
      }catch(e){
        await client.query("ROLLBACK");
        throw e;
      }
    }finally{client.release();}
    if(failed)throw new BadRequestException("Recovery code could not be confirmed");
    return {status:"PASSWORD_RESET",message:"Password updated. Sign in with your new password."};
  }
}
