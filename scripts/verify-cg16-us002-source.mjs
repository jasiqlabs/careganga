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
 d+"application/clinical-lab-custody.service.ts",
 d+"application/clinical-lab-result-evidence.service.ts",
 d+"application/clinical-lab-generated-result.service.ts",
 "apps/backend/db/migrations/1614_cg16_released_report_correction_source.sql",
 "apps/backend/db/migrations/1615_cg19_private_lab_report_release_notice.sql",
 "apps/backend/src/modules/cg-19-documents-notifications/application/notification.service.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/delivery.service.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/infrastructure/communication-worker.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/laboratory-report-renderer.ts",
 d+"application/clinical-lab-professional-review.service.ts",
 d+"application/clinical-lab-patient-release.service.ts",
 d+"http/clinical-lab-patient-report.controller.ts",
 d+"http/clinical-lab-order.controller.ts",
 d+"diagnostics.module.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-professional-review-source.facade.ts",
 "apps/backend/src/modules/cg-01-identity-access/application/session.service.ts",
 web+"clinical-lab-order-workspace.tsx",
 web+"clinical-lab-result-upload.tsx",
 web+"clinical-lab-result-entry.tsx",
 web+"clinical-lab-professional-review-panel.tsx",
 web+"clinical-lab-release-panel.tsx",
 web+"my-lab-reports.tsx",
 "apps/web/src/app/api/lab-patient-reports/[...parts]/route.ts",
 "apps/web/src/app/patients/me/page.tsx",
 "apps/web/src/app/api/lab-clinical/[...parts]/route.ts",
 native+"native-clinical-lab-screen.tsx",
 native+"native-lab-result-upload.tsx",
 native+"native-lab-result-entry.tsx",
 native+"native-lab-professional-review.tsx",
 native+"native-lab-report-release.tsx",
 "apps/android-public/src/features/patients/native-my-lab-reports.tsx",
 "apps/android-public/src/features/patients/patient-profile-native.tsx",
 "apps/android-internal/src/features/dashboard/dashboard-modules.ts",
 "apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"
];
for(const p of files){
 const source=read(p);
 if(!p.endsWith(".sql")){
  const parsed=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,
   p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,p+": "+
  parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
 }
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
 must(sql04,new RegExp(text.replace(/[+()]/g, "\\$&")),"Original lab order/custody source must remain");
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
must(service,/report_?digest!==decision\.reportDigest/i,
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
const correctionSql=read("apps/backend/db/migrations/1614_cg16_released_report_correction_source.sql");
const notificationSql=read("apps/backend/db/migrations/1615_cg19_private_lab_report_release_notice.sql");
const notificationSource=read("apps/backend/src/modules/cg-19-documents-notifications/application/notification.service.ts");
const deliverySource=read("apps/backend/src/modules/cg-19-documents-notifications/application/delivery.service.ts");
const notificationWorker=read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/communication-worker.ts");
const releaseUiWeb=read(web+"clinical-lab-release-panel.tsx");
const releaseUiNative=read(native+"native-lab-report-release.tsx");

const patientView=read(web+"my-lab-reports.tsx");
const nativePatientReports=read("apps/android-public/src/features/patients/native-my-lab-reports.tsx");
const valuesSql=read("apps/backend/db/migrations/1613_cg16_entered_results_for_generated_report.sql");
const generated=read(d+"application/clinical-lab-generated-result.service.ts");
const storageReservation=read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/verified-private-storage.ts");
const pdf=read("apps/backend/src/modules/cg-19-documents-notifications/application/laboratory-report-renderer.ts");
const staffEntry=read(web+"clinical-lab-result-entry.tsx");
const nativeEntry=read(native+"native-lab-result-entry.tsx");
must(valuesSql,/CREATE TABLE lab_result_value \(/,
 "Staff-entered results must be immutable CG16 source values");
must(valuesSql,/FOREIGN KEY\(root_realm_id,order_ref,order_line_ref\)/,
 "No result can belong to another lab order");
must(valuesSql,/GENERATED_INTENT/,"CG19 must record actual generated report provenance");
must(valuesSql,/GENERATED_VERIFIED/,"Generated file verification is auditable");
must(generated,/this\.evidence\.requireProcessingOriginal/,
 "Reuse existing real specimen readiness and patient consent");
must(generated,/this\.objects\.writeVerifiedPrivateDocument/,
 "Automatically generated PDF goes to original CG19 private storage");
must(generated,/this\.objects\.verifyPrivateObject/,
 "Original malware/checksum verification must remain");
must(generated,/this\.lines\(c,actor\.realmId,order\)/,
 "Original ordered test lines only");
must(generated,/GENERATED_VERIFIED/,
 "Report audit must not pretend a user uploaded a PDF");
must(pdf,/renderLaboratoryReport/,"PDF renderer belongs to existing CG19");
must(pdf,/source\.results/,
 "PDF must display actual saved values, never guessed data");
assert.doesNotMatch(pdf,/line\("(?:(?:Reference|Normal) range|Diagnosis)"/i,
 "System must not invent medical ranges or interpretation");
must(controller,/results\/generate/,
 "Original CG16 lab controller must reach generated PDF");
must(bff,/parts\[5\]==="generate"/,
 "Web BFF must allow actual value-entry post");
must(source,/ClinicalLabResultEntry/,
 "Web H10 must use auto-generated report as primary");
must(mobile,/NativeLabResultEntry/,
 "Internal Android H10 must use same generated report flow");
must(staffEntry,/Generate report PDF/,
 "Web staff can request one automatic PDF");
must(nativeEntry,/Generate report PDF/,
 "Native staff can request the same automatic PDF");
must(correctionSql,/CREATE TABLE cg16_lab_result_correction\(/,
 "Original report correction is a new immutable linked result");
must(correctionSql,/JOIN cg16_lab_report_release prior/,
 "Correction cannot invent prior patient release");
must(correctionSql,/next\.corrects_revision_ref=previous\.id/,
 "Correction must name exactly previous released revision");
must(correctionSql,/next\.version_no=previous\.version_no\+1/,
 "Correction must strictly increase the real result version");
must(generated,/this\.priorReleased\(/,
 "New corrected report requires real existing released version");
must(generated,/LAB_CORRECTION_LATEST_RELEASE_REQUIRED/,
 "Stale/duplicate prior-release correction is rejected");
must(generated,/cg16_lab_result_correction/,
 "Reason and original release are persisted in source");
must(generated,/CG16_GENERATED_LAB_RESULT_V1/,
 "Original unreleased PDF retries must retain their existing V1 request digest");
must(generated,/CG16_GENERATED_LAB_CORRECTION_V1/,
 "Corrected PDF must have separate source digest and immutable request");
must(generated,/correctionDraft/,
 "Corrected report reuses original recorded values rather than inventing results");
must(pdf,/if\(source\.corrected\)\{/,
 "Only an actually corrected PDF gets a new version label; V1 bytes unchanged");
must(staffEntry,/correctionDraft/,
 "Web correction form uses original recorded values");
must(nativeEntry,/correctionDraft/,
 "Internal Android correction form uses original recorded values");
must(generated,/if\(!original\.correction\)\{/,
 "Correction cannot overwrite old lab-order status or event");
must(pdf,/source\.corrected/,
 "Corrected PDF must clearly label itself as a newer version");
must(staffEntry,/Generate corrected PDF/,
 "Web staff can correct earlier published value with a reason");
must(nativeEntry,/Generate corrected PDF/,
 "Internal Android can enter same correction");
must(patientView,/superseded/,
 "Patients see earlier released PDF as historical only after next release");
must(nativePatientReports,/superseded/,
 "Public Android identifies previously released historical version");
must(release,/result\.version_no=\(SELECT max\(latest\.version_no\)/,
 "Only latest independently reviewed result can be released");
must(notificationSql,/CREATE TABLE cg19_lab_release_outbox\(/,
 "CG19 source capture begins only on real immutable clinician release");
must(notificationSql,/AFTER INSERT ON cg16_lab_report_release/,
 "Only truly released report creates the notification source event");
must(notificationSql,/cg16_lab_report_release_id=source_key/,
 "CG19 notification source and original release identity identical");
must(notificationSource,/captureCommittedLabReleases/,
 "Reuse actual CG19 source capture, not a separate email sender");
must(notificationSource,/link\.revoked_at IS NULL/,
 "Report notices require live CG15 patient owner");
must(notificationSource,/consent\.purpose='PATIENT_CARE'/,
 "Report notification checks latest actual patient consent");
must(notificationSource,/CG16_LAB_RELEASE/,
 "Neutral report templates do not include medical values or links");
must(notificationWorker,/reconcilePendingLabReleases/,
 "Same bounded CG19 worker must recover source events after outage");
must(notificationWorker,/cg19_lab_release_committed/,
 "Original source wake-up must be connected");
must(deliverySource,/row\.source_kind==="CG16_LAB_RELEASE"/,
 "Current CG15 patient/revoked CG19 file checks before external provider send");
must(deliverySource,/file\.revoked_at IS NULL/,
 "Stopped private report may not trigger external notice");
must(notificationSource,/n\.source_kind<>'CG16_LAB_RELEASE'/,
 "Patient inbox/read also require current owner/consent/file authorization");
must(release,/notificationStates/,
 "Released PDF state is separate from a delivery provider callback");
must(release,/n\.channel!=="IN_APP"&&n\.state==="DELIVERED"/,
 "Internal notice is not mislabelled externally delivered");
must(releaseUiWeb,/notificationStates/,
 "Web clinician can see actual queued or delivered source");
must(releaseUiNative,/notificationStates/,
 "Native clinician can see same actual delivery state");
must(generated,/\/lab-generated\//,
 "Generated lab PDF must use the original server-only private object key namespace");
must(storageReservation,/invoices\|receipts\|lab-generated/,
 "Client upload reservation must deny server-generated lab PDFs");
must(report,/reservePrivateUpload/,
 "Existing staff upload route continues to use original CG19 private reservations");
must(generated,/this\.evidence\.status\(token,center,order,original\.intent\.id\)/,
 "Generated report retry must reuse the original CG16 verified file/consent status");
must(generated,/proof\.status!=="VALIDATED"\|\|!proof\.cleanVerified/,
 "Saved upload intent alone cannot claim clean ready PDF on replay");
must(generated,/proof\.resultRef!==original\.result\.id\|\|!proof\.originalFileRef/,
 "Generated retry must retain the exact same verified original result/file");
must(generated,/verified\.mime!=="application\/pdf"/,
 "Generated CG19 report uses the same PDF MIME proof as staff uploads");
must(generated,/typeof verified\.scanProofRef!=="string"/,
 "CG19 generated report must retain a valid original scanner proof");
must(generated,/Date\.now\(\)-scanTime>=900000/,
 "Generated CG19 scan verification freshness matches original upload checks");
must(generated,/WHERE root_realm_id=\$1 AND id=\$2 AND order_ref=\$3 AND center_ref=\$4/,
 "Generated PDF uncertain-state recovery must be scoped to original Foundation realm/order");
must(generated,/AND result_revision_ref=\$5 AND status=\x27INITIATED\x27/,
 "Unknown generated PDF recovery updates only its exact original result");
// H10: current assigned-center care scope and actual server-backed order lookup.
const h10Order=read(d+"application/clinical-lab-order.service.ts");
const h10Admission=read(d+"application/clinical-lab-admission.service.ts");
const h10Custody=read(d+"application/clinical-lab-custody.service.ts");
assert.ok(h10Admission.includes("consent.revision_no=(SELECT MAX(latest.revision_no)"));
assert.ok(h10Admission.includes("i.id=o.center_intake_ref"));
assert.ok(h10Admission.includes("a.id=o.consultation_ref"));
assert.equal(h10Order.split("CURRENT_LAB_ORDER_CARE_PREDICATE").length-1,3);
assert.ok(h10Custody.includes('"+CURRENT_LAB_ORDER_CARE_PREDICATE+"FOR UPDATE OF s,o"'));
assert.ok(h10Order.includes("LIMIT 31 OFFSET $4"));
assert.ok(h10Order.includes("Number(offsetRaw)%30!==0"));
assert.ok(read(d+"http/clinical-lab-order.controller.ts").includes("centerOrders(token,center,q,offset)"));
assert.ok(read("apps/web/src/app/api/lab-clinical/[...parts]/route.ts").includes("target.searchParams.set(key,values[0])"));
for(const path of [web+"clinical-lab-order-workspace.tsx",native+"native-clinical-lab-screen.tsx"]){
 const surface=read(path);
 assert.ok(surface.includes("q:orderFilter.current.q"),path+" actual server search");
 assert.ok(surface.includes("nextOrderOffset"),path+" page navigation");
}
console.log("CG16 US002 source/parse preflight authored for clinical review and simple release. "+
 "PostgreSQL, browser, Android, independent clinical and security QA NOT_RUN.");
