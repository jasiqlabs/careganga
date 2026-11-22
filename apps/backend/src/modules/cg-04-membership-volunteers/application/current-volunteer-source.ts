import {ForbiddenException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** CG04's current original volunteer eligibility source, shared by CG05 and CG09.
 * The supplied SQL fragments are hard-coded trusted aliases/parameters, never user text.
 * A volunteer association grants NO CG01 project, clinical or finance capabilities. */
export function currentVolunteerPredicate(v:string,account:string,branch:string):string{
 return ` ${v}.status='ACTIVE' AND ${v}.account_ref=${account}
 AND ${v}.branch_ref IS NOT DISTINCT FROM ${branch}
 AND EXISTS(SELECT 1 FROM volunteer_application app
  JOIN volunteer_approval_effect effect ON effect.root_realm_id=app.root_realm_id AND effect.application_id=app.id
    AND effect.volunteer_id=${v}.id
  JOIN cg03_case review ON review.realm_id=effect.root_realm_id AND review.id=effect.case_id
    AND review.case_kind='VOLUNTEER_APPLICATION' AND review.status='OWNER_COMPLETED'
  JOIN account person ON person.realm_id=app.root_realm_id AND person.id=app.applicant_account_ref
    AND person.id=${v}.account_ref AND person.status='ACTIVE'
    AND person.contact_phone_verified_at IS NOT NULL AND person.contact_phone=app.contact_mobile
    AND person.normalized_email IS NOT DISTINCT FROM app.contact_email
  WHERE app.root_realm_id=${v}.root_realm_id AND app.id=${v}.original_application_id AND app.status='APPROVED')
 AND EXISTS(SELECT 1 FROM volunteer_affiliation_history aff
  WHERE aff.root_realm_id=${v}.root_realm_id AND aff.volunteer_id=${v}.id AND aff.effective_to IS NULL
    AND aff.branch_ref IS NOT DISTINCT FROM ${v}.branch_ref AND aff.department_ref=${v}.department_ref)
 AND EXISTS(SELECT 1 FROM department dept WHERE dept.root_realm_id=${v}.root_realm_id
   AND dept.id=${v}.department_ref AND dept.active AND dept.kind='DEPARTMENT'
   AND ((dept.scope_kind='FOUNDATION' AND (${v}.branch_ref IS NULL OR EXISTS(
     SELECT 1 FROM branch_department_link link WHERE link.root_realm_id=${v}.root_realm_id
      AND link.branch_id=${v}.branch_ref AND link.foundation_department_id=dept.id AND link.ended_at IS NULL)))
    OR (dept.scope_kind='BRANCH' AND dept.branch_id=${v}.branch_ref)))
 AND (${v}.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=${v}.root_realm_id
     AND b.id=${v}.branch_ref AND b.status='ACTIVE'))
 AND EXISTS(SELECT 1 FROM cg19_volunteer_private_file proof
    JOIN volunteer_review_file frozen ON frozen.root_realm_id=proof.realm_id AND frozen.file_id=proof.id
    JOIN cg03_case review ON review.realm_id=frozen.root_realm_id AND review.volunteer_review_ref=frozen.snapshot_id
    JOIN volunteer_approval_effect effect ON effect.root_realm_id=review.realm_id AND effect.case_id=review.id
      AND effect.volunteer_id=${v}.id
    WHERE proof.realm_id=${v}.root_realm_id AND proof.application_id=${v}.original_application_id
      AND frozen.classification='VOLUNTEER_IDENTITY_PROOF' AND proof.scan_status='CLEAN_VERIFIED'
      AND proof.revoked_at IS NULL AND proof.revision=frozen.file_version AND proof.sha256=frozen.sha256)`;
}
export type CurrentVolunteer={id:string;account_ref:string;branch_ref:string|null;volunteer_no:string;display_name:string};
export async function requireCurrentVolunteer(tx:PoolClient,realm:string,ref:string,branch:string|null,
 account?:string):Promise<CurrentVolunteer>{
 const predicate=currentVolunteerPredicate("v","v.account_ref","$3::uuid");
 const q=await tx.query<CurrentVolunteer>(`SELECT v.id,v.account_ref,v.branch_ref,v.volunteer_no,v.display_name
 FROM volunteer v WHERE v.root_realm_id=$1 AND v.id=$2 AND ${predicate}
 AND ($4::uuid IS NULL OR v.account_ref=$4) FOR SHARE OF v`,[realm,ref,branch,account??null]);
 if(q.rows.length!==1)throw new ForbiddenException("Choose an active, independently approved volunteer for the current project branch.");
 return q.rows[0];
}
