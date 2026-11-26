import {
 BadRequestException,ForbiddenException,Injectable,ServiceUnavailableException
} from "@nestjs/common";
import type {PoolClient} from "pg";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthLabCatalogSourceFacade}
 from "../../cg-14-healthcare-network/application/health-lab-catalog-source.facade";

export type LabClinicalAction=
 "lab.orders.create"|"lab.orders.view"|"lab.samples.manage"|
 "lab.results.record"|"lab.report.review"|"lab.report.release";
export type LabEquipmentAction="lab.equipment.view"|"lab.equipment.manage"|
 "lab.quality.record";
export type CareSource={kind:"CENTER_INTAKE"|"CONSULTATION";ref:string};
export type CurrentPatientCare={patientRef:string;consentRevision:number;
 consentRecordedAt:Date;careSource:CareSource};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Restrict operational list/detail to the current verified care relationship.
export const CURRENT_LAB_ORDER_CARE_PREDICATE=
 "AND EXISTS(SELECT 1 FROM cg15_patient p WHERE p.root_realm_id=o.root_realm_id "+
 "AND p.id=o.patient_ref AND p.profile_status='VERIFIED' "+
 "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
 "AND EXISTS(SELECT 1 FROM cg15_patient_consent consent WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
 "AND consent.purpose='PATIENT_CARE' AND consent.granted=true AND consent.revision_no=(SELECT MAX(latest.revision_no) FROM cg15_patient_consent latest "+
 "WHERE latest.root_realm_id=p.root_realm_id AND latest.patient_id=p.id AND latest.purpose='PATIENT_CARE'))) "+
 "AND ((o.care_source_kind='CENTER_INTAKE' AND EXISTS(SELECT 1 FROM cg15_patient_center_intake i "+
 "WHERE i.root_realm_id=o.root_realm_id AND i.center_id=o.center_ref AND i.patient_id=o.patient_ref AND i.id=o.center_intake_ref AND i.assisted_consent_attested=true)) "+
 "OR (o.care_source_kind='CONSULTATION' AND EXISTS(SELECT 1 FROM cg15_consultation_appointment a "+
 "WHERE a.root_realm_id=o.root_realm_id AND a.center_id=o.center_ref AND a.patient_id=o.patient_ref AND a.id=o.consultation_ref "+
 "AND a.booking_state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED')))) ";

/** Fail-closed CG16 clinical admission. Public menu and commercial tariff
 * never imply permission to create a patient specimen or medical report. */
@Injectable()
export class ClinicalLabAdmissionService{
 constructor(private readonly sessions:SessionService,
  private readonly lab:HealthLabCatalogSourceFacade){}

 private async requireLabGrant(tx:PoolClient,bearer:string,centerRef:string,
  action:LabClinicalAction|LabEquipmentAction):Promise<VerifiedFoundationActor>{
  if(!UUID.test(centerRef))
   throw new BadRequestException({code:"LAB_CENTER_INVALID"});
  const actor=await this.sessions.requireAction(bearer,action);
  // CG14 checks the latest CG03-verified license, current CG01 scoped
  // staff affiliation and original verified DIAGNOSTICS center.
  await this.lab.assertLab(tx,actor.realmId,centerRef,actor,true,action);
  const g=await tx.query(
   "SELECT g.approved_revision_id FROM health_center_erp_grant g "+
   "JOIN health_center_erp_grant_revision r ON "+
   "r.root_realm_id=g.root_realm_id AND r.center_id=g.center_id "+
   "AND r.capability=g.capability AND r.id=g.approved_revision_id "+
   "JOIN cg03_case review ON review.id=r.original_case_ref "+
   "AND review.realm_id=r.root_realm_id AND review.status='OWNER_COMPLETED' "+
   "AND review.case_kind='HEALTH_CENTER_ERP_GRANT' "+
   "AND review.health_erp_revision_id=r.id "+
   "JOIN cg03_case_decision decision ON decision.id=g.original_decision_ref "+
   "AND decision.realm_id=review.realm_id AND decision.case_id=review.id "+
   "AND decision.action='APPROVE' AND decision.actor_id=g.approved_by "+
   "AND decision.actor_id<>review.proposer_id "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "WHERE g.root_realm_id=$1 AND g.center_id=$2 AND g.capability='LAB_ERP' "+
   "AND g.state='APPROVED' AND r.capability='LAB_ERP' "+
   "AND r.effective_from<=now() "+
   "AND (r.effective_until IS NULL OR r.effective_until>now()) "+
   "FOR SHARE OF g,r",[actor.realmId,centerRef]);
  if(!g.rowCount)
   throw new ForbiddenException({code:"LAB_CENTER_ERP_NOT_APPROVED"});
  return actor;
 }
 async requireCurrent(tx:PoolClient,bearer:string,centerRef:string,
  action:LabClinicalAction):Promise<VerifiedFoundationActor>{
  if(process.env.CAREGANGA_ERP_LAB_ENABLED!=="true"||
     process.env.CAREGANGA_LAB_CLINICAL_READINESS!=="APPROVED")
   throw new ServiceUnavailableException({code:"LAB_CLINICAL_OPERATIONS_DISABLED"});
  return this.requireLabGrant(tx,bearer,centerRef,action);
 }
 /** Equipment and quality are optional LAB_ERP activities, independent of
  * CG15 patient/order clinical readiness. The same CG14 center and CG03
  * approved current grant apply, without a new shadow center permission.
  */
 async requireEquipmentCurrent(tx:PoolClient,bearer:string,centerRef:string,
  action:LabEquipmentAction):Promise<VerifiedFoundationActor>{
  if(process.env.CAREGANGA_ERP_LAB_ENABLED!=="true")
   throw new ServiceUnavailableException({code:"LAB_EQUIPMENT_DISABLED"});
  return this.requireLabGrant(tx,bearer,centerRef,action);
 }

 /** Patient ID is not consent. Recheck CG15 profile, original in-person
  * identity proof, latest care consent and SAME-center actual care source.
  * Use within the order-creation transaction, not in a prior page read. */
 async patientCare(tx:PoolClient,actor:VerifiedFoundationActor,
  centerRef:string,patientRef:string,care:CareSource):Promise<CurrentPatientCare>{
  if(!UUID.test(patientRef)||!UUID.test(care.ref)||
     !["CENTER_INTAKE","CONSULTATION"].includes(care.kind))
   throw new BadRequestException({code:"LAB_PATIENT_SOURCE_INVALID"});
  const p=await tx.query<{profile_status:string}>(
   "SELECT profile_status FROM cg15_patient "+
   "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,patientRef]);
  if(p.rows[0]?.profile_status!=="VERIFIED")
   throw new ForbiddenException({code:"LAB_PATIENT_NOT_READY"});
  const proof=await tx.query("SELECT 1 FROM cg15_patient_identity_event "+
   "WHERE root_realm_id=$1 AND patient_id=$2 LIMIT 1",
   [actor.realmId,patientRef]);
  if(!proof.rowCount)
   throw new ForbiddenException({code:"LAB_PATIENT_NOT_READY"});
  const consent=await tx.query<{revision_no:number;recorded_at:Date}>(
   "SELECT revision_no,recorded_at FROM cg15_patient_consent "+
   "WHERE root_realm_id=$1 AND patient_id=$2 AND purpose='PATIENT_CARE' "+
   "AND granted=true AND revision_no=(SELECT MAX(c.revision_no) "+
    "FROM cg15_patient_consent c WHERE c.root_realm_id=$1 "+
    "AND c.patient_id=$2 AND c.purpose='PATIENT_CARE')",
   [actor.realmId,patientRef]);
  if(!consent.rows[0])
   throw new ForbiddenException({code:"LAB_PATIENT_CONSENT_REQUIRED"});
  if(care.kind==="CENTER_INTAKE"){
   const source=await tx.query(
    "SELECT 1 FROM cg15_patient_center_intake "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND patient_id=$3 "+
    "AND id=$4 AND assisted_consent_attested=true FOR SHARE",
    [actor.realmId,centerRef,patientRef,care.ref]);
   if(!source.rowCount)
    throw new ForbiddenException({code:"LAB_PATIENT_CENTER_CONSENT_REQUIRED"});
  }else{
   const source=await tx.query(
    "SELECT 1 FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND patient_id=$3 "+
    "AND id=$4 AND booking_state IN("+
     "'ARRIVED','WAITING','IN_CONSULTATION','COMPLETED') FOR SHARE",
    [actor.realmId,centerRef,patientRef,care.ref]);
   if(!source.rowCount)
    throw new ForbiddenException({code:"LAB_PATIENT_CENTER_CONSENT_REQUIRED"});
  }
  return {patientRef,consentRevision:consent.rows[0].revision_no,
   consentRecordedAt:consent.rows[0].recorded_at,careSource:care};
 }
}
