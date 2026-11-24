/**
 * CG-20 / US-001–005 manual structural source regression.
 * Run locally from repo root: npm run verify:cg20-source
 * NOTE: Structural presence DOES NOT mean a source story, database, rendered
 * UI, original screenshots, security, performance or device QA has PASSED.
 */
import assert from "node:assert/strict";
import {readFileSync,existsSync,readdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
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
 "MisReportRunService","MisReportScheduleService","MisReportScheduleWorker"
]);
const caps=contains(backend+"modules/cg-01-identity-access/domain/capability-catalog.ts",[
 "mis.dashboard.view","mis.reports.view","mis.reports.manage",
 "mis.reports.export","mis.reports.schedule"
]);
const dashboard=contains(mis+"application/mis-dashboard.service.ts",[
 '"mis.dashboard.view"',"this.finance","this.patients","this.diagnostics",
 "sourceAsOf","SUPPRESSED","PARTIAL","FAILED","NO_AUTHORIZED_SOURCES"
]);
assert.ok(!/\bSELECT\s+.*FROM\b/i.test(dashboard),"CG20 dashboard should use owning source facade");
assert.ok(dashboard.includes('this.operations.read(bearer,"PERMITTED")')&&dashboard.includes('sourceAsOf:x.asOf')&&dashboard.includes('CG05_PROJECT_OPERATIONS'),"CG20 overview must use current scoped CG05 operational counts");

contains(mis+"http/mis-dashboard.controller.ts",[
 '@Get("dashboard")','@Get("options")'
]);
const source=contains(mis+"application/mis-report-source.service.ts",[
 "parseSafeReport","suppressAppointmentCells","FINANCE_POSTED_LEDGER",
 "FINANCE_POSTED_SUMMARY","FINANCE_POSTED_TREND","FINANCE_POSTED_GROUPED",
 "APPOINTMENT_STATUS","APPOINTMENT_STATUS_GROUPED","APPOINTMENT_DOCTOR_SUMMARY",
 "PLATFORM_AUDIT_ACTIVITY","DIAGNOSTICS_CATALOG_SUMMARY",
 "previewScheduledFinance","Date.parse(fromDay","Date.parse(untilDay",
 '"mis.reports.view"',"this.finance","this.patients"
]);
assert.ok(!/SELECT\s+.*FROM/i.test(source),"Report templates may not run arbitrary SQL");
contains(backend+"modules/cg-06-beneficiaries-assistance/application/beneficiary-report.service.ts",["async misSummary(token:string,branchRef?:string","this.beneficiaries.reportScope(tx,a,parseListQuery(raw))","total-recipients.recipients","sensitive.some(v=>v>0&&v<5)"]);
assert.ok(source.includes("this.beneficiaries.misSummary(token,q.branchRef,q.fromDay,q.untilDay)")&&source.includes("BENEFICIARY_ASSISTANCE_SUMMARY"),"Live beneficiary report must consume only the original scoped aggregate");
contains(backend+"modules/cg-04-membership-volunteers/application/membership-roster.service.ts",["async misCounts(token:string,branch?:string","app.consent_version=\'MEMBERSHIP_V1\'","membership.members.view","this.branches.projectBranch(tx,a,f.branch)"]);
contains(backend+"modules/cg-04-membership-volunteers/application/volunteer-roster.service.ts",["async misCounts(token:string,branch?:string","app.consent_version=\'VOLUNTEER_V1\'","volunteers.view","this.branches.projectBranch(tx,a,f.branch)"]);
contains(backend+"modules/cg-07-campaigns-donations/application/donation-admin.service.ts",["private async verifiedSummary","j.immutable_payload_digest=e.immutable_digest","rec.source_digest=e.immutable_digest","j.immutable_source_event_key=r.approval_request_key",'this.ensureReportScopeStillCurrent(bearer,"ALL",scope)',"this.verifiedSummary(actor.realmId,scope,f.branchRef)"]);
assert.ok(source.includes("this.donations.misSummary(token)")&&source.includes("rows:x.requiresReview||x.total===0?[]")&&dashboard.includes("this.donations.misSummary(bearer)")&&dashboard.includes("if(x.requiresReview)throw Error"),"Donation reports must withhold unverified totals and use original reconciled source");
contains(backend+"modules/cg-08-csr-funding/application/csr-funding-reports.service.ts",["csr.all&&finances.all","currentCsr.all","requireFinanceActiveBranch(tx,actor,id","transaction_timestamp() AS at","this.report(bearer,raw,1001)","report.hasMore||report.items.some","REVALIDATION_REQUIRED"]);
assert.ok(source.includes("this.csr.misSummary(token")&&source.includes("CSR_FUNDING_SUMMARY")&&source.includes('finance.ready&&await permission("csr.partners.view")')&&source.includes('rows:x.state==="READY"&&x.totals?'),"CSR MIS must retain verified owner scope and withhold incomplete funding totals");
assert.ok(source.includes("this.members.misCounts(token,q.branchRef,q.fromDay,q.untilDay)")&&source.includes("this.volunteers.misCounts(token,q.branchRef,q.fromDay,q.untilDay)")&&source.includes('this.payroll.dashboard(token,q.payrollMonth??"",q.branchRef??"")')&&source.includes('permission("payroll.runs.view")&&await permission("payroll.compensation.view")'),"MIS must retain original owner status scope");

contains(mis+"application/mis-report-run.service.ts",['LIVE_PREVIEW_KINDS.includes(request.kind)','MIS_LIVE_PREVIEW_ONLY']);
contains(mis+"application/mis-saved-report.service.ts",['LIVE_PREVIEW_KINDS.includes(request.kind)','MIS_LIVE_PREVIEW_ONLY']);
const originals=contains(
 backend+"modules/cg-09-finance-accounting/application/finance-reports.service.ts",[
 "requireFinanceReportBranch","j.status='POSTED'","sourceCutoffKind",
 "monthlyMisTrend","groupedMis","scheduledSummary"
]);
contains(backend+"modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts",[
 "async readMisTotals","async readMisDoctorGroups","async readMisOptions","assertFoundationCenter",
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
 "MisSavedReports","MisReportExports","MisReportSchedules","MisAppointmentGroupBars",
 "/api/mis/reports/","FINANCE_POSTED_LEDGER"
]);
contains(native+"features/mis-reporting/native-mis-reports.tsx",[
 "NativeMisSaved","NativeMisExports","NativeMisSchedules","NativeMisAppointmentGroupBars",
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
 "requestKey","expectedVersion","REVISE","COPY","RETIRE",
 "cg20_saved_report_grant","async grant(","async ownedGrants(",
 "async sharedWithMe(","FOR SHARE"
]);
contains(backend+"modules/cg-01-identity-access/application/session.service.ts",[
 "eligibleMisShareRecipients","mis.reports.share"
]);
contains(web+"features/mis-reporting/mis-shared-definitions.tsx",[
 "shared-with-me","share-recipients","/grants","/share","/copy"
]);
contains(native+"features/mis-reporting/native-mis-shared-definitions.tsx",[
 "shared-with-me","share-recipients","/grants","/share","/copy"
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
 "validateSource","MIS_RUN_LIMIT","UNKNOWN",
 "row.state===\"UNKNOWN\"","15 minutes","postDigest",
 "MIS_RUN_PARTIAL","ORIGINAL_ARTIFACT_UNCONFIRMED"
]);
contains(cg19+"application/mis-protected-artifact.service.ts",[
 "cg19_mis_report_artifact","writeVerifiedGeneratedReport",
 "readVerifiedPrivateObject","issueFromReport","mis.reports.export"
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
 "expo-file-system","file.preview","file?.delete","Protected file"
]);
// US-005: real authorized CG09 posted finance summaries and verified
// CG19 IN_APP notices only. Other sources/channels are NOT enabled.
const schedules=contains(mis+"application/mis-report-schedule.service.ts",[
 "cg20_report_schedule","activationAvailable:true","'ACTIVE'",
 "saved_revision","annual_month","nextScheduleOccurrence",
 "async edit(","async resume(","async pause(","next_due_utc"
]);
contains(mis+"infrastructure/mis-report-schedule.worker.ts",[
 "OnModuleInit","SKIP LOCKED","previewScheduledFinance",
 "issueScheduledFinance","publishReady","saved_revision","CURRENT_SCOPE_CHANGED",
 "run.root_realm_id=stale.root_realm_id","state='SENT_PENDING'",
 "retry_count=retry_count+1","retry_count<3","UNKNOWN"
]);
contains(cg19+"application/mis-report-notice.service.ts",[
 "publishReady","CG20_MIS_REPORT","cg20_report_delivery_attempt",
 "requireScheduledFinanceReportBranch","CONFIRMED"
]);
contains(cg19+"application/notification.service.ts",[
 "currentMisNoticeScope","n.source_kind<>'CG20_MIS_REPORT'","scope.branches"
]);
contains(web+"features/mis-reporting/mis-report-schedules.tsx",[
 "Create active in-app schedule","Resume with current permissions","Edit",
 "deliveryState"
]);
contains(native+"features/mis-reporting/native-mis-schedules.tsx",[
 "Create active in-app schedule","Resume with current permissions","Edit schedule",
 "deliveryState"
]);
// Actual PostgreSQL migration is a single bounded metadata definition.
const sql=contains("apps/backend/db/migrations/2001_cg20_saved_reports_runs_and_schedules.sql",[
 "CREATE TABLE cg20_report_definition",
 "CREATE TABLE cg20_saved_report","CREATE TABLE cg20_saved_request",
 "CREATE TABLE cg20_report_run","CREATE TABLE cg20_report_schedule",
 "CREATE TABLE cg20_report_delivery_attempt","CREATE TABLE cg20_saved_report_grant",
 "saved_revision integer NOT NULL","DIAGNOSTICS_CATALOG_SUMMARY",
 "retry_count smallint NOT NULL DEFAULT 0"
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
].filter(p=>existsSync(resolve(root,p)))) {
 const x=file(p);
 assert.ok(!x.includes("/api/v1/mis/")&&!x.includes("MisReportsWorkspace"),
  "Do not expose private MIS to public users: "+p);
}
// US-001–005 Web and Internal Android parity means actual source components,
// endpoints and allowed interactions exist on both staff channels, not that
// they visually rendered or compiled in this script.
const pairedScreens=[
 [web+"features/mis-reporting/mis-dashboard-panel.tsx",
  native+"features/mis-reporting/native-mis-dashboard.tsx",
  ["sourceAsOf","mis"],["sourceAsOf","NativeMisFinanceTrend"]],
 [web+"features/mis-reporting/mis-reports-workspace.tsx",
  native+"features/mis-reporting/native-mis-reports.tsx",
  ["MisSavedReports","MisReportExports","MisReportSchedules","SOURCE_UNAVAILABLE"],
  ["NativeMisSaved","NativeMisExports","NativeMisSchedules","SOURCE_UNAVAILABLE"]],
 [web+"features/mis-reporting/mis-saved-reports.tsx",
  native+"features/mis-reporting/native-mis-saved.tsx",
  ["CREATE","REVISE","COPY","RETIRE"],
  ["CREATE","REVISE","COPY","RETIRE"]],
 [web+"features/mis-reporting/mis-report-exports.tsx",
  native+"features/mis-reporting/native-mis-exports.tsx",
  ["PDF","XLSX","CSV","runs"],
  ["PDF","XLSX","CSV","runs"]],
 [web+"features/mis-reporting/mis-report-schedules.tsx",
  native+"features/mis-reporting/native-mis-schedules.tsx",
  ["Create active in-app schedule","Resume with current permissions","deliveryState"],
  ["Create active in-app schedule","Resume with current permissions","deliveryState"]]
];
for(const [webPath,nativePath,webTerms,nativeTerms] of pairedScreens){
 contains(webPath,webTerms);
 contains(nativePath,nativeTerms);
}

// C46 period shortcuts and source-valid server filters exist on both private
// staff channels, not in the public Android or public website.
contains(web+"features/mis-reporting/mis-reports-workspace.tsx",[
 "This week (Monday onward)","This calendar year",
 "PLATFORM_AUDIT_ACTIVITY","setPreset"
]);
contains(native+"features/mis-reporting/native-mis-reports.tsx",[
 "This week (Monday onward)","This calendar year",
 "PLATFORM_AUDIT_ACTIVITY","setPreset"
]);
// CG-20 account/center reporting cross-channel: same original CG17 source,
// not a duplicate report-derived financial master.
contains(web+"features/healthcare-assistance/center-monthly-settlement-summary.tsx",
 ["centerRef"]);
contains(native+"features/mis-reporting/native-own-center-mis.tsx",
 ["centerRef","provider-settlements/my-centers/"]);
contains(web+"features/health-network/center-draft-portal.tsx",
 ["CenterMonthlySettlementSummary"]);
contains(native+"features/health-network/native-own-center-portal.tsx",
 ["NativeOwnCenterMis"]);

// Statical import-target check for the new owner. It does not substitute for
// an independent TypeScript compiler or actual Android/Next runtime.
const imports=[
 mis+"application/mis-dashboard.service.ts",
 mis+"application/mis-report-source.service.ts",
 mis+"application/mis-saved-report.service.ts",
 mis+"application/mis-report-run.service.ts",
 mis+"application/mis-report-schedule.service.ts",
 mis+"infrastructure/mis-report-schedule.worker.ts",
 mis+"http/mis-dashboard.controller.ts",
 mis+"http/mis-reports.controller.ts",
 mis+"mis-reporting.module.ts",
 cg19+"application/mis-protected-artifact.service.ts",
 cg19+"application/mis-report-notice.service.ts",
 ...pairedScreens.flatMap(pair=>pair.slice(0,2)),
 web+"app/(admin)/admin/mis/page.tsx",
 native+"features/mis-reporting/native-mis-workspace-screen.tsx",
 web+"app/api/mis/reports/private-mis-proxy.ts",
 web+"app/api/mis/reports/safe-mis-bff-error.ts",
 native+"features/mis-reporting/native-mis-problem.ts"
];
for(const path of imports){
 const src=file(path);
 for(const match of src.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)){
  const target=resolve(root,dirname(path),match[1]);
  const variants=[target,target+".ts",target+".tsx",target+".js",
   target+".jsx",target+".json",resolve(target,"index.ts"),
   resolve(target,"index.tsx")];
  assert.ok(variants.some(existsSync),path+": missing relative source import "+match[1]);
 }
}
// The official 81 QA cases have exactly one active progress status each.
// A status records review disposition, NOT test execution.
const tasks=file("specs/initiatives/careganga-foundation-platform/modules/cg-20-mis-reporting/tasks.md");
const marker="## Execution progress";
assert.ok(tasks.includes(marker),"Canonical CG20 QA progress marker is required");
const progress=tasks.split(marker).slice(1).join(marker);
const byStory=[16,16,15,17,17];
for(let index=0;index<byStory.length;index++){
 const story="US-00"+(index+1);
 const match=progress.split("\n").find(line=>line.startsWith("- "+story+" |"));
 assert.ok(match,"Missing original "+story+" progress entry");
 for(let caseNumber=1;caseNumber<=byStory[index];caseNumber++){
  const id="QA"+String(caseNumber).padStart(2,"0");
  // Match by explicit token and expected next boundary, not a subsection
  // with a similar suffix; no invented PASS for future owners.
  assert.ok(match.includes(id+"="),story+" missing "+id+" progress status");
  assert.ok(tasks.includes("**"+story+"-"+id+" —"),story+" missing original "+id+" case");
 }
}
// Source-closure tracking must not silently lose a deferred original QA ID.
// This is a local structural check only: never upgrades source evidence to PASS.
const transferOwners={
 "CG-04":"cg-04-membership-volunteers",
 "CG-05":"cg-05-projects-field-operations",
 "CG-06":"cg-06-beneficiaries-assistance",
 "CG-07":"cg-07-campaigns-donations",
 "CG-08":"cg-08-csr-funding",
 "CG-11":"cg-11-payroll-compensation",
 "CG-17":"cg-17-healthcare-assistance-settlements",
 "CG-19":"cg-19-documents-notifications"
};
let transferred=0,verified=0,runtimeOnly=0;
for(let index=0;index<byStory.length;index++){
 const story="US-00"+(index+1);
 const row=progress.split("\n").find(line=>line.startsWith("- "+story+" |"));
 assert.ok(row.includes("status=SOURCE_COMPLETE"),
  story+": V1 source closure status was reopened");
 for(let caseNumber=1;caseNumber<=byStory[index];caseNumber++){
  const id="QA"+String(caseNumber).padStart(2,"0");
  const q=row.match(new RegExp("(?:^|[; |])"+id+"=([A-Z_]+)(?:\\(([^)]*)\\))?"));
  assert.ok(q,story+" missing source disposition for "+id);
  const result=q[1],detail=q[2]??"";
  if(result==="SOURCE_VERIFIED"){verified++;continue;}
  if(result==="NOT_VERIFIABLE"){runtimeOnly++;continue;}
  assert.equal(result,"TRANSFERRED_TO_OWNER",
   story+" "+id+" must be source-verified, runtime-only or explicitly transferred");
  const target=detail.match(/^(CG-\d{2})\/(US-\d{3})/);
  assert.ok(target,story+" "+id+" transferred without explicit owner/story");
  const owner=transferOwners[target[1]];
  assert.ok(owner,story+" "+id+" transferred outside a known module owner");
  const other=file("specs/initiatives/careganga-foundation-platform/modules/"+
   owner+"/tasks.md");
  assert.ok(other.includes("origin=CG-20/"+story+"-"+id+"; owner="+
   target[1]+"/"+target[2]+";"),
   story+" "+id+" has no matching destination owner tracker acceptance");
  transferred++;
 }
}
assert.deepEqual({verified,transferred,runtimeOnly},
 {verified:62,transferred:15,runtimeOnly:4},
 "CG20 original 81-case V1 closure/travelled ownership count changed");

// Explicit BFF → original protected owner route parity; all 5 functional
// groups have a real private endpoint, not just a UI tab.
for(const route of [
 "templates/route.ts","preview/route.ts","saved/route.ts",
 "saved/[reportRef]/route.ts","saved/[reportRef]/copy/route.ts",
 "saved/[reportRef]/retire/route.ts","runs/route.ts",
 "runs/[runRef]/route.ts","runs/[runRef]/download/route.ts",
 "schedules/route.ts","schedules/[scheduleRef]/pause/route.ts",
 "schedules/[scheduleRef]/resume/route.ts",
 "schedules/[scheduleRef]/edit/route.ts",
 "schedules/[scheduleRef]/history/route.ts",
 "saved/shared-with-me/route.ts","saved/share-recipients/route.ts",
 "saved/[reportRef]/share/route.ts","saved/[reportRef]/grants/route.ts"
]){
 file(web+"app/api/mis/reports/"+route);
}
// Scan the actual public native source tree rather than a single index file.
// Foundation-private report screens never have an equivalent public screen.
function assertNoPublicMisDirectory(relative){
 const absolute=resolve(root,relative);
 if(!existsSync(absolute))return;
 for(const dirent of readdirSync(absolute,{withFileTypes:true})){
  const child=relative+"/"+dirent.name;
  if(dirent.isDirectory()){assertNoPublicMisDirectory(child);continue;}
  if(!dirent.isFile()||!/\.tsx?$/.test(dirent.name))continue;
  const content=file(child);
  assert.ok(!/(?:\/api\/v1\/mis\/|features\/mis-reporting\/|NativeMisReports\b|NativeMisWorkspaceScreen\b|MisReportsWorkspace\b)/.test(content),
   "Foundation-private MIS must not be imported into Public Android: "+child);
 }
}
assertNoPublicMisDirectory("apps/android-public/app");
assertNoPublicMisDirectory("apps/android-public/src");
console.log("CG-20 structural contracts reviewed. "+stage+
 " — TypeScript, SQL, original screenshots, DB and Android device QA NOT_RUN.");
