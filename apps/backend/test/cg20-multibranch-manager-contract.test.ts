import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const web=(path:string)=>readFileSync(new URL("../../web/src/"+path,import.meta.url),"utf8");
const native=(path:string)=>readFileSync(new URL("../../android-internal/src/"+path,import.meta.url),"utf8");

test("CG-MB-009 root vs region: permission plus CG02 current branch scope, no Foundation-null journal to delegated manager",()=>{
 const cg02=read("src/modules/cg-02-foundation-structure/application/branch-source.facade.ts");
 const finance=read("src/modules/cg-09-finance-accounting/application/finance-reports.service.ts");
 assert.match(cg02,/financeReportScope/);
 assert.match(cg02,/grant_scope\.scope_kind='BRANCH'/);
 assert.match(cg02,/grant_scope\.scope_kind='AREA'/);
 assert.match(finance,/async assignedMisSummary\(bearer:string,yearInput\?:string\)/);
 assert.match(finance,/this\.branches\.financeReportScope\(bearer,"finance\.reports\.view"\)/);
 assert.match(finance,/if\(scope\.all\)return this\.summary\(bearer,yearInput\)/);
 assert.match(finance,/scope\.branchRefs\.length===0/);
 assert.match(finance,/readPostedSummary\(actor\.realmId,year,null,scope\.branchRefs\)/);
 assert.match(finance,/await this\.actor\(bearer\)/);
 assert.match(finance,/scope\.branchRefs\.some\(ref=>!latest\.branchRefs\.includes\(ref\)\)/);
 assert.match(finance,/Your assigned branch reporting scope changed/);
 assert.match(finance,/l\.branch_id=ANY\(\$4::uuid\[\]\)/);
 assert.match(finance,/async assignedMisMonthlyTrend\(bearer:string,yearInput\?:string\)/);
 assert.match(finance,/readMonthlyMisTrend\(actor\.realmId,year,null,scope\.branchRefs\)/);
 assert.match(finance,/verifyAssignedMisYear\(actor\.realmId,year\)/);
 // Existing unfiltered CG09 finance exports must NOT call the MIS-only method.
 const exportMethod=finance.slice(finance.indexOf(" async exportCsv("));
 assert.doesNotMatch(exportMethod,/assignedMisSummary|assignedMisMonthlyTrend/);
});

test("CG-MB-009 Dashboard only requests source-owned assigned union when no single branch is selected",()=>{
 const mis=read("src/modules/cg-20-mis-reporting/application/mis-dashboard.service.ts");
 assert.match(mis,/filters\.branchRef\?this\.finance\.summary/);
 assert.match(mis,/this\.finance\.assignedMisSummary\(bearer,filters\.yearRef\)/);
 assert.match(mis,/this\.finance\.assignedMisMonthlyTrend\(bearer,filters\.yearRef\)/);
 assert.match(mis,/if\(filters\.branchRef\|\|view==="FINANCE"\)throw error/);
 assert.doesNotMatch(mis,/SELECT .* FROM journal_line/);
});

test("CG-MB-009 Web and Internal Android show all assigned vs Foundation+all branches as distinct choices",()=>{
 const w=web("features/mis-reporting/mis-dashboard-panel.tsx");
 const a=native("features/mis-reporting/native-mis-dashboard.tsx");
 for(const screen of [w,a]){
  assert.match(screen,/allBranches\|\|branches\.length>1/);
  assert.match(screen,/All assigned branches/);
  assert.match(screen,/Foundation and all branches/);
  assert.match(screen,/branchRef/);
 }
});


test("CG-MB-009 saved/export and due-worker A+B scope use original CG09 and recheck after source read",()=>{
 const cg02=read("src/modules/cg-02-foundation-structure/application/branch-source.facade.ts");
 const finance=read("src/modules/cg-09-finance-accounting/application/finance-reports.service.ts");
 const source=read("src/modules/cg-20-mis-reporting/application/mis-report-source.service.ts");
 const schedule=read("src/modules/cg-20-mis-reporting/application/mis-report-schedule.service.ts");
 assert.match(cg02,/async scheduledFinanceScope\(root:string,account:string\)/);
 assert.match(cg02,/requireScheduledMisAction\(root,account,"finance\.reports\.view"\)/);
 assert.match(cg02,/await this\.permittedStaffBranches\(this\.db,root,account\)/);
 assert.match(finance,/assigned=branch\?null:await this\.branches\.scheduledFinanceScope\(root,account\)/);
 assert.match(finance,/assigned&&!assigned\.all\?assigned\.branchRefs:null/);
 assert.match(finance,/const current=await this\.branches\.scheduledFinanceScope\(root,account\)/);
 assert.match(finance,/Scheduled report scope changed/);
 assert.match(source,/this\.finance\.assignedMisSummary\(token,q\.yearRef\)/);
 assert.match(source,/this\.finance\.assignedMisMonthlyTrend\(token,q\.yearRef\)/);
 assert.match(source,/this\.finance\.scheduledSummary\(root,account,q\.yearRef,q\.branchRef\)/);
 assert.match(schedule,/this\.sources\.preview\(token,(?:saved\.request|q)\)/);
 // No second shadow finance/posting source is added to MIS.
 assert.doesNotMatch(source,/FROM journal_line/);
});


test("CG-MB-008/009 durable A+B source-of-truth for on-demand/scheduled downloads and notices",()=>{
 const migration=read("db/migrations/3321_cg20_immutable_report_branch_scope.sql");
 const source=read("src/modules/cg-20-mis-reporting/application/mis-report-source.service.ts");
 const module=read("src/modules/cg-20-mis-reporting/mis-reporting.module.ts");
 const run=read("src/modules/cg-20-mis-reporting/application/mis-report-run.service.ts");
 const worker=read("src/modules/cg-20-mis-reporting/infrastructure/mis-report-schedule.worker.ts");
 const notice=read("src/modules/cg-19-documents-notifications/application/mis-report-notice.service.ts");
 const inbox=read("src/modules/cg-19-documents-notifications/application/notification.service.ts");
 assert.match(migration,/ADD COLUMN original_scope_all boolean/);
 assert.match(migration,/original_scope_branch_refs uuid\[\]/);
 assert.match(migration,/cg20_finance_ready_scope_guard/);
 assert.match(migration,/cg20_report_run_scope_no_retarget/);
 assert.match(source,/async originalFinanceScope\(/);
 assert.match(source,/async originalScheduledFinanceScope\(/);
 assert.match(source,/return \{all:false,branchRefs:\[request.branchRef\]\}/);
 assert.match(source,/this\.branches\.financeReportScope/);
 assert.match(module,/FoundationStructureModule/);
 assert.match(run,/original_scope_all=\$6/);
 assert.match(run,/original_scope_branch_refs=\$7::uuid\[\]/);
 assert.match(run,/validateOriginalScope/);
 assert.match(run,/if\(originalReady\)await this\.validateOriginalScope/);
 assert.match(run,/validateSource\(token,claimed.rows\[0\],false\)/);
 assert.match(run,/this\.validateSource\(token,row\)/);
 assert.match(worker,/original_scope_all=\$6/);
 assert.match(worker,/original_scope_branch_refs=\$7::uuid\[\]/);
 assert.match(worker,/run\.original_scope_all&&!latest\.all/);
 assert.match(notice,/original\.original_scope_all&&!current\.all/);
 assert.match(inbox,/report\.original_scope_branch_refs <@ \$6::uuid\[\]/);
 assert.equal(inbox.split("report.original_scope_branch_refs <@ $6::uuid[]").length-1,2);
});
