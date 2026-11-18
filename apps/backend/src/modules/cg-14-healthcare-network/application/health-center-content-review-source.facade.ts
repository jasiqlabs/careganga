import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
export type CenterContentSubmission={kind:"HEALTH_CENTER_CONTENT_REVIEW";
 providerRef:string;centerRef:string;revisionRef:string;
 revisionNo:number;digest:string;requestKey:string};
/** CG-14 original frozen content source read by CG-03, never shadow-case data. */
@Injectable()
export class HealthCenterContentReviewSourceFacade{
 async original(tx:PoolClient,actor:VerifiedFoundationActor,input:CenterContentSubmission){
  const provider=await tx.query<{status:string}>(
   "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,input.providerRef]);
  const center=await tx.query<{status:string;access_state:string;display_name:string}>(
   "SELECT status,access_state,display_name FROM health_center "+
   "WHERE root_realm_id=$1 AND provider_id=$2 AND id=$3 FOR SHARE",
   [actor.realmId,input.providerRef,input.centerRef]);
  if(provider.rows[0]?.status!=="VERIFIED"||center.rows[0]?.status!=="VERIFIED"||
    center.rows[0]?.access_state!=="ENABLED")
   throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
  const draft=await tx.query<{state:string}>(
   "SELECT state FROM health_center_content_draft "+
   "WHERE root_realm_id=$1 AND center_id=$2 FOR SHARE",
   [actor.realmId,input.centerRef]);
  if(draft.rows[0]?.state!=="SUBMITTED")
   throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
  const row=await tx.query<{source_snapshot:Record<string,unknown>;approval_case_ref:string|null}>(
   "SELECT source_snapshot,approval_case_ref FROM health_center_content_revision "+
   "WHERE root_realm_id=$1 AND center_id=$2 AND id=$3 "+
   "AND revision_no=$4 AND source_digest=$5 FOR SHARE",
   [actor.realmId,input.centerRef,input.revisionRef,input.revisionNo,input.digest]);
  if(!row.rows[0])
   throw new ConflictException({code:"HEALTH_CONTENT_SOURCE_CHANGED"});
  return {title:center.rows[0].display_name,source:row.rows[0].source_snapshot,
   approvalCaseRef:row.rows[0].approval_case_ref};
 }
}
