import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import type {VerifiedFoundationActor} from "../public-api";
import {SessionService} from "./session.service";

/** CG-01 account owner adapter for CG-14 pending center representative selection.
 * No duplicate account master or hand-rolled identity assignment in healthcare.
 */
@Injectable()
export class HealthNetworkIdentityFacade{
  constructor(private readonly sessions:SessionService,
    @Inject(DATABASE) private readonly db:Pool){}
  async eligibleRepresentative(client:PoolClient,actor:VerifiedFoundationActor,accountRef:string){
    const rows=await client.query<{id:string}>(
      "SELECT a.id FROM account a "+
      "JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id "+
      "AND ar.revoked_at IS NULL "+
      "JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=false "+
      "JOIN role_grant g ON g.role_id=r.id AND g.capability_key='health.centers.draft.edit' "+
      "WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE' FOR SHARE OF a,ar,r",
      [accountRef,actor.realmId]);
    if(!rows.rows[0])throw new BadRequestException({
      code:"HEALTH_REPRESENTATIVE_NOT_ELIGIBLE",field:"accountRef"
    });
  }
  async eligibleRepresentativeOptions(bearer:string,search=""){
    const actor=await this.sessions.requireAction(bearer,"health.providers.manage");
    if(typeof search!=="string"||search.length>80)
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"search"});
    const term=search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&");
    const rows=await this.db.query<{id:string;display_name:string}>(
      "SELECT DISTINCT a.id,a.display_name FROM account a "+
      "JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id "+
      "AND ar.revoked_at IS NULL "+
      "JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=false "+
      "JOIN role_grant g ON g.role_id=r.id AND g.capability_key='health.centers.draft.edit' "+
      "WHERE a.realm_id=$1 AND a.status='ACTIVE' "+
      "AND ($2='' OR lower(a.display_name) LIKE $2 ESCAPE '\\') "+
      "ORDER BY a.display_name,a.id LIMIT 30",
      [actor.realmId,term?"%"+term+"%":""]);
    return {options:rows.rows.map(row=>({value:row.id,label:row.display_name}))};
  }
}
