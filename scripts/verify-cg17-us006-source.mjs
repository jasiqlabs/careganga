/** CG17 US006 original monthly claim + CG09 source preflight.
 * Run locally with 'node scripts/verify-cg17-us006-source.mjs'.
 * Static parse/source contract only, NOT PostgreSQL, real payout, Web,
 * Android device, CG14 bank proof, independent financial QA or runtime PASS.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const cg17="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const cg09="apps/backend/src/modules/cg-09-finance-accounting/";
const files={
 monthlySql:"apps/backend/db/migrations/1707_cg17_monthly_provider_settlement.sql",
 accrualSql:"apps/backend/db/migrations/1706_cg17_completed_consultation_liability.sql",
 monthly:cg17+"application/monthly-provider-settlement.service.ts",
 monthlyApi:cg17+"http/monthly-provider-settlement.controller.ts",
 cg09:cg09+"application/healthcare-foundation-posting.facade.ts",
 journal:cg09+"application/finance-journal-posting.service.ts",
 accrual:cg17+"application/foundation-journal-reconciliation.service.ts",
 cg14:"apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts",
 capability:"apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts",
 module:cg17+"healthcare-assistance.module.ts",
 webBff:"apps/web/src/app/api/healthcare-assistance/provider-settlements/[...parts]/route.ts",
 web:"apps/web/src/features/healthcare-assistance/monthly-provider-settlement-workspace.tsx",
 webPage:"apps/web/src/app/(admin)/admin/health-network/settlements/page.tsx",
 nav:"apps/web/src/shared/foundation-admin-nav.tsx",
 native:"apps/android-internal/src/features/healthcare-assistance/native-monthly-provider-settlement.tsx",
 staff:"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 dashboard:"apps/android-internal/src/features/dashboard/dashboard-modules.ts"
};
for(const file of Object.values(files)){
 const s=read(file);
 if(/\.tsx?$/.test(file)){
  const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,
   file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(tree.parseDiagnostics.length,0,file+": "+
   tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
 }
 assert.doesNotMatch(s,/^(<{7}|={7}|>{7})/m,file+": merge conflict");
}
const must=(file,pattern,reason)=>assert.match(read(files[file]),pattern,reason);
must("accrualSql",/CREATE TABLE cg17_financial_effect/,"CG17 original accrual effect");
must("cg09",/this\.posting\.postBalanced/,"CG09 owns original balanced journal");
must("journal",/INSERT INTO journal\(/,"Original journal ownership");
must("accrual",/this\.cg09\.postAccrual/,"Accrual must use original CG09");
must("monthlySql",/CREATE TABLE provider_settlement\(/,"Original provider settlement schema");
must("monthlySql",/CREATE TABLE provider_settlement_line\(/,"Immutable source lines");
must("monthlySql",/UNIQUE\(root_realm_id,liability_ref\)/,"No double inclusion");
must("monthlySql",/OLD\.state<>'PROPOSED' OR NEW\.state<>'APPROVED'/,
 "One approved proposal transition only; no invented provider payout");
must("monthlySql",/NEW\.reviewed_by=OLD\.proposed_by/,
 "Independent claim reviewer");
must("monthlySql",/j\.immutable_source_event_key=effect\.idempotency_key/,
 "DB claim must require original CG09 immutable event key");
must("monthlySql",/j\.immutable_payload_digest=effect\.source_digest/,
 "DB claim must require CG09 source digest");
must("monthly",/this\.centers\.verifiedFoundationSettlementDestination/,
 "CG14 actual provider bank proof, not generated in CG17");
must("cg14",/intent\.classification='HEALTH_BANK_PROOF'/,
 "CG14 bank proof must be original CG19 scanner validated");
must("cg14",/file\.scan_status='CLEAN_VERIFIED'/,
 "CG19 original scanner source required");
must("monthly",/e\.posting_state='POSTED'/,"Only posted Foundation liabilities");
must("monthly",/j\.source_ref=e\.id/,
 "Application source must use exact CG09 journal effect");
must("monthly",/pg_advisory_xact_lock/,
 "Concurrent period proposal must be serialized");
must("monthly",/this\.identity\.assertCurrent\(c,a,"approvals\.review"\)/,
 "Independent privileged review is required");
must("monthly",/saved\.proposed_by===a\.accountId/,
 "Approver cannot be proposer");
must("monthly",/actualPaidMinor:c\.paid_minor/,
 "No invented settled amount");
must("monthly",/patientCollectionNotFoundationIncome:true/,
 "Center patient collections must stay outside Foundation books");
must("webBff",/cg_staff_session/,"No public mutation");
must("webPage",/healthcare\.assistance\.settlements\.view/,
 "Current CG01 Web role must gate source access");
must("nav",/healthSettlements/,"UI route is discoverable on original Admin");
must("native",/provider-settlements/,"Native must use same original API");
must("staff",/NativeMonthlyProviderSettlement token=\{token\}/,
 "Internal Android actual staff route required");
must("dashboard",/healthcare\.assistance\.settlements\.view/,
 "Native menu remains CG01 guarded");
console.log("CG17 US006 accrued/liability/monthly claim static preflight PASS. "+
 "Real bank payout, linked CG09 disbursement/reversal, device/PG/independent QA NOT_RUN.");
