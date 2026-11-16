import { ForbiddenException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { implementedCapability } from "../domain/capability-catalog";
import type { VerifiedFoundationActor } from "../public-api";

/** CG-01-owned current actor/eligibility facade: other modules never join identity tables. */
@Injectable()
export class FoundationStructureIdentityFacade {
  async assertCurrent(client:PoolClient,actor:VerifiedFoundationActor,action:string):Promise<void>{
    if(!implementedCapability(action))throw new ForbiddenException("This action is unavailable");
    const current=await client.query<{is_protected:boolean;has_grant:boolean}>(`
      SELECT r.is_protected,
        EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key=$4) AS has_grant
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version AND a.id=$2 AND a.realm_id=$3
      JOIN access_realm realm ON realm.id=a.realm_id AND realm.realm_key='FOUNDATION_ROOT'
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND s.password_authenticated_at IS NOT NULL
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
      FOR SHARE OF s,a,ar,r`,[actor.activeSessionId,actor.accountId,actor.realmId,action]);
    if(!current.rowCount||!current.rows.some(row=>row.is_protected||row.has_grant))
      throw new ForbiddenException("This Foundation action is not permitted");
  }
  async eligibleOfficeholder(client:PoolClient,actor:VerifiedFoundationActor,accountRef:string):Promise<{accountRef:string;displayName:string}>{
    const found=await client.query<{id:string;display_name:string}>(`
      SELECT a.id,a.display_name FROM account a
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE'
      FOR SHARE OF a,ar,r`,[accountRef,actor.realmId]);
    if(!found.rowCount)throw new ForbiddenException("Select an eligible current Foundation account");
    return {accountRef:found.rows[0].id,displayName:found.rows[0].display_name};
  }
  /** Read-only, root-scoped display projection for permitted CG-02 lists/history.
   * Inactive accounts retain their actual historical names; this never grants access.
   */
  async accountLabels(client:PoolClient,actor:VerifiedFoundationActor,ids:readonly string[]):Promise<Record<string,string>>{
    const distinct=[...new Set(ids)];
    if(distinct.length>100)throw new ForbiddenException("Too many account labels requested");
    if(distinct.length===0)return {};
    const rows=await client.query<{id:string;display_name:string}>(`
      SELECT id,display_name FROM account WHERE realm_id=$1 AND id=ANY($2::uuid[])`,
      [actor.realmId,distinct]);
    return Object.fromEntries(rows.rows.map(row=>[row.id,row.display_name]));
  }
  async eligibleOfficeholderOptions(client:PoolClient,actor:VerifiedFoundationActor,search:string):Promise<{value:string;label:string}[]>{
    const rows=await client.query<{id:string;display_name:string}>(`
      SELECT DISTINCT a.id,a.display_name FROM account a
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active
      WHERE a.realm_id=$1 AND a.status='ACTIVE' AND
        ($2='' OR lower(a.display_name) LIKE $2 ESCAPE '\\')
      ORDER BY a.display_name,a.id LIMIT 30`,
      [actor.realmId,search?"%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%":""]);
    return rows.rows.map(x=>({value:x.id,label:x.display_name}));
  }
}
