/** CG17 US004 original source contract preflight: parse + scoped source
 * invariants. NOT actual PostgreSQL, browser, scanner, PDF, or Android QA.
 * To execute: node scripts/verify-cg17-us004-source.mjs locally.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const backend="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const cg19="apps/backend/src/modules/cg-19-documents-notifications/";
const web="apps/web/src/features/healthcare-assistance/";
const admin="apps/android-internal/src/features/healthcare-assistance/";
const patient="apps/android-public/src/features/appointments/";
const files=[
 backend+"application/center-patient-collection.service.ts",
 backend+"application/center-patient-receipt.service.ts",
 backend+"http/center-patient-collection.controller.ts",
 backend+"http/center-patient-receipt.controller.ts",
 backend+"healthcare-assistance.module.ts",
 cg19+"application/center-collection-receipt-renderer.ts",
 cg19+"lab-result-storage.module.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/consultation-patient-charge.service.ts",
 "apps/web/src/app/api/healthcare-assistance/center-collections/[...parts]/route.ts",
 "apps/web/src/app/api/healthcare-assistance/center-receipts/[...parts]/route.ts",
 web+"center-collection-workspace.tsx",
 web+"patient-center-collection-summary.tsx",
 web+"consultation-contribution.tsx",
 admin+"native-center-collection-workspace.tsx",
 admin+"native-consultation-contribution.tsx",
 "apps/android-internal/src/features/appointments/native-center-assisted-booking.tsx",
 "apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 patient+"native-patient-center-collection-summary.tsx",
 patient+"native-consultation-contribution.tsx"
];
for(const p of files){
 const source=read(p);
 const parsed=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,
  p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,p+": "+
  parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
 assert.doesNotMatch(source,/^(<{7}|={7}|>{7})/m,p+": merge conflict");
}
const collection=read(files[0]),receipt=read(files[1]);
const sql=read("apps/backend/db/migrations/1704_cg17_original_center_manual_collection.sql");
const document=read("apps/backend/db/migrations/1705_cg17_original_center_receipt_document.sql");
const staffNative=read(admin+"native-center-collection-workspace.tsx");
const patientNative=read(patient+"native-patient-center-collection-summary.tsx");
const must=(source,pattern,msg)=>assert.match(source,pattern,msg);
must(sql,/CREATE TABLE center_collection\(/,"Original center payment owner missing");
must(sql,/CREATE TRIGGER cg17_center_collection_frozen/,"Immutable center cash evidence");
must(sql,/ux_cg17_original_cash_receipt/,"Cash receipt uniqueness source");
must(document,/UNIQUE\(root_realm_id,collection_ref\)/,
 "Only one original CG19 receipt per cash collection");
must(document,/cg19_center_patient_receipt_frozen/,"Original receipt identity frozen");
must(collection,/cash\?"VERIFIED_CASH":"PENDING_EXTERNAL"/,
 "Electronic reference must never become verified by cashier assertion");
must(collection,/foundationIncomeRecorded:false,foundationLiabilityCreated:false/,
 "Center money must not mutate Foundation financial state");
must(collection,/pg_advisory_xact_lock/,"Same-charge writer transaction lock");
must(collection,/center_collection_adjustment/,"Refunds remain separate events");
must(collection,/outstandingAgeDays/,"Real accepted-charge aging required");
must(collection,/cg19_center_patient_receipt_document/,
 "Actual CG19 receipt status must be used");
must(receipt,/this\.centers\.assertCurrent/,"Current root/center staff must be checked");
must(receipt,/this\.charges\.previewBooking/,"Patient must reuse original CG15 authorization");
must(receipt,/this\.storage\.writeVerifiedPrivateDocument/,
 "CG19 private verified document required");
must(receipt,/this\.storage\.reconcileIssuedPrivateDocument/,
 "Recover after original storage unknown outcome");
must(receipt,/this\.storage\.readVerifiedPrivateObject/,
 "Authenticated original bytes required on download");
must(receipt,/renderCenterCashReceipt/,"Actual source-rendered receipt required");
must(receipt,/source\.cash_receipt_number/,"Only original cash receipt number used");
must(receipt,/sha\(bytes\)!==doc\.content_sha256/,
 "Private receipt bytes must be content-hash checked");
must(receipt,/originalDigest\(root,source\)!==doc\.source_digest/,
 "Must re-evaluate frozen cash source at final issue");
must(staffNative,/NativeCenterCollectionWorkspace/,"Native staff parity missing");
must(staffNative,/center-collections\//,"Native original center money contract missing");
must(staffNative,/center-receipts/,"Native private receipt source missing");
must(staffNative,/File\.preview/,"No native private PDF preview");
must(patientNative,/cg_public_patient_only_session/,
 "Public Android must retain own CG15 session");
must(patientNative,/center-receipts\/me\/appointments/,
 "Public Android requires protected own-patient receipt route");
must(patientNative,/File\.preview/,"Public Android private PDF preview missing");
must(read(patient+"native-consultation-contribution.tsx"),
 /NativePatientCenterCollectionSummary/,"Actual Public Android booking not wired");
must(read(admin+"native-consultation-contribution.tsx"),
 /NativeCenterCollectionWorkspace/,"Actual Internal Android booking not wired");
must(read("apps/web/src/app/api/healthcare-assistance/center-receipts/[...parts]/route.ts"),
 /cg_patient_session/,"Patient BFF must use original patient cookie");
must(read("apps/web/src/app/api/healthcare-assistance/center-receipts/[...parts]/route.ts"),
 /cg_staff_session/,"Staff BFF must use original staff cookie");
must(read(web+"patient-center-collection-summary.tsx"),
 /center-receipts\/me\/appointments/,"Public Website receipt access missing");
console.log("CG17 US004 source parse/contract preflight PASS. "+
 "PostgreSQL, storage, security, Web, Android and independent QA NOT_RUN.");
