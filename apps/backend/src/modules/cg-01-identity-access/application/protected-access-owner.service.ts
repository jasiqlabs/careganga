import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {createHash,randomUUID} from "node:crypto";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "./session.service";
import type {VerifiedFoundationActor} from "../public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type FrozenProtectedChange=Readonly<{
  accountRef:string;accountName:string;accountAccessVersion:string;
  roleRef:string;roleName:string;roleRevision:number;
}>;
/**
 * CG-01's public owner adapter. CG-03 cannot query/mutate CG-01 repositories
 * directly. This class exclusively owns authorization and source snapshots.
 */
@Injectable()
export class ProtectedAccessOwnerService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService){}
  async verifyProposer(client:PoolClient,actor:VerifiedFoundationActor):Promise<void>{
    const rows=await client.query<{permitted:boolean}>(`
      SELECT (r.is_protected OR EXISTS(
        SELECT 1 FROM role_grant rg
        WHERE rg.role_id=r.id AND rg.capability_key='approvals.propose'
      )) AS permitted
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version AND a.realm_id=$3
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      WHERE s.id=$1 AND a.id=$2 AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
        AND s.expires_at>now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
      FOR SHARE OF s,a,ar,r
    `,[actor.activeSessionId,actor.accountId,actor.realmId]);
    if(!rows.rowCount||!rows.rows[0].permitted)
      throw new ForbiddenException("Current access does not permit this request");
  }
  /** Review-time privilege check with session/account/role row locks so a
   *  concurrent role revocation cannot race the accepted CG-03 decision.
   */
  async verifyReviewer(client:PoolClient,actor:VerifiedFoundationActor,
    capability:"roles.assign"|"approvals.review",rootRequired:boolean):Promise<void>{
    const rows=await client.query<{is_protected:boolean;has_capability:boolean}>(`
      SELECT r.is_protected,
        EXISTS(SELECT 1 FROM role_grant grant_row
          WHERE grant_row.role_id=r.id AND grant_row.capability_key=$4) AS has_capability
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.realm_id=$3
        AND a.status='ACTIVE' AND s.account_access_version=a.access_version
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id
        AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      WHERE s.id=$1 AND a.id=$2 AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
        AND s.expires_at>now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
      FOR SHARE OF s,a,ar,r
    `,[actor.activeSessionId,actor.accountId,actor.realmId,capability]);
    const row=rows.rows[0];
    if(!rows.rowCount||!rows.rows.some(row=>(rootRequired?row.is_protected:(row.is_protected||row.has_capability))))
      throw new ForbiddenException("Your reviewer authority is no longer current");
  }
  async requireDistinctFinalReviewer(client:PoolClient,realm:string,proposer:string){
    const reviewers=await client.query(`
      SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND
        ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id
      WHERE a.realm_id=$1 AND a.id<>$2 AND a.status='ACTIVE'
        AND r.active AND r.is_protected LIMIT 1
    `,[realm,proposer]);
    if(!reviewers.rowCount)
      throw new ConflictException({code:"REVIEWER_REQUIRED",
        message:"A different active Foundation Super Admin is required"});
  }
  async freeze(client:PoolClient,realm:string,accountRef:string,roleRef:string,
    proposerRef:string):Promise<FrozenProtectedChange>{
    if(!UUID.test(accountRef)||!UUID.test(roleRef)||accountRef===proposerRef)
      throw new BadRequestException("Choose another eligible account and a custom role");
    const account=await client.query<{
      id:string;display_name:string;access_version:string
    }>(`
      SELECT a.id,a.display_name,a.access_version FROM account a
      WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE'
        AND NOT EXISTS(
          SELECT 1 FROM account_role ar JOIN role current ON current.id=ar.role_id
          WHERE ar.account_id=a.id AND ar.revoked_at IS NULL AND current.is_protected
        )
      FOR SHARE OF a
    `,[accountRef,realm]);
    const role=await client.query<{
      id:string;name:string;revision:number
    }>(`
      SELECT r.id,r.name,r.revision FROM role r
      WHERE r.id=$1 AND r.realm_id=$2 AND r.active AND NOT r.is_protected
        AND EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='roles.manage')
        AND NOT EXISTS(SELECT 1 FROM role_grant g
          WHERE g.role_id=r.id AND g.capability_key='identity.security-policy.manage')
      FOR SHARE OF r
    `,[roleRef,realm]);
    if(!account.rowCount||!role.rowCount)
      throw new ForbiddenException("The selected account or role is no longer eligible");
    return {accountRef:account.rows[0].id,accountName:account.rows[0].display_name,
      accountAccessVersion:account.rows[0].access_version,
      roleRef:role.rows[0].id,roleName:role.rows[0].name,
      roleRevision:Number(role.rows[0].revision)};
  }
  /**
   * CG-01 is the sole owner of the real access effect. The only input is an
   * internal claimed effect key; all trust comes from immutable CG-03 DB
   * decision/case/route rows and live CG-01 accounts, not a caller-supplied
   * signed-looking approval flag or an HTTP callback.
   */
  async applyApprovedAccessChange(effectKey:string,claimToken:string):Promise<
    {state:"CONFIRMED"|"SOURCE_CHANGED"|"UNVERIFIED";accountRef?:string;revision?:number}
  >{
    if(!UUID.test(effectKey)||!UUID.test(claimToken))
      throw new BadRequestException("Invalid protected source outcome");
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      const existing=await client.query<{target_account_id:string;resulting_access_version:string}>(`
        SELECT target_account_id,resulting_access_version
        FROM cg01_approved_sensitive_assignment
        WHERE effect_key=$1 FOR SHARE
      `,[effectKey]);
      if(existing.rowCount){
        await client.query("COMMIT");tx=false;
        return {state:"CONFIRMED",accountRef:existing.rows[0].target_account_id,
          revision:Number(existing.rows[0].resulting_access_version)};
      }
      const proof=await client.query<{
        realm_id:string;case_ref:string;decision_ref:string;proposer_id:string;
        reviewer_id:string;target_account_id:string;target_role_id:string;
        access_version:string;role_revision:number;proposal_revision:number;
        proposal_digest:string;stored_digest:string;process_version:number;
        previous_case_id:string|null;claimed_until:Date;
      }>(`
        SELECT c.realm_id,c.id AS case_ref,d.id AS decision_ref,
          c.proposer_id,d.actor_id AS reviewer_id,c.target_account_id,
          c.target_role_id,c.expected_access_version AS access_version,
          c.expected_role_revision AS role_revision,
          c.proposal_revision,c.proposal_digest,
          f.proposal_digest AS stored_digest,c.process_version,c.previous_case_id,
          f.claimed_until
        FROM cg03_finalization f
        JOIN cg03_case c ON c.id=f.case_id AND c.realm_id=f.realm_id
        JOIN cg03_case_decision d ON d.id=f.final_decision_id AND d.case_id=c.id
          AND d.realm_id=c.realm_id
        JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
          AND p.version=c.process_version
        JOIN cg03_process_step final_step ON final_step.process_id=c.process_id
          AND final_step.ordinal=d.step_ordinal
          AND final_step.protected_root_required=true
          AND final_step.capability_key='approvals.review'
        JOIN access_realm realm ON realm.id=c.realm_id AND realm.realm_key='FOUNDATION_ROOT'
        WHERE f.effect_key=$1 AND f.claim_token=$2 AND f.state='APPLYING'
          AND f.claimed_until>now() AND c.status='PENDING_OWNER'
          AND d.action='APPROVE' AND d.actor_id<>c.proposer_id
          AND d.fresh_mfa_verified_at IS NOT NULL
          AND d.accepted_case_revision=c.revision
          AND d.step_ordinal=(
            SELECT max(st.ordinal) FROM cg03_process_step st
            WHERE st.process_id=c.process_id)
          AND NOT EXISTS (
            SELECT 1 FROM cg03_process_step st
            WHERE st.process_id=c.process_id AND st.ordinal<d.step_ordinal
              AND NOT EXISTS (
                SELECT 1 FROM cg03_case_decision prev
                WHERE prev.case_id=c.id AND prev.step_ordinal=st.ordinal
                  AND prev.action IN ('APPROVE','FORWARD')
              )
          )
        FOR SHARE OF f,c,d,p
      `,[effectKey,claimToken]);
      const p=proof.rows[0];
      if(!p){
        // A claim may have expired or another coordinator may be reconciling.
        // Missing live proof is uncertainty, not evidence of source drift.
        await client.query("ROLLBACK");tx=false;
        return {state:"UNVERIFIED"};
      }
      const digest=createHash("sha256").update(JSON.stringify([
        p.realm_id,p.target_account_id,p.target_role_id,p.proposal_revision,
        p.access_version,p.role_revision,p.proposer_id,p.process_version,
        p.previous_case_id
      ])).digest("hex");
      if(digest!==p.proposal_digest||digest!==p.stored_digest){
        await client.query("ROLLBACK");tx=false;
        return {state:"SOURCE_CHANGED"};
      }
      // Current final-review authority can be revoked after the original
      // decision; do not apply a new sensitive role after its revocation.
      const reviewer=await client.query(`
        SELECT 1 FROM account reviewer
        JOIN account_role ar ON ar.account_id=reviewer.id AND
          ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL
        JOIN role r ON r.id=ar.role_id AND r.realm_id=reviewer.realm_id
        WHERE reviewer.id=$1 AND reviewer.realm_id=$2 AND reviewer.status='ACTIVE'
          AND r.active=true AND r.is_protected=true
        FOR SHARE OF reviewer,ar,r
      `,[p.reviewer_id,p.realm_id]);
      const proposer=await client.query(`
        SELECT 1 FROM account WHERE id=$1 AND realm_id=$2 AND status='ACTIVE'
        FOR SHARE
      `,[p.proposer_id,p.realm_id]);
      if(!reviewer.rowCount||!proposer.rowCount){
        await client.query("ROLLBACK");tx=false;
        return {state:"SOURCE_CHANGED"};
      }
      const target=await client.query<{id:string;display_name:string;access_version:string}>(`
        SELECT id,display_name,access_version FROM account
        WHERE id=$1 AND realm_id=$2 AND status='ACTIVE'
        FOR UPDATE
      `,[p.target_account_id,p.realm_id]);
      const role=await client.query<{id:string;revision:number}>(`
        SELECT r.id,r.revision FROM role r
        WHERE r.id=$1 AND r.realm_id=$2 AND r.active AND NOT r.is_protected
          AND EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id
            AND g.capability_key='roles.manage')
          AND NOT EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id
            AND g.capability_key='identity.security-policy.manage')
        FOR SHARE OF r
      `,[p.target_role_id,p.realm_id]);
      const protectedTarget=await client.query(`
        SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
        WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
          AND r.is_protected LIMIT 1
      `,[p.target_account_id,p.realm_id]);
      if(!target.rowCount||!role.rowCount||protectedTarget.rowCount||
        target.rows[0].access_version!==p.access_version||
        Number(role.rows[0].revision)!==Number(p.role_revision)){
        await client.query("ROLLBACK");tx=false;
        return {state:"SOURCE_CHANGED"};
      }
      await client.query(`
        UPDATE account_role SET revoked_at=now(),revision=revision+1
        WHERE account_id=$1 AND realm_id=$2 AND revoked_at IS NULL
      `,[p.target_account_id,p.realm_id]);
      await client.query(`
        INSERT INTO account_role(account_id,role_id,realm_id,assigned_by)
        VALUES($1,$2,$3,$4)
      `,[p.target_account_id,p.target_role_id,p.realm_id,p.reviewer_id]);
      const bumped=await client.query<{access_version:string}>(`
        UPDATE account SET access_version=access_version+1,revision=revision+1,
          updated_at=now() WHERE id=$1 AND realm_id=$2 RETURNING access_version
      `,[p.target_account_id,p.realm_id]);
      await client.query(`
        UPDATE auth_session SET revoked_at=now()
        WHERE account_id=$1 AND revoked_at IS NULL
      `,[p.target_account_id]);
      await client.query(`
        INSERT INTO cg01_approved_sensitive_assignment(
          realm_id,effect_key,source_case_ref,source_decision_ref,proposal_digest,
          target_account_id,target_role_id,expected_access_version,
          resulting_access_version,approved_role_revision,proposer_id,final_reviewer_id
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,[p.realm_id,effectKey,p.case_ref,p.decision_ref,p.proposal_digest,
        p.target_account_id,p.target_role_id,p.access_version,
        bumped.rows[0].access_version,p.role_revision,p.proposer_id,p.reviewer_id]);
      await client.query(`
        INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,
          action_key,outcome,safe_context,correlation_ref)
        VALUES($1,$2,$3,'identity.account.assign_approved','SUCCESS',$4::jsonb,$5)
      `,[p.realm_id,p.reviewer_id,p.target_account_id,
        JSON.stringify({targetDisplay:target.rows[0].display_name.slice(0,160),
          source:"Foundation protected review"}),randomUUID()]);
      await client.query("COMMIT");tx=false;
      return {state:"CONFIRMED",accountRef:p.target_account_id,
        revision:Number(bumped.rows[0].access_version)};
    }catch(error){
      if(tx){try{await client.query("ROLLBACK");}catch{}}
      throw error;
    }finally{client.release();}
  }
  async protectedEffectOutcome(effectKey:string){
    if(!UUID.test(effectKey))throw new BadRequestException("Invalid owner outcome");
    const rows=await this.db.query<{resulting_access_version:string}>(`
      SELECT resulting_access_version FROM cg01_approved_sensitive_assignment
      WHERE effect_key=$1
    `,[effectKey]);
    return rows.rowCount?{state:"CONFIRMED" as const,
      revision:Number(rows.rows[0].resulting_access_version)}:
      {state:"NOT_FOUND" as const};
  }
  async options(bearer:string,kind:unknown,search:unknown){
    const actor=await this.sessions.requireAction(bearer,"approvals.propose");
    if((kind!=="account"&&kind!=="role")||typeof search!=="string"||search.length>70)
      throw new BadRequestException("Check the search");
    const term="%"+search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&")+"%";
    if(kind==="account"){
      const rows=await this.db.query<{id:string;display_name:string}>(`
        SELECT a.id,a.display_name FROM account a
        WHERE a.realm_id=$1 AND a.status='ACTIVE' AND a.id<>$2
          AND lower(a.display_name) LIKE $3 ESCAPE '\\'
          AND NOT EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
            WHERE ar.account_id=a.id AND ar.revoked_at IS NULL AND r.is_protected)
        ORDER BY a.display_name,a.id LIMIT 30
      `,[actor.realmId,actor.accountId,term]);
      return {options:rows.rows.map(x=>({value:x.id,label:x.display_name}))};
    }
    const rows=await this.db.query<{id:string;name:string}>(`
      SELECT r.id,r.name FROM role r
      WHERE r.realm_id=$1 AND r.active AND NOT r.is_protected
        AND lower(r.name) LIKE $2 ESCAPE '\\'
        AND EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='roles.manage')
        AND NOT EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id
          AND g.capability_key='identity.security-policy.manage')
      ORDER BY r.name,r.id LIMIT 30
    `,[actor.realmId,term]);
    return {options:rows.rows.map(x=>({value:x.id,label:x.name}))};
  }
}
