/**
 * CG14 source-presence preflight only. Not runtime, PG migration/restore,
 * browser, Android, scanner, pixel QA, or independent human approval.
 * No CI or GitHub Actions. Run: npm run verify:cg14-source
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const s={
  schema:read("apps/backend/db/migrations/1401_cg14_pending_provider_centers.sql"),
  evidenceSql:read("apps/backend/db/migrations/1402_cg19_health_draft_evidence.sql"),
  reviewSql:read("apps/backend/db/migrations/1403_cg14_original_provider_center_review.sql"),
  doctorSql:read("apps/backend/db/migrations/1404_cg14_doctor_identity_and_center_affiliation.sql"),
  feeSql:read("apps/backend/db/migrations/1405_cg14_doctor_center_immutable_fee_history.sql"),
  doctorEventsSql:read("apps/backend/db/migrations/1406_cg14_doctor_source_event.sql"),
  doctorEvidenceSql:read("apps/backend/db/migrations/1407_cg19_doctor_original_private_license.sql"),
  doctorCaseSql:read("apps/backend/db/migrations/1408_cg03_original_doctor_verification_case.sql"),
  doctorAuditSql:read("apps/backend/db/migrations/1409_cg14_doctor_center_review_audit.sql"),
  activeStaffSql:read("apps/backend/db/migrations/1410_cg14_active_center_representative_scope.sql"),
  doctorPortraitSql:read("apps/backend/db/migrations/1411_cg19_doctor_private_portrait_source.sql"),
  doctorDraft:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-draft.service.ts"),
  doctorReview:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-review-workflow.service.ts"),
  doctorFees:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-fees.service.ts"),
  doctorPrivate:read("apps/backend/src/modules/cg-19-documents-notifications/application/health-doctor-private-evidence.service.ts"),
  doctorReviewSource:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-review-source.facade.ts"),
  doctorHttp:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-doctor-draft.controller.ts"),
  doctorWeb:read("apps/web/src/features/health-network/doctor-onboarding.tsx"),
  doctorCenterWeb:read("apps/web/src/features/health-network/doctor-center-management.tsx"),
  centerDoctorWeb:read("apps/web/src/features/health-network/center-doctor-fees.tsx"),
  nativeReview:read("apps/android-internal/src/features/registration-approvals/healthcare-native-review.tsx"),
  nativeAuth:read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"),
  network:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-network.service.ts"),
  workflow:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-review-workflow.service.ts"),
  public:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-public-center.service.ts"),
  cg03:read("apps/backend/src/modules/cg-03-registration-approvals/application/health-verification-approval.service.ts"),
  source:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-review-source.facade.ts"),
  cg19:read("apps/backend/src/modules/cg-19-documents-notifications/application/health-draft-evidence.service.ts"),
  identity:read("apps/backend/src/modules/cg-01-identity-access/application/health-network-identity.facade.ts"),
  errors:read("apps/backend/src/core/http/safe-error-copy.ts"),
  bff:read("apps/web/src/app/api/health-network/[...parts]/route.ts"),
  docBff:read("apps/web/src/app/api/documents/[...parts]/route.ts"),
  admin:read("apps/web/src/features/health-network/provider-onboarding.tsx"),
  portal:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
  upload:read("apps/web/src/features/health-network/health-evidence-uploader.tsx"),
  reviewer:read("apps/web/src/features/health-network/health-review-inbox.tsx"),
  publicWeb:read("apps/web/src/app/healthcare/centers/[slug]/page.tsx"),
  tasks:read("specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/tasks.md")
};
const checks=[
 ["Root-scoped provider and centers",s.schema.includes("CREATE TABLE health_provider (")&&s.schema.includes("CREATE TABLE health_center (")],
 ["Original CG19 owner evidence",s.evidenceSql.includes("CG14_DRAFT")&&s.cg19.includes("verifyPrivateObject(")&&s.cg19.includes("CLEAN_VERIFIED")],
 ["Same-root proof before review",s.source.includes("cg19_stored_file")&&s.source.includes("revoked_at IS NULL")],
 ["No second file store",s.cg19.includes("PrivateObjectStorage")&&s.cg19.includes("readVerifiedPrivateObject")],
 ["Only masked bank label in CG14",s.schema.includes("masked_label")&&!s.schema.includes("bank_account_number")],
 ["CG01 affiliated representative",s.identity.includes("health.centers.draft.edit")&&s.network.includes("health_center_account_affiliation")],
 ["Admin-editable safe healthcare copy",s.errors.includes("HEALTH_FIELD_INVALID")&&s.errors.includes("HEALTH_REVIEW_CONFLICT")],
 ["Command digest, CAS and audit",s.network.includes("health_network_command")&&s.workflow.includes("request_digest")&&s.workflow.includes("health_network_event")],
 ["Provider original CG03 case",s.workflow.includes("async submitProvider(")&&s.cg03.includes("async createCase(")&&s.reviewSql.includes("HEALTH_PROVIDER_VERIFICATION")],
 ["Center original CG03 case",s.workflow.includes("async submitCenter(")&&s.reviewSql.includes("HEALTH_CENTER_VERIFICATION")],
 ["Distinct current reviewer and fresh proof",s.cg03.includes("c.proposer_id===actor.accountId")&&s.cg03.includes("requireFreshFoundationRootProof")],
 ["Only original approved decision applies",s.workflow.includes("this.review.approved(")&&s.workflow.includes("this.review.finish(")],
 ["Verified, access and publish separate",s.reviewSql.includes("publication_state")&&s.reviewSql.includes("access_state")&&s.workflow.includes("async publish(")],
 ["Provider and center suspension",s.workflow.includes("async suspendProvider(")&&s.workflow.includes("async suspendCenter(")],
 ["Provider suspension also invalidates child verification",s.workflow.includes("UPDATE health_center SET status='SUSPENDED',access_state='DISABLED'")],
 ["Provider and center suspension revoke scoped representatives",s.workflow.includes("UPDATE health_center_account_affiliation f")&&
   s.workflow.includes("UPDATE health_center_account_affiliation SET status='REVOKED'")],
 ["Concurrent finalizers exclusively lock original CG03 case",s.workflow.includes("case_kind=$3 FOR UPDATE")],
 ["Protected review digest includes public center hours and services",s.workflow.includes("operatingHours:hours.rows.map(")&&
   s.workflow.includes("declaredServices:capabilities.rows.map(")],
 ["Anonymous center read protected by row lock",s.public.includes("LIMIT 1 FOR SHARE OF c")&&
   s.public.includes('await tx.query("COMMIT")')],
 ["US003 doctor is one root-scoped identity and current center association",s.doctorSql.includes("registration_number_normalized")&&
   s.doctorSql.includes("UNIQUE(root_realm_id,registration_jurisdiction,registration_number_normalized)")&&
   s.doctorSql.includes("UNIQUE(root_realm_id,doctor_id,center_id)")],
 ["US003 approved fees cannot overlap and accepted history is guarded",s.feeSql.includes("CREATE EXTENSION IF NOT EXISTS btree_gist")&&
   s.feeSql.includes("EXCLUDE USING gist")&&s.feeSql.includes("cg14_approved_fee_source_guard()")],

 [ "Doctor original event actions support actual review and suspension",
    s.doctorEventsSql.includes("health_doctor_event")&&
    s.doctorAuditSql.includes("'DOCTOR_SUBMIT'")&&
    s.doctorAuditSql.includes("'DOCTOR_VERIFY'")&&
    s.doctorAuditSql.includes("'DOCTOR_SUSPEND'")],
 [ "Real CG03 doctor source and protected CG19 license",
    s.doctorCaseSql.includes("HEALTH_DOCTOR_VERIFICATION")&&
    s.doctorReview.includes("createDoctorCase(")&&
    s.doctorReview.includes("this.evidence.prove(")&&
    s.doctorReviewSource.includes("CLEAN_VERIFIED")&&
    s.doctorPrivate.includes("HEALTH_DOCTOR_LICENSE")],
 [ "Optional doctor portrait stays private and does not verify consent",
    s.doctorPortraitSql.includes("HEALTH_DOCTOR_PORTRAIT")&&
    s.doctorPrivate.includes("CONSENT_PENDING")&&
    s.doctorWeb.includes('classification="HEALTH_DOCTOR_PORTRAIT"')],
 [ "Both foundation and current ACTIVE center staff have real doctor/fee APIs",
    s.doctorDraft.includes("async proposeOwnCenter(")&&
    s.doctorDraft.includes("async approveCenter(")&&
    s.doctorFees.includes("async proposeForOwnCenter(")&&
    s.doctorFees.includes("async ownFees(")&&
    s.doctorHttp.includes(":associationRef/fees/:feeRef/approve")],
 [ "Fee source guards immutable approved rates, future start and no fake slots",
    s.doctorFees.includes("async approve(")&&
    s.doctorFees.includes("effective_from.getTime()<=Date.now()+60000")&&
    s.feeSql.includes("cg14_approved_fee_source_guard")],
 [ "Center staff must be currently ACTIVE; disabled centers revoke representatives",
    s.activeStaffSql.includes("status IN ('PENDING_EDIT','ACTIVE','REVOKED')")&&
    s.doctorFees.includes("f.status='ACTIVE'")&&
    s.workflow.includes("UPDATE health_center_account_affiliation SET status='REVOKED'")],
 [ "Foundation fee history locks eligibility and amount snapshot atomically",
    s.doctorFees.includes('async list(bearer:string,doctorRef:string,associationRef:string)')&&
    s.doctorFees.includes('await this.identity.assertCurrent(tx,actor,"health.doctors.view")')&&
    s.doctorFees.includes("const eligible=provider.rows[0].status")&&
    s.doctorFees.includes("AND id=$4 FOR SHARE")],
 [ "Suspended doctor-center keeps historic fees but never allows new proposals",
    s.doctorCenterWeb.includes('row.status==="SUSPENDED"?"View past fee history"')&&
    s.doctorFees.includes('current:eligible&&f.status==="APPROVED"')],
 [ "Async fee responses never cross assigned doctor or center selection",
    s.doctorCenterWeb.includes("feeReadEpoch.current")&&
    s.centerDoctorWeb.includes("feeReadEpoch.current")],
 [ "Readable named doctor center and fee Web controls",
    s.doctorWeb.includes("DoctorCenterManagement")&&
    s.doctorCenterWeb.includes("Approve association")&&
    s.centerDoctorWeb.includes("Request center association")&&
    s.centerDoctorWeb.includes("Submit fee proposal")],
 [ "Original Internal Android reviewer uses same CG03 and CG19 sources",
    s.nativeAuth.includes("HealthcareNativeReview")&&
    s.nativeReview.includes("/api/health/reviews")&&
    s.nativeReview.includes("doctor-evidence")&&
    s.nativeReview.includes("currentPassword")],
 ["Suspension withdraws current exposure",s.workflow.includes("publication_generation=publication_generation+1")],
 ["Suspended sources reopen PENDING for fresh review",s.workflow.includes("async reopenProvider(")&&
    s.workflow.includes("async reopenCenter(")&&
    s.workflow.includes("HEALTH_PROVIDER_REOPEN")&&s.workflow.includes("HEALTH_CENTER_REOPEN")],
 ["Returned and rejected original review can enter corrected new draft",s.workflow.includes('["RETURNED","REJECTED"].includes(c.state)')&&
    s.cg03.includes("'REJECTED','PENDING_OWNER'")],

 ["Public checks real approval and evidence",s.public.includes("health_center_publication")&&s.public.includes("cg03_case_decision")&&s.public.includes("CLEAN_VERIFIED")],
 ["Public eligibility recheck after fields",s.public.includes("const fresh=await tx.query(")&&s.public.includes("c.publication_generation=$3")],
 ["Public does not claim booking or payment",s.publicWeb.includes("no online lab booking, Foundation benefit or payment is available")&&s.publicWeb.includes("{c.notice}")],
 ["Same-origin guarded Web BFF",s.bff.includes('request.headers.get("origin")')&&s.bff.includes('"publication","suspend"')],
 ["Visible Admin verified actions",s.admin.includes("changeAccess(center.centerRef")&&s.admin.includes("changePublication(center.centerRef")],
 ["Visible Admin suspension",s.admin.includes('suspendOriginal("providers"')&&s.admin.includes('suspendOriginal("centers"')],
 ["Own portal can submit without deciding",s.portal.includes("submitForReview()")&&!s.portal.includes("/decide")],
 ["Private files verify and revoke",s.cg19.includes("async confirm(")&&s.cg19.includes("async revoke(")&&s.upload.includes("uploadRef")],
 ["CG03 reviewer protected document",s.reviewer.includes("sendDecision")&&s.docBff.includes('parts[1]==="reviews"')],
 ["Exactly 94 unique original QA IDs",(()=>{
   const actual=new Set(s.tasks.match(/\bUS-00[1-5]-QA\d{2}\b/g)??[]);
   const wanted=new Set();
   for(let i=1;i<=5;i++)for(let n=1;n<=(i===5?22:18);n++)
     wanted.add("US-"+String(i).padStart(3,"0")+"-QA"+String(n).padStart(2,"0"));
   return actual.size===94&&[...wanted].every(x=>actual.has(x));
 })()]
];
// Previously-missing existing-owner Native Android registration and assigned-center paths.
const parity=[
 ["native Foundation provider and center editor",
  "apps/android-internal/src/features/health-network/native-provider-management.tsx",
  ["NativeHealthCenterEditor","NativeHealthEvidenceUploader",
   "providers?","/representatives","publication",
   "health","expectedVersion"]],
 ["native assigned-center-only editor",
  "apps/android-internal/src/features/health-network/native-own-center-portal.tsx",
  ["/api/v1/health-network/my-centers","NativeHealthCenterEditor",
   "proofFileRef:proof","expectedVersion:active.version"]],
 ["native health geography and hours original source",
  "apps/android-internal/src/features/health-network/native-health-center-editor.tsx",
  ["/api/v1/health-network/geography","openLocal","closeLocal",
   "diagnosticLicenseValidThrough"]],
 ["native provider and center original CG19 evidence",
  "apps/android-internal/src/features/health-network/native-health-evidence-uploader.tsx",
  ["/api/documents/health-draft","SHA-256","UploadType.BINARY_CONTENT",
   "/confirm","cleanVerified"]],
 ["native assigned-center approved content draft and review",
  "apps/android-internal/src/features/health-network/native-center-content-editor.tsx",
  ["my-centers/","content/submit","NativeCenterPhotoUploader",
   "expectedVersion:snapshot.version","reviewCaseRef"]],
 ["native source-based private photo rights and revocation",
  "apps/android-internal/src/features/health-network/native-center-photo-uploader.tsx",
  ["HEALTH_CENTER_PHOTO","/api/documents/health-center-content",
   "/attest","/revoke-rights","/revoke","UploadType.BINARY_CONTENT"]],
 ["native independent Foundation center content publishing",
  "apps/android-internal/src/features/health-network/native-center-content-publisher.tsx",
  ["content/publishing","/content/withdraw","/apply",
   "currentPassword:password","approvedRevisionRef:item.approvedRevisionRef"]],
 ["native original scanned CG14 bank destination",
  "apps/android-internal/src/features/health-network/native-provider-management.tsx",
  ["HEALTH_BANK_PROOF","finance-reference","fileRef:bankProof",
   "maskedLabel:maskedBank.trim()","canManageFinance"]],
 ["original clinician login independent reviewer and personal self acceptance",
  "apps/android-internal/src/features/health-network/native-clinician-account-link.tsx",
  ["clinician-accounts/","account-options?search=",
   "/propose","/revoke","me/pending","/accept",
   'response.status!=="ACTIVE"']],
 ["CG14 verified doctor native reviewer has isolated login association",
  "apps/android-internal/src/features/health-network/native-doctor-management.tsx",
  ["NativeClinicianAccountLinkReviewer","canVerify","doctorRef={selected.doctorRef}"]],
 ["CG01 native signed-in staff dashboard shows own acceptance only if proposal exists",
  "apps/android-internal/src/features/dashboard/internal-dashboard-screen.tsx",
  ["NativeClinicianAccountAcceptance","token={token}","onExpired={onExpired}"]],
 ["native original clinician-center association and fee source",
  "apps/android-internal/src/features/health-network/native-doctor-center-fees.tsx",
  ["my-centers/","doctors/eligible-centers",
   "expectedAssociationVersion:item.version","effectiveFromUtc:start.toISOString()",
   "amountMinor:amount","expectedVersion:fee.version",
   "requestKey:key.current[op]"]],
 ["native current Foundation doctor page shows original fee history",
  "apps/android-internal/src/features/health-network/native-doctor-management.tsx",
  ["NativeDoctorCenterFees","doctorRef={selected.doctorRef}"]],
 ["native assigned center page shows original fee history",
  "apps/android-internal/src/features/health-network/native-own-center-portal.tsx",
  ["NativeDoctorCenterFees","centerRef={active.centerRef}"]],
 ["native professional draft and private licence",
  "apps/android-internal/src/features/health-network/native-doctor-management.tsx",
  ["/api/v1/health-network/doctors","NativeDoctorEvidenceUploader","HEALTH_DOCTOR_PORTRAIT",
   "expectedVersion:selected.version","currentPassword:password"]],
 ["native CG19 doctor scanner and source claim",
  "apps/android-internal/src/features/health-network/native-doctor-evidence-uploader.tsx",
  ["/api/documents/doctor-evidence","SHA-256",
   "cleanVerified","classification"]],
 ["current role-bound original CG14 native navigation",
  "apps/android-internal/src/features/dashboard/dashboard-modules.ts",
  ['roleActions.includes("health.providers.view")',
   'roleActions.includes("health.doctors.view")',
   'roleActions.includes("health.centers.draft.edit")',
   "openHealthProviderManagement","openHealthDoctorManagement","openOwnCenterPortal"]],
 ["original CG14 publisher-only native menu preserves role separation",
  "apps/android-internal/src/features/dashboard/dashboard-modules.ts",
  ['roleActions.includes("health.centers.publish")',
   '!roleActions.includes("health.providers.view")',
   "openCenterContentPublisher"]],
 ["original CG14 publisher-only shell and source-backed queue",
  "apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
  ['roleActions.includes("health.centers.publish")',
   "NativeCenterContentPublisher","centerPublisherOpen"]],
 ["current role-bound CG14 shell/render and return",
  "apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
  ["NativeProviderManagement","NativeDoctorManagement","NativeOwnCenterPortal",
   'roleActions.includes("health.providers.manage")',
   'roleActions.includes("health.doctors.verify")',
   'roleActions.includes("health.centers.activate")']]
];
for(const [name,path,expected] of parity){
 const source=read(path);
 // The original static parity assertions must reject malformed native TSX
 // instead of reporting a misleading PASS based on text fragments alone.
 if(path.endsWith(".tsx")){
  const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  checks.push(["CG14 TSX syntax: "+name,parsed.parseDiagnostics.length===0]);
 }
 checks.push(["CG14 channel: "+name,expected.every(x=>source.includes(x))]);
}
// Original CG14 center-content reviewer parity: same CG03 case as Web,
// not a duplicate approval controller or a fake verified publication.
const contentReviewPath="apps/android-internal/src/features/health-network/native-center-content-review.tsx";
const nativeHealthReviewPath="apps/android-internal/src/features/registration-approvals/healthcare-native-review.tsx";
const cg03ContentReview=read(
 "apps/backend/src/modules/cg-03-registration-approvals/application/health-center-content-approval.service.ts");
const nativeContentReview=read(contentReviewPath);
const nativeHealthReview=read(nativeHealthReviewPath);
const contentController=read(
 "apps/backend/src/modules/cg-03-registration-approvals/http/health-center-content-approval.controller.ts");
const contentMedia=read(
 "apps/backend/src/modules/cg-19-documents-notifications/http/health-center-content-media.controller.ts");
for(const [path,code] of [[contentReviewPath,nativeContentReview],
 [nativeHealthReviewPath,nativeHealthReview]]){
 const parsed=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 checks.push(["CG14 native center-content reviewer TSX parses: "+path,
  parsed.parseDiagnostics.length===0]);
}
checks.push(["CG14 native reviewer reuses real CG03 center-content queue and decision",
 nativeContentReview.includes('"/api/health/content-reviews/"+path')&&
 nativeContentReview.includes('token,""')&&
 contentController.includes('@Get()')&&
 nativeContentReview.includes('encodeURIComponent(op.caseRef)+"/decide"')&&
 contentController.includes('api/health/content-reviews')]);
checks.push(["CG14 native reviewer shares same independently privileged original root",
 cg03ContentReview.includes('verifyReviewer(tx,actor,"approvals.review",true)')&&
 cg03ContentReview.includes('assertCurrent(tx,actor,"health.providers.verify")')&&
 nativeHealthReview.includes('canProviders&&<NativeCenterContentReview token={token}')]);
checks.push(["CG14 native reviewed private photo uses original protected CG19 reader",
 nativeContentReview.includes('"/api/documents/health-center-content/reviews/"')&&
 nativeContentReview.includes('Authorization:"Bearer "+token')&&
 nativeContentReview.includes("file?.delete()")&&
 contentMedia.includes('reviews/:caseRef/photos/:fileRef')]);
checks.push(["CG14 original review disposition is not a fake publication",
 nativeContentReview.includes("No publication performed.")&&
 nativeContentReview.includes("requestKey:op.requestKey")&&
 nativeContentReview.includes("expectedRevision:op.revision")&&
 nativeContentReview.includes("currentPassword:password")]);
checks.push(["CG14 native uncertain independent review reuses SAME request key",
 nativeContentReview.includes("Retry exact original reviewer request")&&
 nativeContentReview.includes("decide(pending)")&&
 nativeContentReview.includes("setPassword(\"\")")]);

let failures=0;
for(const [label,ok] of checks){
  process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+label+"\n");
  if(!ok)failures++;
}
process.stdout.write("CG14 source guards: "+(checks.length-failures)+"/"+checks.length+
  "; runtime, SQL, Web, Android and pixel verification remain NOT_RUN.\n");
if(failures)process.exitCode=1;
