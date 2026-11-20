import {Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";

/** CG15 original immutable clinician-completed service proof for CG17 US005.
 * Read-only typed owner facade. Never stores another appointment/visit master,
 * accepts a client-provided 'completed' flag, or claims the patient paid.
 */
export type OriginalCompletedConsultation=Readonly<{
 appointmentRef:string;centerRef:string;patientRef:string;
 doctorRef:string;associationRef:string;
 termsRevision:number;startAt:Date;endAt:Date;
 completionEventRef:string;completedAt:Date;
 completionActorRef:string;completionDigest:string;
 consentRevision:number
}>;
type CompletedRow={
 appointment_ref:string;center_ref:string;patient_ref:string;
 doctor_ref:string;association_ref:string;terms_revision:number;
 start_at:Date;end_at:Date;completion_event_ref:string;
 completed_at:Date;completion_actor_ref:string;
 completion_digest:string;consent_revision:number
};
@Injectable()
export class ConsultationCompletionSourceFacade{
 /** Original CG15 completed appointment labels only; CG17 filters its own
  * accepted charge and obligations independently. No CG15 -> CG17 import.
  */
 async eligibleCompletedOptions(c:PoolClient,actor:VerifiedFoundationActor,
  center:string){
  const q=await c.query<{appointment_ref:string;booking_display_id:string;
   center_name:string;doctor_name:string;completed_at:Date}>(
   "SELECT a.id AS appointment_ref,a.booking_display_id,a.center_name,"+
   "a.doctor_name,e.created_at AS completed_at "+
   "FROM cg15_consultation_appointment a "+
   "JOIN cg15_visit_queue v ON v.root_realm_id=a.root_realm_id "+
   "AND v.appointment_id=a.id AND v.center_id=a.center_id "+
   "JOIN cg15_visit_event e ON e.root_realm_id=v.root_realm_id "+
   "AND e.visit_id=v.id AND e.appointment_id=a.id "+
   "AND e.next_state='COMPLETED' "+
   "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id "+
   "AND p.id=a.patient_id AND p.profile_status='VERIFIED' "+
   "WHERE a.root_realm_id=$1 AND a.center_id=$2 "+
   "AND a.booking_state='COMPLETED' AND v.state='COMPLETED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event identity "+
   "WHERE identity.root_realm_id=p.root_realm_id AND identity.patient_id=p.id) "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_consent x "+
   "WHERE x.root_realm_id=a.root_realm_id AND x.patient_id=a.patient_id "+
   "AND x.purpose='PATIENT_CARE' AND x.granted=true "+
   "AND x.revision_no=(SELECT max(latest.revision_no) "+
   "FROM cg15_patient_consent latest "+
   "WHERE latest.root_realm_id=x.root_realm_id "+
   "AND latest.patient_id=x.patient_id AND latest.purpose='PATIENT_CARE')) "+
   "ORDER BY e.created_at DESC,e.id DESC LIMIT 51 FOR SHARE OF a,v,e,p",
   [actor.realmId,center]);
  return {rows:q.rows.slice(0,50).map(x=>({
   appointmentRef:x.appointment_ref,bookingLabel:x.booking_display_id,
   centerName:x.center_name,doctorName:x.doctor_name,
   completedAt:x.completed_at.toISOString()})),
   complete:q.rows.length<=50};
 }
 async completed(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,booking:string):Promise<OriginalCompletedConsultation>{
  const q=await c.query<CompletedRow>(
   "SELECT a.id AS appointment_ref,a.center_id AS center_ref,"+
   "a.patient_id AS patient_ref,a.doctor_id AS doctor_ref,"+
   "a.association_id AS association_ref,a.terms_revision,"+
   "a.start_at,a.end_at,e.id AS completion_event_ref,"+
   "e.created_at AS completed_at,e.actor_account_id AS completion_actor_ref,"+
   "e.request_digest AS completion_digest, "+
   "(SELECT consent.revision_no FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=a.root_realm_id AND consent.patient_id=a.patient_id "+
   "AND consent.purpose='PATIENT_CARE' "+
   "ORDER BY consent.revision_no DESC LIMIT 1) AS consent_revision "+
   "FROM cg15_consultation_appointment a "+
   "JOIN cg15_visit_queue v ON v.root_realm_id=a.root_realm_id "+
   "AND v.appointment_id=a.id AND v.center_id=a.center_id "+
   "JOIN cg15_visit_event e ON e.root_realm_id=v.root_realm_id "+
   "AND e.visit_id=v.id AND e.appointment_id=a.id "+
   "AND e.next_state='COMPLETED' "+
   "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id "+
   "AND p.id=a.patient_id AND p.profile_status='VERIFIED' "+
   "WHERE a.root_realm_id=$1 AND a.center_id=$2 AND a.id=$3 "+
   "AND a.booking_state='COMPLETED' AND v.state='COMPLETED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event identity "+
   "WHERE identity.root_realm_id=p.root_realm_id AND identity.patient_id=p.id) "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_consent x "+
   "WHERE x.root_realm_id=a.root_realm_id AND x.patient_id=a.patient_id "+
   "AND x.purpose='PATIENT_CARE' AND x.granted=true "+
   "AND x.revision_no=(SELECT max(latest.revision_no) "+
   "FROM cg15_patient_consent latest "+
   "WHERE latest.root_realm_id=x.root_realm_id "+
   "AND latest.patient_id=x.patient_id AND latest.purpose='PATIENT_CARE')) "+
   "ORDER BY e.created_at DESC,e.id DESC LIMIT 1 FOR SHARE OF a,v,e,p",
   [actor.realmId,center,booking]);
  const x=q.rows[0];
  if(!x)throw new NotFoundException({code:"CG15_COMPLETED_CONSULTATION_UNAVAILABLE"});
  return {appointmentRef:x.appointment_ref,centerRef:x.center_ref,
   patientRef:x.patient_ref,doctorRef:x.doctor_ref,
   associationRef:x.association_ref,termsRevision:x.terms_revision,
   startAt:x.start_at,endAt:x.end_at,
   completionEventRef:x.completion_event_ref,completedAt:x.completed_at,
   completionActorRef:x.completion_actor_ref,
   completionDigest:x.completion_digest,
   consentRevision:x.consent_revision};
 }
}
