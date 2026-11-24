/**
 * CG-16 US-001 source-only preflight.
 *
 * This checks current TypeScript/TSX grammar and regression-critical source
 * ownership, privacy and approval boundaries. It cannot prove a PostgreSQL
 * migration, real authorization, race behavior, CG-03 financial/clinical
 * review, browser pixels, Android, release readiness or ANY runtime QA PASS.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const backend="apps/backend/src/modules/cg-16-healthcare-diagnostics/";
const frontend="apps/web/src/features/diagnostics/";
const sources=[
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-catalog-source.facade.ts",
 "apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts",
 backend+"application/diagnostics-catalog.service.ts",
 backend+"application/diagnostics-price-review.service.ts",
 backend+"http/diagnostics-catalog.controller.ts",
 backend+"diagnostics.module.ts",
 "apps/backend/src/app.module.ts",
 frontend+"diagnostic-api.ts",
 frontend+"center-lab-pricing-panel.tsx",
 frontend+"lab-test-master-workspace.tsx",
 frontend+"my-lab-pricing-workspace.tsx",
 "apps/android-internal/src/features/diagnostics/native-lab-pricing-panel.tsx",
 "apps/web/src/app/api/diagnostics/[...parts]/route.ts",
 "apps/web/src/app/(admin)/center/page.tsx",
 "apps/web/src/app/(admin)/admin/health-network/diagnostics/page.tsx",
 "apps/web/src/app/(admin)/admin/health-network/lab-pricing/page.tsx",
 "apps/web/src/features/health-network/center-draft-portal.tsx",
 "apps/web/src/shared/foundation-admin-nav.tsx",
 "apps/web/src/shared/healthcare-admin-shell.tsx"
];
for(const path of sources){
 const text=read(path);
 const kind=path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 const sf=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,kind);
 const problems=sf.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));
 assert.equal(problems.length,0,path+": TypeScript/JSX parse errors: "+problems.join(" | "));
 assert.doesNotMatch(text,/^(<{7}|={7}|>{7})/m,path+": merge-conflict marker");
}
const sql=read("apps/backend/db/migrations/1601_cg16_lab_test_catalog_and_center_prices.sql");
for(const name of [
 "CREATE TABLE test_category","CREATE TABLE diagnostic_test (",
 "CREATE TABLE diagnostic_test_revision","CREATE TABLE diagnostic_package (",
 "CREATE TABLE diagnostic_package_revision","CREATE TABLE diagnostic_package_line",
 "CREATE TABLE lab_center_test_mapping","CREATE TABLE lab_center_price_version",
 "CREATE TABLE lab_catalog_command","CREATE TABLE lab_catalog_event",
 "CREATE TABLE lab_center_price_window_event",
 "cg16_approved_price_no_overlap","cg16_approved_price_immutable",
 "cg16_price_window_event_frozen","CHECK(active_to IS NULL OR active_to>active_from)"
]){
 assert.ok(sql.includes(name),"CG16 expected schema ownership is missing: "+name);
}
assert.match(sql,/EXCLUDE USING gist/,"real price overlap DB constraint missing");
assert.match(sql,/FOREIGN KEY\(root_realm_id,center_ref\)/,
 "center mapped to CG14 original root owner");
const service=read(backend+"application/diagnostics-catalog.service.ts");
const publicSource=read(backend+"application/diagnostics-public-catalog.service.ts");
const validity=read("apps/backend/db/migrations/1603_cg16_test_master_validity.sql");
const cg14=read(sources[0]);
const cg14Center=read("apps/backend/src/modules/cg-14-healthcare-network/application/health-network.service.ts");
const cg14Review=read("apps/backend/src/modules/cg-14-healthcare-network/application/health-review-workflow.service.ts");
const cg14Expiry=read("apps/backend/db/migrations/1422_cg14_diagnostic_center_license_validity.sql");
const cg14Editor=read("apps/web/src/features/health-network/center-editor.tsx");
const cg14ReviewInbox=read("apps/web/src/features/health-network/health-review-inbox.tsx");
const bff=read("apps/web/src/app/api/diagnostics/[...parts]/route.ts");
const permissions=read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts");
assert.match(service,/this\.identity\.assertCurrent/,"current CG01 grant guard missing");
assert.match(service,/CG14_CURRENT_LAB_EVIDENCE_SQL/,"CG14 validated lab evidence missing");
assert.match(cg14,/HEALTH_CENTER_VERIFICATION/,"original CG03 center review missing");
assert.match(cg14,/CLEAN_VERIFIED/,"CG19 scan/clean proof missing");
assert.match(cg14,/HEALTH_CENTER_LICENSE/,"CG19 original license classification missing");

assert.match(cg14Expiry,/diagnostic_license_valid_through date/,
 "CG14 source-owned real diagnostic license expiry column missing");
assert.match(cg14Center,/diagnosticLicenseValidThrough/,
 "CG14 pending draft and calendar validator must retain original date");
assert.match(cg14Review,/diagnostic_license_current/,
 "CG14 original submit and CG03 final apply must recheck actual expiry");
assert.match(cg14Review,/source_snapshot->>'diagnosticLicenseValidThrough'/,
 "Original approved source date must be rechecked before finalization");
assert.match(cg14,/rev\.revision_no=\(SELECT MAX\(latest\.revision_no\)/,
 "Do not accept older CG14 license proof after latest center revision");
assert.match(cg14,/diagnostic_license_valid_through >=/,
 "Protected center lab finder must reject expired licence");
assert.match(publicSource,/diagnostic_license_valid_through >=/,
 "Public lab offers must not leak revoked or expired license prices");
assert.match(service,/diagnostic_license_valid_through >=/,
 "Published KPI must exclude expired or unknown lab certificate");
assert.match(cg14Editor,/Diagnostic licence valid through/,
 "Real source expiry field missing from original CG14 Web form");
assert.match(cg14ReviewInbox,/Compare the/,
 "Reviewers must inspect declared expiry against protected original proof");

assert.match(service,/this\.lab\.assertLab/,"scoped lab source reader missing");
assert.match(service,/this\.command\(tx,actor/,"idempotent source command missing");
assert.match(service,/this\.done\(tx,actor/,"immutable command result/audit missing");
assert.match(service,/assertPackagePriceWindow/,"package price effective window guard missing");
assert.match(service,/publishedOffers/,"source-backed H09 published KPI missing");
assert.match(service,/health_center_publication pub/,"actual original public publication missing");
assert.match(service,/lab_center_price_window_event/,
 "audited supersession of approved tariff missing");
assert.match(validity,/cg16_test_valid_window/,"Test source effective window missing");
assert.match(service,/active_from<=now\(\)/,"Test source activation guard missing");
assert.match(service,/active_to>now\(\)/,"Test source expiry guard missing");
assert.match(service,/this\.priceReviews\.create\(tx,actor/,"CG03 case must be submitted on proposed price");
assert.match(service,/this\.priceReviews\.decide\(tx,actor/,"Original case decision must approve tariff");
assert.match(service,/this\.priceReviews\.finish\(tx,actor/,"CG03 original owner case must finalize");
assert.match(service,/pricingReview\.status='OWNER_COMPLETED'/,
 "H09 public total must exclude tariffs without completed CG03 approval");
assert.match(publicSource,/pricingReview\.status='OWNER_COMPLETED'/,
 "Public lab offers must exclude unreviewed commercial tariffs");
assert.match(publicSource,/component\.active_to IS NOT NULL/,
 "Public package offers must hide expired tests");
assert.match(service,/new Date\(data\.from\)/,"Price validity must follow original source timeline");
assert.match(service,/Package member dates may have been shortened/,
 "Package effective price must recheck its constituent test validity");

const caseMigration=read("apps/backend/db/migrations/1602_cg16_original_cg03_lab_price_review.sql");
const priceCase=read(backend+"application/diagnostics-price-review.service.ts");
for(const expected of [
 "HEALTH_LAB_PRICE_REVIEW","cg03_lab_price_only_source",
 "cg03_case_finance_source_disjoint","cg03_health_process_current_case_kind_check",
 "fk_cg03_original_lab_price","cg16_cg03_lab_price_frozen",
 "cg16_price_cg03_review_guard","cg16_price_requires_cg03_decision",
 "d.fresh_password_verified_at IS NOT NULL",
 "d.actor_id<>c.proposer_id","d.accepted_case_revision=c.revision"
])assert.ok(caseMigration.includes(expected),
 "CG03 real price case DB guard missing: "+expected);
assert.match(service,/priceReviews\.create\(tx,actor/,
 "Every price proposal must create original CG03 case in same TX");
assert.match(service,/priceReviews\.decide\(tx,actor/,
 "Direct tariff approval must have original CG03 review");
assert.match(service,/priceReviews\.finish\(tx,actor/,
 "Original CG03 case must be finished with owner effect");
assert.match(service,/sessions\.limitFoundationRootProof\(actor\)/,
 "Fresh root proof attempt rate limit required");
assert.match(service,/sessions\.requireAction\(bearer,"approvals.review"\)/,
 "No price review without original CG03 reviewer action");
assert.match(priceCase,/requireDistinctFinalReviewer/,
 "Price approval must require other eligible protected reviewer");
assert.match(priceCase,/verifyReviewer\(tx,actor,"approvals.review",true\)/,
 "Protected independent CG03 reviewer current role guard missing");
assert.match(priceCase,/requireFreshFoundationRootProof\(tx,actor,input.currentPassword\)/,
 "Real credential challenge in review commit missing");
assert.match(priceCase,/priceSourceDigest\(p\)/,
 "Unchanged original price revision must be checked at approval");
assert.match(priceCase,/INSERT INTO cg03_case_decision/,
 "CG03 original immutable decision/event missing");
assert.match(priceCase,/OWNER_COMPLETED/,
 "Approved price must finalize original CG03 case");

assert.match(bff,/get\("cg_staff_session"\)/,"staff session ownership missing");
assert.match(bff,/req\.headers\.get\("origin"\)!==req\.nextUrl\.origin/,
 "same-origin write guard missing");
assert.match(permissions,/key:"diagnostics\.catalog\.view"/,"CG01 catalogue permission missing");
assert.match(permissions,/key:"diagnostics\.pricing\.manage"/,"CG01 pricing permission missing");
assert.match(permissions,/key:"diagnostics\.pricing\.approve"[^}]+assignable:false/,
 "sensitive price approval must not be assignable outside protected reviewer");
const admin=read(frontend+"lab-test-master-workspace.tsx");
const own=read(frontend+"center-lab-pricing-panel.tsx");
assert.match(admin,/Average Current Patient Price/,"H09 true commercial-price KPI missing");
assert.match(admin,/Current Published Offers/,"H09 source published count missing");
assert.match(admin,/writeUncertain/,"unknown-outcome protection missing");
assert.match(admin,/reviewPassword/,"CG03 review password field missing");
assert.match(admin,/expectedCaseRevision/,"CG03 case revision source CAS missing");
assert.match(admin,/reviewReference/,"Human-readable original case number missing");
assert.match(own,/my-centers\//,"own-center route missing");
assert.doesNotMatch(service,/\bINSERT INTO cg09_|\bUPDATE cg09_|\bINSERT INTO cg17_/,
 "catalogue must never infer patient payment or Foundation assistance");
// H09: filter authorized center tariffs before paging; no global price master.
const h09Pricing=read(backend+"application/diagnostics-catalog.service.ts");
assert.ok(h09Pricing.includes("AND ($4::text='' OR pr.status::text=$4"));
assert.ok(h09Pricing.includes("LIMIT 101 OFFSET $5"));
for(const path of [frontend+"lab-test-master-workspace.tsx",frontend+"center-lab-pricing-panel.tsx","apps/android-internal/src/features/diagnostics/native-lab-pricing-panel.tsx"]){
 const surface=read(path);
 assert.ok(surface.includes("priceStatus:filter.status"),path+" actual price status filter");
 assert.ok(surface.includes("nextPriceOffset"),path+" price paging");
}
console.log("CG16 US001 SOURCE/PARSE GUARDS PASS — CG03 source contract exists; no migration, auth, review, browser or clinical runtime QA performed");
