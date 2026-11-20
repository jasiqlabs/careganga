import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
export type AssistancePolicySubmission=Readonly<{
 kind:"CG17_POLICY_EXCEPTION";policyRevisionRef:string;revisionNo:number;
 digest:string;requestKey:string;centerRef:string
}>;
/** CG17 original revision, read by genuine CG03 approval; no shadow case. */
@Injectable()
export class HealthcareAssistanceReviewSourceFacade{
 async original(c:PoolClient,actor:VerifiedFoundationActor,
  submission:AssistancePolicySubmission){
  const row=await c.query<{
   id:string;center_ref:string;policy_ref:string;actor_ref:string;
   doctor_ref:string|null;
   approval_state:string;service_kind:string;mode:string;
   percent_basis_points:number;source_digest:string;revision_no:number;
   valid_from:Date;valid_until:Date;cap_minor:string
  }>(
   "SELECT * FROM healthcare_policy_revision WHERE root_realm_id=$1 "+
   "AND id=$2 AND revision_no=$3 AND source_digest=$4 FOR SHARE",
   [actor.realmId,submission.policyRevisionRef,submission.revisionNo,
    submission.digest]);
  const v=row.rows[0];
  if(!v||v.center_ref!==submission.centerRef||v.actor_ref===null||
   v.service_kind!=="CONSULTATION"||v.mode!=="PERCENT"||
   v.percent_basis_points!==10000||v.approval_state!=="PENDING_APPROVAL"||
   v.valid_until<=new Date())
   throw new ConflictException({code:"ASSISTANCE_POLICY_SOURCE_CHANGED"});
  const verified=await c.query<{name:string}>(
   "SELECT center.display_name AS name FROM health_center center "+
   "JOIN health_provider p ON p.root_realm_id=center.root_realm_id "+
   "AND p.id=center.provider_id "+
   "WHERE center.root_realm_id=$1 AND center.id=$2 "+
   "AND center.status='VERIFIED' AND center.access_state='ENABLED' "+
   "AND p.status='VERIFIED' FOR SHARE OF center,p",
   [actor.realmId,v.center_ref]);
  if(!verified.rows[0])
   throw new ConflictException({code:"ASSISTANCE_POLICY_CENTER_CHANGED"});
  if(v.doctor_ref){
   // Independently recheck the current CG14 license, approved affiliation,
   // original CG03 professional verification and clean CG19 license.
   const doctor=await c.query(
    "SELECT d.id FROM health_doctor_center affiliation "+
    "JOIN health_doctor d ON d.root_realm_id=affiliation.root_realm_id "+
    "AND d.id=affiliation.doctor_id "+
    "JOIN health_center center ON center.root_realm_id=affiliation.root_realm_id "+
    "AND center.id=affiliation.center_id "+
    "JOIN health_doctor_revision revision ON "+
    "revision.root_realm_id=d.root_realm_id AND revision.doctor_id=d.id "+
    "AND revision.revision_no=(SELECT max(last.revision_no) "+
    "FROM health_doctor_revision last WHERE last.root_realm_id=d.root_realm_id "+
    "AND last.doctor_id=d.id) "+
    "JOIN cg03_case case_original ON case_original.realm_id=revision.root_realm_id "+
    "AND case_original.id=revision.approval_case_ref "+
    "AND case_original.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
    "AND case_original.health_doctor_id=d.id "+
    "AND case_original.health_doctor_revision_id=revision.id "+
    "AND case_original.health_source_digest=revision.source_digest "+
    "AND case_original.status='OWNER_COMPLETED' "+
    "JOIN cg03_case_decision decision ON decision.realm_id=case_original.realm_id "+
    "AND decision.case_id=case_original.id AND decision.action='APPROVE' "+
    "AND decision.actor_id<>case_original.proposer_id "+
    "AND decision.fresh_password_verified_at IS NOT NULL "+
    "JOIN cg19_stored_file proof ON proof.realm_id=revision.root_realm_id "+
    "AND proof.id=revision.proof_file_ref AND proof.owner_kind='CG14_DOCTOR' "+
    "AND proof.health_doctor_id=d.id AND proof.scan_status='CLEAN_VERIFIED' "+
    "AND proof.revoked_at IS NULL "+
    "WHERE affiliation.root_realm_id=$1 AND affiliation.center_id=$2 "+
    "AND affiliation.doctor_id=$3 "+
    "AND affiliation.affiliation_state='APPROVED' "+
    "AND affiliation.approved_from<=now() AND "+
    "(affiliation.approved_to IS NULL OR affiliation.approved_to>now()) "+
    "AND d.status='VERIFIED' "+
    "AND d.professional_license_valid_through >= "+
    "(now() AT TIME ZONE center.time_zone)::date "+
    "AND revision.source_snapshot->>'professionalLicenseValidThrough' = "+
    "to_char(d.professional_license_valid_through,'YYYY-MM-DD') "+
    "FOR SHARE OF affiliation,d,center,revision,proof",
    [actor.realmId,v.center_ref,v.doctor_ref]);
   if(!doctor.rowCount)
    throw new ConflictException({code:"ASSISTANCE_POLICY_DOCTOR_SOURCE_CHANGED"});
  }
  return {revision:v,centerName:verified.rows[0].name};
 }
}
