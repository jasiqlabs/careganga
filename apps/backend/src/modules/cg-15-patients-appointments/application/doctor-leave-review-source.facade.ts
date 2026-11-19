import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export type DoctorLeaveSubmission=Readonly<{
 kind:"CG15_DOCTOR_LEAVE";
 doctorRef:string;centerRef:string;exceptionRef:string;
 revisionNo:number;digest:string;requestKey:string;
}>;
type ExceptionSource={
 id:string;root_realm_id:string;doctor_id:string;center_id:string;
 schedule_id:string;association_id:string;kind:string;state:string;
 version:number;source_digest:string;original_case_ref:string|null;
 approved_case_ref:string|null;proposed_by:string;
 start_at:Date;end_at:Date;reason:string;
};
@Injectable()
export class DoctorLeaveReviewSourceFacade{
 /** Original CG15 exception is immutable input to the ONE CG03 case.
  * CG03 owns decision, CG15 applies only pinned original accepted decision.
  */
 async original(tx:PoolClient,actor:VerifiedFoundationActor,input:DoctorLeaveSubmission){
  const peek=await tx.query<ExceptionSource>(
   "SELECT * FROM cg15_schedule_exception WHERE root_realm_id=$1 "+
   "AND id=$2 AND center_id=$3 AND doctor_id=$4 AND kind='LEAVE'",
   [actor.realmId,input.exceptionRef,input.centerRef,input.doctorRef]);
  const found=peek.rows[0];
  if(!found||found.version<input.revisionNo||
    found.source_digest!==input.digest||found.state!=="PENDING")
   throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  const provider=await tx.query<{provider_id:string}>(
   "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
   [actor.realmId,input.centerRef]);
  if(!provider.rows[0])
   throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  const p=await tx.query<{status:string}>(
   "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,provider.rows[0].provider_id]);
  const c=await tx.query<{status:string;access_state:string}>(
   "SELECT status,access_state FROM health_center WHERE root_realm_id=$1 "+
   "AND provider_id=$2 AND id=$3 FOR SHARE",
   [actor.realmId,provider.rows[0].provider_id,input.centerRef]);
  const d=await tx.query<{status:string;full_name:string}>(
   "SELECT status,full_name FROM health_doctor "+
   "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,input.doctorRef]);
  const a=await tx.query<{affiliation_state:string;approved_to:Date|null;
    approved_from:Date|null}>(
   "SELECT affiliation_state,approved_from,approved_to FROM health_doctor_center "+
   "WHERE root_realm_id=$1 AND id=$2 AND doctor_id=$3 AND center_id=$4 FOR SHARE",
   [actor.realmId,found.association_id,input.doctorRef,input.centerRef]);
  const schedule=await tx.query<{id:string;status:string}>(
   "SELECT id,status FROM cg15_doctor_schedule "+
   "WHERE root_realm_id=$1 AND id=$2 AND doctor_id=$3 AND center_id=$4 "+
   "AND association_id=$5 FOR SHARE",
   [actor.realmId,found.schedule_id,input.doctorRef,input.centerRef,
    found.association_id]);
  // Original CG03 review must see the same CURRENT approved CG14/CG19
  // evidence as scheduling. Revoked center/doctor proof cannot be approved.
  const evidence=await tx.query<{doctor_ok:boolean;center_ok:boolean}>(
   "SELECT EXISTS(SELECT 1 FROM health_doctor_revision dr "+
   "JOIN cg03_case dc ON dc.id=dr.approval_case_ref AND dc.realm_id=dr.root_realm_id "+
   "AND dc.case_kind='HEALTH_DOCTOR_VERIFICATION' AND dc.status='OWNER_COMPLETED' "+
   "AND dc.health_doctor_id=dr.doctor_id AND dc.health_doctor_revision_id=dr.id "+
   "AND dc.health_source_digest=dr.source_digest "+
   "JOIN cg03_case_decision dd ON dd.case_id=dc.id AND dd.realm_id=dc.realm_id "+
   "AND dd.action='APPROVE' AND dd.fresh_password_verified_at IS NOT NULL "+
   "AND dd.actor_id<>dc.proposer_id "+
   "JOIN cg19_stored_file proof ON proof.id=dr.proof_file_ref "+
   "AND proof.realm_id=dr.root_realm_id AND proof.owner_kind='CG14_DOCTOR' "+
   "AND proof.health_doctor_id=dr.doctor_id AND proof.revoked_at IS NULL "+
   "AND proof.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent i ON i.id=proof.upload_intent_id "+
   "AND i.realm_id=proof.realm_id AND i.status='VALIDATED' "+
   "AND i.classification='HEALTH_DOCTOR_LICENSE' "+
   "WHERE dr.root_realm_id=$1 AND dr.doctor_id=$2 "+
   "AND dr.revision_no=(SELECT MAX(x.revision_no) FROM health_doctor_revision x "+
   "WHERE x.root_realm_id=dr.root_realm_id AND x.doctor_id=dr.doctor_id)) doctor_ok,"+
   " EXISTS(SELECT 1 FROM health_center_revision cr "+
   "JOIN cg03_case cc ON cc.id=cr.approval_case_ref "+
   "AND cc.realm_id=cr.root_realm_id AND cc.case_kind='HEALTH_CENTER_VERIFICATION' "+
   "AND cc.status='OWNER_COMPLETED' AND cc.health_center_id=cr.center_id "+
   "AND cc.health_center_revision_id=cr.id AND cc.health_source_digest=cr.source_digest "+
   "JOIN cg03_case_decision cd ON cd.case_id=cc.id AND cd.realm_id=cc.realm_id "+
   "AND cd.action='APPROVE' AND cd.fresh_password_verified_at IS NOT NULL "+
   "AND cd.actor_id<>cc.proposer_id "+
   "JOIN cg19_stored_file proof ON proof.id=cr.proof_file_ref "+
   "AND proof.realm_id=cr.root_realm_id AND proof.owner_kind='CG14_DRAFT' "+
   "AND proof.health_provider_id=cr.provider_id AND proof.health_center_id=cr.center_id "+
   "AND proof.revoked_at IS NULL AND proof.scan_status='CLEAN_VERIFIED' "+
   "JOIN cg19_upload_intent i ON i.id=proof.upload_intent_id "+
   "AND i.realm_id=proof.realm_id AND i.status='VALIDATED' "+
   "AND i.classification='HEALTH_CENTER_LICENSE' "+
   "WHERE cr.root_realm_id=$1 AND cr.center_id=$3 "+
   "AND cr.revision_no=(SELECT MAX(x.revision_no) FROM health_center_revision x "+
   "WHERE x.root_realm_id=cr.root_realm_id AND x.center_id=cr.center_id)) center_ok",
   [actor.realmId,input.doctorRef,input.centerRef]);
  if(!evidence.rows[0]?.doctor_ok||!evidence.rows[0]?.center_ok)
   throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  const original=await tx.query<ExceptionSource>(
   "SELECT * FROM cg15_schedule_exception WHERE root_realm_id=$1 "+
   "AND id=$2 AND kind='LEAVE' AND source_digest=$3 FOR SHARE",
   [actor.realmId,input.exceptionRef,input.digest]);
  const row=original.rows[0];
  if(p.rows[0]?.status!=="VERIFIED"||c.rows[0]?.status!=="VERIFIED"||
     c.rows[0]?.access_state!=="ENABLED"||
     d.rows[0]?.status!=="VERIFIED"||
     a.rows[0]?.affiliation_state!=="APPROVED"||
     !a.rows[0].approved_from||a.rows[0].approved_from>new Date()||
     a.rows[0].approved_to&&a.rows[0].approved_to<=new Date()||
     schedule.rows[0]?.status!=="ACTIVE"||!row||
     row.state!=="PENDING"||row.version<input.revisionNo||
     row.center_id!==input.centerRef||row.doctor_id!==input.doctorRef||
     row.source_digest!==input.digest)
   throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  return {doctorName:d.rows[0].full_name,centerRef:input.centerRef,
    doctorRef:input.doctorRef,startAt:row.start_at,endAt:row.end_at,
    reason:row.reason,proposedBy:row.proposed_by,
    originalCaseRef:row.original_case_ref};
 }
}
