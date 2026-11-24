import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { maybePruneAuthThrottle } from "../infrastructure/throttle-maintenance";
import type { Pool,PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { hashPassword, verifyPassword } from "../domain/secret-crypto";
import type { IdentityAuthorization, VerifiedFoundationActor } from "../public-api";
import { capabilitiesInUse, implementedCapability } from "../domain/capability-catalog";
import { DEFAULT_SECURITY_POLICY } from "../domain/security-policy";

const INVALID_LOGIN = {code:"IDENTITY_LOGIN_INVALID"} as const;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type AccountCredential = {
  id:string;realm_id:string;display_name:string;normalized_mobile:string|null;
  password_hash:string;status:string;access_version:string;credential_version:number;
}

@Injectable()
export class SessionService implements IdentityAuthorization {
  constructor(@Inject(DATABASE) private readonly db: Pool) {}

  private throttleKey(kind: string, value: string): string {
    const key = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
    if (key.length !== 32) throw new Error("Missing protected identity key");
    return createHmac("sha256", key).update(kind + ":" + value).digest("hex");
  }

  /** Reads the one Foundation-root policy, with secure defaults before initial configuration. */
  private async loginRules():Promise<{maxSessionAgeSeconds:number;failedAttemptWindowSeconds:number;maxFailedAttempts:number}>{
    const current=await this.db.query<{
      max_session_age_seconds:number;failed_attempt_window_seconds:number;max_failed_attempts:number
    }>(`
      SELECT COALESCE(p.max_session_age_seconds,$1)::integer AS max_session_age_seconds,
        COALESCE(p.failed_attempt_window_seconds,$2)::integer AS failed_attempt_window_seconds,
        COALESCE(p.max_failed_attempts,$3)::integer AS max_failed_attempts
      FROM access_realm r LEFT JOIN auth_security_policy p ON p.access_realm_id=r.id
      WHERE r.realm_key='FOUNDATION_ROOT'`,
      [DEFAULT_SECURITY_POLICY.maxSessionAgeSeconds,DEFAULT_SECURITY_POLICY.failedAttemptWindowSeconds,
       DEFAULT_SECURITY_POLICY.maxFailedAttempts]);
    const v=current.rows[0];
    if(!v)throw new Error("Foundation identity realm is not configured");
    return {maxSessionAgeSeconds:v.max_session_age_seconds,failedAttemptWindowSeconds:v.failed_attempt_window_seconds,
      maxFailedAttempts:v.max_failed_attempts};
  }
  private async takeAttempt(kind: string, value: string, limit: number,windowSeconds:number): Promise<void> {
    if(kind==="network")await maybePruneAuthThrottle(this.db);
    const digest = this.throttleKey(kind, value);
    const result = await this.db.query<{ attempt_count: number }>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count = CASE WHEN auth_login_attempt.window_started_at < now() - make_interval(secs=>$2)
          THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at = CASE WHEN auth_login_attempt.window_started_at < now() - make_interval(secs=>$2)
          THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`, [digest,windowSeconds]);
    if (result.rows[0].attempt_count > limit)
      throw new HttpException("Retry limit reached", HttpStatus.TOO_MANY_REQUESTS);
  }

  async signIn(details:{identifier:string;password:string;remoteAddress:string;
    deviceLabel:string;correlationRef:string}):Promise<{sessionToken:string;expiresAt:string;displayName:string}>{
    const identifier=details.identifier.trim().toLowerCase();
    const rules=await this.loginRules();
    await this.takeAttempt("network",details.remoteAddress,300,900);
    await this.takeAttempt("ip-identifier",details.remoteAddress+"|"+identifier,
      Math.min(30,rules.maxFailedAttempts*3),rules.failedAttemptWindowSeconds);
    await this.takeAttempt("identifier",identifier,rules.maxFailedAttempts,rules.failedAttemptWindowSeconds);
    const lookup=await this.db.query<AccountCredential>(`
      SELECT a.id,a.realm_id,a.display_name,a.normalized_mobile,a.status,a.access_version,
        c.password_hash,c.credential_version
      FROM account a JOIN identity_credential c ON c.account_id=a.id
      WHERE a.normalized_mobile=$1 OR a.normalized_email=$1 LIMIT 1`,[identifier]);
    const row=lookup.rows[0];
    const passwordOk=row?await verifyPassword(details.password,row.password_hash):
      Boolean(await hashPassword(details.password.padEnd(8,"_"))) && false;
    if(!row||!passwordOk||row.status!=="ACTIVE")
      throw new UnauthorizedException(INVALID_LOGIN);
    const raw=randomBytes(32).toString("base64url"),digest=sha256(raw);
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      try{
        const current=await client.query<AccountCredential>(`
          SELECT a.id,a.realm_id,a.display_name,a.normalized_mobile,a.status,a.access_version,
            c.password_hash,c.credential_version
          FROM account a JOIN identity_credential c ON c.account_id=a.id
          WHERE a.id=$1 FOR UPDATE OF a,c`,[row.id]);
        const locked=current.rows[0];
        if(!locked||locked.status!=="ACTIVE"||locked.password_hash!==row.password_hash
          ||locked.credential_version!==row.credential_version)
          throw new UnauthorizedException(INVALID_LOGIN);
        const role=await client.query<{name:string}>(`
          SELECT r.name FROM account_role ar JOIN role r ON r.id=ar.role_id
          WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL AND r.active=true
          LIMIT 1`,[row.id,row.realm_id]);
        if(!role.rowCount)throw new UnauthorizedException(INVALID_LOGIN);
        const session=await client.query<{expires_at:Date}>(`
          INSERT INTO auth_session(account_id,token_digest,account_access_version,expires_at,
            password_authenticated_at,device_label)
          VALUES($1,$2,$3,now()+make_interval(secs=>$5),now(),$4)
          RETURNING expires_at`,
          [row.id,digest,locked.access_version,details.deviceLabel,rules.maxSessionAgeSeconds]);
        await client.query(`
          INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,
            action_key,outcome,correlation_ref)
          VALUES($1,$2,$2,'identity.session.login','SUCCESS',$3)`,
          [row.realm_id,row.id,details.correlationRef]);
        await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",
          [this.throttleKey("identifier",identifier)]);
        await client.query("COMMIT");
        return {sessionToken:raw,expiresAt:session.rows[0].expires_at.toISOString(),
          displayName:row.display_name};
      }catch(e){await client.query("ROLLBACK");throw e;}
    }finally{client.release();}
  }

  private digestFromBearer(value: string): string {
    if (!/^Bearer [A-Za-z0-9_-]{40,100}$/.test(value ?? ""))
      throw new UnauthorizedException();
    return sha256(value.slice(7));
  }
  async verifySession(bearer: string): Promise<VerifiedFoundationActor> {
    const tokenDigest=this.digestFromBearer(bearer);
    const result=await this.db.query<{
      id:string;account_id:string;realm_id:string;display_name:string;role_name:string;password_authenticated_at:Date;
    }>(`
      SELECT s.id,s.account_id,a.realm_id,a.display_name,r.name AS role_name,s.password_authenticated_at
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.password_authenticated_at IS NOT NULL
        AND s.expires_at > now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
      LIMIT 1`,[tokenDigest]);
    const actor=result.rows[0];
    if (!actor) throw new UnauthorizedException();
    // Bounded last-seen write. A shorter policy is still evaluated on each protected read.
    await this.db.query(`UPDATE auth_session SET last_seen_at=now()
      WHERE id=$1 AND revoked_at IS NULL AND last_seen_at < now() - interval '60 seconds'`,[actor.id]);
    return {
      accountId:actor.account_id,realmId:actor.realm_id,
      displayName:actor.display_name,roleName:actor.role_name,
      activeSessionId:actor.id,passwordAuthenticatedAt:actor.password_authenticated_at
    };
  }
  private async allowedActionsFor(actor: VerifiedFoundationActor): Promise<string[]> {
    // Reconfirm session and membership in the same guarded query: client roles never confer authority.
    const result=await this.db.query<{
      is_protected:boolean;capability_key:string|null;approved_sensitive:boolean
    }>(`
      SELECT r.is_protected,rg.capability_key,
        EXISTS(SELECT 1 FROM cg01_approved_sensitive_assignment eff
          WHERE eff.realm_id=a.realm_id AND eff.target_account_id=a.id
            AND eff.target_role_id=r.id AND eff.approved_role_revision=r.revision
            AND eff.resulting_access_version<=a.access_version
        ) AS approved_sensitive
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      LEFT JOIN role_grant rg ON rg.role_id=r.id
      WHERE s.id=$1 AND s.account_id=$2 AND s.revoked_at IS NULL
        AND s.expires_at>now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
        AND s.password_authenticated_at IS NOT NULL AND a.realm_id=$3`,
      [actor.activeSessionId,actor.accountId,actor.realmId]);
    if (!result.rowCount)throw new UnauthorizedException();
    const implemented=capabilitiesInUse();
    // A protected Foundation root has ONLY the concrete implemented CG-01 actions.
    if(result.rows.some(row=>row.is_protected))return implemented.map(c=>c.key);
    return [...new Set(result.rows
      .filter(row=>row.capability_key&&(
        implementedCapability(row.capability_key)?.assignable===true||
        (row.capability_key==="roles.manage"&&row.approved_sensitive)
      ))
      .map(row=>row.capability_key as string))];
  }
  /**
   * Current-role-only principal for unattended, CG-20-owned scheduled MIS.
   * This is NOT an auth_session, impersonated bearer, login or new identity
   * scope. Only the stored owner/recipient on a durable scheduled report may
   * be supplied by the caller. Original source owners must re-check their
   * branch/purpose/center scopes before generation and sending.
   * Never expose this method through an HTTP controller.
   */
  async requireScheduledMisAction(rootInput:string,accountInput:string,action:string,client:Pool|PoolClient=this.db):
   Promise<{realmId:string;accountId:string;accessVersion:string}>{
    if(!["mis.reports.view","mis.reports.manage","mis.reports.export","mis.reports.schedule",
      "finance.reports.view","foundation.branches.admin","projects.view","projects.export",
      "communications.notifications.view",
      "platform.audit.view"].includes(action)||
      !implementedCapability(action))
      throw new ForbiddenException("This scheduled reporting action is unavailable");
    const result=await client.query<{
      access_version:string;is_protected:boolean;
      capability_key:string|null;approved_sensitive:boolean
    }>(`
      SELECT a.access_version::text AS access_version,
        r.is_protected,gr.capability_key,
        EXISTS(SELECT 1 FROM cg01_approved_sensitive_assignment approved
          WHERE approved.realm_id=a.realm_id
            AND approved.target_account_id=a.id
            AND approved.target_role_id=r.id
            AND approved.approved_role_revision=r.revision
            AND approved.resulting_access_version<=a.access_version
        ) AS approved_sensitive
      FROM access_realm foundation
      JOIN account a ON a.realm_id=foundation.id AND a.status='ACTIVE'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id
        AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      LEFT JOIN role_grant gr ON gr.role_id=r.id
      WHERE foundation.id=$1 AND foundation.realm_key='FOUNDATION_ROOT'
        AND a.id=$2
      LIMIT 250
    `,[rootInput,accountInput]);
    if(!result.rows.length||result.rows.length>=250)
      throw new ForbiddenException("Scheduled report account is unavailable");
    const allowed=result.rows.some(row=>row.is_protected||
      row.capability_key===action&&(
        implementedCapability(action)?.assignable===true||
        action==="roles.manage"&&row.approved_sensitive));
    if(!allowed)throw new ForbiddenException(
     "The current account no longer permits this scheduled report");
    return {realmId:rootInput,accountId:accountInput,
      accessVersion:result.rows[0].access_version};
  }

    /** Private CG-20 definition sharing may search eligible staff ONLY.
   * Source grants still have to be checked when a recipient opens or copies
   * the definition. Search never returns email, phone or technical IDs to UI.
   */
  async eligibleMisShareRecipients(bearer:string,search:unknown){
    const actor=await this.requireAction(bearer,"mis.reports.share");
    await this.requireAction(bearer,"mis.reports.manage");
    if(typeof search!=="string"||search.trim().length<2||
       search.trim().length>60)
      throw new BadRequestException("Enter at least two letters to find a colleague");
    const q=await this.db.query<{ref:string;name:string}>(`
      SELECT a.id AS ref,a.display_name AS name FROM account a
      WHERE a.realm_id=$1 AND a.id<>$2 AND a.status='ACTIVE'
        AND position(lower($3) in lower(a.display_name))>0
        AND EXISTS(
         SELECT 1 FROM account_role ar
         JOIN role r ON r.id=ar.role_id AND r.active=true
         WHERE ar.realm_id=a.realm_id AND ar.account_id=a.id
           AND ar.revoked_at IS NULL
           AND (r.is_protected OR EXISTS(
            SELECT 1 FROM role_grant g
            WHERE g.role_id=r.id AND g.capability_key='mis.reports.view'
           ))
        )
        AND EXISTS(
         SELECT 1 FROM account_role ar
         JOIN role r ON r.id=ar.role_id AND r.active=true
         WHERE ar.realm_id=a.realm_id AND ar.account_id=a.id
           AND ar.revoked_at IS NULL
           AND (r.is_protected OR EXISTS(
            SELECT 1 FROM role_grant g
            WHERE g.role_id=r.id AND g.capability_key='mis.reports.manage'
           ))
        )
      ORDER BY a.display_name,a.id LIMIT 16`,
      [actor.realmId,actor.accountId,search.trim()]);
    return {people:q.rows.slice(0,15),hasMore:q.rows.length>15};
  }

async effectiveAccess(bearer:string):Promise<{displayName:string;roleName:string;actions:readonly {key:string;businessLabel:string;group:string}[]}> {
    const actor=await this.verifySession(bearer);
    const granted=await this.allowedActionsFor(actor);
    return {
      displayName:actor.displayName,roleName:actor.roleName,
      actions:capabilitiesInUse().filter(c=>granted.includes(c.key))
        .map(({key,businessLabel,group})=>({key,businessLabel,group}))
    };
  }
  async requireAction(bearer: string, capability: string): Promise<VerifiedFoundationActor> {
    const actor=await this.verifySession(bearer);
    if(capability==="identity.session.self")return actor;
    if(!implementedCapability(capability))throw new ForbiddenException();
    if(!(await this.allowedActionsFor(actor)).includes(capability))
      throw new ForbiddenException();
    return actor;
  }
  /** Fresh current-password confirmation, in the protected owner's commit transaction.
   * Password proof does not replace caller action, role and resource checks. Caller also enforces
   * separated approval, scoped roles, idempotency and current versions.
   */
  async requireFreshFoundationRootProof(
    client:PoolClient,actor:VerifiedFoundationActor,currentPassword:string
  ):Promise<void>{
    if(typeof currentPassword!=="string"||currentPassword.length<8
      ||Buffer.byteLength(currentPassword,"utf8")>1024)
      throw new ForbiddenException("Enter the current password to confirm");
    const current=await client.query<{password_hash:string}>(`
      SELECT c.password_hash
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id
        AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=true
      JOIN identity_credential c ON c.account_id=a.id
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      WHERE s.id=$1 AND s.account_id=$2 AND a.realm_id=$3
        AND s.revoked_at IS NULL AND s.password_authenticated_at IS NOT NULL
        AND s.expires_at>now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
      FOR UPDATE OF s,a,ar,r,c
    `,[actor.activeSessionId,actor.accountId,actor.realmId]);
    if(!current.rowCount||!await verifyPassword(currentPassword,current.rows[0].password_hash))
      throw new ForbiddenException("Current password could not be confirmed");
    // Count failed proofs, not every valid protected write. This row deletion
    // commits only when the caller's protected operation commits successfully.
    await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",
      [this.throttleKey("foundation-root-fresh-proof",actor.accountId)]);
  }

  /** Throttle fresh privileged password attempts outside the caller's write transaction,
   * so failed proofs cannot roll back their own failed-attempt counter. */
  async limitFoundationRootProof(actor:VerifiedFoundationActor):Promise<void>{
    const rules=await this.loginRules();
    const digest=this.throttleKey("foundation-root-fresh-proof",actor.accountId);
    const count=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at <
          now()-make_interval(secs=>$2) THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at <
          now()-make_interval(secs=>$2) THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count
    `,[digest,rules.failedAttemptWindowSeconds]);
    if(count.rows[0].attempt_count>rules.maxFailedAttempts)
      throw new HttpException("Password confirmation retry limit",HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Clinical professional sign-off requires a fresh password from the
   * ORIGINAL CG01 account, regardless of whether the clinician's role is
   * a protected Foundation administration role. The caller additionally
   * verifies exact clinical action, center and CG14 licensed identity.
   * Do not reuse broad root-only approval privileges for clinicians.
   */
  async limitClinicalProfessionalProof(actor:VerifiedFoundationActor):Promise<void>{
    const rules=await this.loginRules();
    const digest=this.throttleKey("clinical-professional-proof",actor.accountId);
    const row=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at<
          now()-make_interval(secs=>$2) THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at<
          now()-make_interval(secs=>$2) THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`,[digest,rules.failedAttemptWindowSeconds]);
    if(row.rows[0].attempt_count>rules.maxFailedAttempts)
      throw new HttpException("Professional password retry limit",HttpStatus.TOO_MANY_REQUESTS);
  }
  async requireClinicalProfessionalProof(client:PoolClient,
    actor:VerifiedFoundationActor,password:string):Promise<void>{
    if(typeof password!=="string"||password.length<8||
      Buffer.byteLength(password,"utf8")>1024)
      throw new ForbiddenException("Confirm your current account password");
    const q=await client.query<{password_hash:string}>(`
      SELECT credentials.password_hash FROM auth_session session
      JOIN account member ON member.id=session.account_id
        AND member.realm_id=$3 AND member.status='ACTIVE'
        AND member.access_version=session.account_access_version
      JOIN identity_credential credentials ON credentials.account_id=member.id
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=member.realm_id
      WHERE session.id=$1 AND session.account_id=$2
        AND session.revoked_at IS NULL
        AND session.password_authenticated_at IS NOT NULL
        AND session.expires_at>now()
        AND session.issued_at>now()-make_interval(secs=>COALESCE(
          policy.max_session_age_seconds,28800))
        AND session.last_seen_at>now()-make_interval(secs=>COALESCE(
          policy.idle_timeout_seconds,1800))
      FOR UPDATE OF session,member,credentials`,
      [actor.activeSessionId,actor.accountId,actor.realmId]);
    if(!q.rows[0]||!await verifyPassword(password,q.rows[0].password_hash))
      throw new ForbiddenException("Current clinical account password is incorrect");
    await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",
      [this.throttleKey("clinical-professional-proof",actor.accountId)]);
  }

  /** Signed-in password change for every role; old sessions are invalid immediately. */
  async changePassword(bearer:string,currentPassword:string,newPassword:string,
    correlationRef:string):Promise<{status:"PASSWORD_CHANGED";message:string}>{
    const actor=await this.verifySession(bearer);
    if(typeof currentPassword!=="string"||typeof newPassword!=="string"
      ||currentPassword.length<1||Buffer.byteLength(currentPassword,"utf8")>1024
      ||newPassword.length<8||Buffer.byteLength(newPassword,"utf8")>1024)
      throw new ForbiddenException("Check the current and new passwords");
    // A stolen session must not become an unlimited online password oracle.
    await this.takeAttempt("self-password-change",actor.accountId,6,900);
    const newHash=await hashPassword(newPassword);
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      try{
        const res=await client.query<{password_hash:string}>(`
          SELECT c.password_hash FROM auth_session s
          JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
            AND a.access_version=s.account_access_version
          JOIN identity_credential c ON c.account_id=a.id
          WHERE s.id=$1 AND s.account_id=$2 AND s.revoked_at IS NULL
            AND s.password_authenticated_at IS NOT NULL AND s.expires_at>now()
          FOR UPDATE OF s,a,c`,
          [actor.activeSessionId,actor.accountId]);
        if(!res.rowCount||!await verifyPassword(currentPassword,res.rows[0].password_hash))
          throw new ForbiddenException("Current password could not be confirmed");
        if(await verifyPassword(newPassword,res.rows[0].password_hash))
          throw new ForbiddenException("Choose a different password");
        await client.query(`
          UPDATE identity_credential SET password_hash=$2,
            credential_version=credential_version+1,updated_at=now()
          WHERE account_id=$1`,[actor.accountId,newHash]);
        await client.query("UPDATE account SET access_version=access_version+1,updated_at=now() WHERE id=$1",
          [actor.accountId]);
        await client.query("UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",
          [actor.accountId]);
        await client.query(`
          INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,
            action_key,outcome,correlation_ref)
          VALUES($1,$2,$2,'identity.password.change','SUCCESS',$3)`,
          [actor.realmId,actor.accountId,correlationRef]);
        await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",
          [this.throttleKey("self-password-change",actor.accountId)]);
        await client.query("COMMIT");
      }catch(e){await client.query("ROLLBACK");throw e;}
    }finally{client.release();}
    return {status:"PASSWORD_CHANGED",message:"Password changed. Sign in again."};
  }

  async signOut(bearer: string): Promise<void> {
    const digest=this.digestFromBearer(bearer);
    await this.db.query(`UPDATE auth_session SET revoked_at=now()
      WHERE token_digest=$1 AND revoked_at IS NULL`, [digest]);
  }
}
