/** JASIQ local source QA: mandatory non-ERP real partner verification,
 * original CG09 liability/monthly bank settlement and Web/Android parity.
 * Static source assertions only: NOT PG execution, independent financial
 * audit, real scanner, Android device, or payment provider verification.
 */
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const file=p=>readFileSync(resolve(root,p),"utf8");
const s={
 intake:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/partner-service-claim.service.ts"),
 base:file("apps/backend/db/migrations/1713_cg17_erp_off_partner_service_claim_intake.sql"),
 scan:file("apps/backend/db/migrations/1713b_cg19_partner_payment_proof_classification.sql"),
 proof:file("apps/backend/db/migrations/1713c_cg17_partner_claim_patient_payment_evidence.sql"),
 audit:file("apps/backend/db/migrations/1713d_cg19_protected_partner_invoice_read_audit.sql"),
 attest:file("apps/backend/db/migrations/1714_cg17_partner_service_independent_verification.sql"),
 liability:file("apps/backend/db/migrations/1715_cg17_partner_liability_existing_finance_extension.sql"),
 verification:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/partner-invoice-verification.service.ts"),
 controller:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/partner-invoice-verification.controller.ts"),
 module:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/healthcare-assistance.module.ts"),
 monthly:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/monthly-provider-settlement.service.ts"),
 correction:file("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/foundation-liability-correction.service.ts"),
 staffBff:file("apps/web/src/app/api/healthcare-assistance/partner-verification/[...parts]/route.ts"),
 staffWeb:file("apps/web/src/features/healthcare-assistance/staff-partner-claim-verification.tsx"),
 staffNative:file("apps/android-internal/src/features/healthcare-assistance/native-staff-partner-claim-verification.tsx"),
 staffWebInbox:file("apps/web/src/features/healthcare-assistance/pending-partner-service-claims.tsx"),
 staffNativeInbox:file("apps/android-internal/src/features/healthcare-assistance/native-pending-partner-service-claims.tsx"),
 patientWeb:file("apps/web/src/features/patients/patient-partner-claims.tsx"),
 patientNative:file("apps/android-public/src/features/patients/native-patient-partner-claims.tsx"),
 privacy:file("apps/backend/src/modules/cg-19-documents-notifications/application/patient-clinical-file-sharing.service.ts"),
 safe:file("apps/backend/src/core/http/safe-error-copy.ts")
};
const count=(v,x)=>v.split(x).length-1;
const tests=[
 ["Stable human tracking code is syntactically valid and unique",
  s.base.includes("'^CG-[A-F0-9]{14}$'")&&
  s.base.includes("center_ref uuid NOT NULL")&&
  s.base.includes("UNIQUE(root_realm_id,public_code)")],
 ["Original clean patient-owned payment proof has its own classification and SQL guard",
  s.scan.includes("PATIENT_PARTNER_PAYMENT_PROOF")&&
  s.proof.includes("cg17_claim_patient_payment_scan_guard")&&
  s.proof.includes("f.patient_id=NEW.patient_ref")&&
  s.intake.includes("PATIENT_PARTNER_PAYMENT_PROOF")],
 ["CG19 audit records original protected reviewer read (not financial payment)",
  s.audit.includes("PARTNER_CLAIM_REVIEW_READ")&&
  s.verification.includes("this.files.readVerifiedPrivateObject")&&
  s.verification.includes("createHash(\"sha256\")")&&
  s.verification.includes("PARTNER_CLAIM_REVIEW_READ")],
 ["Partner attestation is original assigned center, distinct from patient and immutable",
  s.attest.includes("CREATE TABLE cg17_partner_invoice_attestation")&&
  s.attest.includes("f.status='ACTIVE'")&&
  s.attest.includes("NEW.attested_by_account=source.requested_by_account")&&
  s.verification.includes("this.centers.assertCurrent")],
 ["Protected independent review requires distinct patient/partner/reviewer",
  s.attest.includes("CREATE TABLE cg17_partner_invoice_decision")&&
  s.attest.includes("NEW.reviewed_by_account IN(attest.attested_by_account,claim.requested_by_account)")&&
  s.verification.includes('this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true)')&&
  s.verification.includes("requireFreshFoundationRootProof")],
 ["Approver must actually access original scanned invoice/completion/payment proof",
  s.attest.includes("ev.action='PARTNER_CLAIM_REVIEW_READ'")&&
  s.attest.includes("ev.created_at>=attest.attested_at")&&
  s.attest.includes("claim.completion_file_ref")&&
  s.attest.includes("claim.payment_file_ref")],
 ["Original approved amount reconciles actual partner collected amount",
  s.attest.includes("NEW.accepted_patient_paid_minor<>attest.collected_minor")&&
  s.attest.includes("NEW.approved_support_minor<>claim.estimated_support_minor")&&
  s.attest.includes("claim.estimated_support_minor=0")],
 ["Original CG15 visit source guard remains and genuine nonconsultation shape is separate",
  s.liability.includes("CREATE OR REPLACE FUNCTION cg17_liability_completion_guard")&&
  s.liability.includes("e.next_state='COMPLETED'")&&
  s.liability.includes("NEW.source_kind='CG17_PARTNER_SERVICE'")&&
  s.liability.includes("partner_decision_ref IS NOT NULL")],
 ["Independent approval writes original real Foundation liability and unposted CG09 effect",
  s.verification.includes("INSERT INTO foundation_liability(")&&
  s.verification.includes("INSERT INTO cg17_financial_effect(")&&
  s.verification.includes("LIABILITY_ACCRUAL")&&
  !s.verification.includes("INSERT INTO journal")],
 ["Existing monthly provider settlement and CG09 evidence include original partner liability",
  s.monthly.includes("CG17_PARTNER_SERVICE")&&
  s.monthly.includes("JOIN cg17_partner_invoice_decision decision")&&
  s.monthly.includes("partnerPatientCollectedAttestedMinor")&&
  s.monthly.includes("posting_state='POSTED'")],
 ["Original CG09 reversal & verified bank recovery reused for partner liability",
  s.correction.includes('"CG15_CONSULTATION","CG17_PARTNER_SERVICE"')&&
  s.correction.includes("cg09.reverseAccrual")&&
  s.correction.includes("recovery.recoveryOptions")],
 ["Protected staff routes, staff Web and Internal Android both have real actions",
  s.controller.includes('Post("partner/centers/:centerRef/claims/:claimCode/attest")')&&
  s.controller.includes('Post("foundation/centers/:centerRef/claims/:claimCode/decide")')&&
  s.staffBff.includes('cg_staff_session')&&
  s.staffBff.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.staffWeb.includes("StaffPartnerClaimVerification")===false&&
  s.staffWeb.includes('submit("APPROVE")')&&
  s.staffNative.includes('submit("APPROVE")')&&
  s.staffWebInbox.includes("StaffPartnerClaimVerification")&&
  s.staffNativeInbox.includes("NativeStaffPartnerClaimVerification")],
 ["Public patient Web and Android show actual review status and optional payment file",
  s.patientWeb.includes("APPROVED_AWAITING_FINANCE")&&
  s.patientNative.includes("APPROVED_AWAITING_FINANCE")&&
  s.patientWeb.includes("paymentFileRef")&&
  s.patientNative.includes("paymentFileRef")],
 ["Private clinical appointment sharing never opens partner money documents",
  s.privacy.includes("AND classification IN('PATIENT_PHOTO'")&&
  s.privacy.includes("AND f.classification IN('PATIENT_PHOTO'")],
 ["All new error codes have plain-language central safe copy",
  ["CG17_PARTNER_REVIEW_INVALID","CG17_PARTNER_REVIEW_UNAVAILABLE",
   "CG17_PARTNER_REVIEW_SOURCE_CHANGED","CG17_PARTNER_REVIEW_ALREADY_DECIDED",
   "CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"].every(k=>s.safe.includes(k+":"))],
 ["New CG17 migration functions/guards appear once (no accidental appended SQL)",
  count(s.attest,"CREATE FUNCTION cg17_partner_attestation_validate()")===1&&
  count(s.attest,"CREATE FUNCTION cg17_partner_decision_validate()")===1&&
  count(s.base,"CREATE FUNCTION cg17_partner_claim_original_guard()")===1&&
  count(s.liability,"CREATE OR REPLACE FUNCTION cg17_liability_completion_guard()")===1]
];
let failed=0;
for(const [label,ok] of tests){
 console.log((ok?"SOURCE_ASSERTION_OK":"SOURCE_GAP")+": "+label);
 if(!ok)failed++;
}
console.log("CG17 original mandatory verified-partner source "+(tests.length-failed)+"/"+tests.length+
 " static contracts. Local JS/TS/PG/browser/Android/provider/independent QA NOT_RUN.");
if(failed)process.exitCode=1;
