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
 erpSourceModule:read("apps/backend/src/modules/cg-14-healthcare-network/health-source.module.ts"),
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
 webPublisher:read("apps/web/src/features/health-network/center-content-publisher-queue.tsx"),
 contentReviewPage:read("apps/web/src/app/(admin)/admin/health-network/content-reviews/page.tsx"),
 contentPublisherApi:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-center-content.controller.ts"),
 erpAdminPage:read("apps/web/src/app/(admin)/admin/health-network/erp-grants/page.tsx"),
 healthAdmin:read("apps/web/src/app/(admin)/admin/health-network/page.tsx"),
 tasks:read("specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/tasks.md")
};
const checks=[
 ["US004 original approved provider and center",s.directory.includes("health_center_publication")&&
  s.directory.includes("HEALTH_CENTER_LICENSE")],
 ["US004 doctor current license and independent decision",s.directory.includes("HEALTH_DOCTOR_VERIFICATION")&&
  s.directory.includes("HEALTH_DOCTOR_LICENSE")&&s.directory.includes("revoked_at IS NULL")],
 ["US004 original current center-linked doctor fees",s.directory.includes("fee.doctor_center_id=assoc.id")&&
  s.directory.includes("minFee")&&s.directory.includes("maxFee")],
 ["US004 bounded original search and current facets",s.directory.includes("minExperience")&&
  s.directory.includes("service")&&s.directory.includes("health_center_hours")],
 ["US004 hashed SQL public throttle all directory routes",s.publicThrottleSql.includes("health_public_request_bucket")&&
  s.publicThrottle.includes("timingSafeEqual")&&
  ["centers","doctors","doctor","facets","sitemap"].every(x=>
   s.directoryApi.includes('this.throttle.hit(request,"'+x+'")'))&&
  s.publicCenterApi.includes('this.throttle.hit(request,"center")')],
 ["US004 public source and published photos no-store",s.directoryApi.includes("Cache-Control")&&
  s.publicCenter.includes("health_center_publication")&&
  s.media.includes("derivative(bytes,before.original_mime)")],
 ["US004 responsive Web filters and correct parent areas",s.web.includes("selectedDistrict")&&
  s.web.includes("a.parentRef===selectedDistrict")&&s.web.includes("<details open={showAdvanced}")],
 ["US004 native Android actual stateful filters and backed directory",s.native.includes("new URLSearchParams()")&&
  s.native.includes("setRegion(")&&s.native.includes('a.parentRef===region.district.value')&&
  s.native.includes("{filtersExpanded&&<>")],
 ["US004 Android Hardware Back and nested verified detail history",s.native.includes("BackHandler.addEventListener")&&
  s.native.includes("detailHistory.current.pop()")&&
  s.native.includes("void show(previous,false)")],
 ["US004 native app entry and published sitemap",s.nativeEntry.includes("PublicHealthcareDirectory")&&
  s.sitemap.includes("approvedHealthSitemap")],
 ["US004 no fabricated clinic booking or appointment availability",
  s.web.includes("Check available consultation times before booking")&&
  s.web.includes("Check appointment times")&&
  s.native.includes("Check appointment times before booking")&&
  s.native.includes("Assistance is confirmed separately")&&
  s.native.includes("<DoctorSchedulePreview")],
 ["US005 original center content frozen source and publication",s.sql12.includes("health_center_content_revision")&&
  s.sql14.includes("health_center_content_publication")&&
  s.content.includes("source_snapshot")],
 ["US005 CG03 protected independent reviewer decision",s.review.includes("requireFreshFoundationRootProof")&&
  s.review.includes("c.proposer_id===actor.accountId")&&
  s.review.includes("this.source.original(tx,actor,this.submission(snapshot))")],
 ["US005 original CG19 scanned center photo and current consent",s.media.includes("verifyPrivateObject")&&
  s.media.includes("cg19_center_content_media_rights")&&
  s.media.includes("async revokeRights(")],
 ["US005 protected publisher queue separate from original reviewer queue",s.content.includes("async publishing(bearer:string)")&&
  s.webPublisher.includes("CenterContentPublisherQueue")&&
  s.contentReviewPage.includes("canReview&&<CenterContentReviewInbox")&&
  s.contentReviewPage.includes("canPublish&&<CenterContentPublisherQueue")],
 ["US005 content publication CAS and current source-bound withdrawal",s.content.includes("AND withdrawn_at IS NULL AND generation=$3")&&
  s.content.includes("AND approved_revision_id=$4 RETURNING generation")&&
  s.webPublisher.includes("expectedGeneration:item.publicationGeneration")&&
  s.webReview.includes("expectedGeneration:detail.publicationGeneration")],
 ["US005 error copy for withdrawal is editable",s.errors.includes("HEALTH_CONTENT_PUBLICATION_CHANGED")&&
  s.bff.includes("HEALTH_CONTENT_PUBLICATION_CHANGED")],
 ["US005 original CG19 support case, no duplicate file owner",s.sql12.includes("ALTER TABLE cg19_support_case ADD COLUMN center_id")&&
  s.attachmentSql.includes("cg19_stored_file")&&
  !s.attachmentSql.includes("CREATE TABLE health_support_file")],
 ["US005 support attachment exact Center A/B DB FK",s.attachmentSql.includes("uq_cg19_support_case_exact_center")&&
  s.attachmentSql.includes("REFERENCES cg19_support_case(id,realm_id,center_id)")&&
  s.attachmentSql.includes("FOREIGN KEY(support_case_id,realm_id,health_center_id)")],
 ["US005 scanned case attachment and double-checked private downloads",s.attachment.includes("verifyPrivateObject")&&
  s.attachment.includes("async download(")&&s.attachment.includes("async agentDownload(")&&
  s.attachment.includes("after.revision!==before.revision")],
 ["US005 original CG19 support case accessible to scoped users",s.supportScope.includes("assertCurrent")&&
  s.attachmentCenter.includes("Upload securely")&&
  s.attachmentAgent.includes("Refresh attachments")],
 ["US005 true CG03 optional ERP source and immutable grants",s.erpSql.includes("HEALTH_CENTER_ERP_GRANT")&&
  s.erpSql.includes("health_center_erp_grant_revision")&&
  s.erpSql.includes("BEFORE UPDATE OR DELETE ON health_center_erp_grant_command")],
 ["US005 source original CG03 FK and provider-center unique",s.erpSql.includes("UNIQUE(root_realm_id,provider_id,id)")&&
  s.erpSql.includes("REFERENCES health_center(root_realm_id,provider_id,id)")&&
  s.erpSql.includes("cg03_erp_only_source")],
 ["US005 independent protected grant reviewer and source module export",s.erpReview.includes("requireFreshFoundationRootProof")&&
  s.erpReview.includes("c.proposer_id===actor.accountId")&&
  s.erpSourceModule.includes("HealthErpGrantReviewSourceFacade]")],
 ["US005 distinct ERP publisher can access approved-only queue",s.erpGrant.includes('requireAction(bearer,"health.centers.publish")')&&
  s.erpGrant.includes("ready_case_ref")&&
  s.erpReviewUi.includes("publishReady(g)")&&
  s.erpAdminPage.includes("if(!canReview&&!canPublish)")],
 ["US005 optional ERP always nonoperational without real owner",s.erpConfig.includes("CAREGANGA_ERP_PHARMACY_ENABLED")&&
  s.erpConfig.includes("available:false")&&s.erpGrant.includes("canUseOperations:false")&&
  !s.erpSql.includes("CREATE TABLE pharmacy_stock")],
 ["US005 original content/ERP Center Portal editable and role safe",s.webEditor.includes("Save private draft")&&
  s.erpPanel.includes("CenterErpCapabilityPanel")&&
  s.contentApi.includes('@Get("content/publishing")')],
 ["US005 source errors safe and editable",s.errors.includes("HEALTH_ERP_GRANT_CHANGED")&&
  s.errors.includes("HEALTH_CENTER_MEDIA_RIGHTS_CHANGED")&&
  s.errors.includes("HEALTH_CONTENT_PUBLICATION_CHANGED")],
 ["Original 94 US QA IDs preserved exactly",(()=>{
  const observed=new Set(s.tasks.match(/\bUS-00[1-5]-QA\d{2}\b/g)??[]);
  const required=new Set();
  for(let story=1;story<=5;story++){
   const maximum=story===5?22:18;
   for(let number=1;number<=maximum;number++)
    required.add("US-"+String(story).padStart(3,"0")+"-QA"+
     String(number).padStart(2,"0"));
  }
  return observed.size===94&&required.size===94&&
   [...required].every(id=>observed.has(id));
 })()]
];
let failed=0;
for(const [description,present] of checks){
 process.stdout.write((present?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+description+"\n");
 if(!present)failed++;
}
process.stdout.write("US004/US005 authored source preflight: "+
 (checks.length-failed)+"/"+checks.length+
 ". This script NEVER proves executed PostgreSQL, build, browser, mobile, scanner or specialist QA.\n");
if(failed)process.exitCode=1;
