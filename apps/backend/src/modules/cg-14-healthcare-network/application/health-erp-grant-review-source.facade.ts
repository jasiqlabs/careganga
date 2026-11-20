import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export type GrantSubmission=Readonly<{
 kind:"HEALTH_CENTER_ERP_GRANT";
 providerRef:string;centerRef:string;revisionRef:string;
 revisionNo:number;digest:string;requestKey:string;
}>;
/** CG-14 original immutable source, read by the one original CG-03 approval
 * process. Never grant an operational ERP permission from this facade. */
@Injectable()
export class HealthErpGrantReviewSourceFacade{
 async original(tx:PoolClient,actor:VerifiedFoundationActor,input:GrantSubmission){
  const p=await tx.query<{status:string;legal_name:string}>(
   "SELECT status,legal_name FROM health_provider WHERE root_realm_id=$1 "+
   "AND id=$2 FOR SHARE",[actor.realmId,input.providerRef]);
  const c=await tx.query<{status:string;access_state:string;provider_id:string;
    display_name:string}>(
   "SELECT status,access_state,provider_id,display_name FROM health_center "+
   "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [actor.realmId,input.centerRef]);
  const grant=await tx.query<{state:string;version:number;
    pending_revision_id:string}>(
   "SELECT state,version,pending_revision_id FROM health_center_erp_grant "+
   "WHERE root_realm_id=$1 AND center_id=$2 "+
   "AND pending_revision_id=$3 FOR SHARE",
   [actor.realmId,input.centerRef,input.revisionRef]);
  const rev=await tx.query<{id:string;capability:string;source_digest:string;
    effective_from:Date;effective_until:Date|null;revision_no:number;
    submitted_by:string;original_case_ref:string|null}>(
   "SELECT id,capability,source_digest,effective_from,effective_until,"+
   "revision_no,submitted_by,original_case_ref "+
   "FROM health_center_erp_grant_revision "+
   "WHERE root_realm_id=$1 AND provider_id=$2 AND center_id=$3 AND id=$4 "+
   "AND source_digest=$5 AND revision_no=$6 FOR SHARE",
   [actor.realmId,input.providerRef,input.centerRef,input.revisionRef,
    input.digest,input.revisionNo]);
  if(p.rows[0]?.status!=="VERIFIED"||c.rows[0]?.provider_id!==input.providerRef||
    c.rows[0]?.status!=="VERIFIED"||c.rows[0]?.access_state!=="ENABLED"||
    grant.rows[0]?.state!=="REQUESTED"||grant.rows[0]?.version!==input.revisionNo||
    !rev.rows[0]||rev.rows[0].original_case_ref&&
     !/^[a-f0-9-]{36}$/i.test(rev.rows[0].original_case_ref))
   throw new ConflictException({code:"HEALTH_ERP_GRANT_SOURCE_CHANGED"});
  return {centerName:c.rows[0].display_name,providerName:p.rows[0].legal_name,
   capability:rev.rows[0].capability,validFrom:rev.rows[0].effective_from,
   validUntil:rev.rows[0].effective_until,submittedBy:rev.rows[0].submitted_by};
 }
}
