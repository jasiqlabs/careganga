// CG-20 source-only structural trace. Run manually: npm run verify:cg20-source
// This is NOT a DB, device, independent review, visual or runtime QA pass.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=process.cwd();
const text=p=>readFileSync(resolve(root,p),"utf8");
const check=(p,required)=>{const s=text(p);for(const term of required)
 assert.ok(s.includes(term),`${p}: missing ${term}`);return s;};
const backend="apps/backend/src/";
const web="apps/web/src/";
const native="apps/android-internal/src/";
check(backend+"app.module.ts",["MisReportingModule"]);
check(backend+"modules/cg-01-identity-access/domain/capability-catalog.ts",["mis.dashboard.view"]);
check(backend+"modules/cg-20-mis-reporting/mis-reporting.module.ts",[
 "FinanceAccountingModule","DiagnosticsModule","PatientsAppointmentsModule"]);
check(backend+"modules/cg-20-mis-reporting/http/mis-dashboard.controller.ts",[
 '@Get("dashboard")','@Get("options")']);
const service=check(backend+"modules/cg-20-mis-reporting/application/mis-dashboard.service.ts",[
 '"mis.dashboard.view"','diagnostics.summary','patients.readMisTotals',
 '"NO_AUTHORIZED_SOURCES"','"PARTIAL"','"FAILED"','"CG09_POSTED_FINANCE"',
 '"CG16_FOUNDATION_DIAGNOSTICS"','"CG15_APPOINTMENT_STATES"',
 "if(filters.branchRef)throw error"]);
assert.ok(service.includes(".summary(bearer,filters.yearRef,filters.branchRef)"),"CG09 summary owner call missing");
assert.ok(!/\bSELECT\b|\bFROM\s+journal\b/i.test(service),
 "CG20 must not directly query original owner tables");
check(backend+"modules/cg-09-finance-accounting/application/finance-reports.service.ts",[
 "requireFinanceReportBranch","j.status='POSTED'"]);
check(backend+"modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts",[
 'async readMisTotals','"foundation.branches.admin"','WHERE root_realm_id=$1']);
check(web+"app/api/mis/dashboard/route.ts",["cg_staff_session","/api/v1/mis/dashboard","Cache-Control"]);
check(web+"app/api/mis/options/route.ts",["cg_staff_session","/api/v1/mis/options"]);
check(web+"app/(admin)/admin/dashboard/page.tsx",[
 'verifiedActions?.includes("mis.dashboard.view")','<MisDashboardPanel />']);
check(web+"features/mis-reporting/mis-dashboard-panel.tsx",[
 '/api/mis/dashboard','/api/mis/options','All permitted years','allBranches','data.sources.map']);
check(native+"features/dashboard/internal-dashboard-screen.tsx",[
 'roleActions.includes("mis.dashboard.view")','<NativeMisDashboard','onOpenFinance=']);
check(native+"features/mis-reporting/native-mis-dashboard.tsx",[
 'identityRequest("/api/v1/mis/options"','identityRequest("/api/v1/mis/dashboard?"',
 'NativeFinanceOptions','onExpired()','overview.sources.map']);
const publicTree=["apps/android-public/app/index.tsx"];
for(const p of publicTree) assert.ok(!text(p).includes("/api/v1/mis"),
 "Protected Foundation MIS must not be reachable on Public Android");
console.log("CG20 structural source checks passed (NOT runtime QA).");
