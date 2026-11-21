import {ForbiddenException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type Professional={
 doctor_ref:string;review_revision_ref:string;source_version:number;
 licensed_through:string;proof_ref:string;center_affiliation_ref:string
};
export type VerifiedLabProfessional=Readonly<{
 doctorRef:string;reviewRevisionRef:string;sourceVersion:number;
 licensedThrough:string;proofRef:string;centerAffiliationRef:string
}>;
/** CG14 owns all professional identity, CG03 verification and original CG19
 * licence. A general staff login or permission is NOT an actual clinician.
 * This is a scoped SOURCE reader, not a self-declared clinical sign-off. */
@Injectable()
export class HealthLabProfessionalReviewSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async assertCurrent(tx:PoolClient,actor:VerifiedFoundationActor,
  centerRef:string,action:"lab.report.review"|"lab.report.release"):
  Promise<VerifiedLabProfessional>{
  await this.identity.assertCurrent(tx,actor,action);
  const r=await tx.query<Professional>(
   "SELECT d.id AS doctor_ref,rev.id AS review_revision_ref,"+
   "rev.source_version,to_char(d.professional_license_valid_through,'YYYY-MM-DD') "+
   "AS licensed_through,rev.proof_file_ref AS proof_ref,"+
   "association.id AS center_affiliation_ref "+
   "FROM health_doctor_account_link accountLink "+
   "JOIN health_doctor d ON d.root_realm_id=accountLink.root_realm_id "+
   "AND d.id=accountLink.doctor_id AND d.status='VERIFIED' "+
   "JOIN health_doctor_center association ON "+
   "association.root_realm_id=d.root_realm_id "+
   "AND association.doctor_id=d.id AND association.center_id=$3 "+
   "AND association.affiliation_state='APPROVED' "+
   "AND association.approved_from<=now() "+
   "AND (association.approved_to IS NULL OR association.approved_to>now()) "+
   "JOIN health_center center ON center.root_realm_id=association.root_realm_id "+
   "AND center.id=association.center_id AND center.status='VERIFIED' "+
   "AND center.access_state='ENABLED' "+
   "JOIN health_doctor_revision rev ON rev.root_realm_id=d.root_realm_id "+
   "AND rev.doctor_id=d.id "+
   "AND rev.revision_no=(SELECT MAX(last.revision_no) "+
   "FROM health_doctor_revision last WHERE "+
   "last.root_realm_id=rev.root_realm_id AND last.doctor_id=rev.doctor_id) "+
   "JOIN cg03_case reviewed ON reviewed.id=rev.approval_case_ref "+
   "AND reviewed.realm_id=rev.root_realm_id "+
   "AND reviewed.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
   "AND reviewed.health_doctor_id=d.id "+
   "AND reviewed.health_doctor_revision_id=rev.id "+
   "AND reviewed.health_source_digest=rev.source_digest "+
   "AND reviewed.status='OWNER_COMPLETED' "+
   "JOIN cg03_case_decision decision ON decision.realm_id=reviewed.realm_id "+
   "AND decision.case_id=reviewed.id AND decision.action='APPROVE' "+
   "AND decision.actor_id<>reviewed.proposer_id "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "JOIN cg19_stored_file proof ON proof.realm_id=rev.root_realm_id "+
   "AND proof.id=rev.proof_file_ref AND proof.owner_kind='CG14_DOCTOR' "+
   "AND proof.health_doctor_id=d.id "+
   "AND proof.health_source_version=rev.source_version "+
   "AND proof.scan_status='CLEAN_VERIFIED' AND proof.revoked_at IS NULL "+
   "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
   "AND intent.realm_id=proof.realm_id AND intent.status='VALIDATED' "+
   "AND intent.owner_kind='CG14_DOCTOR' "+
   "AND intent.classification='HEALTH_DOCTOR_LICENSE' "+
   "WHERE accountLink.root_realm_id=$1 AND accountLink.account_id=$2 "+
   "AND accountLink.status='ACTIVE' "+
   "AND d.professional_license_valid_through IS NOT NULL "+
   "AND d.professional_license_valid_through >= "+
   "(now() AT TIME ZONE center.time_zone)::date "+
   "AND rev.source_snapshot->>'professionalLicenseValidThrough' = "+
   "to_char(d.professional_license_valid_through,'YYYY-MM-DD') "+
   "FOR SHARE OF accountLink,d,association,center,rev,proof,intent",
   [actor.realmId,actor.accountId,centerRef]);
  const p=r.rows[0];
  if(!p)throw new ForbiddenException({code:"LAB_PROFESSIONAL_NOT_VERIFIED"});
  return {doctorRef:p.doctor_ref,reviewRevisionRef:p.review_revision_ref,
   sourceVersion:p.source_version,licensedThrough:p.licensed_through,
   proofRef:p.proof_ref,centerAffiliationRef:p.center_affiliation_ref};
 }
}
