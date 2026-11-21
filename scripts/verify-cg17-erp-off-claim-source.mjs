/** Original CG17 US002/004 ERP-OFF patient partner claim and CG19 evidence.
 * Local-only STATIC source gate. Not runtime/PG/device/financial QA.
 * Actual clinical/fiscal claim approval and CG09 posting remain separate.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const s={
 cg19Migration:read("apps/backend/db/migrations/1712_cg19_patient_partner_invoice_proof.sql"),
 claimMigration:read("apps/backend/db/migrations/1713_cg17_erp_off_partner_service_claim_intake.sql"),
 cg19:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-private-files.service.ts"),
 cg19Clinical:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-clinical-file-sharing.service.ts"),
 claim:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/partner-service-claim.service.ts"),
 controller:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/partner-service-claim.controller.ts"),
 mod:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/healthcare-assistance.module.ts"),
 publicBff:read("apps/web/src/app/api/partner-claims/[action]/route.ts"),
 staffBff:read("apps/web/src/app/api/healthcare-assistance/partner-claims/[...parts]/route.ts"),
 web:read("apps/web/src/features/patients/patient-partner-claims.tsx"),
 webProfile:read("apps/web/src/features/patients/patient-profile-panel.tsx"),
 webUpload:read("apps/web/src/features/patients/patient-private-files-panel.tsx"),
 native:read("apps/android-public/src/features/patients/native-patient-partner-claims.tsx"),
 nativeProfile:read("apps/android-public/src/features/patients/patient-profile-native.tsx"),
 nativeUpload:read("apps/android-public/src/features/patients/native-patient-private-files.tsx"),
 staffWeb:read("apps/web/src/features/healthcare-assistance/pending-partner-service-claims.tsx"),
 staffWebLiability:read("apps/web/src/features/healthcare-assistance/completed-consultation-liability-workspace.tsx"),
 staffWebPartner:read("apps/web/src/features/healthcare-assistance/center-monthly-settlement-summary.tsx"),
 staffNative:read("apps/android-internal/src/features/healthcare-assistance/native-pending-partner-service-claims.tsx"),
 staffNativeLiability:read("apps/android-internal/src/features/healthcare-assistance/native-completed-consultation-liabilities.tsx"),
 staffNativePartner:read("apps/android-internal/src/features/healthcare-assistance/native-partner-settlement-summary.tsx"),
 safe:read("apps/backend/src/core/http/safe-error-copy.ts"),
};
const checks=[
 ["Forward-only CG19 scanned proof classification is original owner-only",
  s.cg19Migration.includes("PATIENT_PARTNER_INVOICE")&&
  s.cg19Migration.includes("PATIENT_PARTNER_SERVICE_PROOF")&&
  s.cg19.includes('type Class="PATIENT_PHOTO"')&&
  s.cg19.includes("PATIENT_PARTNER_SERVICE_PROOF")],
 ["Manual claim uses separate immutable intake, not a fabricated consultation",
  s.claimMigration.includes("CREATE TABLE cg17_partner_service_claim(")&&
  s.claimMigration.includes("state='PENDING_VERIFICATION'")&&
  s.claimMigration.includes("cg17_partner_service_claim_guard")&&
  !s.claimMigration.includes("INSERT INTO foundation_liability")&&
  !s.claim.includes("INSERT INTO patient_charge")&&
  !s.claim.includes("INSERT INTO foundation_liability")],
 ["Database enforces verified patient and latest original care consent",
  s.claimMigration.includes("cg15_patient_account_link")&&
  s.claimMigration.includes("patient.profile_status='VERIFIED'")&&
  s.claimMigration.includes("consent.revision_no DESC")&&
  s.claim.includes("private async owned(")],
 ["SQL enforces clean verified original invoice and performed-service evidence",
  s.claimMigration.includes("PATIENT_PARTNER_INVOICE")&&
  s.claimMigration.includes("PATIENT_PARTNER_SERVICE_PROOF")&&
  s.claimMigration.includes("f.scan_status='CLEAN_VERIFIED'")&&
  s.claimMigration.includes("f.revoked_at IS NULL")&&
  s.claim.includes("intent.status='VALIDATED'")],
 ["Only real active approved center service and source policy can estimate",
  s.claim.includes("this.verified.eligibleService")&&
  s.claim.includes("policy.approval_state='ACTIVE'")&&
  s.claimMigration.includes("policy.activated_at IS NOT NULL")&&
  s.claimMigration.includes("NEW.estimated_support_minor<>v_support")],
 ["Exact paise, replayed request, same-center invoice uniqueness guarded",
  s.claim.includes("BigInt(p.percent_basis_points)+5000n")&&
  s.claim.includes("pg_advisory_xact_lock")&&
  s.claimMigration.includes("UNIQUE(root_realm_id,center_ref,invoice_normalized)")&&
  s.claimMigration.includes("UNIQUE(root_realm_id,requested_by_account,request_key)")],
 ["API hides technical claim IDs behind private business tracking code",
  s.claimMigration.includes("public_code text NOT NULL")&&
  s.claim.includes("claimCode:row.public_code")&&
  s.controller.includes('@Get("mine")')&&
  s.controller.includes('@Post("mine")')&&
  s.mod.includes("PartnerServiceClaimController")],
 ["Web patient cookie and same-origin POST use bounded original endpoint",
  s.publicBff.includes('cg_patient_session')&&
  s.publicBff.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.publicBff.includes("partner-claims/")],
 ["Public Web and Android both submit original private scanned proof and show pending status",
  s.web.includes("PATIENT_PARTNER_INVOICE")&&
  s.native.includes("PATIENT_PARTNER_INVOICE")&&
  s.web.includes("PENDING_VERIFICATION")&&
  s.native.includes("PENDING_VERIFICATION")&&
  s.webProfile.includes("PatientPartnerClaims")&&
  s.nativeProfile.includes("NativePatientPartnerClaims")],
 ["Original clinician sharing backend cannot expose partner invoice/service evidence",
  s.cg19Clinical.includes("AND classification IN('PATIENT_PHOTO'")&&
  !s.cg19Clinical.includes("AND classification IN('PATIENT_PARTNER_INVOICE'")],
 ["Original CG19 upload selections exist in Web and Public Android without clinical file-share shortcut",
  s.webUpload.includes('value="PATIENT_PARTNER_INVOICE"')&&
  s.nativeUpload.includes('"PATIENT_PARTNER_INVOICE"')&&
  s.webUpload.includes('row.classification!=="PATIENT_PARTNER_INVOICE"')&&
  s.nativeUpload.includes('row.classification!=="PATIENT_PARTNER_INVOICE"')],
 ["Foundation/assigned-center pending lists have distinct original permissions",
  s.claim.includes('"healthcare.assistance.liabilities.view"')&&
  s.claim.includes('"healthcare.assistance.settlements.view"')&&
  s.claim.includes("this.centers.assertCurrent")&&
  s.staffBff.includes("cg_staff_session")&&
  s.staffWebLiability.includes("PendingPartnerServiceClaims")&&
  s.staffWebPartner.includes("PendingPartnerServiceClaims")&&
  s.staffNativeLiability.includes("NativePendingPartnerServiceClaims")&&
  s.staffNativePartner.includes("NativePendingPartnerServiceClaims")],
 ["Pending Web/Android projections never claim approved Foundation paid money",
  s.claim.includes('approvedFoundationMinor:"0"')&&
  s.claim.includes("foundationPaymentVerified:false")&&
  s.staffWeb.includes("Awaiting independent verification")&&
  s.staffNative.includes("Pending independent review")&&
  !s.staffWeb.includes("Mark claim PAID")],
 ["All authored partner-claim exceptions have central reviewed text",
  ["CG17_PARTNER_CLAIM_INVALID","CG17_PARTNER_CLAIM_PROOF_REQUIRED",
   "CG17_PARTNER_CLAIM_PATIENT_UNAVAILABLE","CG17_PARTNER_CLAIM_DUPLICATE_INVOICE",
   "CG17_PARTNER_CLAIM_REQUEST_CONFLICT","CG17_PARTNER_CLAIM_POLICY_UNAVAILABLE",
   "CG17_PARTNER_CLAIM_CENTER_UNAVAILABLE","CG17_PARTNER_CLAIM_LIST_LIMIT",
   "CG17_PARTNER_CLAIM_SOURCE_FROZEN"].every(code=>s.safe.includes(code+":"))]
];
let failed=0;
for(const [label,pass] of checks){
 console.log((pass?"SOURCE_ASSERTION_OK":"SOURCE_GAP")+": "+label);
 if(!pass)failed++;
}
console.log("CG17 ERP-OFF intake static source "+(checks.length-failed)+"/"+
 checks.length+". Original clinical/finance approval, CG09 monthly settlement, "+
 "local npm/TS/PG migration, Web, Android and independent QA NOT_RUN.");
if(failed)process.exitCode=1;
