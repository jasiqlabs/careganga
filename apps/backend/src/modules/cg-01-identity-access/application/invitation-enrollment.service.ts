import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { encryptTotpSecret, decryptTotpSecret, hashPassword, matchedTotpCounter } from "../domain/secret-crypto";

const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(value:Buffer):string{
  let buffer=0,bits=0,output="";
  for(const byte of value){
    buffer=(buffer<<8)|byte;bits+=8;
    while(bits>=5){bits-=5;output+=BASE32[(buffer>>>bits)&31];}
  }
  if(bits>0)output+=BASE32[(buffer<<(5-bits))&31];
  return output;
}
type InvitationRow={
  id:string;account_id:string;realm_id:string;display_name:string;expires_at:Date;
  status:string;attempts:number;enroll_secret_ciphertext:Buffer|null;
  enroll_secret_nonce:Buffer|null;enroll_secret_tag:Buffer|null;
};
@Injectable()
export class InvitationEnrollmentService {
  constructor(@Inject(DATABASE) private readonly db:Pool){}

  private parse(email:unknown,token:unknown){
    if(typeof email!=="string"||typeof token!=="string"||email.length>254||
      !EMAIL.test(email)||!/^[A-Za-z0-9_-]{40,100}$/.test(token))
      throw new BadRequestException("Invitation could not be confirmed");
    return {email:email.trim().toLowerCase(),digest:digest(token)};
  }
  private async limit(kind:string,d:string,remoteAddress:string){
    // One fixed network bucket also bounds random-token spraying and throttle-row growth.
    // HMAC hides the client IP and supplied token; never store either value in this table.
    const secret=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
    if(secret.length!==32)throw new Error("Identity protection key unavailable");
    const keyed=(data:string)=>createHmac("sha256",secret).update(data).digest("hex");
    const networkKey=keyed("cg01:invitation:network:"+kind+":"+remoteAddress);
    const tokenKey=keyed("cg01:invitation:token:"+kind+":"+d+":"+remoteAddress);
    const x=await this.db.query<{key_digest:string;attempt_count:number}>(String.raw`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1),($2,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at<now()-interval '15 minutes'
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at<now()-interval '15 minutes'
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING key_digest,attempt_count`,[networkKey,tokenKey]);
    const requests=new Map(x.rows.map(row=>[row.key_digest,row.attempt_count]));
    if((requests.get(networkKey)??0)>120||(requests.get(tokenKey)??0)>10)
      throw new HttpException("Retry limited",HttpStatus.TOO_MANY_REQUESTS);
  }
  async begin(body:{email:unknown;token:unknown},remoteAddress:string){
    const parsed=this.parse(body?.email,body?.token);
    await this.limit("invitation.begin",parsed.digest,remoteAddress);
    const client=await this.db.connect();
    let transactionOpen=false;
    try{
      await client.query("BEGIN");transactionOpen=true;
      const matched=await client.query<InvitationRow>(String.raw`
        SELECT c.id,c.account_id,c.expires_at,c.attempts,c.enroll_secret_ciphertext,
          c.enroll_secret_nonce,c.enroll_secret_tag,a.realm_id,a.display_name,a.status
        FROM auth_challenge c JOIN account a ON a.id=c.account_id
        WHERE c.digest=$1 AND c.kind='INVITATION' AND a.normalized_email=$2
          AND c.consumed_at IS NULL AND c.expires_at>now() AND c.attempts<5
          AND a.status='INVITED'
          AND EXISTS(
            SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
            WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
              AND r.active=true AND r.is_protected=false
              AND NOT EXISTS(SELECT 1 FROM role_grant rg WHERE rg.role_id=r.id
                AND rg.capability_key IN ('roles.manage','identity.security-policy.manage'))
          ) FOR UPDATE OF c,a`,[parsed.digest,parsed.email]);
      if(!matched.rowCount)throw new BadRequestException("Invitation could not be confirmed");
      const row=matched.rows[0];
      let secret:Buffer;
      if(row.enroll_secret_ciphertext&&row.enroll_secret_nonce&&row.enroll_secret_tag){
        secret=decryptTotpSecret(row.enroll_secret_ciphertext,row.enroll_secret_nonce,row.enroll_secret_tag);
      }else{
        secret=randomBytes(20);
        const encrypted=encryptTotpSecret(secret);
        await client.query(String.raw`
          UPDATE auth_challenge SET enroll_secret_ciphertext=$2,enroll_secret_nonce=$3,
            enroll_secret_tag=$4 WHERE id=$1`,
          [row.id,encrypted.ciphertext,encrypted.nonce,encrypted.tag]);
      }
      const enrollmentSecret=base32(secret);secret.fill(0);
      await client.query("COMMIT");transactionOpen=false;
      // Show only to the claimant holding the email's unguessable invitation token.
      // Never log this key, embed it in a browser URL or store it in a public app.
      return {status:"MFA_ENROLLMENT_REQUIRED",displayName:row.display_name,enrollmentSecret};
    }catch(e){
      if(transactionOpen){try{await client.query("ROLLBACK");}catch{}}
      throw e;
    }finally{client.release();}
  }
  async confirm(body:{email:unknown;token:unknown;password:unknown;totp:unknown},
     remoteAddress:string,correlationRef:string){
    const parsed=this.parse(body?.email,body?.token);
    if(typeof body?.password!=="string"||body.password.length<14||
      Buffer.byteLength(body.password,"utf8")>1024||
      typeof body.totp!=="string"||!/^[0-9]{6}$/.test(body.totp))
      throw new BadRequestException("Check the password and authenticator code");
    await this.limit("invitation.confirm",parsed.digest,remoteAddress);
    const pre=await this.db.query(String.raw`
      SELECT 1 FROM auth_challenge c JOIN account a ON a.id=c.account_id
      WHERE c.digest=$1 AND c.kind='INVITATION' AND a.normalized_email=$2 AND a.status='INVITED'
        AND c.consumed_at IS NULL AND c.expires_at>now() AND c.attempts<5
        AND c.enroll_secret_ciphertext IS NOT NULL
        AND EXISTS(
          SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
          WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
            AND r.active AND NOT r.is_protected
            AND NOT EXISTS(SELECT 1 FROM role_grant rg WHERE rg.role_id=r.id
              AND rg.capability_key IN ('roles.manage','identity.security-policy.manage'))
        ) LIMIT 1`,[parsed.digest,parsed.email]);
    if(!pre.rowCount)throw new BadRequestException("Invitation could not be confirmed");
    const passwordHash=await hashPassword(body.password);
    const client=await this.db.connect();
    let transactionOpen=false;
    try{
      await client.query("BEGIN");transactionOpen=true;
      const matched=await client.query<InvitationRow>(String.raw`
        SELECT c.id,c.account_id,c.expires_at,c.attempts,c.enroll_secret_ciphertext,
          c.enroll_secret_nonce,c.enroll_secret_tag,a.realm_id,a.display_name,a.status
        FROM auth_challenge c JOIN account a ON a.id=c.account_id
        WHERE c.digest=$1 AND c.kind='INVITATION' AND a.normalized_email=$2
          AND c.consumed_at IS NULL AND c.expires_at>now() AND c.attempts<5
          AND a.status='INVITED'
          AND EXISTS(
            SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
            WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
              AND r.active=true AND r.is_protected=false
              AND NOT EXISTS(SELECT 1 FROM role_grant rg WHERE rg.role_id=r.id
                AND rg.capability_key IN ('roles.manage','identity.security-policy.manage'))
          ) FOR UPDATE OF c,a`,[parsed.digest,parsed.email]);
      if(!matched.rowCount)throw new BadRequestException("Invitation could not be confirmed");
      const row=matched.rows[0];
      if(!row.enroll_secret_ciphertext||!row.enroll_secret_nonce||!row.enroll_secret_tag)
        throw new BadRequestException("Start authenticator setup first");
      const secret=decryptTotpSecret(row.enroll_secret_ciphertext,row.enroll_secret_nonce,row.enroll_secret_tag);
      const proof=matchedTotpCounter(secret,body.totp);
      if(proof===null){
        secret.fill(0);
        await client.query("UPDATE auth_challenge SET attempts=attempts+1 WHERE id=$1",[row.id]);
        await client.query("COMMIT");transactionOpen=false;
        throw new BadRequestException("Invitation could not be confirmed");
      }
      const credential=encryptTotpSecret(secret);secret.fill(0);
      await client.query(String.raw`
        INSERT INTO identity_credential(account_id,password_hash,totp_ciphertext,totp_nonce,totp_tag,
          last_totp_counter) VALUES($1,$2,$3,$4,$5,$6)`,
        [row.account_id,passwordHash,credential.ciphertext,credential.nonce,credential.tag,proof]);
      await client.query(String.raw`
        UPDATE account SET status='ACTIVE',email_verified_at=now(),revision=revision+1,
          access_version=access_version+1,updated_at=now() WHERE id=$1`,[row.account_id]);
      await client.query("UPDATE auth_challenge SET consumed_at=now() WHERE id=$1",[row.id]);
      await client.query(String.raw`
        INSERT INTO access_audit(realm_id,target_account_id,action_key,outcome,
          safe_context,correlation_ref) VALUES($1,$2,'identity.invitation.accept','SUCCESS',
            $3::jsonb,$4)`,
        [row.realm_id,row.account_id,JSON.stringify({targetDisplay:row.display_name}),correlationRef]);
      await client.query("COMMIT");transactionOpen=false;
      return {status:"ACCOUNT_ACTIVATED",
        message:"Account activated. Use a fresh authenticator code to sign in."};
    }catch(e){
      if(transactionOpen){try{await client.query("ROLLBACK");}catch{}}
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new BadRequestException("Invitation was already completed");
      throw e;
    }finally{client.release();}
  }
}
