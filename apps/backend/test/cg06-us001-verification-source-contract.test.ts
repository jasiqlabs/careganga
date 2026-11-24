import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
// Exact owner-source integration checks only. Fresh PostgreSQL and Android QA are NOT_RUN.
const read=(path:string)=>readFileSync(join(import.meta.dirname,"../../",path),"utf8");
const migration=read("apps/backend/db/migrations/3602_cg03_original_beneficiary_verification.sql");
const source=read("apps/backend/src/modules/cg-06-beneficiaries-assistance/application/beneficiaries.service.ts");
const cg03=read("apps/backend/src/modules/cg-03-registration-approvals/application/beneficiary-verification-review.service.ts");
const controller=read("apps/backend/src/modules/cg-03-registration-approvals/http/beneficiary-verification-review.controller.ts");
const module=read("apps/backend/src/modules/cg-03-registration-approvals/registration-approvals.module.ts");

test("US-001-QA12/14: original CG03 case and independent decisions only; no shadow approval engine",()=>{
 assert.match(migration,/ALTER TABLE cg03_case\s+ADD COLUMN beneficiary_review_ref uuid/);
 assert.match(migration,/cg03_case_finance_source_disjoint/);
 assert.match(migration,/cg03_process_kind_finance/);
 assert.match(migration,/cg03_case_kind_finance/);
 assert.match(cg03,/INSERT INTO cg03_case\(/);
 assert.match(cg03,/INSERT INTO cg03_case_decision\(/);
 assert.match(cg03,/requireDistinctFinalReviewer/);
 assert.match(cg03,/verifyReviewer\(tx,a,"approvals.review",true\)/);
 assert.match(cg03,/requireFreshFoundationRootProof\(tx,a,x.currentPassword\)/);
 assert.match(controller,/submit-verification/);
 assert.match(controller,/verification-cases\/\:ref\/decide/);
 assert.match(module,/BeneficiariesSourceModule/);
 assert.match(module,/BeneficiaryVerificationReviewController/);
});
test("US-001-QA03/11/14/18: exact revised beneficiary source and consent must match",()=>{
 assert.match(source,/guardVerificationSource/);
 assert.match(source,/submitVerificationSource/);
 assert.match(source,/applyVerificationDecision/);
 assert.match(source,/sourceDigest:string,caseRef:string,decision/);
 assert.match(source,/this.fingerprint\(current\)!==sourceDigest/);
 assert.match(source,/current.verification_state!=="SUBMITTED"/);
 assert.match(source,/current.consent_revoked_at/);
 assert.match(cg03,/c.proposer_id===a.accountId/);
 assert.match(cg03,/src.revision!==c.beneficiary_source_revision/);
 assert.match(cg03,/src.digest!==c.beneficiary_source_digest/);
});
test("US-001-QA05/16: both authenticated staff channels consume original CG03 routes",()=>{
 const web=read("apps/web/src/features/beneficiaries/beneficiaries-workspace.tsx");
 const native=read("apps/android-internal/src/features/beneficiaries/native-beneficiaries-workspace.tsx");
 for(const ui of [web,native]){
  assert.match(ui,/\/submit-verification/);
  assert.match(ui,/\/verification-review/);
  assert.match(ui,/\/verification-cases\//);
  assert.match(ui,/currentPassword:reviewPassword/);
 }
});
