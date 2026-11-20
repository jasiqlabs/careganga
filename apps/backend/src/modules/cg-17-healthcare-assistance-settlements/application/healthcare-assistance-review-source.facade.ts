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
  return {revision:v,centerName:verified.rows[0].name};
 }
}
