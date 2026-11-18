/**
 * CG14 source-presence preflight only. Not runtime, PG migration/restore,
 * browser, Android, scanner, pixel QA, or independent human approval.
 * No CI or GitHub Actions. Run: npm run verify:cg14-source
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
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
 ["Public eligibility recheck after fields",s.public.includes("const fresh=await this.db.query(")&&s.public.includes("c.publication_generation=$3")],
 ["Public does not claim booking or payment",s.publicWeb.includes("Online booking, clinical advice and online payment are not offered")],
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
let failures=0;
for(const [label,ok] of checks){
  process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+label+"\n");
  if(!ok)failures++;
}
process.stdout.write("CG14 source guards: "+(checks.length-failures)+"/"+checks.length+
  "; runtime, SQL, Web, Android and pixel verification remain NOT_RUN.\n");
if(failures)process.exitCode=1;
