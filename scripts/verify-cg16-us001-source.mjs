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
 backend+"http/diagnostics-catalog.controller.ts",
 backend+"diagnostics.module.ts",
 "apps/backend/src/app.module.ts",
 frontend+"diagnostic-api.ts",
 frontend+"center-lab-pricing-panel.tsx",
 frontend+"lab-test-master-workspace.tsx",
 frontend+"my-lab-pricing-workspace.tsx",
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
const cg14=read(sources[0]);
const bff=read("apps/web/src/app/api/diagnostics/[...parts]/route.ts");
const permissions=read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts");
assert.match(service,/this\.identity\.assertCurrent/,"current CG01 grant guard missing");
assert.match(service,/CG14_CURRENT_LAB_EVIDENCE_SQL/,"CG14 validated lab evidence missing");
assert.match(cg14,/HEALTH_CENTER_VERIFICATION/,"original CG03 center review missing");
assert.match(cg14,/CLEAN_VERIFIED/,"CG19 scan/clean proof missing");
assert.match(cg14,/HEALTH_CENTER_LICENSE/,"CG19 original license classification missing");
assert.match(service,/this\.lab\.assertLab/,"scoped lab source reader missing");
assert.match(service,/this\.command\(tx,actor/,"idempotent source command missing");
assert.match(service,/this\.done\(tx,actor/,"immutable command result/audit missing");
assert.match(service,/assertPackagePriceWindow/,"package price effective window guard missing");
assert.match(service,/publishedOffers/,"source-backed H09 published KPI missing");
assert.match(service,/health_center_publication pub/,"actual original public publication missing");
assert.match(service,/lab_center_price_window_event/,
 "audited supersession of approved tariff missing");
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
assert.match(own,/my-centers\//,"own-center route missing");
assert.doesNotMatch(service,/\bINSERT INTO cg09_|\bUPDATE cg09_|\bINSERT INTO cg17_/,
 "catalogue must never infer patient payment or Foundation assistance");
console.log("CG16 US001 SOURCE/PARSE GUARDS PASS — not runtime QA, not CG03 price-case approval, not clinical validation");
