import { BadRequestException,ConflictException,ForbiddenException,HttpException,HttpStatus,Inject,Injectable,UnauthorizedException } from "@nestjs/common";
import { createHmac,randomUUID } from "node:crypto";
import type { Pool,PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "./session.service";
import { decryptTotpSecret,matchedTotpCounter } from "../domain/secret-crypto";
import { DEFAULT_SECURITY_POLICY,validateSecurityPolicy,
  type SecurityPolicyValues,type SecurityPolicyView } from "../domain/security-policy";
import type { VerifiedFoundationActor } from "../public-api";

type PolicyRow={
  id:string;revision:number;max_session_age_seconds:number;idle_timeout_seconds:number;
  failed_attempt_window_seconds:number;max_failed_attempts:number;root_mfa_required:boolean;
  updated_at:Date;
};
type ProofRow={
  account_id:string;password_hash:string;last_totp_counter:string;
  totp_ciphertext:Buffer|null;totp_nonce:Buffer|null;totp_tag:Buffer|null;
};
type UpdateBody={
  maxSessionAgeSeconds:number;idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;maxFailedAttempts:number;rootMfaRequired:true;
  expectedRevision:number;idempotencyKey:string;totp:string;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function conflict(code:string):ConflictException{
  return new ConflictException({code});
}
function toValues(p:PolicyRow|null):SecurityPolicyValues{
  return p?{
    maxSessionAgeSeconds:p.max_session_age_seconds,
    idleTimeoutSeconds:p.idle_timeout_seconds,
    failedAttemptWindowSeconds:p.failed_attempt_window_seconds,
    maxFailedAttempts:p.max_failed_attempts,rootMfaRequired:true
  }:{...DEFAULT_SECURITY_POLICY};
}
function toView(p:PolicyRow|null):SecurityPolicyView{
  return {...toValues(p),revision:p?.revision??0,updatedAt:p?.updated_at.toISOString()??null};
}
function digest(values:SecurityPolicyValues,expectedRevision:number):string {
  const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
  if(key.length!==32)throw new Error("Identity encryption key unavailable");
  return createHmac("sha256",key).update(JSON.stringify([values,expectedRevision])).digest("hex");
}

@Injectable()
export class SecurityPolicyService {
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService){}

  /** Read is privileged and always checked on a real, currently protected Foundation-root actor. */
  private async root(bearer:string):Promise<VerifiedFoundationActor>{
    const actor=await this.sessions.requireAction(bearer,"identity.security-policy.view");
    const proof=await this.db.query(`
      SELECT 1 FROM auth_session s JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=true
      WHERE s.id=$1 AND s.account_id=$2 AND a.realm_id=$3
        AND s.revoked_at IS NULL AND s.account_access_version=a.access_version
        AND s.mfa_verified_at IS NOT NULL AND s.expires_at>now()
        AND s.last_seen_at>now()-interval '30 minutes' LIMIT 1`,
      [actor.activeSessionId,actor.accountId,actor.realmId]);
    if(!proof.rowCount)throw new ForbiddenException();
    return actor;
  }
  async read(bearer:string):Promise<SecurityPolicyView>{
    const actor=await this.root(bearer);
    const rows=await this.db.query<PolicyRow>(`
      SELECT id,revision,max_session_age_seconds,idle_timeout_seconds,
        failed_attempt_window_seconds,max_failed_attempts,root_mfa_required,updated_at
      FROM auth_security_policy WHERE access_realm_id=$1`,[actor.realmId]);
    return toView(rows.rows[0]??null);
  }
  private async lockCurrent(client:PoolClient,actor:VerifiedFoundationActor):
      Promise<ProofRow>{
    const result=await client.query<ProofRow>(`
      SELECT a.id AS account_id,c.password_hash,c.last_totp_counter,
        c.totp_ciphertext,c.totp_nonce,c.totp_tag
      FROM account a
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN auth_session s ON s.account_id=a.id
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id
        AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=true
      JOIN identity_credential c ON c.account_id=a.id
      LEFT JOIN auth_security_policy p ON p.access_realm_id=a.realm_id
      WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE'
        AND s.id=$3 AND s.account_access_version=a.access_version
        AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
        AND s.expires_at>now() AND s.issued_at>now()-make_interval(secs=>COALESCE(p.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(p.idle_timeout_seconds,1800))
      FOR UPDATE OF a,s,c`,
      [actor.accountId,actor.realmId,actor.activeSessionId]);
    if(!result.rowCount)throw new ForbiddenException("Root access could not be confirmed");
    return result.rows[0];
  }
  private async rateLimitMfa(actor:VerifiedFoundationActor):Promise<void>{
    // Bound online proof guesses before checking an authenticator; no raw session identifiers in this table.
    const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
    if(key.length!==32)throw new Error("Identity key unavailable");
    const hash=createHmac("sha256",key).update("policy-proof:"+actor.accountId).digest("hex");
    const policy=await this.db.query<{window_seconds:number;max_attempts:number}>(`
      SELECT COALESCE(p.failed_attempt_window_seconds,900)::integer AS window_seconds,
        COALESCE(p.max_failed_attempts,6)::integer AS max_attempts
      FROM access_realm r LEFT JOIN auth_security_policy p ON p.access_realm_id=r.id
      WHERE r.id=$1 AND r.realm_key='FOUNDATION_ROOT'`,[actor.realmId]);
    if(!policy.rowCount)throw new ForbiddenException();
    const settings=policy.rows[0];
    const row=await this.db.query<{attempt_count:number}>(`
      INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count)
      VALUES($1,now(),1)
      ON CONFLICT(key_digest) DO UPDATE SET
        attempt_count=CASE WHEN auth_login_attempt.window_started_at <
          now()-make_interval(secs=>$2) THEN 1 ELSE auth_login_attempt.attempt_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt.window_started_at <
          now()-make_interval(secs=>$2) THEN now() ELSE auth_login_attempt.window_started_at END
      RETURNING attempt_count`,[hash,settings.window_seconds]);
    if(row.rows[0].attempt_count>settings.max_attempts)
      throw new HttpException("Retry limit reached",HttpStatus.TOO_MANY_REQUESTS);
  }
  async update(bearer:string,body:unknown,correlationRef:string):
      Promise<{status:"SAVED"|"REPLAY_CONFIRMED";revision:number}> {
    const actor=await this.root(bearer);
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException();
    const input=body as Record<string,unknown>;
    const permitted=[
      "maxSessionAgeSeconds","idleTimeoutSeconds","failedAttemptWindowSeconds",
      "maxFailedAttempts","rootMfaRequired","expectedRevision","idempotencyKey","totp"
    ];
    if(Object.keys(input).some(k=>!permitted.includes(k))||
      !Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||
      Number(input.expectedRevision)>2147483646||
      typeof input.idempotencyKey!=="string"||!UUID.test(input.idempotencyKey)||
      typeof input.totp!=="string"||!/^[0-9]{6}$/.test(input.totp))
      throw new BadRequestException("Check security policy information");
    let values:SecurityPolicyValues;
    try{
      values=validateSecurityPolicy({
        maxSessionAgeSeconds:input.maxSessionAgeSeconds,idleTimeoutSeconds:input.idleTimeoutSeconds,
        failedAttemptWindowSeconds:input.failedAttemptWindowSeconds,
        maxFailedAttempts:input.maxFailedAttempts,rootMfaRequired:input.rootMfaRequired
      });
    }catch{throw new BadRequestException("The security policy is outside permitted limits");}
    const expectedRevision=Number(input.expectedRevision);
    await this.rateLimitMfa(actor);
    const requestDigest=digest(values,expectedRevision);
    const client=await this.db.connect();
    let transactionOpen=false;
    try{
      await client.query("BEGIN");transactionOpen=true;
      // Serializes root-policy updates including initial insert without a second realm or DB.
      const realm=await client.query<{id:string}>(`
        SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE`,
        [actor.realmId]);
      if(!realm.rowCount)throw new ForbiddenException();
      const auth=await this.lockCurrent(client,actor);
      const existing=await client.query<{request_digest:string;result_revision:number}>(`
        SELECT request_digest,result_revision FROM auth_security_policy_command
        WHERE actor_account_id=$1 AND idempotency_key=$2`,
        [actor.accountId,input.idempotencyKey]);
      if(existing.rowCount){
        if(existing.rows[0].request_digest!==requestDigest)
          throw conflict("POLICY_REPLAY_CONFLICT");
        await client.query("COMMIT");transactionOpen=false;
        return {status:"REPLAY_CONFIRMED",revision:existing.rows[0].result_revision};
      }
      // Fresh one-use CG-01 TOTP proof; never re-use the login counter.
      if(!auth.totp_ciphertext||!auth.totp_nonce||!auth.totp_tag)
        throw new UnauthorizedException("Authenticator confirmation required");
      const raw=decryptTotpSecret(auth.totp_ciphertext,auth.totp_nonce,auth.totp_tag);
      const counter=matchedTotpCounter(raw,String(input.totp));raw.fill(0);
      if(counter===null||counter<=Number(auth.last_totp_counter))
        throw new UnauthorizedException("A fresh authenticator code is required");
      const current=await client.query<PolicyRow>(`
        SELECT id,revision,max_session_age_seconds,idle_timeout_seconds,
          failed_attempt_window_seconds,max_failed_attempts,root_mfa_required,updated_at
        FROM auth_security_policy WHERE access_realm_id=$1 FOR UPDATE`,[actor.realmId]);
      const before=current.rows[0]??null;
      if(expectedRevision!==(before?.revision??0))throw conflict("POLICY_STALE");
      const previous=toValues(before);
      if(JSON.stringify(previous)===JSON.stringify(values))
        throw new BadRequestException("No security policy changes were selected");
      let policyId:string,revision:number;
      if(before){
        revision=before.revision+1;
        const next=await client.query<{id:string}>(`
          UPDATE auth_security_policy SET revision=$2,max_session_age_seconds=$3,
            idle_timeout_seconds=$4,failed_attempt_window_seconds=$5,max_failed_attempts=$6,
            root_mfa_required=TRUE,updated_by=$7,updated_at=now()
          WHERE id=$1 RETURNING id`,
          [before.id,revision,values.maxSessionAgeSeconds,values.idleTimeoutSeconds,
           values.failedAttemptWindowSeconds,values.maxFailedAttempts,actor.accountId]);
        policyId=next.rows[0].id;
      }else{
        revision=1;
        const created=await client.query<{id:string}>(`
          INSERT INTO auth_security_policy(access_realm_id,revision,max_session_age_seconds,
            idle_timeout_seconds,failed_attempt_window_seconds,max_failed_attempts,
            root_mfa_required,updated_by)
          VALUES($1,1,$2,$3,$4,$5,TRUE,$6) RETURNING id`,
          [actor.realmId,values.maxSessionAgeSeconds,values.idleTimeoutSeconds,
           values.failedAttemptWindowSeconds,values.maxFailedAttempts,actor.accountId]);
        policyId=created.rows[0].id;
      }
      await client.query(`
        INSERT INTO auth_security_policy_revision(policy_id,revision,safe_previous_values,
          safe_effective_values,actor_ref,correlation_ref)
        VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
        [policyId,revision,JSON.stringify(previous),JSON.stringify(values),actor.accountId,correlationRef]);
      const changed=Object.keys(values).filter(k=>
        (previous as unknown as Record<string,unknown>)[k]!== (values as unknown as Record<string,unknown>)[k]);
      await client.query(`
        INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,
          action_key,outcome,safe_context,correlation_ref)
        VALUES($1,$2,$2,'identity.security-policy.update','SUCCESS',$3::jsonb,$4)`,
        [actor.realmId,actor.accountId,JSON.stringify({changedFields:changed}),correlationRef]);
      await client.query(`
        UPDATE identity_credential SET last_totp_counter=$2 WHERE account_id=$1`,
        [actor.accountId,counter]);
      // Clear this actor's proof-attempt bucket only after the policy+audit are durable.
      const proofKey=createHmac("sha256",
        Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64"))
        .update("policy-proof:"+actor.accountId).digest("hex");
      await client.query("DELETE FROM auth_login_attempt WHERE key_digest=$1",[proofKey]);
      await client.query(`
        UPDATE auth_session SET mfa_verified_at=now()
        WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL`,
        [actor.activeSessionId,actor.accountId]);
      await client.query(`
        INSERT INTO auth_security_policy_command(actor_account_id,idempotency_key,
          request_digest,policy_id,result_revision) VALUES($1,$2,$3,$4,$5)`,
        [actor.accountId,input.idempotencyKey,requestDigest,policyId,revision]);
      await client.query("COMMIT");transactionOpen=false;
      return {status:"SAVED",revision};
    }catch(e){
      if(transactionOpen){try{await client.query("ROLLBACK");}catch{}}
      throw e;
    }finally{client.release();}
  }
}
