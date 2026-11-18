import {ConflictException,Inject,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {DATABASE} from "../../../core/infrastructure/database.module";
import type {Pool} from "pg";
export type HealthReviewKind="HEALTH_PROVIDER_VERIFICATION"|"HEALTH_CENTER_VERIFICATION";
export type HealthSubmission={
  kind:HealthReviewKind;providerRef:string;centerRef:string|null;
  revisionRef:string;revisionNo:number;digest:string;requestKey:string
};
@Injectable()
export class HealthReviewSourceFacade{
  constructor(@Inject(DATABASE)private readonly db:Pool){}
  /** Read of CG-14's original revision and CG-19's verified evidence,
   * called by CG-03 in the SAME transaction as case creation/decision.
   */
  async original(tx:PoolClient,actor:VerifiedFoundationActor,input:HealthSubmission){
    const center=input.kind==="HEALTH_CENTER_VERIFICATION";
    if(center!==Boolean(input.centerRef))
      throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
    const result=await tx.query<{source_version:number;source_digest:string;case_ref:string|null;
      proof_file_ref:string;source_snapshot:Record<string,unknown>;status:string}>(
      center?
        "SELECT rev.source_version,rev.source_digest,rev.approval_case_ref AS case_ref,"+
        "rev.proof_file_ref,rev.source_snapshot,c.status FROM health_center_revision rev "+
        "JOIN health_center c ON c.root_realm_id=rev.root_realm_id "+
        "AND c.id=rev.center_id AND c.provider_id=rev.provider_id "+
        "WHERE rev.id=$1 AND rev.root_realm_id=$2 AND rev.provider_id=$3 "+
        "AND rev.center_id=$4 AND rev.revision_no=$5 AND rev.source_digest=$6 "+
        "FOR SHARE OF rev,c":
        "SELECT rev.source_version,rev.source_digest,rev.approval_case_ref AS case_ref,"+
        "rev.proof_file_ref,rev.source_snapshot,p.status FROM health_provider_revision rev "+
        "JOIN health_provider p ON p.root_realm_id=rev.root_realm_id AND p.id=rev.provider_id "+
        "WHERE rev.id=$1 AND rev.root_realm_id=$2 AND rev.provider_id=$3 "+
        "AND rev.revision_no=$5 AND rev.source_digest=$6 FOR SHARE OF rev,p",
      [input.revisionRef,actor.realmId,input.providerRef,input.centerRef,
        input.revisionNo,input.digest]);
    const rev=result.rows[0];
    if(!rev||rev.status!=="SUBMITTED")
      throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
    const file=await tx.query(
      "SELECT f.id FROM cg19_stored_file f "+
      "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG14_DRAFT' "+
      "AND f.health_provider_id=$3 AND f.health_center_id IS NOT DISTINCT FROM $4::uuid "+
      "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
      "AND i.status='VALIDATED' AND i.classification=$5 FOR SHARE OF f,i",
      [rev.proof_file_ref,actor.realmId,input.providerRef,input.centerRef,
        center?"HEALTH_CENTER_LICENSE":"HEALTH_PROVIDER_REGISTRATION"]);
    if(!file.rows[0])throw new ConflictException({code:"HEALTH_REVIEW_PROOF_NOT_CURRENT"});
    return {title:center?"Healthcare center verification":"Healthcare provider verification",
      sourceSnapshot:rev.source_snapshot,sourceVersion:rev.source_version,
      caseRef:rev.case_ref,proofFileRef:rev.proof_file_ref};
  }
  /** Protected approval reviewers see safe registration snapshots only,
   * not bank proof, full CG-19 private bytes, or third-party data.
   */
  async reviewSnapshot(tx:PoolClient,actor:VerifiedFoundationActor,input:HealthSubmission){
    const proof=await this.original(tx,actor,input);
    return {kind:input.kind,
      source:proof.sourceSnapshot,
      proofStatus:"PRIVATE_VERIFIED",
      sourceVersion:proof.sourceVersion};
  }
}
