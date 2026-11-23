import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const backend=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const web=(path:string)=>readFileSync(new URL("../../web/src/"+path,import.meta.url),"utf8");
const native=(path:string)=>readFileSync(new URL("../../android-internal/src/"+path,import.meta.url),"utf8");

test("CG-MB-001 original scoped staff assignment keeps immutable same-root source and one current permission",()=>{
 const sql=backend("db/migrations/3320_cg02_delegated_staff_scope.sql");
 assert.match(sql,/CREATE TABLE cg02_staff_scope_assignment/);
 assert.match(sql,/scope_kind IN\('BRANCH','AREA'\)/);
 assert.match(sql,/FOREIGN KEY\(account_ref,root_realm_id\) REFERENCES account\(id,realm_id\)/);
 assert.match(sql,/FOREIGN KEY\(branch_ref,root_realm_id\) REFERENCES branch\(id,root_realm_id\)/);
 assert.match(sql,/FOREIGN KEY\(area_ref,root_realm_id\) REFERENCES geography_area\(id,root_realm_id\)/);
 assert.match(sql,/ux_cg02_active_staff_scope/);
 assert.match(sql,/CREATE TRIGGER cg02_staff_scope_no_retarget/);
 assert.match(sql,/OLD\.ended_at IS NOT NULL/);
 assert.match(sql,/NEW\.source_version<>2/);
 assert.doesNotMatch(sql,/health_center/);
});
test("CG-MB-001 current protected grant/end and revocation require genuine CG01 action and password",()=>{
 const service=backend("src/modules/cg-02-foundation-structure/application/branch-staff-access.service.ts");
 const mod=backend("src/modules/cg-02-foundation-structure/foundation-structure.module.ts");
 const controller=backend("src/modules/cg-02-foundation-structure/http/branch-staff-access.controller.ts");
 assert.match(service,/requireAction\(bearer,"foundation\.branches\.admin"\)/);
 assert.match(service,/limitFoundationRootProof/);
 assert.match(service,/requireFreshFoundationRootProof/);
 assert.match(service,/eligibleOfficeholder\(tx,a,account\)/);
 assert.match(service,/status='ACTIVE' FOR SHARE/);
 assert.match(service,/request_digest/);
 assert.match(service,/access_version=access_version\+1/g);
 assert.match(service,/cg02\.staff\.scope\.grant/);
 assert.match(service,/cg02\.staff\.scope\.end/);
 assert.match(service,/old\.ended_by!==a\.accountId/);
 assert.match(controller,/@Post\("assignments"\)/);
 assert.match(controller,/@Post\("assignments\/:assignmentRef\/end"\)/);
 assert.match(mod,/BranchStaffAccessService/);
 assert.match(mod,/BranchStaffAccessController/);
});
test("CG-MB-001 root-only and delegated branch/area selection remain separate from CG14 center rights",()=>{
 const source=backend("src/modules/cg-02-foundation-structure/application/branch-source.facade.ts");
 assert.match(source,/WITH RECURSIVE ancestors AS/);
 assert.match(source,/grant_scope\.scope_kind='BRANCH'/);
 assert.match(source,/grant_scope\.scope_kind='AREA'/);
 assert.match(source,/p\.status='ACTIVE'/);
 assert.match(source,/b\.status='ACTIVE'/);
 assert.match(source,/grant_scope\.ended_at IS NULL/);
 assert.match(source,/FOR SHARE/);
 assert.match(source,/requireAssignedStaffBranch/);
 assert.match(source,/currentStaffBranchRefs/);
 assert.match(source,/permittedStaffBranches\(this\.db,actor\.realmId,actor\.accountId\)/);
 assert.match(source,/requireScheduledFinanceReportBranch/);
 assert.match(source,/requireFinanceRootScope/);
 assert.doesNotMatch(source,/CG14.*grant_scope\.scope_kind/s);
});
test("CG-MB-001/002/003/004 consumers reuse original CG02 source, without new shadow finance/stock grants",()=>{
 const inventory=backend("src/modules/cg-12-inventory-suppliers/application/inventory-catalog.service.ts");
 const inventoryModule=backend("src/modules/cg-12-inventory-suppliers/inventory-source.module.ts");
 const human=backend("src/modules/cg-10-human-resources/application/hr-enrollment.service.ts");
 const humanModule=backend("src/modules/cg-10-human-resources/hr-enrollment.module.ts");
 const branches=backend("src/modules/cg-02-foundation-structure/application/branch-operations.service.ts");
 assert.match(inventory,/this\.branches\.requireAssignedStaffBranch\(tx,a,branch\)/);
 assert.match(inventory,/if\(branch===null\)\{if\(!full\)/);
 assert.match(inventoryModule,/FoundationStructureModule/);
 assert.match(human,/this\.branches\.requireAssignedStaffBranch\(tx,a,ref\)/);
 assert.match(humanModule,/FoundationStructureModule/);
 assert.match(branches,/this\.branches\.currentStaffBranchRefs/);
 assert.match(branches,/this\.branches\.requireAssignedStaffBranch/);
});
test("CG-MB-001 current Web and native Internal Android protected operations use the same original API",()=>{
 const panel=web("features/foundation-structure/branch-access-panel.tsx");
 const source=web("features/foundation-structure/operating-branches-panel.tsx");
 const bff=web("app/api/foundation/[...parts]/route.ts");
 const android=native("features/foundation-structure/branch-staff-access-native.tsx");
 const screen=native("features/foundation-structure/branch-registration-screen.tsx");
 assert.match(panel,/canGrant/);
 assert.match(panel,/Current staff account/);
 assert.match(panel,/currentPassword/);
 assert.match(panel,/setUnknown\(true\)/);
 assert.match(panel,/scopeKind:kind/);
 assert.match(panel,/End staff access/);
 assert.match(source,/<BranchAccessPanel\/>/);
 assert.match(bff,/parts\[0\]==="branch-access"/);
 assert.match(bff,/parts\[3\]==="end"/);
 assert.match(android,/currentPassword/);
 assert.match(android,/scopeKind:kind/);
 assert.match(android,/setBlocked\(true\)/);
 assert.match(screen,/<BranchStaffAccessNative token=\{token\}/);
 assert.match(screen,/canAdmin&&/);
 const shell=native("features/identity-access/staff-authentication-screen.tsx");
 assert.match(shell,/canAdmin=\{roleActions\.includes\("foundation\.branches\.admin"\)\}/);
});


test("CG-MB-004 HR employee/app roster, summary and private original/current branch never use manager-only list",()=>{
 const hr=backend("src/modules/cg-10-human-resources/application/hr-enrollment.service.ts");
 const source=backend("src/modules/cg-10-human-resources/application/hr-enrollment-source.facade.ts");
 const module=backend("src/modules/cg-10-human-resources/hr-source.module.ts");
 const attendance=backend("src/modules/cg-10-human-resources/application/hr-attendance.service.ts");
 const privateData=backend("src/modules/cg-10-human-resources/application/hr-private-detail.service.ts");
 assert.match(hr,/availableBranches\(a,token,"hr\.applications\.view"\)/);
 assert.match(hr,/availableBranches\(a,token,"hr\.employees\.view"\)/);
 assert.match(hr,/this\.branches\.staffBranchScope\(token,"hr\.applications\.view"\)/);
 assert.match(hr,/this\.branches\.staffBranchScope\(token,"hr\.employees\.view"\)/);
 assert.match(hr,/const scope=await this\.branches\.projectBranchScope\(tx,actor\)/);
 assert.match(hr,/b\.id=ANY\(\$11::uuid\[\]\)/);
 assert.match(hr,/scope\.branches\.map\(x=>x\.value\)/);
 assert.match(source,/this\.branches\.requireAssignedStaffBranch\(tx,actor,app\.proposed_branch_ref\)/);
 assert.match(module,/FoundationStructureModule/);
 assert.match(attendance,/this\.branches\.projectBranchScope\(tx,actor\)/);
 assert.match(attendance,/b\.id=ANY\(\$4::uuid\[\]\)/);
 assert.match(privateData,/current_branch\.id=ANY\(\$4::uuid\[\]\)/);
 assert.match(privateData,/origin_branch\.id=ANY\(\$4::uuid\[\]\)/);
});
test("CG-MB-003 warehouse selectors, real availability and KPI counts all use current source",()=>{
 const catalog=backend("src/modules/cg-12-inventory-suppliers/application/inventory-catalog.service.ts");
 assert.match(catalog,/permittedBranches=full\?\[\]:await this\.branches\.currentStaffBranchRefs/);
 assert.match(catalog,/id=ANY\(\$3::uuid\[\]\)/);
 assert.match(catalog,/b\.id=ANY\(\$3::uuid\[\]\)/);
 assert.doesNotMatch(catalog.slice(catalog.indexOf(" async options(token:string){"),
  catalog.indexOf(" async list(token:string,")),/manager_account_ref/);
});


test("CG-MB-004 employment change source keeps self and manager exceptions but narrows staff options, history and destination",()=>{
 const source=backend("src/modules/cg-10-human-resources/application/hr-employment-change-source.facade.ts");
 assert.match(source,/actorScope=\(branchParam:number\)/);
 assert.match(source,/b\.id=ANY\(\$\$\{branchParam\}::uuid\[\]\)/);
 assert.match(source,/actorScope\(4\)/);
 assert.match(source,/actorScope\(6\)/);
 assert.match(source,/const assigned=await this\.branches\.currentStaffBranchRefs/);
 assert.match(source,/this\.branches\.projectBranch\(tx,actor,leaveId\(branch\)\)/);
 assert.match(source,/SELECT id,name FROM branch WHERE root_realm_id=\$1 AND status='ACTIVE'/);
 assert.match(source,/scope\.branches\.map\(x=>x\.value\)/);
 assert.match(source,/supervisor\.account_ref=\$2/);
});
