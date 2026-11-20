/**
 * CG-16 US-003 Web/native anonymous public lab catalogue SOURCE preflight.
 * This DOES NOT run Postgres, prove price isolation/concurrency, render UI,
 * execute devices, check real licence expiration or mark QA as runtime PASS.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const files=[
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-public-catalog.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/diagnostics-public-catalog.controller.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/diagnostics.module.ts",
 "apps/web/src/features/diagnostics/public-lab-offers.ts",
 "apps/web/src/app/health-network/lab-tests/page.tsx",
 "apps/web/src/app/health-network/page.tsx",
 "apps/android-public/src/features/health-network/public-lab-offer-directory.tsx",
 "apps/android-public/src/features/health-network/public-healthcare-directory.tsx",
 "apps/web/src/features/diagnostics/my-lab-pricing-workspace.tsx",
 "apps/web/src/features/diagnostics/lab-test-master-workspace.tsx"
];
for(const path of files){
 const source=read(path);
 const syntax=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(syntax.parseDiagnostics.length,0,path+": "+syntax.parseDiagnostics.map(
  d=>ts.flattenDiagnosticMessageText(d.messageText,"\n")).join(" | "));
 assert.doesNotMatch(source,/^(<{7}|={7}|>{7})/m,path+": merge marker");
}
const s=read(files[0]),controller=read(files[1]),web=read(files[3]),
 page=read(files[4]),mobile=read(files[6]),oldMobile=read(files[7]);
for(const required of [
 "JOIN health_center_publication pub","pub.generation=c.publication_generation",
 "JOIN cg03_case cg","cg.status='OWNER_COMPLETED'",
 "JOIN cg03_case_decision decision","decision.action='APPROVE'",
 "JOIN cg19_stored_file proof","proof.scan_status='CLEAN_VERIFIED'",
 "proof.revoked_at IS NULL","intent.classification='HEALTH_CENTER_LICENSE'",
 "JOIN lab_center_price_version price","price.status='APPROVED'",
 "price.effective_from<=now()","price.effective_to>now()",
 "m.publication_state='ACTIVE'","c.publication_state='PUBLISHED'",
 "pkg.active_from<=now()","pkg.active_to>now()",
 "NOT EXISTS (SELECT 1 FROM diagnostic_package_line",
 "category.code AS","LIMIT 51 OFFSET $4"
])assert.ok(s.includes(required),"Missing current source proof: "+required);
const sql=s.slice(s.indexOf("const PUBLIC_OFFERS_SQL="),s.indexOf("type OfferRow="));
assert.ok(sql.startsWith("const PUBLIC_OFFERS_SQL="));
assert.doesNotMatch(sql,/\b(?:INSERT INTO|DELETE FROM|UPDATE|JOIN cg15_|JOIN cg17_|JOIN cg09_|JOIN lab_order|JOIN lab_specimen)\b/i,
 "Anonymous public projection crosses clinical or finance owner");
assert.match(s,/new Set\(\["q","category","center","page"\]\)/,
 "Public query must reject unlisted/unsafe keys");
assert.match(controller,/@Get\("offers"\)/,"Public route is not GET-only");
assert.match(controller,/@Get\("facets"\)/,"Source-backed category facets must be available");
assert.match(s,/SELECT DISTINCT category\.code/,"Category facets must reuse active source");
assert.match(controller,/throttle\.hit\(request,"centers"\)/,"Original CG14 ingress rate limiter missing");
assert.doesNotMatch(controller,/@Post|@Patch|@Delete/,"Public route must be read only");
for(const source of [web,mobile]){
 assert.ok(source.includes("/api/v1/public/diagnostics/offers"),
  "Web/native must consume identical source");
 assert.ok(source.includes('cache:"no-store"'),"Do not show withdrawn stale offers");
 assert.ok(source.includes("patientPriceMinor"),"Show actual published partner price");
 assert.ok(source.includes("centerSlug"),"Show exact original center, not provider-wide rates");
 assert.ok(source.includes("validUntilUtc"),"Expose price validity honestly");
 assert.ok(source.includes("UNAVAILABLE")||source.includes('state:"ERROR"'),
  "Show inability to verify current source");
}
assert.match(page,/Lab Tests & Packages|Lab Tests & Prices/,
 "Client-visible approved test category and details must be discoverable");
assert.match(page,/\/healthcare\/centers\//,"Web must reuse CG14 center page");
assert.match(oldMobile,/PublicLabOfferDirectory/,
 "Native healthcare directory must have reachable test tab");
assert.match(read(files[5]),/\/health-network\/lab-tests/,
 "Public CG14 Web directory must link to test offers");
assert.match(read(files[8]),/Preview currently published prices/,
 "Assigned center should link only its live public result");
assert.match(read(files[9]),/Preview this lab/,
 "Foundation should preview original public source, not draft price as paid");
console.log("CG16 US003 SOURCE/PARSE PREFLIGHT PASS — not runtime, device, license expiry or clinical QA");
