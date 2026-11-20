import {Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Read-only CG-14 source ownership adapter for the original CG-19 helpdesk.
 * CG-19 must check this INSIDE its support transaction before any case read,
 * reply or create. A stored center ID is not an authorization grant.
 */
@Injectable()
export class HealthCenterSupportScopeFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async assertCurrent(tx:PoolClient,actor:VerifiedFoundationActor,centerRef:string,
  action:string="health.centers.draft.edit"){
  if(!UUID.test(centerRef))
   throw new NotFoundException("Your healthcare center is unavailable");
  await this.identity.assertCurrent(tx,actor,action);
  // Parent first, then center, then current affiliation to avoid suspension
  // races and preserve the same lock order as CG-14 doctor/fee ownership.
  const ref=await tx.query<{provider_id:string}>(
   "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
   [actor.realmId,centerRef]);
  if(!ref.rows[0])throw new NotFoundException("Your healthcare center is unavailable");
  const parent=await tx.query<{status:string}>(
   "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,ref.rows[0].provider_id]);
  const center=await tx.query<{status:string;access_state:string}>(
   "SELECT status,access_state FROM health_center WHERE root_realm_id=$1 "+
   "AND provider_id=$2 AND id=$3 FOR SHARE",
   [actor.realmId,ref.rows[0].provider_id,centerRef]);
  if(parent.rows[0]?.status!=="VERIFIED"||
    center.rows[0]?.status!=="VERIFIED"||
    center.rows[0]?.access_state!=="ENABLED")
   throw new NotFoundException("Your healthcare center is unavailable");
  const assignment=await tx.query(
   "SELECT f.id FROM health_center_account_affiliation f "+
   "JOIN account a ON a.id=f.account_ref AND a.realm_id=f.root_realm_id "+
   "WHERE f.root_realm_id=$1 AND f.center_id=$2 AND f.account_ref=$3 "+
   "AND f.status='ACTIVE' AND a.status='ACTIVE' FOR SHARE OF f,a",
   [actor.realmId,centerRef,actor.accountId]);
  if(!assignment.rowCount)
   throw new NotFoundException("Your healthcare center is unavailable");
 }
}
