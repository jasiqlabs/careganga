/** CG14 mandatory source: basic pharmacy/nursing/procedure information.
 * Source-only check; not real PostgreSQL, Next.js, Expo or device QA.
 * Optional full ERP and patient billing explicitly excluded.
 */
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const s={
 schema:read("apps/backend/db/migrations/1716_cg14_partner_public_service_information.sql"),
 source:read("apps/backend/src/modules/cg-14-healthcare-network/application/partner-public-offers.service.ts"),
 controller:read("apps/backend/src/modules/cg-14-healthcare-network/http/partner-public-offers.controller.ts"),
 module:read("apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts"),
 webBff:read("apps/web/src/app/api/health-network/[...parts]/route.ts"),
 staffWeb:read("apps/web/src/features/health-network/partner-public-offers-workspace.tsx"),
 staffWebOwner:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
 staffWebReview:read("apps/web/src/features/health-network/center-content-publisher-queue.tsx"),
 staffNative:read("apps/android-internal/src/features/health-network/native-partner-public-offers.tsx"),
 staffNativeOwner:read("apps/android-internal/src/features/health-network/native-own-center-portal.tsx"),
 staffNativeReview:read("apps/android-internal/src/features/health-network/native-center-content-publisher.tsx"),
 publicSource:read("apps/web/src/features/health-network/public-directory-source.ts"),
 publicWeb:read("apps/web/src/app/healthcare/centers/[slug]/page.tsx"),
 publicNative:read("apps/android-public/src/features/health-network/native-public-partner-offers.tsx"),
 publicNativeParent:read("apps/android-public/src/features/health-network/public-healthcare-directory.tsx"),
 safe:read("apps/backend/src/core/http/safe-error-copy.ts")
};
const tests=[
 ["Forward-only CG14 public service information has limited original center scope",
  s.schema.includes("CREATE TABLE health_partner_public_offer(")&&
  s.schema.includes("PHARMACY','NURSING','OT")&&
  s.schema.includes("PENDING_REVIEW")&&
  s.schema.includes("indicative_price_minor")&&
  !s.schema.includes("CREATE TABLE inventory")],
 ["Published information is immutable and distinct protected Foundation review is required",
  s.schema.includes("cg14_public_offer_proof")&&
  s.schema.includes("reviewed_by_account<>created_by_account")&&
  s.source.includes('this.reviewer.verifyReviewer(c,a,"approvals.review",true)')&&
  s.source.includes("requireFreshFoundationRootProof")],
 ["Current real CG14 published center/CG03/CG19 scanner verified evidence is checked",
  s.source.includes("JOIN health_center_publication pub")&&
  s.source.includes("cg.case_kind='HEALTH_CENTER_VERIFICATION'")&&
  s.source.includes("proof.scan_status='CLEAN_VERIFIED'")&&
  s.source.includes("offer.status='APPROVED'")],
 ["No ERP stock, prescriptions, bank transactions or automatic discount master",
  !s.schema.includes("CREATE TABLE stock")&&
  !s.schema.includes("CREATE TABLE pharmacy_erp")&&
  !s.source.includes("INSERT INTO patient_charge")&&
  !s.source.includes("INSERT INTO foundation_liability")],
 ["Only assigned verified partner may propose and Foundation publish",
  s.source.includes("this.centers.assertCurrent")&&
  s.source.includes("this.centers.assertFoundationCenter")&&
  s.source.includes('"health.centers.publish"')&&
  s.schema.includes("f.status='ACTIVE'")],
 ["Backend routes and protected staff Next.js BFF support all original actions",
  s.controller.includes('@Get(":centerSlug")')&&
  s.controller.includes('Post("my-centers/:centerRef")')&&
  s.controller.includes('Post("foundation/centers/:centerRef/offers/:offerCode/decision")')&&
  s.module.includes("PartnerPublicOffersService")&&
  s.webBff.includes('parts[0]==="partner-offers"')&&
  s.webBff.includes('cg_staff_session')],
 ["Web and Internal Android support original proposal and protected independent decision",
  s.staffWeb.includes('commit("PROPOSE")')&&
  s.staffWeb.includes('commit("APPROVE",row)')&&
  s.staffNative.includes('save("PROPOSE")')&&
  s.staffNative.includes('save("APPROVE",row)')&&
  s.staffWebOwner.includes('<PartnerPublicOffersWorkspace mode="partner"')&&
  s.staffWebReview.includes('<PartnerPublicOffersWorkspace mode="foundation"')&&
  s.staffNativeOwner.includes('<NativePartnerPublicOffers token={token} mode="partner"')&&
  s.staffNativeReview.includes('<NativePartnerPublicOffers token={token} mode="foundation"')],
 ["Public Web and Public Android use original non-ERP verified center slug",
  s.publicSource.includes("publicPartnerOffers(")&&
  s.publicWeb.includes("publicPartnerOffers(slug)")&&
  s.publicNative.includes("public/health-network/partner-offers/")&&
  s.publicNativeParent.includes("<NativePublicPartnerOffers")],
 ["Displayed prices are only indicative, never entitlement, clinical conclusion or paid transaction",
  s.source.includes("priceConfirmedAtPurchase:false")&&
  s.staffWeb.includes("No inventory")&&
  s.publicNative.includes("No prescription or guaranteed discount")&&
  s.publicWeb.includes("separate verification")],
 ["Staff form errors use central business-safe plain language",
  ["CG14_OFFER_INVALID","CG14_OFFER_DUPLICATE","CG14_OFFER_LIST_LIMIT",
   "CG14_OFFER_UNAVAILABLE","CG14_OFFER_REQUEST_CONFLICT",
   "CG14_OFFER_SERVICE_NOT_VERIFIED","CG14_OFFER_INDEPENDENT_REVIEW_REQUIRED",
   "CG14_OFFER_REVIEW_CHANGED"].every(k=>s.safe.includes(k+":"))]
];
let fails=0;for(const [name,pass] of tests){
 console.log((pass?"SOURCE_ASSERTION_OK":"SOURCE_GAP")+": "+name);
 if(!pass)fails++;
}
console.log("CG14 original ERP-OFF public partner information "+(tests.length-fails)+
 "/"+tests.length+" source checks. PG/TypeScript/Web/Android/device/runtime NOT_RUN.");
if(fails)process.exitCode=1;
