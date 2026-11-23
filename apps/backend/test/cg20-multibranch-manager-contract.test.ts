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
 assert.match(mis,/if\(filters\.branchRef\)throw error/);
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
