// Source-presence guard only. Does not replace executable API/DB, security, pixel or Android QA.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const internalCms=read("apps/android-internal/src/features/cms/native-cms-editorial.tsx");
const internalMedia=read("apps/android-internal/src/features/cms/native-cms-media-uploader.tsx");
const internalReviewer=read("apps/android-internal/src/features/cms/native-cms-reviewer.tsx");
const internalMenu=read("apps/android-internal/src/features/dashboard/dashboard-modules.ts");
const internalShell=read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx");
const files={
 backend:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts"),
 review:read("apps/backend/src/modules/cg-18-cms-public-content/application/cms-review-source.facade.ts"),
 media:read("apps/backend/src/modules/cg-19-documents-notifications/application/cms-draft-media.service.ts"),
 migration:read("apps/backend/db/migrations/0936_cg18_original_site_editorial_media_roles.sql"),
 web:read("apps/web/src/features/cms-public-content/cms-public-page.tsx"),
 homepage:read("apps/web/src/app/page.tsx"),
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
 ngoChildren:read("apps/web/src/features/cms-public-content/cms-ngo-pages.tsx"),
 ngoAnnual:read("apps/web/src/features/cms-public-content/cms-ngo-annual-client.tsx"),
 ngoChildRoute:read("apps/web/src/app/ngo-information/[section]/page.tsx"),
 contactPhotoMigration:read("apps/backend/db/migrations/0941_cg18_original_contact_photography.sql"),
 webSitemap:read("apps/web/src/app/sitemap.ts"),
 publicMediaController:read("apps/backend/src/modules/cg-19-documents-notifications/http/cms-draft-media.controller.ts"),
 publicMediaWebProxy:read("apps/web/src/app/api/public/content/media/[fileRef]/route.ts"),
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
 ["Original NGO Information uses the approved 80G source and verified child routes",
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
  (files.backend.includes("f.page_id=source_rev.page_id")||(files.backend.match(/f.page_id=a.page_id/g)||[]).length===3)&&
  (files.media.includes("f.page_id=source_rev.page_id")||files.media.includes("f.page_id=a.page_id"))&&
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
  files.backend.includes("a.public_rights_status<>'VALIDATED'")&&
  files.backend.includes("body.structured_fields->>'publicReleaseConfirmed'='true'")&&
  files.backend.includes("n.expires_at>now()")&&
  files.publicCmsController.includes('@Get("notices")')&&
  files.publicSource.includes("publishedCmsNotices()")&&
  files.noticeRoute.includes("CmsPublicNoticeBoard")&&
  files.noticeBoard.includes("Reset Filters")&&
  files.header.includes('text==="News & Updates"?"/notices"')],

 ["Original MP4 byte ranges survive the Web same-origin proxy without exposing storage",
  files.publicMediaWebProxy.includes('headers:range?{Range:range}:undefined')&&
  files.publicMediaWebProxy.includes('status:partial?206:200')&&
  files.publicMediaWebProxy.includes('response.status===416')&&
  files.publicMediaWebProxy.includes('declared!==bytes.byteLength')&&
  files.publicMediaWebProxy.includes("Content-Range")&&
  files.publicMediaWebProxy.includes("Cache-Control")&&
  files.publicMediaWebProxy.includes("Content-Security-Policy")&&
  !files.publicMediaWebProxy.includes("storageUrl")],

 ["Published CMS SQL uses the actual revision page ID (never nonexistent placement.page_id)",
  !files.backend.includes("a.page_id")&&
  !files.media.includes("a.page_id")&&
  files.backend.includes("f.page_id=v.page_id")&&
  files.backend.includes("f.page_id=p.id")&&
  files.backend.includes("f.page_id=source_rev.page_id")&&
  files.media.includes("f.page_id=source_rev.page_id")],

 ["Original MP4 video byte ranges retain CG19 verification and do not cache rights",
  files.publicMediaController.includes("await this.media.publicBytes(ref)")&&
  files.publicMediaController.includes("requestedRange:string|undefined")&&
  files.publicMediaController.includes("Accept-Ranges")&&
  files.publicMediaController.includes("Content-Range")&&
  files.publicMediaController.includes("response.status(206)")&&
  files.publicMediaController.includes("response.status(416)")&&
  files.publicMediaController.includes('Cache-Control","no-store"')&&
  files.publicMediaController.includes("Number.isSafeInteger")],

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

 ["Original PAN registration and annual child routes reuse current CG18/19 source",
  files.ngoChildRoute.includes("CmsNgoChildRoute")&&
  files.ngoChildren.includes('publishedCmsPage("80g")')&&
  files.ngoChildren.includes('allowed=new Set<Child>')&&
  files.ngoChildren.includes('safeMediaPath(a.src)')&&
  files.ngoAnnual.includes("Reset Filters")&&
  files.webSitemap.includes('proof("REGISTRATION")')&&
  files.webSitemap.includes('proof("ANNUAL_REPORT")')&&
  !files.webSitemap.includes('"/ngo-information/financial-reports"')],

 ["Original Contact three photos use the existing CG19 scan and safe public media",
  files.contactPhotoMigration.includes("'CONTACT','OTHER'")&&
  files.backend.includes('if(a.role==="CONTACT")')&&
  files.backend.includes('a.order<3')&&
  files.media.includes("a.role='CONTACT' AND sec.section_kind='CONTACT_INFO'")&&
  files.media.includes("'ARTICLE','IMPACT','CONTACT')")&&
  files.adminExtended.includes('value="CONTACT"')&&
  files.publicExtended.includes('a.role==="CONTACT"')&&
  files.web.includes('assets={assets}')&&
  files.androidExtended.includes('picture("CONTACT",i)')&&
  files.android.includes('contact:"CONTACT"')],

 ["Original Native Notice Board consumes only bounded current CG19 public source",
  files.android.includes("async function publishedNotices()")&&
  files.android.includes('new URL("/api/public/content/notices",base)')&&
  files.android.includes('data.notices.length>60')&&
  files.android.includes('title="Notices"')&&
  files.android.includes('noticePriority')&&
  files.android.includes('noticeCategory')&&
  files.android.includes('noticeSearch')&&
  files.android.includes('articleBackTarget')],

 ["Native original NGO PAN/certificate/year tabs use approved CG18/CG19 assets",
  files.android.includes('setNgoScope("80g")')&&
  files.android.includes('hasOfficialDocument(scope==="annual-reports"')&&
  files.androidExtended.includes('ngoScope!=="80g"')&&
  files.androidExtended.includes('mediaUrl(asset("DOCUMENT",index))')&&
  files.androidExtended.includes('annualYear')&&
  files.ngoChildren.includes('publishedCmsPage("80g")')],

 ["Verified Google Maps embeds require an explicit safe approved URL",
  files.publicExtended.includes('u.pathname==="/maps/embed"')&&
  files.publicExtended.includes('u.searchParams.has("pb")')&&
  files.publicExtended.includes('referrerPolicy="no-referrer-when-downgrade"')],

 ["CG21 administrator can edit original team-consent failure copy",
  files.cg21Copy.includes("CMS_TEAM_CONSENT_REQUIRED:")],
 ["Original newsletter uses real CG19 verification and withdrawal, not a fake success",
  files.web.includes('<Cg19NewsletterForm/>')&&
  files.android.includes('<NativeNewsletterForm/>')&&
  files.android.includes('slug==="@newsletter"?<View')&&
  files.originalNav.includes("CG-19 owns any real opt-in receipt")]
];
// Same original editorial business source; public mobile CMS viewer does not
// satisfy the protected Foundation staff Web-to-Internal-Android requirement.
const nativeCmsSyntax=ts.createSourceFile(
 "apps/android-internal/src/features/cms/native-cms-editorial.tsx",
 internalCms,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
checks.push(["Existing CG18 native CMS TSX parses",
 nativeCmsSyntax.parseDiagnostics.length===0]);
checks.push(["Non-home CMS payload must omit forbidden navigation key",
 internalCms.includes('...(v.kind==="HOME"&&v.navigation?{navigation:v.navigation}:{})')&&
 files.backend.includes('kind!=="HOME"&&v.navigation!==undefined')]);
const nativeCmsMediaSyntax=ts.createSourceFile(
 "apps/android-internal/src/features/cms/native-cms-media-uploader.tsx",
 internalMedia,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
checks.push(["Original CG18 native CMS CG19 media syntax parses",
 nativeCmsMediaSyntax.parseDiagnostics.length===0]);
checks.push(["Original CG19 private scanner media is attached only to unpublished CMS drafts",
 internalMedia.includes('"/api/cms/media/"')&&
 internalMedia.includes('"/confirm"')&&
 internalMedia.includes("cleanVerified")&&
 internalMedia.includes("rightsConfirmed:true")&&
 internalCms.includes('<NativeCmsMediaUploader token={token}')&&
 internalCms.includes('selected.status==="DRAFT"')]);
// Original CG18 editor UX must not offer an invalid role, position, or
// file kind that the existing backend refuses or silently excludes.
checks.push(["Native CMS media choices follow existing authored sections and save contract",
 internalCms.includes("sections={draft.sections}")&&
 internalMedia.includes("placementChoices(sections)")&&
 internalMedia.includes('section.kind==="RICH_TEXT"&&f.variant==="SPLIT"')&&
 internalMedia.includes('section.kind==="FEATURE_CARDS"&&Array.isArray(f.cards)')&&
 internalMedia.includes('section.kind==="COMPLIANCE_FACTS"&&Array.isArray(f.documents)')&&
 internalMedia.includes('const selectedChoice=choices.find')&&
 internalMedia.includes('!selectedChoice')&&
 files.backend.includes('if(!placementFits(sections,a))')]);
checks.push(["Native gallery photo/video/PDF picker follows authored mediaType",
 internalMedia.includes('if(type==="PHOTO")add("GALLERY",i,images)')&&
 internalMedia.includes('else if(type==="VIDEO")add("GALLERY",i,["video/mp4"])')&&
 internalMedia.includes('else if(type==="PUBLICATION")add("GALLERY",i,["application/pdf"])')&&
 internalMedia.includes('!mime.includes(picked.mime)')&&
 files.backend.includes('item?.mediaType==="VIDEO"?mime==="video/mp4"')]);
checks.push(["Web and Internal Android keep confirmed CMS writes confirmed when later read fails",
 internalCms.includes("The server has definitively committed THIS command")&&
 internalCms.includes("}catch(refreshError){")&&
 internalCms.includes("setSelected(null);setDraft(null);")&&
 internalCms.includes("A list GET is not proof that an earlier uncertain write was ours.")&&
 internalCms.includes("void open(p.pageRef).catch(readFailure)")&&
 files.adminExtended.includes("A positively acknowledged original write is never made uncertain")&&
 files.adminExtended.includes('setPending(null);setNotice("Confirmed: "')&&
 files.adminExtended.includes("setSelected(null);")&&
 files.adminExtended.includes("if(busy||pending")]);
checks.push(["Web and native CG18 original gallery uploads cannot bypass authored mediaType",
 files.adminExtended.includes('const allowedForCurrentPlacement=()=>')&&
 files.adminExtended.includes('media==="PHOTO"?image:media==="VIDEO"?["video/mp4"]')&&
 files.adminExtended.includes('media==="PUBLICATION"?["application/pdf"]:[]')&&
 files.adminExtended.includes('allowedForCurrentPlacement().join(",")')&&
 files.adminExtended.includes('const allowed=allowedForCurrentPlacement()')&&
 internalMedia.includes('if(type==="PHOTO")add("GALLERY",i,images)')&&
 files.backend.includes('item?.mediaType==="VIDEO"?mime==="video/mp4"')]);
checks.push(["Confirmed CG18 edit cannot leave stale Web drawer or native create form active",
 files.adminExtended.includes("setSelected(null);setEditorOpen(false);setClosePrompt(false)")&&
 internalCms.includes("setSelected(null);setDraft(null);setNewPage(null)")&&
 internalCms.includes('if(pending||uncertain')&&
 internalCms.includes("same-key retry on this screen.")]);
checks.push(["After a confirmed Web CG03 CMS review, busy-state inbox refresh is allowed but no uncertain new action",
 files.admin.includes("async function showInbox(afterConfirmedDecision=false)")&&
 files.admin.includes("if(busy&&!afterConfirmedDecision)return;")&&
 (files.admin.includes("if(pending&&!afterConfirmedDecision)")||files.admin.includes("if((pending||mediaAttempt.current)&&!afterConfirmedDecision)"))&&
 files.admin.includes("await showInbox(true);await refresh();")&&
 files.admin.includes("if(busy||pending||!review||reviewPassword.length<8)")]);
checks.push(["Original main CMS Web cannot abandon uncertain CG03 or page mutation key",
 files.admin.includes("Resolve the previous original CMS request using its existing")&&
 files.admin.includes("if(busy||pending||!review||reviewPassword.length<8)")&&
 files.admin.includes("setSelected(null);setDraft(blank")&&
 !files.admin.includes('setDraft(blank("HOME"));setPending(null);setPreview(false)')]);
checks.push(["Original main and extended Web CG19 media uploads reuse exact first intent",
 files.admin.includes("const mediaAttempt=useRef")&&
 files.admin.includes("requestKey:attempt.key")&&
 files.admin.includes('media/"+encodeURIComponent(attempt.uploadRef)')&&
 files.admin.includes("old.fingerprint!==fingerprint")&&
 files.adminExtended.includes("const mediaAttempt=useRef")&&
 files.adminExtended.includes("requestKey:attempt.key")&&
 files.adminExtended.includes('media/"+encodeURIComponent(attempt.uploadRef)')&&
 files.adminExtended.includes("old.fingerprint!==fingerprint")]);
checks.push(["Native CG19 media intent is bound to original page revision and placement",
 internalMedia.includes("original.current.pageRef!==pageRef")&&
 internalMedia.includes("original.current.revisionRef!==revisionRef")&&
 internalMedia.includes("original.current.role!==role")&&
 internalMedia.includes("original.current.order!==selectedChoice.order")&&
 internalMedia.includes("if(original.current||key.current||intent||busy||uncertain)")&&
 internalMedia.includes("Check the previous original CG19 upload before choosing another file.")]);
checks.push(["Uncertain native CG19 upload cannot be lost through CMS page switch",
 internalCms.includes("const [mediaActive,setMediaActive]=useState(false)")&&
 internalCms.includes("if(mediaActive)")&&
 internalCms.includes("onAttemptChange={setMediaActive}")&&
 internalMedia.includes("onAttemptChange(true);")&&
 internalMedia.includes("onAttemptChange(false);")&&
 internalMedia.includes('action("Retry same original upload request",()=>void upload(true)')&&
 internalMedia.includes("original.current.pageRef!==pageRef")]);
checks.push(["Unresolved CG19 private media keeps same-page Web editors recoverable",
 files.admin.includes("if(pending||mediaAttempt.current)")&&
 files.admin.includes("if(busy||pending||mediaAttempt.current)")&&
 files.admin.includes("disabled={busy||!!pending||!!mediaAttempt.current}")&&
 files.adminExtended.includes("if(pending||mediaAttempt.current)")&&
 files.adminExtended.includes("if(busy||pending||mediaAttempt.current)")&&
 files.adminExtended.includes("if(pending||dirty||mediaAttempt.current)")&&
 files.adminExtended.includes("disabled={!!mediaAttempt.current}")]);
checks.push(["Native CG18 media slots are original tappable choices, not technical index input",
 internalMedia.includes("positions.map((position,i)=>")&&
 internalMedia.includes('"Placement "+(i+1)')&&
 internalMedia.includes('selectedChoice?.order===position.order')&&
 internalMedia.includes('const first=choices.find(c=>c.role===role)??choices[0]')&&
 !internalMedia.includes('accessibilityLabel="Editorial placement order"')]);
checks.push(["Original Web CMS article, policy and other supported page kinds can be created on Internal Android",
 internalCms.includes("const initialKind=(kind:NewKind):NewPage=>")&&
 internalCms.includes('perform("create","POST","pages"')&&
 internalCms.includes('canonicalFor(p.kind,p.slug)')&&
 internalCms.includes("newKinds.map")]);
checks.push(["Internal Android CMS editor is real, not a public WebView",
 internalCms.includes('"/api/cms/"')&&
 internalCms.includes("pages/")&&internalCms.includes("/draft")&&
 internalCms.includes("/submit")&&internalCms.includes("/publish")&&
 internalCms.includes("/withdraw")]);
checks.push(["Internal CMS source preserves original media and review approvals",
 internalCms.includes("assets:v.assets")&&
 internalCms.includes("caseRef:selected.approvalCaseRef")&&
 internalCms.includes("expectedVersion:selected.version")]);
checks.push(["Internal Android CMS has current CG01 effective view gating",
 internalMenu.includes('roleActions.includes("cms.content.view")')&&
 internalShell.includes('roleActions.includes("cms.content.view")')&&
 internalShell.includes('canManage={roleActions.includes("cms.content.manage")}')&&
 internalShell.includes('canPublish={roleActions.includes("cms.content.publish")}')]);
// Original CG18/CG03 US001–004 review action parity for a currently
// authorized Foundation actor, not a new CMS reviewer or duplicate approval.
const nativeCmsReviewerSyntax=ts.createSourceFile(
 "native-cms-reviewer.tsx",internalReviewer,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
checks.push(["Existing independent Android CMS reviewer TSX syntax parses",
 nativeCmsReviewerSyntax.parseDiagnostics.length===0]);
checks.push(["Original CG03 reviewer queue, item, and independent decision exist in native CMS",
 internalReviewer.includes('token,"reviews?offset="+offset')&&
 internalReviewer.includes('token,"reviews/"+encodeURIComponent(caseRef)')&&
 internalReviewer.includes('"reviews/"+encodeURIComponent(op.ref)+"/decide')&&
 files.cg03.includes('requireAction(bearer,"approvals.review"')]);
checks.push(["Web and Internal Android independently use the same original approval case",
 files.admin.includes('"reviews/"+review.caseRef+"/decide"')&&
 internalReviewer.includes("requestKey:op.key,expectedRevision:op.version")&&
 internalReviewer.includes("currentPassword:op.password")]);
checks.push(["Reviewer cannot approve a revoked/unverified media source",
 internalReviewer.includes('detail.source.assets.some(asset=>!asset.current)')&&
 internalReviewer.includes("asset.current?")]);
checks.push(["Original native reviewer privately previews scanned CG19 assets by current bearer token",
 internalReviewer.includes('"/api/cms/media/preview/"')&&
 internalReviewer.includes('Authorization:"Bearer "+token')&&
 internalReviewer.includes("bytes.length>max")&&
 internalReviewer.includes("temporary?.delete()")]);
checks.push(["Native CG18 review is role gated and mounted inside real staff CMS editor",
 internalCms.includes('canReview&&<NativeCmsReviewer token={token}')&&
 internalShell.includes('canReview={roleActions.includes("approvals.review")}')&&
 internalMenu.includes('roleActions.includes("cms.content.view")')]);
checks.push(["Native independent reviewer preserves same outcome request key after uncertain network",
 internalReviewer.includes("setPending(op)")&&
 internalReviewer.includes("Retry exact original request")&&
 internalReviewer.includes("requestKey:op.key")]);
// The original CG18 extended parser REQUIRES typed first list items
// (categories/gallery) and bounded structures; empty native arrays must be
// editable with exact existing fields rather than invalid blank-string rows.
checks.push(["Native empty CMS arrays can add original typed gallery/category/FAQ/impact objects",
 internalCms.includes('initialListItem=(name:string,section?:string,group?:string)')&&
 internalCms.includes('name==="categories"&&section==="HEALTHCARE_CATEGORIES"')&&
 internalCms.includes('name==="items"&&section==="GALLERY_GRID"')&&
 internalCms.includes('name==="faqs"')&&
 internalCms.includes('name==="items"&&section==="IMPACT_GROUP"')&&
 internalCms.includes('button("Add "+title(name)+" item"')]);
checks.push(["Native editor preserves real-person consent and original CG18 list limits",
 internalCms.includes('group==="STORIES")v.consentConfirmed=false')&&
 internalCms.includes('name==="faqs"?8')&&
 internalCms.includes('name==="socialLinks"||name==="inquiries"?3')&&
 internalCms.includes('section==="GALLERY_GRID"?12:16')&&
 internalCms.includes('sectionKind={section.kind}')&&
 internalCms.includes('sectionKind={sec.kind}')]);
checks.push(["Existing CG18 typed parser proves native first-item schema",
 files.extended.includes('kind==="HEALTHCARE_CATEGORIES"')&&
 files.extended.includes('kind==="GALLERY_GRID"')&&
 files.extended.includes('kind==="CONTACT_INFO"')]);
// Deployment incident 23-Nov: a source merge is not a CMS publication. This
// checks safe navigation wiring, not actual live publication/DB or rendered UI.
checks.push(["Current Home CG03 approval only controls Member and Volunteer Join visibility",
 files.backend.includes("n.member_join_desired,n.volunteer_join_desired")&&
 files.backend.includes("memberJoin=x?.member_join_desired===true")&&
 files.backend.includes("volunteerJoin=x?.volunteer_join_desired===true")&&
 files.backend.includes('path:memberJoin?"/membership":null')&&
 files.backend.includes('path:volunteerJoin?"/volunteer":null')&&
 files.backend.includes("c.status='OWNER_COMPLETED'")&&
 files.backend.includes("n.status='APPROVED'")]);
checks.push(["Public Web/footer never fabricate fundraiser links",
 files.web.includes('isPublished("/campaigns")?<Link href="/campaigns">Campaigns</Link>')&&
 files.web.includes('isPublished("/donate")?<Link href="/donate">Donate</Link>')&&
 files.web.includes('aria-disabled="true"')]);
checks.push(["Unpublished Home remains non-indexed but exposes truthful shared public shell",
 files.homepage.includes('robots:{index:false,follow:false}')&&
 files.homepage.includes('return <CmsPublicShell navigation={navigation}>')&&
 files.homepage.includes('result.state==="NOT_PUBLISHED"')]);
checks.push(["Public Android accepts only an approved canonical membership/volunteer join path",
 files.android.includes('data.memberJoin?.visible===true&&data.memberJoin?.path==="/membership"')&&
 files.android.includes('data.volunteerJoin?.visible===true&&data.volunteerJoin?.path==="/volunteer"')&&
 files.android.includes('memberJoin&&<CmsButton title="Become a Member"')]);
checks.push(["Public Android CMS CTA navigation matches current canonical join visibility",
 files.android.includes('"/collaboration","/membership","/volunteer","/campaigns"].includes(route)')&&
 files.android.includes('if(route==="/membership")return memberJoin;')&&
 files.android.includes('if(route==="/volunteer")return volunteerJoin;')&&
 files.android.includes('if(!canNavigate(href))return;')&&
 files.android.includes('canNavigate(fields.primaryPath)')&&
 files.android.includes('canNavigate(fields.secondaryPath)')&&
 files.android.includes('canNavigate(fields.path)')&&
 files.android.includes('setMemberJoin(false);setPublishedPaths([]);')]);
checks.push(["Public Web joins use only exact owner destinations",
 files.header.includes('navigation.memberJoin.path==="/membership"')&&
 files.header.includes('navigation.volunteerJoin.path==="/volunteer"')&&
 files.web.includes('const expected=type==="memberJoin"?"/membership":"/volunteer";')&&
 files.web.includes('target?.visible===true&&target.path===expected')]);
checks.push(["Healthcare directory remains discoverable without editorial publication",
 files.header.includes('href={isPublished("/healthcare")?"/healthcare":"/health-network"}')&&
 files.web.includes('href={isPublished("/healthcare")?"/healthcare":"/health-network"}')]);
const ctaRoute=read("apps/web/src/features/cms-public-content/cms-cta-route.ts");
const nativeExtendedCta=read("apps/android-public/src/features/cms/cms-extended-native-screen.tsx");
const canonicalCtaList='["/","/about","/contact","/our-impact","/ngo-information","/gallery","/videos","/publications","/healthcare","/our-work","/upcoming-projects","/collaboration","/membership","/volunteer","/campaigns"]';
checks.push(["CMS hero and promo routes use same fixed cross-channel allowlist",
 [files.backend,ctaRoute,files.android].every(s=>s.includes(canonicalCtaList))&&
 files.backend.includes('path(fields.primaryPath,"primaryPath",kind)')&&
 files.backend.includes('path(fields.secondaryPath,"secondaryPath",kind)')&&
 files.backend.includes('path(fields.path,"path",kind)')&&
 files.admin.includes("isCmsCtaRoute(draft.promoPath.trim())")]);
checks.push(["CMS effective CTA gating preserves join flags, media scope and approved page visibility",
 ctaRoute.includes('navigation.memberJoin.path===value')&&
 ctaRoute.includes('navigation.volunteerJoin.path===value')&&
 ctaRoute.includes('navigation?.publishedRoutes?.some(p=>p.path===required)===true')&&
 files.web.includes('effectiveCmsCtaRoute(href,navigation)')&&
 files.carousel.includes('effectiveCmsCtaRoute(href,navigation)')&&
 files.android.includes('canNavigate={canNavigate}')&&nativeExtendedCta.includes('canNavigate(f.ctaPath)&&')]);
checks.push(["Neutral healthcare editorial CTA still excludes unapproved operational routes",
 files.backend.includes('kind==="HEALTHCARE"&&!["/","/about","/contact"].includes(x)')]);
const initDrafts=read("scripts/initialize-cms-drafts.mjs");
checks.push(["Default CMS onboarding is explicit and uses original draft creation only",
 initDrafts.includes('if(!apply)')&&initDrafts.includes('/api/cms/pages?scope=baseline')&&files.backend.includes('scope==="baseline"')&&files.backend.includes('"CONTACT_INFO","PARTNER_CARDS"]);')&&
 initDrafts.includes('if(existing.has(content.slug))')&&initDrafts.includes('if(r.status===409)')&&
 initDrafts.includes('result.status!=="DRAFT"')&&!initDrafts.includes('/api/cms/pages/submit')&&
 !initDrafts.includes('/api/cms/pages/publish')]);
checks.push(["Reference-derived CMS starter copy remains editable and operational collections stay empty",
 ["Get In Touch","Our Social Partners","Real People. Real Stories. Real Change.","Moments of Hope & Action","Stories in Motion","Publications & Reports","No photos published yet."].every(value=>initDrafts.includes(value))&&
 initDrafts.includes("partners:[]")&&initDrafts.includes("items:[]")&&initDrafts.includes("assets:[]")]);
const firstPublication=read("scripts/verify-cms-first-publication.mjs"),baselinePublisher=read("scripts/publish-cms-baseline.mjs");
checks.push(["First-install approved baseline uses only existing revision/approval publication contract",
 initDrafts.includes("textOnly:true")&&initDrafts.includes('sourceRefs:[]')&&
 files.backend.includes("!slide.text_only")&&files.backend.includes("s.fields.textOnly!==true")&&
 files.admin.includes("projectEnabled")&&internalCms.includes("Keep project directory available")&&
 firstPublication.includes("requiredRoutes")&&firstPublication.includes("publishedRoutes")&&
 baselinePublisher.includes('d.revisionRef!==e.revisionRef')&&baselinePublisher.includes('d.approvalCaseRef!==e.caseRef')&&
 baselinePublisher.includes('d.publicationStatus==="EFFECTIVE"')&&baselinePublisher.includes('"/publish"')&&
 baselinePublisher.includes("d.hasPublicationHistory!==false")&&baselinePublisher.includes("firstPublicationOnly:true")&&
 files.backend.includes("if(v.firstPublicationOnly===true)")&&files.backend.includes("hasPublicationHistory:!!history.rowCount")&&
 !baselinePublisher.includes("/submit")]);
checks.push(["Empty media/impact has no synthetic records and nonempty impact retains required provenance",
 files.extended.includes('source:str(x.source??"","source",180,items.length?3:0)')&&
 files.extended.includes('if(!Array.isArray(x.items)||x.items.length>12)')&&
 files.extended.includes('entry.visible!==false&&!assets.some')&&
 files.extended.includes('if(x.consentConfirmed!==true)')&&
 files.androidExtended.includes("No approved information has been published yet.")]);
const partnershipPage=read("apps/web/src/app/collaboration/page.tsx");
checks.push(["Corporate partnership general narrative uses current CMS content in both public channels",
 initDrafts.includes('heading:"Why Partner With Us?"')&&partnershipPage.includes('approved.filter(s=>s.kind==="RICH_TEXT")')&&
 partnershipPage.includes("narrative.map")&&!partnershipPage.includes("<h3>Community Impact</h3>")&&
 files.android.includes('section.kind==="RICH_TEXT"')&&files.adminExtended.includes("Add partnership text section")]);
const eventsRoute=read("apps/web/src/app/events/page.tsx");
checks.push(["Events reuse the effective CMS article and current CG05 eligibility source",
 files.backend.includes("NOT $3::boolean OR body.structured_fields ? 'sourceEventRef'")&&
 files.backend.includes("NOTICE_CURRENT_SQL+EVENT_CURRENT_SQL")&&
 eventsRoute.includes('publishedCmsArticles("",cursor,true)')&&
 files.header.includes('href="/events"')&&
 files.android.includes('publishedArticles(target==="@events",cursor)')&&
 files.android.includes('loadedTarget!==slug')&&
 files.android.includes('title="Events"')]);
checks.push(["Standalone collaboration enquiry is available without fabricated published partners",
 files.android.includes('slug==="collaboration"&&result.state!=="PUBLISHED"')&&
 files.android.includes('title="Get in touch" onPress={onContact}')&&
 files.android.includes('title="Apply as a healthcare partner" onPress={onPartnerApplication}')&&
 ctaRoute.includes('value==="/collaboration"')&&
 files.android.includes('route==="/collaboration"')]);
const teamOwner=read("apps/backend/src/modules/cg-10-human-resources/application/hr-public-bio-editorial-source.ts");
const teamRoute=read("apps/web/src/app/about/team/page.tsx");
checks.push(["E2E-006 team source and publication revalidation",
 teamOwner.includes("c.consent_status='GRANTED'")&&teamOwner.includes("acc.status='ACTIVE'")&&
 teamOwner.includes('this.identity.assertCurrent(tx,actor,"hr.employees.view")')&&
 files.backend.includes("this.hrPublicBio.currentCards")&&
 files.backend.includes("await this.teamRevisionCurrent")&&
 files.due.includes("await this.teamRevisionEligible")&&
 files.due.split("private async teamRevisionEligible(").length===2&&
 internalCms.split("function TeamSelection(").length===2&&
 internalCms.split("type TeamSource=").length===2&&
 files.admin.includes('"team-sources"')&&internalCms.includes('"team-sources"')&&
 teamRoute.includes('p.consentConfirmed!==true')&&teamRoute.includes('publishedCmsPage("about")')&&
 files.header.includes('href:"/about/team"')&&files.android.includes('slug==="@team"?<NativeTeamDirectory/>')&&
 files.backend.includes('assets:visibleAssets.filter(v=>v.role!=="TEAM")')]);
let errors=0;
for(const [label,ok] of checks){
 console.log((ok?"SOURCE-PRESENT":"SOURCE-FAIL")+": "+label);
 if(!ok)errors++;
}
assert.equal(errors,0,"Source wiring assertions failed");
console.log("CG-18 US-001–004 original website/navigation static source-presence checks are green ONLY if all checks above pass; 76 original runtime QA, live Web/Android/DB, full original URLs, About dropdown and pixel fidelity remain NOT EXECUTED/NOT VERIFIED.");

// E2E-006 current HR name/designation only
const hrPublicBio=read("apps/backend/src/modules/cg-10-human-resources/application/hr-public-bio-editorial-source.ts");

for(const needle of ["c.consent_status='GRANTED'","acc.status='ACTIVE'","b.status='ACTIVE'","c.consent_version","this.branches.projectBranchScope(tx,actor)","c.proof===x.proof"])assert.ok(hrPublicBio.includes(needle),needle);
for(const needle of ["teamSelections(fields.members)","this.hrPublicBio.choices(tx,actor,chosen.map","cards.map(({name,designation})",'a.role==="TEAM"||!placementFits'])assert.ok(files.backend.includes(needle),needle);
assert.ok(files.due.includes("this.teamRevisionEligible(tx,item.foundation_root_id,item.page_revision_id)"));
assert.ok(teamRoute.includes("p.consentConfirmed!==true")&&files.android.includes("function NativeTeamDirectory")&&internalCms.includes("TeamSelection sections="));
