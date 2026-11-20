import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type VerifiedLabCenter={
 centerRef:string;name:string;publicSlug:string|null;publicationState:string;
};
/** CG-14-owned source facade: CG-16 never creates a second lab or trusts a
 * client-submitted "verified" flag. Current root, provider, center, service
 * declaration and own-center account affiliation are checked in one tx. */
@Injectable()
export class HealthLabCatalogSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async assertLab(tx:PoolClient,root:string,centerRef:string,
  actor?:VerifiedFoundationActor,own=false,
  action:"diagnostics.pricing.view"|"diagnostics.pricing.manage"="diagnostics.pricing.manage"):Promise<VerifiedLabCenter>{
  if(!UUID.test(centerRef))throw new BadRequestException({code:"LAB_CENTER_INVALID"});
  const center=await tx.query<{
   name:string;public_slug:string|null;publication_state:string
  }>(
   "SELECT c.display_name AS name,c.public_slug,c.publication_state "+
   "FROM health_center c JOIN health_provider p ON "+
   "p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
   "JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id "+
   "AND cap.center_id=c.id AND cap.capability_code='DIAGNOSTICS' "+
   "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.status='VERIFIED' "+
   "AND c.access_state='ENABLED' AND p.status='VERIFIED' "+
   "FOR SHARE OF c,p,cap",[root,centerRef]);
  if(!center.rows[0])throw new NotFoundException("The selected approved lab is unavailable");
  if(own){
   if(!actor||actor.realmId!==root)
    throw new NotFoundException("The selected approved lab is unavailable");
   await this.identity.assertCurrent(tx,actor,action);
   const assigned=await tx.query(
    "SELECT f.id FROM health_center_account_affiliation f "+
    "JOIN account a ON a.realm_id=f.root_realm_id AND a.id=f.account_ref "+
    "WHERE f.root_realm_id=$1 AND f.center_id=$2 AND f.account_ref=$3 "+
    "AND f.status='ACTIVE' AND a.status='ACTIVE' FOR SHARE OF f,a",
    [root,centerRef,actor.accountId]);
   if(!assigned.rowCount)
    throw new NotFoundException("The selected approved lab is unavailable");
  }
  return {centerRef,name:center.rows[0].name,
   publicSlug:center.rows[0].public_slug,
   publicationState:center.rows[0].publication_state};
 }
}
