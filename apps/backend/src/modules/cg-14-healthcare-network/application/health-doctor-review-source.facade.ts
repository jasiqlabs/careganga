import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

/** Typed read-only CG14 source for the EXISTING CG03 professional verification.
 * The original CG19 doctor license is checked in the same transaction.
 */
export type DoctorSubmission={
  kind:"HEALTH_DOCTOR_VERIFICATION";doctorRef:string;
  revisionRef:string;revisionNo:number;digest:string;requestKey:string
};
@Injectable()
export class HealthDoctorReviewSourceFacade{
  async original(tx:PoolClient,actor:VerifiedFoundationActor,input:DoctorSubmission){
    const found=await tx.query<{source_version:number;source_digest:string;
      approval_case_ref:string|null;proof_file_ref:string;
      source_snapshot:Record<string,unknown>;status:string;current_version:number}>(
      "SELECT rev.source_version,rev.source_digest,rev.approval_case_ref,"+
      "rev.proof_file_ref,rev.source_snapshot,d.status,d.version AS current_version "+
      "FROM health_doctor_revision rev JOIN health_doctor d "+
      "ON d.root_realm_id=rev.root_realm_id AND d.id=rev.doctor_id "+
      "WHERE rev.id=$1 AND rev.root_realm_id=$2 AND rev.doctor_id=$3 "+
      "AND rev.revision_no=$4 AND rev.source_digest=$5 FOR SHARE OF rev,d",
      [input.revisionRef,actor.realmId,input.doctorRef,input.revisionNo,input.digest]);
    const r=found.rows[0];
    if(!r||r.status!=="SUBMITTED"||r.current_version!==input.revisionNo+1)
      throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
    const file=await tx.query(
      "SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i "+
      "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG14_DOCTOR' "+
      "AND f.health_doctor_id=$3 AND f.health_source_version=$4 "+
      "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
      "AND i.status='VALIDATED' AND i.classification='HEALTH_DOCTOR_LICENSE' "+
      "FOR SHARE OF f,i",
      [r.proof_file_ref,actor.realmId,input.doctorRef,input.revisionNo]);
    if(!file.rowCount)
      throw new ConflictException({code:"HEALTH_DOCTOR_EVIDENCE_NOT_VERIFIED"});
    return {sourceSnapshot:r.source_snapshot,sourceVersion:r.source_version,
      caseRef:r.approval_case_ref,proofFileRef:r.proof_file_ref};
  }
  async reviewSnapshot(tx:PoolClient,actor:VerifiedFoundationActor,input:DoctorSubmission){
    const source=await this.original(tx,actor,input);
    return {kind:input.kind,source:source.sourceSnapshot,
      proofStatus:"PRIVATE_VERIFIED",sourceVersion:source.sourceVersion};
  }
}
