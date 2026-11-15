import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { decryptTotpSecret, hashPassword, matchedTotpCounter, verifyPassword } from "../domain/secret-crypto";
import type { IdentityAuthorization, VerifiedFoundationActor } from "../public-api";

const INVALID_LOGIN = "The account details or verification code could not be confirmed.";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type AccountCredential = {
  id: string; realm_id: string; display_name: string; normalized_email: string;
  password_hash: string; totp_ciphertext: Buffer | null; totp_nonce: Buffer | null;
  totp_tag: Buffer | null; last_totp_counter: string; status: string; access_version: string;
};

@Injectable()
export class SessionService implements IdentityAuthorization {
  constructor(@Inject(DATABASE) private readonly db: Pool) {}

  private throttleKey(kind: string, value: string): string {
    const key = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
    if (key.length !== 32) throw new Error("Missing protected identity key");
    return createHmac("sha256", key).update(kind + ":" + value).digest("hex");
  }

  private async takeAttempt(kind: string, value: string, limit: number): Promise<void> {
    const digest = this.throttleKey(kind, value);
    const result = await this.db.query<{ attempt_count: number }>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count = CASE WHEN auth_login_attempt.window_started_at < now() - interval '15 minutes'
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at = CASE WHEN auth_login_attempt.window_started_at < now() - interval '15 minutes'
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`, [digest]);
    if (result.rows[0].attempt_count > limit)
      throw new HttpException("Retry limit reached", HttpStatus.TOO_MANY_REQUESTS);
  }

  async signIn(details: { email: string; password: string; totp: string; remoteAddress: string; deviceLabel: string }):
      Promise<{ sessionToken: string; expiresAt: string; displayName: string }> {
    const email = details.email.trim().toLowerCase();
    // Do not globally lock out all users sharing one trusted Web BFF/proxy IP.
    await this.takeAttempt("ip-email", details.remoteAddress + "|" + email, 20);
    await this.takeAttempt("email", email, 6);
    const lookup = await this.db.query<AccountCredential>(`
      SELECT a.id,a.realm_id,a.display_name,a.normalized_email,a.status,a.access_version,
             c.password_hash,c.totp_ciphertext,c.totp_nonce,c.totp_tag,c.last_totp_counter
      FROM account a JOIN identity_credential c ON c.account_id = a.id
      WHERE a.normalized_email=$1 LIMIT 1`, [email]);
    const row = lookup.rows[0];
    // Match scrypt work for unknown contacts without disclosing account existence.
    const passwordOk = row ? await verifyPassword(details.password,row.password_hash)
      : Boolean(await hashPassword(details.password.padEnd(14,"_"))) && false;
    if (!row || !passwordOk || row.status !== "ACTIVE" || !row.totp_ciphertext
        || !row.totp_nonce || !row.totp_tag) throw new UnauthorizedException(INVALID_LOGIN);

    const secret = decryptTotpSecret(row.totp_ciphertext,row.totp_nonce,row.totp_tag);
    const matchedCounter = matchedTotpCounter(secret,details.totp);
    secret.fill(0);
    if (matchedCounter === null) throw new UnauthorizedException(INVALID_LOGIN);

    const raw = randomBytes(32).toString("base64url");
    const digest = sha256(raw);
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      try {
        const locked = await client.query<AccountCredential>(`
          SELECT a.id,a.realm_id,a.display_name,a.status,a.access_version,c.password_hash,
                 c.totp_ciphertext,c.totp_nonce,c.totp_tag,c.last_totp_counter
          FROM account a JOIN identity_credential c ON c.account_id=a.id
          WHERE a.id=$1 FOR UPDATE OF a,c`, [row.id]);
        const current = locked.rows[0];
        // Do not accept MFA verified against a credential secret rotated between read and lock.
        if (!current || current.status !== "ACTIVE" || current.password_hash !== row.password_hash
            || !current.totp_ciphertext?.equals(row.totp_ciphertext)
            || !current.totp_nonce?.equals(row.totp_nonce)
            || !current.totp_tag?.equals(row.totp_tag)
            || matchedCounter <= Number(current.last_totp_counter))
          throw new UnauthorizedException(INVALID_LOGIN);
        const role = await client.query<{ name: string; is_protected: boolean }>(`
          SELECT r.name,r.is_protected FROM account_role ar
          JOIN role r ON r.id=ar.role_id
          WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL AND r.active=true
          LIMIT 1`, [row.id,row.realm_id]);
        if (!role.rowCount || !role.rows[0].is_protected)
          throw new UnauthorizedException(INVALID_LOGIN);
        const session = await client.query<{ expires_at: Date }>(`
          INSERT INTO auth_session(account_id,token_digest,account_access_version,expires_at,mfa_verified_at,device_label)
          VALUES($1,$2,$3,now()+interval '8 hours',now(),$4) RETURNING expires_at`,
          [row.id,digest,current.access_version,details.deviceLabel]);
        await client.query("UPDATE identity_credential SET last_totp_counter=$2 WHERE account_id=$1",
          [row.id, matchedCounter]);
        await client.query(`
          INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,correlation_ref)
          VALUES($1,$2,$2,'identity.session.login','SUCCESS',$3)`,[row.realm_id,row.id,randomUUID()]);
        // The throttle cleanup is part of the transaction. Never report a failed sign-in
        // after the session and mandatory audit have already committed.
        await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",[this.throttleKey("email",email)]);
        await client.query("COMMIT");
        return {sessionToken:raw,expiresAt:session.rows[0].expires_at.toISOString(),displayName:row.display_name};
      } catch(e) { await client.query("ROLLBACK"); throw e; }
    } finally { client.release(); }
  }

  private digestFromBearer(value: string): string {
    if (!/^Bearer [A-Za-z0-9_-]{40,100}$/.test(value ?? ""))
      throw new UnauthorizedException();
    return sha256(value.slice(7));
  }
  async verifySession(bearer: string): Promise<VerifiedFoundationActor> {
    const tokenDigest=this.digestFromBearer(bearer);
    const result=await this.db.query<{
      id:string;account_id:string;realm_id:string;display_name:string;role_name:string;mfa_verified_at:Date;
    }>(`
      SELECT s.id,s.account_id,a.realm_id,a.display_name,r.name AS role_name,s.mfa_verified_at
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
        AND s.expires_at > now() AND s.last_seen_at > now() - interval '30 minutes'
      LIMIT 1`,[tokenDigest]);
    const actor=result.rows[0];
    if (!actor) throw new UnauthorizedException();
    // Bounded DB write, but never extends the fixed 8-hour session maximum.
    await this.db.query(`UPDATE auth_session SET last_seen_at=now()
      WHERE id=$1 AND revoked_at IS NULL AND last_seen_at < now() - interval '60 seconds'`,[actor.id]);
    return {
      accountId:actor.account_id,realmId:actor.realm_id,
      displayName:actor.display_name,roleName:actor.role_name,
      activeSessionId:actor.id,mfaVerifiedAt:actor.mfa_verified_at
    };
  }
  async requireAction(bearer: string, capability: string): Promise<VerifiedFoundationActor> {
    const actor=await this.verifySession(bearer);
    // The first story only implements self-session access; all future module actions default-deny.
    if (capability !== "identity.session.self") throw new UnauthorizedException();
    return actor;
  }
  async signOut(bearer: string): Promise<void> {
    const digest=this.digestFromBearer(bearer);
    await this.db.query(`UPDATE auth_session SET revoked_at=now()
      WHERE token_digest=$1 AND revoked_at IS NULL`, [digest]);
  }
}
