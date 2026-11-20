import {ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthVerifiedCenterDoctorFacade}
 from "../../cg-14-healthcare-network/application/health-verified-center-doctor.facade";
export type AssistancePolicySubmission=Readonly<{
 kind:"CG17_POLICY_EXCEPTION";policyRevisionRef:string;revisionNo:number;
 digest:string;requestKey:string;centerRef:string
}>;
/** CG17 original revision, read by genuine CG03 approval; no shadow case. */
@Injectable()
export class HealthcareAssistanceReviewSourceFacade{
 constructor(private readonly verified:HealthVerifiedCenterDoctorFacade){}
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
  // The CG-14 owner, not CG-17, validates the current original center,
  // doctor affiliation, independent CG03 decision and scanned CG19 proof.
  try{
   const current=await this.verified.center(c,actor.realmId,v.center_ref);
   if(v.doctor_ref)
    await this.verified.doctor(c,actor.realmId,v.center_ref,v.doctor_ref);
   return {revision:v,centerName:current.name};
  }catch(error){
   if(error instanceof NotFoundException)
    throw new ConflictException({code:"ASSISTANCE_POLICY_CLINICAL_SOURCE_CHANGED"});
   throw error;
  }
 }
}
