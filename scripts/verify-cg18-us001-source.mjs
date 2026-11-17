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
 cg03:read("apps/backend/src/modules/cg-03-registration-approvals/application/cms-publication-approval.service.ts")
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
  files.adminStyles.includes(".cg-cms-banner-row[aria-pressed=")]
];
let errors=0;
for(const [label,ok] of checks){
 console.log((ok?"SOURCE-PRESENT":"SOURCE-FAIL")+": "+label);
 if(!ok)errors++;
}
assert.equal(errors,0,"Source wiring assertions failed");
console.log("CG-18 US-001 static assertions passed; 20 original user-story QA remain NOT EXECUTED.");
