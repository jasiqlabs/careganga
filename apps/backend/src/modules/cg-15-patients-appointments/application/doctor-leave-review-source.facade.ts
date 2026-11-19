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
  if(!found||found.version!==input.revisionNo||
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
     row.state!=="PENDING"||row.version!==input.revisionNo||
     row.center_id!==input.centerRef||row.doctor_id!==input.doctorRef||
     row.source_digest!==input.digest)
   throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  return {doctorName:d.rows[0].full_name,centerRef:input.centerRef,
    doctorRef:input.doctorRef,startAt:row.start_at,endAt:row.end_at,
    reason:row.reason,proposedBy:row.proposed_by,
    originalCaseRef:row.original_case_ref};
 }
}
