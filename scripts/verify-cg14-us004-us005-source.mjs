/**
 * CG-14 US004/US005 local SOURCE-WIRING guard only.
 * No CI / GitHub Actions. No PostgreSQL, TypeScript build, browser,
 * Android, scanner/object-store, Web pixel, backup/restore, race or p95 run.
 * Run: npm run verify:cg14-us004-us005-source
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const s={
 directory:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-public-directory.service.ts"),
 directoryApi:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-public-directory.controller.ts"),
 publicThrottle:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-public-request-throttle.service.ts"),
 publicThrottleSql:read("apps/backend/db/migrations/1418_cg14_public_directory_request_throttle.sql"),
 publicCenterApi:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-public-center.controller.ts"),
 publicModule:read("apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts"),
 erpSql:read("apps/backend/db/migrations/1419_cg14_center_erp_grant_original_cg03_case.sql"),
 erpGrant:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-erp-grant.service.ts"),
 erpSource:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-erp-grant-review-source.facade.ts"),
 erpReview:read("apps/backend/src/modules/cg-03-registration-approvals/application/health-erp-grant-approval.service.ts"),
 erpOwnUi:read("apps/web/src/features/health-network/center-erp-capability-panel.tsx"),
 erpReviewUi:read("apps/web/src/features/health-network/center-erp-grant-reviews.tsx"),
 erpReviewBff:read("apps/web/src/app/api/health/erp-grant-reviews/[...parts]/route.ts"),
 erpPanel:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
 erpRoot:read("apps/backend/src/modules/cg-03-registration-approvals/registration-approvals.module.ts"),
 erpConfig:read("apps/backend/src/core/config/config.ts"),
 content:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-content.service.ts"),
 contentApi:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-center-content.controller.ts"),
 review:read("apps/backend/src/modules/cg-03-registration-approvals/application/health-center-content-approval.service.ts"),
 reviewSource:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-content-review-source.facade.ts"),
 media:read("apps/backend/src/modules/cg-19-documents-notifications/application/health-center-content-media.service.ts"),
 mediaApi:read("apps/backend/src/modules/cg-19-documents-notifications/http/health-center-content-media.controller.ts"),
 support:read("apps/backend/src/modules/cg-19-documents-notifications/application/support.service.ts"),
 attachment:read("apps/backend/src/modules/cg-19-documents-notifications/application/center-support-attachment.service.ts"),
 attachmentHttp:read("apps/backend/src/modules/cg-19-documents-notifications/http/center-support-attachment.controller.ts"),
 attachmentSql:read("apps/backend/db/migrations/1417_cg19_center_support_original_attachments.sql"),
 attachmentCenter:read("apps/web/src/features/health-network/center-support-attachments.tsx"),
 attachmentAgent:read("apps/web/src/features/support/foundation-support-attachments.tsx"),
 supportScope:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts"),
 publicCenter:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-public-center.service.ts"),
 sql12:read("apps/backend/db/migrations/1412_cg14_center_content_drafts_and_cg19_support_scope.sql"),
 sql13:read("apps/backend/db/migrations/1413_cg03_original_center_content_review.sql"),
 sql14:read("apps/backend/db/migrations/1414_cg14_center_content_publication_lifecycle.sql"),
 sql15:read("apps/backend/db/migrations/1415_cg19_original_center_content_media_and_rights.sql"),
 sql16:read("apps/backend/db/migrations/1416_cg14_reference_healthcare_categories.sql"),
 web:read("apps/web/src/app/health-network/page.tsx"),
 webDoctor:read("apps/web/src/app/health-network/doctors/[doctorRef]/page.tsx"),
 webCenter:read("apps/web/src/app/healthcare/centers/[slug]/page.tsx"),
 webEditor:read("apps/web/src/features/health-network/center-content-editor.tsx"),
 webPhoto:read("apps/web/src/features/health-network/center-photo-uploader.tsx"),
 webReview:read("apps/web/src/features/health-network/center-content-review-inbox.tsx"),
 webSupport:read("apps/web/src/features/health-network/center-support-desk.tsx"),
 native:read("apps/android-public/src/features/health-network/public-healthcare-directory.tsx"),
 nativeEntry:read("apps/android-public/app/index.tsx"),
 sitemap:read("apps/web/src/app/sitemap.ts"),
 photosProxy:read("apps/web/src/app/healthcare/centers/[slug]/photos/[fileRef]/route.ts"),
 bff:read("apps/web/src/app/api/health-network/[...parts]/route.ts"),
 supportBff:read("apps/web/src/app/api/support/[...parts]/route.ts"),
 mediaBff:read("apps/web/src/app/api/documents/health-center-content/[...parts]/route.ts"),
 errors:read("apps/backend/src/core/http/safe-error-copy.ts"),
 tasks:read("specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/tasks.md")
};
const checks=[
 ["US004 original verified center only",s.directory.includes("health_center_publication")&&s.directory.includes("HEALTH_CENTER_LICENSE")],
 ["US004 original doctor case and unrevoked proof",s.directory.includes("HEALTH_DOCTOR_VERIFICATION")&&s.directory.includes("HEALTH_DOCTOR_LICENSE")&&s.directory.includes("revoked_at IS NULL")],
 ["US004 independent approved center-specific fee",s.directory.includes("fee.doctor_center_id=assoc.id")&&s.directory.includes("fee.status='APPROVED'")],
 ["US004 approved photos never leak private object key",s.media.includes("derivative(bytes,before.original_mime)")&&s.photosProxy.includes('"Cache-Control":"no-store')],
 ["US004 source-current no cache API",s.directoryApi.includes('Cache-Control')&&s.directoryApi.includes('this.throttle.hit(request,"facets")')],
 ["US004 rate-limited and HMAC-bound published endpoints",s.publicThrottle.includes("health_public_request_bucket")&&
  s.publicThrottle.includes("timingSafeEqual")&&s.publicThrottle.includes("CG14_PUBLIC_PROXY_KEY")&&
  s.publicThrottleSql.includes("CREATE TABLE health_public_request_bucket")&&
  s.directoryApi.includes('this.throttle.hit(request,"doctors")')&&
  s.publicCenterApi.includes('this.throttle.hit(request,"center")')&&
  s.publicModule.includes("HealthPublicRequestThrottleService")],
 ["US004 editable safe rate-limit copy",s.errors.includes("HEALTH_PUBLIC_RATE_LIMIT")&&
  s.publicThrottle.includes('code:"HEALTH_PUBLIC_RATE_LIMIT"')],
 ["US004 stable doctor-center cursor",s.directory.includes('split_part($6')&&s.directory.includes('doc.id LIMIT 21')],
 ["US004 validated category + geography",s.sql16.includes("POLYCLINIC")&&s.directory.includes("g.status='ACTIVE'")],
 ["US004 name, specialty, qualifications, experience, fees",s.directory.includes("doc.qualifications")&&s.directory.includes("doc.specialties")&&s.directory.includes("minExperience")&&s.directory.includes("minFee")],
 ["US004 actual day/service/facility allowlist",s.directory.includes("health_center_hours")&&s.directory.includes("health_center_capability")&&s.directory.includes("facilities")],
 ["US004 Next responsive list/detail and guarded 404",s.web.includes("gridTemplateColumns")&&s.webDoctor.includes("notFound()")&&s.webCenter.includes("notFound()")],
 ["US004 Web category and area filters",s.web.includes("publicAreas")&&s.web.includes('name="district"')],
 ["US004 native actual filter/detail/back",s.nativeEntry.includes("PublicHealthcareDirectory")&&s.native.includes("AppState.addEventListener")&&s.native.includes("Back")],
 ["US004 real dynamic approved-only sitemap",s.sitemap.includes("approvedHealthSitemap")&&s.directory.includes("async sitemap(")],
 ["US004 no invented booking slots",s.web.includes("Online appointments")&&s.native.includes("cannot confirm appointments")],
 ["US005 typed versioned draft+original CG03 case",s.sql12.includes("health_center_content_revision")&&s.sql13.includes("HEALTH_CENTER_CONTENT_REVIEW")],
 ["US005 independent protected reviewer decision",s.review.includes("requireFreshFoundationRootProof")&&s.review.includes("c.proposer_id===actor.accountId")],
 ["US005 exact source and stale version rejection",s.reviewSource.includes("input.revisionNo+1")&&s.content.includes("this.review.approved(")],
 ["US005 public content only frozen approved source",s.publicCenter.includes("cp.original_decision_ref")&&s.publicCenter.includes("source_snapshot")],
 ["US005 original scanned CG19 photo and rights",s.sql15.includes("cg19_center_content_media_rights")&&s.media.includes("verifyPrivateObject")],
 ["US005 photo revocation after approval",s.media.includes("async revokeRights(")&&s.media.includes("rights.revoked_at IS NULL")],
 ["US005 public Web and Android center photos",s.webCenter.includes("/photos/")&&s.native.includes("/api/documents/health-center-content/public/")],
 ["US005 own center content editor",s.webEditor.includes("CenterPhotoUploader")&&s.webEditor.includes("Save private draft")],
 ["US005 real Foundation review and separate publication",s.webReview.includes("Record independent decision")&&s.webReview.includes("Publish independently approved content")],
 ["US005 exact current center support ownership",s.supportScope.includes("f.status='ACTIVE'")&&s.support.includes("async centerReply(")],
 ["US005 CG19 original support case not shadow table",s.sql12.includes("ALTER TABLE cg19_support_case ADD COLUMN center_id")&&!s.sql12.includes("CREATE TABLE health_center_support_case")],
 ["US005 no own-center BFF permissions bypass",s.supportBff.includes('parts[0]==="centers"')&&s.mediaBff.includes("cg_staff_session")],
 ["US005 original CG19 support case attachments, no parallel master",s.attachmentSql.includes("CG19_SUPPORT")&&
  s.attachmentSql.includes("FOREIGN KEY(support_case_id,realm_id)")&&
  !s.attachmentSql.includes("CREATE TABLE health_support_file")],
 ["US005 scanned source and double checked private download",s.attachment.includes("verifyPrivateObject")&&
  s.attachment.includes("async download(")&&s.attachment.includes("async agentDownload(")&&
  s.attachment.includes("after.revision!==before.revision")],
 ["US005 center and Foundation staff have original guarded attachment UI",s.attachmentHttp.includes("SupportAgentAttachmentController")&&
  s.attachmentCenter.includes("Upload securely")&&
  s.attachmentAgent.includes("Refresh attachments")&&s.supportBff.includes('parts[4]==="attachments"')],
 ["US005 original ERP source and no fake operational stock",s.erpSql.includes("health_center_erp_grant_revision")&&
  s.erpSql.includes("health_center_erp_grant_event")&&
  s.erpSql.includes("HEALTH_CENTER_ERP_GRANT")&&
  !s.erpSql.includes("CREATE TABLE pharmacy_stock")],
 ["US005 original CG03 grant source disjoint and frozen",s.erpSql.includes("cg03_erp_only_source")&&
  s.erpSql.includes("health_source_digest ~ '^[a-f0-9]{64}s.errors.includes("HEALTH_CONTENT_REVIEW_INVALID")&&
  s.errors.includes("HEALTH_CENTER_MEDIA_RIGHTS_CHANGED")&&s.errors.includes("CENTER_SUPPORT_FILE_CHANGED")],
 ["US005 restricted original center approval routes",s.contentApi.includes("content/reviews/:caseRef/apply")&&s.bff.includes('["submit","withdraw"].includes(parts[3])')],
 ["All original 94 story QA identifiers preserved",(()=>{
   const actual=new Set(s.tasks.match(/\bUS-00[1-5]-QA\d{2}\b/g)??[]);
   const want=new Set();
   for(let story=1;story<=5;story++)for(let n=1;n<=(story===5?22:18);n++)
    want.add("US-"+String(story).padStart(3,"0")+"-QA"+String(n).padStart(2,"0"));
   return actual.size===94&&[...want].every(x=>actual.has(x));
 })()]
];
let fails=0;
for(const [name,pass] of checks){
 process.stdout.write((pass?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+name+"\n");
 if(!pass)fails++;
}
process.stdout.write("US004/US005 static source wiring "+(checks.length-fails)+"/"+checks.length+
 "; **no executed QA**, SQL, build, device or pixel proof.\n");
if(fails)process.exitCode=1;
")&&
  s.erpSql.includes("NEW.health_erp_revision_id IS DISTINCT FROM OLD.health_erp_revision_id")],
 ["US005 actual original independent CG03 reviewer",s.erpReview.includes("requireDistinctFinalReviewer")&&
  s.erpReview.includes("requireFreshFoundationRootProof")&&
  s.erpReview.includes("c.proposer_id===actor.accountId")&&
  s.erpReview.includes("this.source.original(")],
 ["US005 center current owner creates ERP request, no operational grant",s.erpGrant.includes("this.centerScope.assertCurrent")&&
  s.erpGrant.includes("this.approval.create(tx,actor")&&
  s.erpGrant.includes("canUseOperations:false")],
 ["US005 protected Foundation applies, suspends or withdraws version",s.erpGrant.includes("this.approval.approved(")&&
  s.erpGrant.includes("requireFreshFoundationRootProof")&&
  s.erpGrant.includes("'SUSPENDED'")&&s.erpGrant.includes("'WITHDRAWN'")],
 ["US005 deployment switches OFF or explicitly NOT_AVAILABLE",s.erpConfig.includes("CAREGANGA_ERP_PHARMACY_ENABLED")&&
  s.erpConfig.includes("available:false")&&s.erpGrant.includes("erpDeploymentCapabilities")],
 ["US005 center and Foundation views explicitly do not enable ERP",s.erpOwnUi.includes("Request independent Foundation approval")&&
  s.erpReviewUi.includes("Record independent decision")&&
  s.erpReviewUi.includes("Apply approved center grant")&&
  s.erpPanel.includes("CenterErpCapabilityPanel")],
 ["US005 original grant modules and staff-only proxy",s.publicModule.includes("HealthCenterErpGrantService")&&
  s.erpRoot.includes("HealthErpGrantApprovalService")&&
  s.erpReviewBff.includes("erp-grant-reviews")&&
  s.bff.includes('parts[0]==="erp-grants"')],
 ["US005 ERP status and user-editable error",s.errors.includes("HEALTH_ERP_GRANT_INVALID")&&
  s.errors.includes("HEALTH_ERP_GRANT_SOURCE_CHANGED")],
 ["US005 editable human error catalog",s.errors.includes("HEALTH_CONTENT_REVIEW_INVALID")&&
  s.errors.includes("HEALTH_CENTER_MEDIA_RIGHTS_CHANGED")&&s.errors.includes("CENTER_SUPPORT_FILE_CHANGED")],
 ["US005 restricted original center approval routes",s.contentApi.includes("content/reviews/:caseRef/apply")&&s.bff.includes('["submit","withdraw"].includes(parts[3])')],
 ["All original 94 story QA identifiers preserved",(()=>{
   const actual=new Set(s.tasks.match(/\bUS-00[1-5]-QA\d{2}\b/g)??[]);
   const want=new Set();
   for(let story=1;story<=5;story++)for(let n=1;n<=(story===5?22:18);n++)
    want.add("US-"+String(story).padStart(3,"0")+"-QA"+String(n).padStart(2,"0"));
   return actual.size===94&&[...want].every(x=>actual.has(x));
 })()]
];
let fails=0;
for(const [name,pass] of checks){
 process.stdout.write((pass?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+name+"\n");
 if(!pass)fails++;
}
process.stdout.write("US004/US005 static source wiring "+(checks.length-fails)+"/"+checks.length+
 "; **no executed QA**, SQL, build, device or pixel proof.\n");
if(fails)process.exitCode=1;
