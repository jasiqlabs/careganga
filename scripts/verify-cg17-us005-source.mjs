/** CG17 US005 existing canonical story source/parse preflight.
 * Run: node scripts/verify-cg17-us005-source.mjs (from repo root).
 * NOT a PostgreSQL, CG09 journal, Web, device or independent audit PASS.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const base="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const cg15="apps/backend/src/modules/cg-15-patients-appointments/";
const paths={
 sql:"apps/backend/db/migrations/1706_cg17_completed_consultation_liability.sql",
 service:base+"application/completed-consultation-liability.service.ts",
 controller:base+"http/completed-consultation-liability.controller.ts",
 module:base+"healthcare-assistance.module.ts",
 owner:cg15+"application/consultation-completion-source.facade.ts",
 ownerModule:cg15+"patients-appointments.module.ts",
 centers:"apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts",
 capabilities:"apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts",
 bff:"apps/web/src/app/api/healthcare-assistance/foundation-liabilities/[...parts]/route.ts",
 web:"apps/web/src/features/healthcare-assistance/completed-consultation-liability-workspace.tsx",
 webRoute:"apps/web/src/app/(admin)/admin/health-network/liabilities/page.tsx",
 nav:"apps/web/src/shared/foundation-admin-nav.tsx",
 shell:"apps/web/src/shared/healthcare-admin-shell.tsx",
 native:"apps/android-internal/src/features/healthcare-assistance/native-completed-consultation-liabilities.tsx",
 staff:"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 dashboard:"apps/android-internal/src/features/dashboard/dashboard-modules.ts"
};
for(const file of Object.values(paths)){
 const s=read(file);
 if(/\.tsx?$/.test(file)){
  const parsed=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,
   file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,file+" syntax: "+
   parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
 }
 assert.doesNotMatch(s,/^(<{7}|={7}|>{7})/m,
  "Unresolved merge conflict in "+file);
}
const must=(file,pattern,why)=>assert.match(read(paths[file]),pattern,why);
must("sql",/ADD CONSTRAINT uq_cg17_patient_charge_realm_id_center/,
 "Original patient-charge owner must provide exact FK target before accrual DDL");
must("sql",/UNIQUE\(root_realm_id,id,center_ref\)/,
 "PostgreSQL original charge parent key must match award FK columns");
must("sql",/CREATE TABLE assistance_award\(/,"Award has its original CG17 owner");
must("sql",/CREATE TABLE foundation_liability\(/,"Liability has original CG17 owner");
must("sql",/CREATE TABLE cg17_financial_effect\(/,"Durable original pending posting effect");
must("sql",/UNIQUE\(root_realm_id,source_kind,source_ref\)/,"No duplicate completion liabilities");
must("sql",/cg17_liability_completion_guard/,"DB must reject invented completion source");
must("sql",/e\.next_state='COMPLETED'/,"Real clinician-owned event required");
must("sql",/v\.state='COMPLETED'/,"Real completed visit required");
must("sql",/a\.booking_state='COMPLETED'/,"Real completed booking required");
must("sql",/cg17_foundation_liability_frozen/,"Original liability immutable");
must("sql",/posting_state text NOT NULL DEFAULT 'PENDING'/,"No fake CG09 posting");
must("sql",/REFERENCES journal\(id,root_realm_id\)/,"Actual CG09 journal composite key");
must("owner",/cg15_visit_event e/,"CG15 original completed visit owner");
must("owner",/cg15_patient_consent x/,"Current genuine patient care consent");
must("owner",/cg15_patient_identity_event/,"Existing verified patient identity");
must("service",/this\.completed\.completed\(c,a,center,booking\)/,
 "CG17 must reuse actual CG15 typed source");
must("service",/this\.centers\.assertFoundationCenter\(c,a,center/,
 "Current CG14 center authorization required");
must("service",/this\.identity\.assertCurrent\(c,a,action\)/,
 "Current Foundation role check required");
must("service",/this\.assertOriginal\(charge,source\)/,
 "Original booking economic terms bound to accepted charge");
must("service",/this\.policy\(c,a\.realmId,charge\)/,
 "Previously approved exact policy revision required");
must("service",/pg_advisory_xact_lock/,"Per-appointment transaction lock required");
must("service",/LIABILITY_ACCRUAL/,"Only original obligation effect created");
must("service",/effect_state:"PENDING"/,"No invented posted journal success");
must("service",/providerSettled:false/,"No invented provider settlement success");
assert.doesNotMatch(read(paths.service),/FROM center_collection/,
 "US005 liability must not depend on patient cash/US004");
must("capabilities",/healthcare\.assistance\.liabilities\.manage/,
 "Existing CG01 owner must register approval operation");
must("bff",/cg_staff_session/,"Web must use protected Foundation staff auth");
must("webRoute",/healthcare\.assistance\.liabilities\.view/,
 "Web route must hide unprivileged Foundation liability data");
must("nav",/healthLiabilities/,"Web original admin menu must reach the workflow");
must("web",/completed-options/,"Source-owned actual CG15 completion list");
must("native",/completed-options/,"Internal Android uses same real CG15 source");
must("native",/foundation-liabilities/,"Internal Android uses same CG17 backend");
must("staff",/NativeCompletedConsultationLiabilities token=\{token\}/,
 "Internal Android actual staff screen must be reachable");
must("dashboard",/healthcare\.assistance\.liabilities\.view/,
 "Internal Android visibility must be permission-gated");
console.log("CG17 US005 SOURCE/PARSE preflight PASS. Live CG15/CG09, PG, "+
 "Web/native devices, original visual and independent finance QA NOT_RUN.");
