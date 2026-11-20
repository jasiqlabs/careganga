/** CG16 US005 source-only grammar and ownership verification.
 * This is NOT live Postgres, browser, Android, security, clinical or p95 QA.
 * No CI and no extra QA tracker. Results belong to original tasks.md US005.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const files=[
"apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-equipment.service.ts",
"apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-quality-evidence.service.ts",
"apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-admission.service.ts",
"apps/backend/src/modules/cg-16-healthcare-diagnostics/http/clinical-lab-equipment.controller.ts",
"apps/backend/src/modules/cg-16-healthcare-diagnostics/diagnostics.module.ts",
"apps/web/src/features/diagnostics/lab-equipment-workspace.tsx",
"apps/web/src/features/diagnostics/lab-equipment-quality-upload.tsx",
"apps/web/src/features/diagnostics/foundation-lab-equipment-overview.tsx",
"apps/web/src/app/api/lab-equipment/[...parts]/route.ts",
"apps/web/src/app/(admin)/admin/health-network/equipment/page.tsx",
"apps/web/src/app/(admin)/center/page.tsx",
"apps/web/src/features/health-network/center-draft-portal.tsx",
"apps/web/src/shared/foundation-admin-nav.tsx",
"apps/android-internal/src/features/diagnostics/native-lab-equipment-screen.tsx",
"apps/android-internal/src/features/diagnostics/native-lab-equipment-quality-upload.tsx",
"apps/android-internal/src/features/dashboard/dashboard-modules.ts",
"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"
];
for(const p of files){
 const input=read(p);
 const source=ts.createSourceFile(p,input,ts.ScriptTarget.Latest,true,
  p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0,p+": "+
 source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join(" | "));
 assert.doesNotMatch(input,/^(<{7}|={7}|>{7})/m,"Git conflict marker in "+p);
}
const sql=read("apps/backend/db/migrations/1610_cg16_optional_lab_equipment.sql");
const proof=read("apps/backend/db/migrations/1611_cg19_private_lab_quality_evidence.sql");
const service=read(files[0]),filesSvc=read(files[1]),admission=read(files[2]);
const web=read(files[5]),webUpload=read(files[6]);
const native=read(files[13]),nativeUpload=read(files[14]);
const has=(s,...needles)=>needles.every(v=>s.includes(v));
const qa={
QA01:has(admission,"requireEquipmentCurrent")&&has(service,"INSERT INTO lab_equipment"),
QA02:has(admission,"CAREGANGA_ERP_LAB_ENABLED","this.lab.assertLab"),
QA03:has(sql,"UNIQUE(root_realm_id,center_ref,equipment_code)",
 "UNIQUE(root_realm_id,actor_ref,request_key)")&&has(service,"pg_advisory_xact_lock"),
QA04:has(proof,"cg16_equipment_ready_requires_quality","CLEAN_VERIFIED")&&
 has(service,"LAB_EQUIPMENT_PROOF_NOT_VERIFIED"),
QA05:has(service,"CALIBRATION_DUE","OUT_OF_SERVICE"),
QA06:has(sql,"cg16_equipment_event_required")&&has(service,"expectedVersion","FOR UPDATE"),
QA07:has(filesSvc,"verifyPrivateObject","readVerifiedPrivateObject")&&
 has(webUpload,"crypto.subtle.digest")&&has(nativeUpload,"createUploadTask"),
QA08:has(filesSvc,"requireEquipmentCurrent","revoked_at IS NULL")&&
 has(sql,"FOREIGN KEY(root_realm_id,center_ref)"),
QA09:has(web,"accreditation")&&has(native,"accreditation"),
QA10:!has(sql,"stock_quantity")&&!has(service,"stock_transaction"),
QA11:has(read(files[7]),"verified CG14","Lab Equipment & Quality")&&
 has(read(files[11]),"LabEquipmentWorkspace")&&has(native,"NativeLabEquipmentQualityUpload"),
QA12:has(sql,"ix_lab_equipment_due")&&has(service,"effective_readiness")&&
 !has(service,"setInterval")&&!has(service,"node-cron"),
QA13:has(admission,"LAB_EQUIPMENT_DISABLED")&&has(sql,"lab_equipment_event"),
QA14:!has(service,"lab_order")&&!has(service,"cg15_patient"),
QA15:has(filesSvc,"readVerifiedPrivateObject")&&has(proof,"cg19_lab_quality_file_immutable"),
QA16:has(read(files[12]),"healthLabEquipment")&&has(read(files[15]),"lab.equipment.view")&&
 has(read(files[3]),"@Controller(\"api/v1/diagnostics/equipment\")")
};
for(const [key,ok]of Object.entries(qa))assert.ok(ok,"Original CG16 US005 "+key+" missing implementation source");
assert.equal(Object.keys(qa).length,16);
assert.match(proof,/CREATE TRIGGER cg19_lab_quality_intent_immutable/,
 "Original private upload cannot be retargeted");
assert.match(proof,/cg16_equipment_ready_proof_guard/,
 "A client must not set readiness without original proof");
console.log("CG16 US005 TS/TSX PARSE + 16/16 ORIGINAL SOURCE CASES VERIFIED ONLY; runtime QA NOT_RUN.");
