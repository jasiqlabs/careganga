/**
 * CG-20 / US-001–005 manual structural source regression.
 * Run locally from repo root: npm run verify:cg20-source
 * NOTE: Structural presence DOES NOT mean a source story, database, rendered
 * UI, original screenshots, security, performance or device QA has PASSED.
 */
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const root=process.cwd();
const file=(p)=>{
 const full=resolve(root,p);
 assert.ok(existsSync(full),"Missing CG20 source path: "+p);
 return readFileSync(full,"utf8");
};
const contains=(p,words)=>{
 const source=file(p);
 for(const w of words)assert.ok(source.includes(w),p+": missing "+w);
 return source;
};
const backend="apps/backend/src/";
const web="apps/web/src/";
const native="apps/android-internal/src/";
const mis=backend+"modules/cg-20-mis-reporting/";
const cg19=backend+"modules/cg-19-documents-notifications/";
const stage="SOURCE_ONLY_NOT_EXECUTABLE_QA";

// Bootstrap + implemented real owner dependency boundary.
contains(backend+"app.module.ts",["MisReportingModule"]);
contains(mis+"mis-reporting.module.ts",[
 "FinanceAccountingModule","PatientsAppointmentsModule","DocumentsNotificationsModule",
 "MisDashboardService","MisReportSourceService","MisSavedReportService",
 "MisReportRunService","MisReportScheduleService"
]);
const caps=contains(backend+"modules/cg-01-identity-access/domain/capability-catalog.ts",[
 "mis.dashboard.view","mis.reports.view","mis.reports.manage",
 "mis.reports.export","mis.reports.schedule"
]);
const dashboard=contains(mis+"application/mis-dashboard.service.ts",[
 '"mis.dashboard.view"',"this.finance","this.patients","this.diagnostics",
 "sourceAsOf","SUPPRESSED","PARTIAL","FAILED","NO_AUTHORIZED_SOURCES"
]);
assert.ok(!/\bSELECT\b/i.test(dashboard),"CG20 dashboard should use owning source facade");
contains(mis+"http/mis-dashboard.controller.ts",[
 '@Get("dashboard")','@Get("options")'
]);
const source=contains(mis+"application/mis-report-source.service.ts",[
 "parseSafeReport","suppressAppointmentCells","FINANCE_POSTED_LEDGER",
 "FINANCE_POSTED_SUMMARY","FINANCE_POSTED_TREND","APPOINTMENT_STATUS",
 '"mis.reports.view"',"this.finance","this.patients"
]);
assert.ok(!/SELECT\s+.*FROM/i.test(source),"Report templates may not run arbitrary SQL");
const originals=contains(
 backend+"modules/cg-09-finance-accounting/application/finance-reports.service.ts",[
 "requireFinanceReportBranch","j.status='POSTED'","sourceCutoffKind",
 "monthlyMisTrend"
]);
contains(backend+"modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts",[
 "async readMisTotals","async readMisOptions","assertFoundationCenter",
 '"foundation.branches.admin"',"sourceCutoffKind"
]);
contains(backend+"modules/cg-17-healthcare-assistance-settlements/application/monthly-provider-settlement.service.ts",[
 "ownCenterStatement"
]);
// US-002 original API, source-backed Web and native task workflows.
contains(mis+"http/mis-reports.controller.ts",[
 '@Get("templates")','@Post("preview")','@Get("saved")',
 '@Post("runs")','@Get("runs/:runRef/download")',
 '@Get("schedules")','@Post("schedules")'
]);
contains(web+"app/(admin)/admin/mis/page.tsx",[
 'active="mis"','<MisDashboardPanel/>','<MisReportsWorkspace/>',
 '"mis.reports.view"'
]);
contains(web+"shared/foundation-admin-nav.tsx",[
 '"mis"','href: "/admin/mis"','mis.reports.view'
]);
contains(native+"features/dashboard/dashboard-modules.ts",[
 "openMis: () => void","key: \"mis\"",'roleActions.includes("mis.reports.view")'
]);
contains(native+"features/identity-access/staff-authentication-screen.tsx",[
 "setMisOpen","openMis","NativeMisWorkspaceScreen","misOpen",
 '"mis"'
]);
contains(native+"features/mis-reporting/native-mis-workspace-screen.tsx",[
 "NativeMisDashboard","NativeMisReports","onExit"
]);
contains(web+"features/mis-reporting/mis-reports-workspace.tsx",[
 "MisSavedReports","MisReportExports","MisReportSchedules",
 "/api/mis/reports/","FINANCE_POSTED_LEDGER"
]);
contains(native+"features/mis-reporting/native-mis-reports.tsx",[
 "NativeMisSaved","NativeMisExports","NativeMisSchedules",
 "/api/v1/mis/reports/","FINANCE_POSTED_LEDGER"
]);
contains(web+"features/mis-reporting/mis-dashboard-panel.tsx",[
 "/api/mis/dashboard","source.sourceAsOf","mis-safe-error"
]);
contains(native+"features/mis-reporting/native-mis-dashboard.tsx",[
 "/api/v1/mis/dashboard","source.sourceAsOf","NativeMisFinanceTrend"
]);
// US-003: metadata, immutable revisions, private CAS and both screens.
contains(mis+"application/mis-saved-report.service.ts",[
 "cg20_saved_report","cg20_report_definition","cg20_saved_request",
 "requestKey","expectedVersion","REVISE","COPY","RETIRE"
]);
contains(web+"features/mis-reporting/mis-saved-reports.tsx",[
 "Save new private report","Retire selected report","mis-safe-error"
]);
contains(native+"features/mis-reporting/native-mis-saved.tsx",[
 "Save new private report","Retire selected report","native-mis-problem"
]);
// US-004: owned, real bytes, original protected file and clients.
contains(mis+"application/mis-report-run.service.ts",[
 "cg20_report_run","this.files.issueFromReport","this.files.read",
 "validateSource","MIS_RUN_LIMIT","UNKNOWN"
]);
contains(cg19+"application/mis-protected-artifact.service.ts",[
 "cg19_mis_report_artifact","writeVerifiedGeneratedReport",
 "readVerifiedPrivateObject","issueFromReport","current"
]);
contains(cg19+"application/mis-report-renderer.ts",[
 "pdfReport","xlsxReport","csvReport","excelText","CareGanga"
]);
contains(cg19+"infrastructure/verified-private-storage.ts",[
 "reconcileGeneratedReport","writeVerifiedGeneratedReport",
 "lab-generated|mis"
]);
contains(web+"features/mis-reporting/mis-report-exports.tsx",[
 "My protected report exports","Download authorized"
]);
contains(native+"features/mis-reporting/native-mis-exports.tsx",[
 "expo-file-system","file.preview","file?.delete","private report"
]);
// US-005: safe metadata only; NOT a claim of automatic delivery.
const schedules=contains(mis+"application/mis-report-schedule.service.ts",[
 "cg20_report_schedule","'PAUSED'","activationAvailable:false",
 "MIS_SCHEDULE_DELIVERY_NOT_READY","next_due_utc"
]);
assert.ok(!/new\s+(?:Interval|Cron|BackgroundWorker)/.test(schedules));
contains(web+"features/mis-reporting/mis-report-schedules.tsx",[
 "Automatic delivery is not enabled","Save schedule as paused"
]);
contains(native+"features/mis-reporting/native-mis-schedules.tsx",[
 "Automatic delivery is not enabled","Save as paused schedule"
]);
// Actual PostgreSQL migration is a single bounded metadata definition.
const sql=contains("apps/backend/db/migrations/2001_cg20_saved_reports_runs_and_schedules.sql",[
 "CREATE TABLE cg20_report_definition",
 "CREATE TABLE cg20_saved_report","CREATE TABLE cg20_saved_request",
 "CREATE TABLE cg20_report_run","CREATE TABLE cg20_report_schedule",
 "CREATE TABLE cg20_report_delivery_attempt"
]);
for(const name of ["cg20_report_definition","cg20_saved_report","cg20_saved_request",
 "cg20_report_run","cg20_report_schedule","cg20_report_delivery_attempt"]){
 const rx=new RegExp("\\bCREATE TABLE "+name+"\\s*\\(","g");
 assert.equal([...sql.matchAll(rx)].length,1,"Duplicate migration table: "+name);
}
assert.ok(sql.includes("payload_digest ~ '^[a-f0-9]{64}$'"),
 "Schedule payload digest constraint must be complete");
const cg19Sql=file("apps/backend/db/migrations/2002_cg19_protected_mis_artifact.sql");
assert.ok(cg19Sql.includes("cg19_mis_report_artifact")&&
 cg19Sql.includes("fk_cg20_run_original_cg19_file"),
 "CG19 report artifact must be an original protected file");
// Semantic safe exception keys and both frontends share safe rendered copy.
const catalog=file(backend+"core/http/safe-error-copy.ts");
const raw=[
 dashboard,source,
 file(mis+"application/mis-report-run.service.ts"),
 file(mis+"application/mis-saved-report.service.ts"),
 schedules,file(cg19+"application/mis-protected-artifact.service.ts")
].join("\n");
for(const m of raw.matchAll(/\bcode\s*:\s*["']((?:MIS_|CG15_MIS_)[A-Z0-9_]+)["']/g)){
 assert.ok(catalog.includes(m[1]+":"),"Missing safe-message catalog entry: "+m[1]);
}
contains(web+"app/api/mis/reports/private-mis-proxy.ts",["safeMisBffError"]);
contains(native+"features/mis-reporting/native-mis-problem.ts",["nativeMisProblem"]);
// Private/admin context never becomes a public API/screen on public Android.
for(const p of [
 "apps/android-public/app/index.tsx",
 "apps/web/src/app/(public)/page.tsx"
].filter(exists)) {
 const x=file(p);
 assert.ok(!x.includes("/api/v1/mis/")&&!x.includes("MisReportsWorkspace"),
  "Do not expose private MIS to public users: "+p);
}
console.log("CG-20 structural contracts reviewed. "+stage+
 " — TypeScript, SQL, original screenshots, DB and Android device QA NOT_RUN.");
