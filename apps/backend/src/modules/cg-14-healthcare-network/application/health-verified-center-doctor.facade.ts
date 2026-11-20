import {ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
/** CG14 owns current verified healthcare center/doctor identity.
 * Later CG17 policy consumers must call this read-only source rather than
 * duplicate professional license, original CG03 review or CG19 proof rules.
 * No CG17 import, runtime dependency, policy table, or patient charge here.
 */
@Injectable()
export class HealthVerifiedCenterDoctorFacade{
 async center(c:PoolClient,root:string,center:string){
  const q=await c.query<{name:string}>(
   "SELECT center.display_name AS name FROM health_center center "+
   "JOIN health_provider provider ON provider.root_realm_id=center.root_realm_id "+
   "AND provider.id=center.provider_id "+
   "WHERE center.root_realm_id=$1 AND center.id=$2 "+
   "AND center.status='VERIFIED' AND center.access_state='ENABLED' "+
   "AND provider.status='VERIFIED' FOR SHARE OF center,provider",
   [root,center]);
  if(!q.rows[0])throw new NotFoundException({code:"ASSISTANCE_CENTER_NOT_VERIFIED"});
  return q.rows[0];
 }

 async doctor(c:PoolClient,root:string,center:string,doctor:string){
  const q=await c.query<{name:string}>(
   "SELECT d.full_name AS name FROM health_doctor_center membership "+
   "JOIN health_doctor d ON d.root_realm_id=membership.root_realm_id "+
   "AND d.id=membership.doctor_id "+
   "JOIN health_center center ON center.root_realm_id=membership.root_realm_id "+
   "AND center.id=membership.center_id "+
   "JOIN health_doctor_revision revision ON revision.root_realm_id=d.root_realm_id "+
   "AND revision.doctor_id=d.id "+
   "AND revision.revision_no=(SELECT max(latest.revision_no) "+
   "FROM health_doctor_revision latest WHERE latest.root_realm_id=d.root_realm_id "+
   "AND latest.doctor_id=d.id) "+
   "JOIN cg03_case reviewed ON reviewed.realm_id=revision.root_realm_id "+
   "AND reviewed.id=revision.approval_case_ref "+
   "AND reviewed.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
   "AND reviewed.health_doctor_id=d.id AND "+
   "reviewed.health_doctor_revision_id=revision.id "+
   "AND reviewed.health_source_digest=revision.source_digest "+
   "AND reviewed.status='OWNER_COMPLETED' "+
   "JOIN cg03_case_decision decision ON decision.realm_id=reviewed.realm_id "+
   "AND decision.case_id=reviewed.id AND decision.action='APPROVE' "+
   "AND decision.actor_id<>reviewed.proposer_id "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "JOIN cg19_stored_file proof ON proof.realm_id=revision.root_realm_id "+
   "AND proof.id=revision.proof_file_ref AND proof.owner_kind='CG14_DOCTOR' "+
   "AND proof.health_doctor_id=d.id AND proof.scan_status='CLEAN_VERIFIED' "+
   "AND proof.revoked_at IS NULL "+
   "WHERE membership.root_realm_id=$1 AND membership.center_id=$2 "+
   "AND membership.doctor_id=$3 AND membership.affiliation_state='APPROVED' "+
   "AND membership.approved_from<=now() "+
   "AND (membership.approved_to IS NULL OR membership.approved_to>now()) "+
   "AND d.status='VERIFIED' AND "+
   "d.professional_license_valid_through >= "+
   "(now() AT TIME ZONE center.time_zone)::date "+
   "AND revision.source_snapshot->>'professionalLicenseValidThrough' = "+
   "to_char(d.professional_license_valid_through,'YYYY-MM-DD') "+
   "FOR SHARE OF membership,d,center,revision,proof",
   [root,center,doctor]);
  if(!q.rows[0])throw new NotFoundException({code:"ASSISTANCE_DOCTOR_NOT_VERIFIED"});
  return q.rows[0];
 }

 async centers(c:PoolClient,root:string){
  const centers=await c.query<{centerRef:string;name:string}>(
    "SELECT center.id AS \"centerRef\",center.display_name AS name "+
    "FROM health_center center JOIN health_provider p ON "+
    "p.root_realm_id=center.root_realm_id AND p.id=center.provider_id "+
    "WHERE center.root_realm_id=$1 AND center.status='VERIFIED' "+
    "AND center.access_state='ENABLED' AND p.status='VERIFIED' "+
    "ORDER BY center.display_name,center.id LIMIT 101",[root]);
   if(centers.rows.length>100)
    throw new ConflictException({code:"ASSISTANCE_CENTER_LIST_LIMIT"});
  return centers.rows;
 }
 async doctors(c:PoolClient,root:string,center:string){
  await this.center(c,root,center);
  // Same bounded CG14 professional/approval/proof query; no N+1 reads.
  const result=await c.query<{doctorRef:string;name:string}>(
    "SELECT d.id AS \"doctorRef\",d.full_name AS name "+
    "FROM health_doctor_center affiliation "+
    "JOIN health_doctor d ON d.root_realm_id=affiliation.root_realm_id "+
    "AND d.id=affiliation.doctor_id "+
    "JOIN health_center center ON center.root_realm_id=affiliation.root_realm_id "+
    "AND center.id=affiliation.center_id "+
    "WHERE affiliation.root_realm_id=$1 AND affiliation.center_id=$2 "+
    "AND affiliation.affiliation_state='APPROVED' "+
    "AND affiliation.approved_from<=now() AND "+
    "(affiliation.approved_to IS NULL OR affiliation.approved_to>now()) "+
    "AND d.status='VERIFIED' AND d.professional_license_valid_through >= "+
    "(now() AT TIME ZONE center.time_zone)::date "+
    "AND EXISTS(SELECT 1 FROM health_doctor_revision revision "+
    "JOIN cg03_case review ON review.realm_id=revision.root_realm_id "+
    "AND review.id=revision.approval_case_ref "+
    "AND review.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
    "AND review.health_doctor_id=d.id "+
    "AND review.health_doctor_revision_id=revision.id "+
    "AND review.health_source_digest=revision.source_digest "+
    "AND review.status='OWNER_COMPLETED' "+
    "JOIN cg03_case_decision decision ON decision.realm_id=review.realm_id "+
    "AND decision.case_id=review.id AND decision.action='APPROVE' "+
    "AND decision.actor_id<>review.proposer_id "+
    "AND decision.fresh_password_verified_at IS NOT NULL "+
    "JOIN cg19_stored_file proof ON proof.realm_id=revision.root_realm_id "+
    "AND proof.id=revision.proof_file_ref "+
    "AND proof.owner_kind='CG14_DOCTOR' AND proof.health_doctor_id=d.id "+
    "AND proof.scan_status='CLEAN_VERIFIED' AND proof.revoked_at IS NULL "+
    "WHERE revision.root_realm_id=d.root_realm_id "+
    "AND revision.doctor_id=d.id AND "+
    "revision.revision_no=(SELECT max(latest.revision_no) "+
    "FROM health_doctor_revision latest "+
    "WHERE latest.root_realm_id=d.root_realm_id AND latest.doctor_id=d.id) "+
    "AND revision.source_snapshot->>'professionalLicenseValidThrough' = "+
    "to_char(d.professional_license_valid_through,'YYYY-MM-DD')) "+
    "ORDER BY d.full_name,d.id LIMIT 101",[root,center]);
   if(result.rows.length>100)
    throw new ConflictException({code:"ASSISTANCE_DOCTOR_LIST_LIMIT"});
  return result.rows;
 }
}
