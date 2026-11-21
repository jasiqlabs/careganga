/** CG17 ERP-OFF policy/estimate original US001–US002 QA SOURCE CONTRACT.
 * This script must be executed by the local developer, not CI or release.
 * Static source evidence is NOT PostgreSQL, browser, Android, finance or clinical QA.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const f={
 migration:read("apps/backend/db/migrations/1711_cg17_protected_nonconsultation_policy.sql"),
 originalPolicyMigration:read("apps/backend/db/migrations/1701_cg17_original_assistance_policy_revision.sql"),
 policy:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-assistance-policy.service.ts"),
 review:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-policy-approval.service.ts"),
 reviewedSource:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-assistance-review-source.facade.ts"),
 center:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-verified-center-doctor.facade.ts"),
 controller:read("apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/healthcare-assistance-policy.controller.ts"),
 web:read("apps/web/src/features/healthcare-assistance/healthcare-policy-workspace.tsx"),
 webApproval:read("apps/web/src/features/healthcare-assistance/healthcare-policy-approval-panel.tsx"),
 webApi:read("apps/web/src/app/api/healthcare-assistance/policies/[...parts]/route.ts"),
 native:read("apps/android-internal/src/features/healthcare-assistance/native-healthcare-policy-screen.tsx"),
 nativeApproval:read("apps/android-internal/src/features/healthcare-assistance/native-healthcare-policy-approval.tsx"),
 safe:read("apps/backend/src/core/http/safe-error-copy.ts")
};
const checks=[
 ["Forward-only migration changes consultation-only policy guard with original CG03 proof",
  f.migration.includes("SELECT conname INTO STRICT old_constraint")&&
  f.migration.includes("cg17_nonconsultation_requires_independent_approval")&&
  f.migration.includes("NEW.service_kind<>'CONSULTATION'")&&
  f.migration.includes("d.actor_id<>c.proposer_id")&&
  f.migration.includes("d.fresh_password_verified_at IS NOT NULL")],
 ["Original consultation charge/liability historical guards still remain",
  f.originalPolicyMigration.includes("service_kind='CONSULTATION'")&&
  f.policy.includes('const active=v.serviceKind==="CONSULTATION"&&!full;')],
 ["All nonconsultation service policy revisions require independent original review",
  f.policy.includes("const protectedReview=!active;")&&
  f.policy.includes("if(protectedReview){")&&
  f.reviewedSource.includes('v.service_kind!=="CONSULTATION"')&&
  f.review.includes('service:original.service_kind')&&
  f.review.includes("fixedMinor:original.fixed_minor")],
 ["Original center service capability and doctor-specific scope validated",
  f.center.includes("health_center_capability cap")&&
  f.center.includes("CG14_CENTER_SERVICE_NOT_VERIFIED")&&
  f.policy.includes("this.verified.eligibleService")&&
  f.policy.includes('d.serviceKind!=="CONSULTATION"&&doctorRef!==null')],
 ["Read-only staff estimate uses active original policy and exact paise/caps",
  f.policy.includes("async previewService(")&&
  f.policy.includes('approval_state=\'ACTIVE\'')&&
  f.policy.includes("gross*BigInt(policy.percent_basis_points)+5000n")&&
  f.policy.includes("estimateOnly:true")&&
  f.policy.includes("invoiceVerified:false")&&
  f.policy.includes("foundationLiabilityPosted:false")],
 ["Estimate API and strict bounded Next proxy path support the same original action",
  f.controller.includes("serviceEstimate(")&&
  f.webApi.includes('parts[2]==="services"')&&
  f.webApi.includes('url.searchParams.set("grossMinor",gross)')],
 ["Web/Internal Android render same estimate and keep technical identifiers hidden",
  f.web.includes("previewPartnerService")&&f.native.includes("previewPartnerService")&&
  f.web.includes("serviceEstimate.caution")&&f.native.includes("serviceEstimate.caution")&&
  !f.web.includes("Enter policyRef")&&!f.native.includes("Enter policyRef")],
 ["Protected review copy supports a genuine fixed or percentage policy on both staff clients",
  f.webApproval.includes('selected.source.mode==="PERCENT"')&&
  f.nativeApproval.includes('detail.source.mode==="PERCENT"')&&
  f.webApproval.includes("Protected healthcare contribution")&&
  f.nativeApproval.includes("Protected healthcare contribution")],
 ["New center service restriction is present in the single safe-error catalog",
  f.safe.includes("CG14_CENTER_SERVICE_NOT_VERIFIED:")]
];
let failed=0;
for(const [name,pass] of checks){
 console.log((pass?"SOURCE_ASSERTION_OK":"SOURCE_GAP")+": "+name);
 if(!pass)failed++;
}
console.log("Original CG17 ERP-OFF policy source checks "+(checks.length-failed)+"/"+checks.length+
 ". The original 68 QA IDs, real PostgreSQL, browser/Android, patient invoice, "+
 "clinical verification, CG09 settlement and independent QA remain unexecuted.");
if(failed)process.exitCode=1;
