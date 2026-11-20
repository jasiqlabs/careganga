/**
 * CareGanga CG-15 final original QA source-wiring audit (2026-11-19).
 * Read-only, local, no CI/GitHub Actions. Not compilation, PostgreSQL,
 * screenshot/Android, legal-retention, security penetration or runtime QA.
 * Source checks are purposeful guards, NOT proof that behavior ran.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const cases=[
 {id:"US-001-QA13",checks:[
 ["apps/web/src/features/appointments/doctor-schedule-workspace.tsx",
  ["cg15-h07-kpis","cg15-h07-tabs","cg15-h07-save-bar",
   "Weekly Schedule","Availability Calendar","Leave or Block Time",
   "State","District","Block","Healthcare center","Save verified working hours",
   "BulkCopyTarget","Verified doctor"]],
 ["apps/backend/src/modules/cg-15-patients-appointments/application/doctor-schedule.service.ts",
  ["eligibleDoctorSql","COUNT(DISTINCT assoc.doctor_id)",
   "COUNT(DISTINCT assoc.center_id)","CG15_SCHEDULE_DOCTOR_CONFLICT"]],
 ["apps/web/src/app/globals.css",
  ["--cg-sidebar: #0A1F44","--cg-accent: #1E53DC",".sidebar .sidebar-link.selected"]]]},
 {id:"US-003-QA11",checks:[
 ["apps/backend/db/migrations/1444_cg15_protected_duplicate_patient_review.sql",
  ["cg15_patient_duplicate_review","cg15_patient_reviewed_alias",
   "ux_cg15_duplicate_pending_or_approved_pair",
   "cg15_reviewed_alias_approval_guard","cg15_reviewed_alias_immutable"]],
 ["apps/backend/src/modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts",
  ["duplicateReviews(","duplicateReviewEvidence(","proposeDuplicate(",
   "decideDuplicate(","requireFreshFoundationRootProof(",
   "SAME_PERSON_EVIDENCE_REVIEWED","preservedOriginalRecords:true"]],
 ["apps/web/src/features/appointments/foundation-patient-duplicate-reviews.tsx",
  ["Review original identity evidence","evidence?.reviewRef",
   "independently reviewed","current-password"]],
 ["apps/web/src/app/api/appointments/admin/patients/duplicate-reviews/[reviewRef]/evidence/route.ts",
  ['get("cg_staff_session")','"Cache-Control":"private, no-store"']]]},
 {id:"US-003-QA15",checks:[
 ["apps/android-public/src/features/patients/native-patient-date-picker.tsx",
  ["accessibilityRole","onRequestClose","Choose date of birth",
   "Date.UTC","Clear date"]],
 ["apps/android-public/src/features/patients/patient-profile-native.tsx",
  ["NativePatientDatePicker","NativeConsultationHistory",
   "NativePatientPrivateFiles","BackHandler","accept-second-account"]],
 ["apps/web/src/features/patients/patient-profile-panel.tsx",
  ["type=\"date\"","MyConsultationHistory","accept-second-account"]],
 ["apps/backend/src/modules/cg-15-patients-appointments/application/patient-profile.service.ts",
  ["cg15_patient_identity_event","async acceptSecondAccountLink",
   "async claimCenterIntake"]]]},
 {id:"US-008-QA16",checks:[
 ["apps/backend/src/modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts",
  ["async authorizePrint(","access_audit","fromDay","untilDay",
   "async bookingHistory("]],
 ["apps/web/src/features/appointments/foundation-patient-bookings.tsx",
  ["body *{visibility:hidden!important;}",
   "body.cg15-h15-report-print .cg15-print-scope",
   "print-authorization","window.print()",
   "Load the complete original selected booking history"]],
 ["apps/backend/src/modules/cg-19-documents-notifications/application/appointment-slip-document.service.ts",
  ["issueDownloadGrant(","downloadGranted(",
   "timingSafeEqual","Math.floor(Date.now()/1000)+120",
   "readVerifiedPrivateObject","health.patients.slip.download"]],
 ["apps/android-public/src/features/appointments/native-appointment-documents.tsx",
  ["verifiedSlipRead(","/restricted-file?grant=",
   "AppState.addEventListener","cached.current?.delete()"]],
 ["apps/web/src/app/api/appointments/slips/[...parts]/route.ts",
  ["Referrer-Policy","X-Content-Type-Options","private, no-store"]]]}
];
let tested=0;
for(const test of cases){
 for(const [path,needles] of test.checks){
  const text=read(path);
  for(const needle of needles){
   assert.ok(text.includes(needle),test.id+": missing "+JSON.stringify(needle)+" in "+path);
   tested++;
  }
 }
 console.log(test.id+": source files and expected guards located; runtime QA NOT_RUN");
}
console.log("CG-15 original source-gap preflight: "+tested+
 " static source assertions completed. No source PASS equals executable test PASS.");
