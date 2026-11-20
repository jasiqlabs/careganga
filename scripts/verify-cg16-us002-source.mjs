/** Original CG16 US002 SOURCE/PARSE preflight, NOT a runtime medical release QA.
 * Run with npm run verify:cg16-us002-source before SQL+browser+Android QA.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const d="apps/backend/src/modules/cg-16-healthcare-diagnostics/";
const web="apps/web/src/features/diagnostics/";
const native="apps/android-internal/src/features/diagnostics/";
const files=[
 d+"application/clinical-lab-admission.service.ts",
 d+"application/clinical-lab-order.service.ts",
 d+"application/clinical-lab-result-evidence.service.ts",
 d+"application/clinical-lab-professional-review.service.ts",
 d+"application/clinical-lab-patient-release.service.ts",
 d+"http/clinical-lab-patient-report.controller.ts",
 d+"http/clinical-lab-order.controller.ts",
 d+"diagnostics.module.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-professional-review-source.facade.ts",
 "apps/backend/src/modules/cg-01-identity-access/application/session.service.ts",
 web+"clinical-lab-order-workspace.tsx",
 web+"clinical-lab-result-upload.tsx",
 web+"clinical-lab-professional-review-panel.tsx",
 web+"clinical-lab-release-panel.tsx",
 web+"my-lab-reports.tsx",
 "apps/web/src/app/api/lab-patient-reports/[...parts]/route.ts",
 "apps/web/src/app/patients/me/page.tsx",
 "apps/web/src/app/api/lab-clinical/[...parts]/route.ts",
 native+"native-clinical-lab-screen.tsx",
 native+"native-lab-result-upload.tsx",
 native+"native-lab-professional-review.tsx",
 native+"native-lab-report-release.tsx",
 "apps/android-public/src/features/patients/native-my-lab-reports.tsx",
 "apps/android-public/src/features/patients/patient-profile-native.tsx",
 "apps/android-internal/src/features/dashboard/dashboard-modules.ts",
 "apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"
];
for(const p of files){
 const source=read(p);
 const parsed=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,
  p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,p+": "+
  parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
 assert.doesNotMatch(source,/^(<{7}|={7}|>{7})/m,p+": merge conflict");
}
const sql04=read("apps/backend/db/migrations/1604_cg16_clinical_order_and_custody_sources.sql");
const sql07=read("apps/backend/db/migrations/1607_cg19_original_lab_result_private_evidence.sql");
const sql08=read("apps/backend/db/migrations/1608_cg16_original_professional_report_review.sql");
const sql09=read("apps/backend/db/migrations/1609_cg16_verified_result_order_event_gate.sql");
const report=read(d+"application/clinical-lab-result-evidence.service.ts");
const service=read(d+"application/clinical-lab-professional-review.service.ts");
const controller=read(d+"http/clinical-lab-order.controller.ts");
const bff=read("apps/web/src/app/api/lab-clinical/[...parts]/route.ts");
const admission=read(d+"application/clinical-lab-admission.service.ts");
const author=read("apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-professional-review-source.facade.ts");
const sessions=read("apps/backend/src/modules/cg-01-identity-access/application/session.service.ts");
const source=read(web+"clinical-lab-order-workspace.tsx");
const mobile=read(native+"native-clinical-lab-screen.tsx");
const mobileReviewer=read(native+"native-lab-professional-review.tsx");
const webReviewer=read(web+"clinical-lab-professional-review-panel.tsx");
const must=(s,pattern,why)=>assert.match(s,pattern,why);
for(const text of ["lab_order_line","lab_sample_custody_event","lab_result_revision",
 "CHECK(new_revision=prior_revision+1)"])
 must(sql04,new RegExp(text),"Original lab order/custody source must remain");
must(sql07,/fk_cg16_original_cg19_result/,"Only exact CG19 scanned file can change result state");
must(sql07,/original_cg19_file_ref/,"Private report must carry original file ref");
must(sql07,/scan_status='CLEAN_VERIFIED'/,"Verified file required");
must(sql09,/CREATE OR REPLACE FUNCTION cg16_order_requires_real_custody/,
 "Result stage must extend original custody guard, not disable it");
must(sql09,/OLD.status<>'PROCESSING'/,"Only processing order can advance to result ready");
must(sql09,/event_type='RESULT_FILE_READY'/,"Real immutable lab order result event required");
must(sql09,/file.scan_status='CLEAN_VERIFIED'/,"Scanner proof required at database commit");
must(report,/status='RESULT_READY',revision=revision\+1/,
 "Report-confirm transaction must update order status and revision");
must(report,/RESULT_FILE_READY/,"Report must append original result-ready order event");
must(report,/\["PROCESSING","RESULT_READY"\]/,
 "Recovery must support both in-progress upload and verified ready order");
must(report,/if\(current\.status==="PROCESSING"\)\{/,
 "Only processing order may use specimen upload readiness check");
must(report,/intent\.status='VALIDATED'/,
 "Ready-state recovery must require original validated CG19 intent");
must(report,/file\.scan_status='CLEAN_VERIFIED'/,
 "Ready-state recovery must reject unverified or revoked report");
must(report,/consent\.revision_no=\(SELECT max\(last\.revision_no\)/,
 "Ready-state recovery must check current CG15 patient-care consent");
must(report,/LAB_RESULT_REPORT_NOT_VERIFIED/,
 "Ready-state recovery must fail closed without original clean source");

must(report,/async status\(token:string,centerRaw:string,orderRaw:string,uploadRaw:string\)/,
 "Original uploader must have an authorized recovery status route");
must(report,/o\.status IN\('PROCESSING','RESULT_READY'\)/,
 "Status must be restricted to the two existing clinical stages");
must(report,/intent\.status='VALIDATED'/,
 "Status must only accept an original verified CG19 scan intent");
must(report,/result\.report_digest=file\.sha256/,
 "Status must bind the exact verified result checksum");
must(report,/row\.status==="VALIDATED"&&!verified/,
 "Claimed validated report must fail closed when original source cannot be verified");
must(report,/requested_by=\$5/,
 "Original report status must remain scoped to its uploading operator");


must(report,/this\.objects\.verifyPrivateObject/,"Actual private malware scan required");
must(sql08,/reviewer_account_ref<>operator_account_ref/,
 "Reviewer cannot be processing operator");
must(sql08,/UNIQUE\(root_realm_id,result_revision_ref\)/,
 "Competing reviewers must not commit multiple final decisions");
must(sql08,/doctor_review.status='OWNER_COMPLETED'/,
 "Clinician credentials require original CG03 completion");
must(sql08,/original_proof.scan_status='CLEAN_VERIFIED'/,
 "Reviewer credential document must be CG19 scan verified");
must(sql08,/clinician.status='ACTIVE'/,"Clinician account must link actual original CG14 doctor");
must(sql08,/cg16_lab_review_file_access/,"Review requires original file-read audit");
must(service,/this\.admission\.requireCurrent\(c,token,center,"lab.report.review"\)/,
 "Role+center/ERP readiness must be live");
must(service,/this\.professionals\.assertCurrent/,"Current verified CG14 clinician required");
must(service,/this\.sessions\.requireClinicalProfessionalProof/,
 "Fresh password confirmation required");
must(service,/source.operator_account_ref===actor.accountId/,
 "Self-approval must be rejected");
must(service,/this\.objects\.readVerifiedPrivateObject/,"Reviewer must see true private CG19 bytes");
must(service,/reportDigest!==decision.reportDigest/,
 "Stale digest must fail");
must(service,/reviewed:true|professionallyReviewed:true/,
 "Only professional review status may be emitted");
assert.doesNotMatch(service,/patientReleased:true|notificationDelivery:"SENT"/,
 "Review must not claim patient release or delivery");
must(author,/HEALTH_DOCTOR_VERIFICATION/,"Original CG14 professional independent review");
must(author,/professional_license_valid_through/,"Clinician expiry must be current");
must(admission,/CAREGANGA_ERP_LAB_ENABLED/,"Clinical ERP feature gate must fail closed");
must(sessions,/limitClinicalProfessionalProof/,"Fresh password rate limiting");
must(controller,/@Get\("centers\/:centerRef\/orders\/:orderRef\/reports\/reviewer-file"\)/,
 "Protected PDF route missing");
must(bff,/isReviewerFile/,"Web private PDF must be explicitly allowlisted");
must(webReviewer,/attested/,"Clinician must attest actual PDF inspection");
must(mobileReviewer,/File\.preview/,"Android must use existing native protected PDF viewer");
must(mobileReviewer,/attested/,"Native clinical document inspection attestation");
must(source,/ClinicalLabProfessionalReviewPanel/,"Web H10 review route missing");
must(mobile,/NativeLabProfessionalReview/,"Native H10 review route missing");
const releaseSql=read("apps/backend/db/migrations/1612_cg16_professional_report_release.sql");
const release=read(d+"application/clinical-lab-patient-release.service.ts");
const patientApi=read("apps/web/src/app/api/lab-patient-reports/[...parts]/route.ts");
const nativePatient=read("apps/android-public/src/features/patients/native-my-lab-reports.tsx");
must(releaseSql,/CREATE TABLE cg16_lab_report_release\(/,
 "One simple clinician-approved report release record");
must(releaseSql,/review\.decision='APPROVE'/,
 "Database release must require exact existing independent approval");
must(releaseSql,/file\.scan_status='CLEAN_VERIFIED'/,
 "Only existing CG19 clean private PDF can be released");
must(releaseSql,/UNIQUE\(root_realm_id,result_revision_ref\)/,
 "Duplicate releases per report are forbidden");
must(releaseSql,/CREATE TABLE cg16_lab_patient_report_access\(/,
 "Patient private PDF access must be auditable");
assert.doesNotMatch(releaseSql,/CREATE TABLE.*digital_signature|signature_provider|signing_key/,
 "No digital signing system added");
must(release,/this\.professionals\.assertCurrent/,
 "Existing CG14 credential and clinical role reused");
must(release,/source\.reviewer_account_ref!==actor\.accountId/,
 "No one except original approving reviewer may release");
must(release,/this\.storage\.readVerifiedPrivateObject/,
 "Patient download must read original protected CG19 bytes");
must(release,/this\.mine\(c,actor\)/,
 "Existing CG15 verified patient and consent required on every read");
must(release,/digestBytes\(bytes\)!==original\.report_digest/,
 "Patient PDF checksum validated before delivery");
must(controller,/orders\/:orderRef\/release/,
 "Existing lab controller must route release");
must(patientApi,/cg_patient_session/,
 "Public Web patient session is not staff session");
must(patientApi,/application\/pdf/,
 "Web report download must return protected PDF only");
must(nativePatient,/File\.preview/,
 "Public Android must use existing PDF preview");
must(source,/ClinicalLabReleasePanel/,
 "Clinician Web release must be reachable in original lab orders");
must(mobile,/NativeLabReportRelease/,
 "Internal Android release must be reachable on original lab screen");
console.log("CG16 US002 source/parse preflight authored for clinical review and simple release. "+
 "PostgreSQL, browser, Android, independent clinical and security QA NOT_RUN.");
