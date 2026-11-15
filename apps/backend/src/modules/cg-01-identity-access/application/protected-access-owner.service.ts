import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
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
    if(!row||!(rootRequired?row.is_protected:(row.is_protected||row.has_capability)))
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
