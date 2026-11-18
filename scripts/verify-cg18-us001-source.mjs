// Source-presence guard only. Does not replace executable API/DB, security, pixel or Android QA.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const files={
 backend:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts"),
 review:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-review-source.facade.ts"),
 media:read("apps/backend/src/modules/cg-19-documents-notifications/application/cms-draft-media.service.ts"),
 migration:read("apps/backend/db/migrations/0936_cg18_original_site_editorial_media_roles.sql"),
 web:read("apps/web/src/features/cms-public-content/cms-public-page.tsx"),
 header:read("apps/web/src/features/cms-public-content/cms-site-header.tsx"),
 carousel:read("apps/web/src/features/cms-public-content/cms-hero-carousel.tsx"),
 admin:read("apps/web/src/features/cms-public-content/cms-admin-workspace.tsx"),
 adminStyles:read("apps/web/src/app/globals.css"),
 proxy:read("apps/web/src/app/api/cms-image-preview/[fileRef]/route.ts"),
 android:read("apps/android-public/src/features/cms/public-cms-screen.tsx"),
 reference:read("apps/web/src/features/cms-public-content/cms-client-screenshot-reference.ts"),
 cg03:read("apps/backend/src/modules/cg-03-registration-approvals/application/cms-publication-approval.service.ts"),
 extended:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-extended-sections.ts"),
 proof:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-compliance-eligibility.ts"),
 due:read("apps/backend/src/modules/cg-18-cms-public-content/infrastructure/cms-publication-due.worker.ts"),
 db1938:read("apps/backend/db/migrations/0938_cg18_public_impact_media_and_healthcare.sql"),
 db1939:read("apps/backend/db/migrations/0939_cg18_impact_editorial_photo.sql"),
 adminExtended:read("apps/web/src/features/cms-public-content/cms-extended-workspace.tsx"),
 publicExtended:read("apps/web/src/features/cms-public-content/cms-public-extended.tsx"),
 publicSource:read("apps/web/src/features/cms-public-content/cms-public-source.ts"),
 androidExtended:read("apps/android-public/src/features/cms/cms-extended-native-screen.tsx"),
 adminRoute:read("apps/web/src/app/(admin)/admin/website/page.tsx"),
 routeImpact:read("apps/web/src/app/our-impact/page.tsx"),
 routeVideos:read("apps/web/src/app/videos/page.tsx"),
 routePublications:read("apps/web/src/app/publications/page.tsx"),
 mediaRenderer:read("apps/web/src/features/cms-public-content/cms-editorial-route.tsx"),
 route80g:read("apps/web/src/app/80g/page.tsx"),
 routeNgo:read("apps/web/src/app/ngo-information/page.tsx"),
 routeGallery:read("apps/web/src/app/gallery/page.tsx"),
 routeBlog:read("apps/web/src/app/blog/page.tsx"),
 routeHealthcare:read("apps/web/src/app/healthcare/page.tsx"),
 notice:read("apps/backend/src/modules/cg-19-documents-notifications/application/notice.service.ts"),
 noticeSource:read("apps/backend/src/modules/cg-19-documents-notifications/application/cms-public-notice-source.service.ts"),
 storage:read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/verified-private-storage.ts"),
 scanner:read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/clamav-scanner.ts"),
 originalNav:read("docs/research/CAREGANGA-ORIGINAL-PUBLIC-NAVIGATION-CONTRACT-20261118.md"),
 policyMigration:read("apps/backend/db/migrations/0940_cg18_original_footer_policy_editorial.sql"),
 policyRoute:read("apps/web/src/app/policies/[slug]/page.tsx"),
 reuseMigration:read("apps/backend/db/migrations/0937_cg18_same_page_verified_media_reuse.sql"),
 galleryClient:read("apps/web/src/features/cms-public-content/cms-gallery-grid-client.tsx"),
 noticeBoard:read("apps/web/src/features/cms-public-content/cms-public-notice-board.tsx"),
 noticeRoute:read("apps/web/src/app/notices/page.tsx"),
 contactRoute:read("apps/web/src/app/contact/page.tsx"),
 originalScreenshotTrace:read("docs/research/CAREGANGA-ORIGINAL-PUBLIC-SCREENSHOT-QA-TRACE-20261118.md"),
 publicCmsController:read("apps/backend/src/modules/cg-18-cms-public-content/http/cms-editorial.controller.ts"),
 cg21Copy:read("apps/backend/src/core/http/safe-error-copy.ts")
};
const checks=[
 ["All screenshot-driven content blocks validated by backend",
  ["FEATURE_CARDS","JOIN_CARDS","SITE_FOOTER"].every(x=>files.backend.includes(x))],
 ["Original hero supports multiple source-validated slides",files.backend.includes("heroSlides")],
 ["CG19 media types and DB role constraint match",["ABOUT","PROMO","FEATURE"].every(x=>
  files.backend.includes(x)&&files.migration.includes(x))],
 ["CG03 reviewer uses actual reviewed source",files.cg03.includes("const frozen=await this.source.original")],
 ["No public page HTML injection",!files.web.includes("dangerouslySetInnerHTML")],
 ["Public header uses Healthcare Assistance, not old Blood Donation slot",
  files.header.includes("Healthcare Assistance")&&!files.header.includes("Blood Donation")],
 ["Public carousel permits deliberate controls",files.carousel.includes("aria-pressed")],
 ["Admin owns real image placement upload",files.admin.includes("media/initiate")],
 ["No public draft media preview leak",files.media.includes('requireAction(bearer,"cms.content.view")')
  &&files.proxy.includes("private, no-store")],
 ["Private preview validates media after storage fetch",
  files.media.includes("current.rows[0].object_version!==item.object_version")],
 ["Reviewer sees source media proof",files.review.includes("fileRef:a.fileRef")&&
  files.admin.includes("source.assets.map")],
 ["Native Android uses correct banner media order",files.android.includes("v.order===section.order")],
 ["Original screenshot content remains editable, not seeded",
  files.reference.includes("NEVER auto-seed")&&files.admin.includes("clientScreenshotHome")],
 ["Confirmed 4xx rejections release CMS editing and reviewing locks",
  files.admin.includes("class CmsRequestRejected extends Error")&&
  files.admin.includes("if(r.status>=400&&r.status<500)throw new CmsRequestRejected")&&
  (files.admin.match(/if\(e instanceof CmsRequestRejected\)setPending\(null\)/g)||[]).length===2],
 ["Uncertain CMS writes retain their original idempotency key",
  files.admin.includes("setPending(c)")&&files.admin.includes("Retry original action")],
 ["Authored media section/index validation is shared with public projection",
  files.backend.includes("function placementFits(")&&
  files.backend.includes("if(!placementFits(sections,a))")&&
  files.backend.includes("visibleAssets.filter(")],
 ["Direct CMS media URLs recheck allowed placements before and after storage fetch",
  files.media.includes("const PUBLIC_MEDIA_SECTION_ALLOWED=")&&
  files.media.split("   PUBLIC_MEDIA_SECTION_ALLOWED+").length===3&&
  !files.media.includes("a.role NOT IN('HERO','MOBILE_HERO')")],
 ["Original C22 banner overview is source-driven and selects one editor",
  files.admin.includes('className="cg-cms-banner-summary"')&&
  files.admin.includes('aria-pressed={active} onClick={()=>setActiveHeroIndex(index)}')&&
  files.admin.includes('index===Math.min(activeHeroIndex,draft.slides.length-1)')],
 ["Original verified banner thumbnails retain responsive Admin focus and selection",
  files.admin.includes('src={"/api/cms-image-preview/"+desktop.fileRef}')&&
  files.adminStyles.includes(".cg-cms-banner-row:focus-visible")&&
  files.adminStyles.includes(".cg-cms-banner-row[aria-pressed=")],
 ["CG18 US-002 typed ten-group editorial Impact and source/date validated",
  files.extended.includes("impactGroups=[")&&
  files.extended.includes('group==="BREAKDOWN"')&&
  files.extended.includes('out.asOfDate')&&
  files.adminExtended.includes("claimsFullBreakdown")&&
  files.publicExtended.includes("cg-site-evidence-table")&&
  files.androidExtended.includes('section.kind==="IMPACT_GROUP"')],
 ["CG18 US-002 statutory truth and current proof expiry guards",
  files.extended.includes('kind==="COMPLIANCE_FACTS"')&&
  files.extended.includes('fact.verification==="VERIFIED"')&&
  files.proof.includes("complianceEligible(")&&
  files.backend.includes("await complianceEligible(")&&
  files.due.includes("await complianceEligible(")&&
  files.routeNgo.includes("CmsOriginalNgoInformationRoute")],
 ["CG18 US-003 gallery and article originals reuse CG19 private bytes",
  files.extended.includes('kind==="GALLERY_GRID"')&&
  files.extended.includes('kind==="ARTICLE_BODY"')&&
  files.db1938.includes("application/pdf")&&files.db1938.includes("video/mp4")&&
  files.media.includes("PUBLIC_MEDIA_MIME_ALLOWED")&&
  files.publicExtended.includes("CmsGallery")&&
  files.publicExtended.includes("CmsArticle")&&
  files.androidExtended.includes('section.kind==="GALLERY_GRID"')&&
  files.routeBlog.includes("publishedCmsArticles")],
 ["CG18 US-003 public Contact preserves original CG19 support master",
  files.adminExtended.includes('kind==="CONTACT"')&&
  files.publicSource.includes("publishedCmsArticles")&&
  !files.extended.includes("cms_contact_message")],
 ["CG18 US-004 genuine neutral Healthcare editorial only",
  files.extended.includes('kind==="HEALTHCARE_CATEGORIES"')&&
  files.extended.includes('healthcareClaims')&&
  files.adminExtended.includes('kind:"HERO"')&&
  files.routeHealthcare.includes('slug="healthcare"')&&
  files.publicExtended.includes("CmsHealthcare")&&
  files.androidExtended.includes('section.kind==="HEALTHCARE_CATEGORIES"')],
 ["All new CG18 editors stay in original authorized Admin and public source",
  files.adminRoute.includes("CmsExtendedWorkspace")&&
  files.header.includes("publishedRoutes")&&
  files.publicSource.includes("effectiveGeneration")],
 ["CG19 original notice is never automatically exposed to public",
  files.notice.includes("audience_kind")&&
  files.noticeSource.includes("communications.notices.manage")&&
  files.noticeSource.includes("revisionEligible(")&&
  files.noticeSource.includes("audience_kind='ALL_ACTIVE'")&&
  files.extended.includes("publicReleaseConfirmed")&&
  files.backend.includes("requireSelectionAccess(bearer)")&&
  files.backend.includes("await this.notices.revisionEligible(")&&
  files.adminExtended.includes("I confirm that this exact notice title and body")&&
  !files.publicExtended.includes("cg19_notice_recipient")],
 ["CG19 short video is scanned and size-limited without increasing finance limits",
  files.storage.includes("maxFor=(key:string,mime:string)")&&
  files.storage.includes('mime==="video/mp4"')&&
  files.storage.includes("byteSignatureMatches")&&
  files.scanner.includes("bytes.length>25*1024*1024")],
 ["80G annual reports require exact indexed scanned original documents",
  files.extended.includes('"ANNUAL_REPORT"')&&
  files.extended.includes('role==="DOCUMENT"&&a.order===i')&&
  files.backend.includes('s.fields.documents.length')&&
  files.publicExtended.includes("Published original reports")],
 ["Original 12 primary public navigation labels, no invented Blood Bank lifecycle",
  ["Home","About Us","Our Work","NGO Information","Campaigns","Upcoming Projects",
   "Partnerships","Events","Media & Resources","Join Now","Healthcare Assistance","Contact Us"]
    .every(name=>files.header.includes(name))&&!files.header.includes("Blood Donation")],
 ["Original NGO Information uses the approved current 80G source without fabricated PAN pages",
  files.backend.includes('kind==="COMPLIANCE"?"/ngo-information"')&&
  files.backend.includes('p.kind==="COMPLIANCE"?"/ngo-information"')&&
  files.routeNgo.includes('CmsOriginalNgoInformationRoute')&&
  files.mediaRenderer.includes('publishedCmsPage("80g")')&&
  files.web.includes('cg-site-ngo-sidebar')&&
  files.route80g.includes('permanentRedirect("/ngo-information")')],
 ["Original /our-impact is canonical across validated server CMS and public SSR",
  files.backend.includes('IMPACT:"our-impact"')&&
  files.publicSource.includes('slug!=="our-impact"')&&
  files.routeImpact.includes('slug="our-impact"')],
 ["Original NGO Information navigation never opens unrelated Impact",
  !files.header.includes('href="/impact"')&&
  files.header.includes('isPublished("/ngo-information")')&&
  files.header.includes('href="/ngo-information"')&&
  files.header.includes('aria-disabled="true">NGO Information')],
 ["Screenshot-original Our Work six / Media five / Join two retained",
  ["All Projects","Education","Healthcare","Livelihood","Social Welfare",
   "Community Development","News & Updates","Gallery","Videos",
   "Publications / Reports","Blog","Become a Member","Become a Volunteer"]
    .every(name=>files.header.includes(name))],
 ["Original Videos and Publications use distinct safe visitor URLs and one approved media source",
  files.header.includes('"/videos"')&&
  files.header.includes('"/publications"')&&
  files.routeVideos.includes('CmsOriginalMediaRoute mediaType="VIDEO"')&&
  files.routePublications.includes('CmsOriginalMediaRoute mediaType="PUBLICATION"')&&
  files.mediaRenderer.includes('publishedCmsPage("gallery")')&&
  files.galleryClient.includes('mediaType==="PUBLICATION"')&&
  files.galleryClient.includes('originalIndex')&&
  files.adminExtended.includes('Videos page heading')&&
  files.extended.includes('videosEmptyText')],
 ["All original seven footer policies are editable via same CMS and CG03 approval",
  files.originalNav.includes("seven original Footer Policies & Legal")&&
  files.policyMigration.includes("'POLICY'")&&
  files.backend.includes('if(page.kind==="POLICY")')&&
  files.backend.includes("POLICY_SLUGS")&&
  files.adminExtended.includes('kind==="POLICY"')&&
  files.policyRoute.includes('source.page.kind!=="POLICY"')],
 ["Original footer legal links and native legal buttons only after effective publish",
  files.web.includes('isPublished("/policies/"+slug)')&&
  files.android.includes('publishedPaths.includes("/policies/"+name)')&&
  files.publicSource.includes('source.kind==="POLICY"')],
 ["Required 0937 same-page media FK is inserted from trusted revision and checked across owners",
  files.reuseMigration.includes("ADD COLUMN page_id uuid")&&
  files.reuseMigration.includes("ALTER COLUMN page_id SET NOT NULL")&&
  files.backend.includes('"page_id,cg19_file_ref,cg19_validated_version')&&
  files.backend.includes('"FROM cms_page_revision v WHERE v.id=$2 AND v.foundation_root_id=$1"')&&
  (files.backend.match(/f.page_id=a.page_id/g)||[]).length===3&&
  files.media.includes("f.page_id=a.page_id")&&
  files.proof.includes("f.page_id=a.page_id")],
 ["Original Gallery hidden state denies public item metadata and direct CG19 bytes",
  files.extended.includes('"visible"]);')&&
  files.extended.includes("visible:item.visible!==false")&&
  files.backend.includes("item&&item.visible!==false?[{...item,originalIndex:index}]")&&
  files.backend.includes('asset.role!=="GALLERY"||authoredGallery[asset.sort_order]?.visible!==false')&&
  files.media.includes("->>'visible') IS DISTINCT FROM 'false'")&&
  files.galleryClient.includes("mediaOrder=Number.isSafeInteger(item.originalIndex)")&&
  files.androidExtended.includes('typeof item.originalIndex==="number"')&&
  files.adminExtended.includes("Show this item on the public site after independent approval")],
 ["Original Notices listing reads ONLY independent currently published CG19 source",
  files.backend.includes("async publicNotices(){")&&
  files.backend.includes("n.audience_kind='ALL_ACTIVE'")&&
  files.backend.includes("body.structured_fields->>'publicReleaseConfirmed'='true'")&&
  files.backend.includes("n.expires_at>now()")&&
  files.publicCmsController.includes('@Get("notices")')&&
  files.publicSource.includes("publishedCmsNotices()")&&
  files.noticeRoute.includes("CmsPublicNoticeBoard")&&
  files.noticeBoard.includes("Reset Filters")&&
  files.header.includes('text==="News & Updates"?"/notices"')],

 ["Original Contact uses one authorized editable section and real CG19 support",
  files.extended.includes('if(kind==="CONTACT_INFO")')&&
  files.backend.includes('"CONTACT_INFO"')&&
  files.adminExtended.includes("Contact page hero title")&&
  files.adminExtended.includes("Add FAQ")&&
  files.publicExtended.includes("export function CmsContactInfo")&&
  files.publicExtended.includes("const secure=(value:unknown,hosts:string[])")&&
  files.web.includes('section.kind==="CONTACT_INFO"')&&
  files.contactRoute.includes("<Cg19PublicContactForm/>")&&
  files.cg21Copy.includes("CMS_INPUT_INVALID:")],

 ["CG21 administrator can edit original team-consent failure copy",
  files.cg21Copy.includes("CMS_TEAM_CONSENT_REQUIRED:")],
 ["Original newsletter cannot fake subscriber success before CG19 opt-in",
  files.web.includes('disabled className="cg-site-newsletter-button"')&&
  files.originalNav.includes("CG-19 owns any real opt-in receipt")]
];
let errors=0;
for(const [label,ok] of checks){
 console.log((ok?"SOURCE-PRESENT":"SOURCE-FAIL")+": "+label);
 if(!ok)errors++;
}
assert.equal(errors,0,"Source wiring assertions failed");
console.log("CG-18 US-001–004 original website/navigation static source-presence checks are green ONLY if all checks above pass; 76 original runtime QA, live Web/Android/DB, full original URLs, About dropdown and pixel fidelity remain NOT EXECUTED/NOT VERIFIED.");
