import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Current CG-14 review evidence. Do not substitute a self-declared "verified"
 * flag, upload name, or copied CG-16 licensing state for the real original
 * CG-03 final decision plus CG-19 clean, non-revoked license proof.
 * Diagnostic licence validity comes only from the date frozen in the
 * original CG03-approved center revision and its genuine CG19 proof.
 * Legacy records without that date are UNKNOWN, never assumed valid. */
export const CG14_CURRENT_LAB_EVIDENCE_SQL=
 "EXISTS (SELECT 1 FROM health_center_revision rev "+
 "JOIN cg03_case review ON review.id=rev.approval_case_ref "+
 "AND review.realm_id=rev.root_realm_id "+
 "AND review.case_kind='HEALTH_CENTER_VERIFICATION' "+
 "AND review.health_center_id=c.id AND review.health_center_revision_id=rev.id "+
 "AND review.health_source_digest=rev.source_digest "+
 "AND review.status='OWNER_COMPLETED' "+
 "JOIN cg03_case_decision decision ON decision.case_id=review.id "+
 "AND decision.realm_id=review.realm_id "+
 "AND decision.action='APPROVE' "+
 "AND decision.fresh_password_verified_at IS NOT NULL "+
 "AND decision.actor_id<>review.proposer_id "+
 "JOIN cg19_stored_file proof ON proof.id=rev.proof_file_ref "+
 "AND proof.realm_id=rev.root_realm_id "+
 "AND proof.owner_kind='CG14_DRAFT' AND proof.health_center_id=c.id "+
 "AND proof.health_provider_id=p.id AND proof.revoked_at IS NULL "+
 "AND proof.scan_status='CLEAN_VERIFIED' "+
 "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
 "AND intent.realm_id=proof.realm_id AND intent.status='VALIDATED' "+
 "AND intent.classification='HEALTH_CENTER_LICENSE' "+
 "WHERE rev.root_realm_id=c.root_realm_id AND rev.provider_id=p.id "+
 "AND rev.center_id=c.id "+
 "AND c.diagnostic_license_valid_through IS NOT NULL "+
 "AND c.diagnostic_license_valid_through >= (now() AT TIME ZONE c.time_zone)::date "+
 "AND rev.source_snapshot->>'diagnosticLicenseValidThrough' = "+
 "c.diagnostic_license_valid_through::text) ";
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
   "AND "+CG14_CURRENT_LAB_EVIDENCE_SQL+
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
