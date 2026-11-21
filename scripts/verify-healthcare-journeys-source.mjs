/** Cross-module healthcare journey SOURCE/PARSE preflight, NOT runtime QA.
 * No invented patient discount, bank transfer, center registration or medical test.
 * Run locally after existing owning source verifiers and before real Postgres,
 * browser, internal/public Android and independent clinical/finance QA.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const must=(p,pat,why)=>assert.match(read(p),pat,p+": "+why);
const cg14="apps/backend/src/modules/cg-14-healthcare-network/";
const cg15="apps/backend/src/modules/cg-15-patients-appointments/";
const cg17="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const web="apps/web/src/";
const native="apps/android-internal/src/";
const files=[
 cg14+"application/health-clinician-identity.service.ts",
 cg15+"application/consultation-queue.service.ts",
 cg15+"http/consultation-queue.controller.ts",
 cg17+"application/monthly-provider-settlement.service.ts",
 cg17+"http/monthly-provider-settlement.controller.ts",
 web+"app/api/appointments/queue/[...parts]/route.ts",
 web+"app/api/healthcare-assistance/provider-settlements/[...parts]/route.ts",
 web+"features/appointments/my-clinician-activity.tsx",
 web+"app/(admin)/admin/health-network/my-clinical-activity/page.tsx",
 web+"app/(admin)/admin/health-network/settlements/page.tsx",
 web+"features/healthcare-assistance/center-monthly-settlement-summary.tsx",
 web+"features/health-network/center-draft-portal.tsx",
 web+"app/(admin)/center/page.tsx",
 web+"shared/foundation-admin-nav.tsx",
 web+"shared/healthcare-admin-shell.tsx",
 native+"features/appointments/native-my-clinician-activity.tsx",
 native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 native+"features/dashboard/dashboard-modules.ts",
 native+"features/identity-access/staff-authentication-screen.tsx",
 cg17+"application/consultation-patient-charge.service.ts",
 cg17+"application/center-patient-collection.service.ts",
 cg17+"application/verified-provider-payout.service.ts",
 "apps/backend/db/migrations/1706_cg17_completed_consultation_liability.sql",
 "apps/backend/db/migrations/1441_cg14_professional_license_validity.sql"
];
for(const p of files){
 const source=read(p);
 if(!p.endsWith(".sql")){
  const parsed=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,
   p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,p+" TS syntax: "+
  parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
 }
 assert.doesNotMatch(source,/^(<{7}|={7}|>{7})/m,p+" merge conflict");
}
must(cg14+"application/health-clinician-identity.service.ts",
 /currentClinicalAssignments/,
 "CG14 owns real verified doctor-center assignment");
must(cg14+"application/health-clinician-identity.service.ts",
 /l\.accepted_at IS NOT NULL/,
 "Only consented accepted clinician account links");
must(cg15+"application/consultation-queue.service.ts",
 /ownClinicianSummary/,
 "CG15 owns its own appointment and visit counts");
must(cg15+"application/consultation-queue.service.ts",
 /this\.clinicians\.assertCurrentAppointmentClinician/,
 "Current CG14 doctor identity required, not just staff role");
must(cg15+"application/consultation-queue.service.ts",
 /"health\.visits\.clinical\.manage"/,
 "No generic reception-only access to doctor activity");
must(cg15+"http/consultation-queue.controller.ts",
 /my-clinician\/centers\/:centerRef\/doctors\/:doctorRef\/summary/,
 "CG15 doctor summary endpoint registered");
must(web+"app/api/appointments/queue/[...parts]/route.ts",
 /parts\[0\]==="my-clinician"/,
 "Doctor activity Web BFF requires literal restricted route");
must(web+"features/appointments/my-clinician-activity.tsx",
 /containsPatientDetails!==false/,
 "Doctor Web dashboard checks source cannot return patient details");
must(web+"app/(admin)/admin/health-network/my-clinical-activity/page.tsx",
 /allowed\.has\("health\.visits\.clinical\.manage"\)/,
 "Original effective CG01 grant gates professional dashboard");
must(native+"features/dashboard/dashboard-modules.ts",
 /roleActions\.includes\("health\.visits\.clinical\.manage"\)/,
 "Native action-gated doctor module");
must(native+"features/identity-access/staff-authentication-screen.tsx",
 /<NativeMyClinicianActivity/,
 "Native doctor dashboard is actually reachable");
must(native+"features/appointments/native-my-clinician-activity.tsx",
 /containsPatientDetails/,
 "Native doctor activity does not expose other patient identities");
must(cg17+"application/monthly-provider-settlement.service.ts",
 /ownCenters\(token:string\)/,
 "Native center dashboard uses original CG14 assigned center labels");
must(cg17+"http/monthly-provider-settlement.controller.ts",
 /my-centers\/eligible/,
 "Native center list protected at own-center endpoint");
must(cg17+"application/monthly-provider-settlement.service.ts",
 /ownCenterStatement/,
 "CG17 same original provider claim projection");
must(cg17+"application/monthly-provider-settlement.service.ts",
 /this\.centers\.assertCurrent\(c,a,center/,
 "CG14 current center assignment required for partner statement");
must(cg17+"http/monthly-provider-settlement.controller.ts",
 /my-centers\/:centerRef\/months\/:month/,
 "Partner's own read endpoint cannot approve or pay");
must(web+"app/api/healthcare-assistance/provider-settlements/[...parts]/route.ts",
 /p\[0\]==="my-centers"/,
 "Protected BFF partner read only");
must(web+"features/healthcare-assistance/center-monthly-settlement-summary.tsx",
 /patientCollectionNotFoundationIncome/,
 "Never represent the center's patient cash as Foundation income");
must(web+"features/health-network/center-draft-portal.tsx",
 /<CenterMonthlySettlementSummary/,
 "Partner statement actually reachable in real Center Portal");
must(web+"app/(admin)/center/page.tsx",
 /canViewSettlements=\{allowed\.has\("healthcare\.assistance\.settlements\.view"\)\}/,
 "Effective settlement view permission reaches center UI");
must(native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 /patientCollectionNotFoundationIncome/,
 "Internal Android partner view must not present patient cash as Foundation income");
must(native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 /approved\?summary\.approvedFoundationMinor:summary\.eligibleAccruedMinor/,
 "Unapproved monthly claim is not zeroed out by the approved-only amount");
must(native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 /"Proposed claim \(not approved\)"/,
 "Partner Android visibly distinguishes a proposed claim from approved payout");
must(web+"features/healthcare-assistance/center-monthly-settlement-summary.tsx",
 /requestVersion=useRef\(0\)/,
 "Web partner statement must invalidate stale month/network responses");
must(web+"features/healthcare-assistance/center-monthly-settlement-summary.tsx",
 /return\(\)=>\{requestVersion\.current\+\+\}/,
 "Web partner screen cleanup cannot publish an out-of-date statement");
must(native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 /requestVersion=useRef\(0\)/,
 "Android partner statement must reject stale center or month results");
must(native+"features/healthcare-assistance/native-partner-settlement-summary.tsx",
 /return\(\)=>\{requestVersion\.current\+\+\}/,
 "Android partner screen cleanup must invalidate pending requests");


must(native+"features/dashboard/dashboard-modules.ts",
 /roleActions\.includes\("health\.centers\.draft\.edit"\)/,
 "Native partner statement menu requires actual assigned representative capability");
must(native+"features/identity-access/staff-authentication-screen.tsx",
 /<NativePartnerSettlementSummary/,
 "Native partner statement actually reachable from original shell");
must(cg17+"application/consultation-patient-charge.service.ts",
 /foundationSupportMinor/,
 "Original patient quote remains policy-derived, no blanket 50%");
must(cg17+"application/verified-provider-payout.service.ts",
 /this\.cg09\.verify\(c,a,bankMatch\)/,
 "Original CG09 bank payment must be independently verified");
must("apps/backend/db/migrations/1706_cg17_completed_consultation_liability.sql",
 /uq_cg17_patient_charge_realm_id_center/,
 "Original patient_charge root/id/center composite FK has a real unique target");
must(cg17+"application/monthly-provider-settlement.service.ts",
 /"health\.providers\.finance\.view"/,
 "Foundation-wide finance access is independent of own-center viewing");
must(cg17+"application/monthly-provider-settlement.service.ts",
 /proposedClaimMinor:/,
 "Pending proposed claim is not represented as paid or approved");
must(web+"app/(admin)/admin/health-network/settlements/page.tsx",
 /!actions\.has\("health\.providers\.finance\.view"\)/,
 "Foundation settlements page rejects a center-representative-only session");
must("apps/backend/db/migrations/1441_cg14_professional_license_validity.sql",
 /ADD COLUMN professional_license_valid_through/,
 "Current clinician report license schema exists before CG16 migration");
console.log("Healthcare user-journey source/parse preflight authored. "+
 "Runtime/SQL/provider/Web/Android/clinical/finance QA NOT_RUN.");
