import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const read=(p:string)=>readFileSync(join(import.meta.dirname,"..",p),"utf8");
const sql=read("db/migrations/3605_cg06_original_aid_fulfillment.sql");
const svc=read("src/modules/cg-06-beneficiaries-assistance/application/assistance-fulfillment.service.ts");
const report=read("src/modules/cg-06-beneficiaries-assistance/application/beneficiary-report.service.ts");
test("US-002 source contract: unique original effects, exact handover and linked corrections",()=>{
 for(const fragment of ["UNIQUE(root_realm_id,stock_operation_ref)","UNIQUE(root_realm_id,voucher_ref)","UNIQUE(root_realm_id,fulfillment_id,action)","CREATE TRIGGER cg06_aid_allocation_guard","CREATE TRIGGER cg06_aid_delivery_guard","CREATE TRIGGER cg06_recovery_source_guard","cg06_recovery_journal","Exact posted verified payment required","Current clean handover proof required"])assert.ok(sql.includes(fragment),fragment);
 assert.ok(svc.includes("ISSUED_AWAITING_HANDOVER"));assert.ok(svc.includes("PAID_AWAITING_HANDOVER"));
 assert.ok(svc.includes("prepareAidRecovery"));assert.ok(svc.includes("confirmRecovery"));
 assert.ok(svc.includes("guardAssistanceProof"));
});
test("US-003 source contract: scoped snapshot, separate unit totals, bounded protected exports",()=>{
 for(const fragment of ["reportScope(tx,a,q)","count(DISTINCT beneficiary_id)","GROUP BY i.id,i.sku_norm,i.name,e.unit_code","beneficiaries.reports.export","beneficiary_report_access","LIMIT 501","AID_HISTORY","reportCsvCell","b.consent_revoked_at IS NULL","readBeneficiaryImpactForMIS"])assert.ok(report.includes(fragment),fragment);
 assert.ok(read("db/migrations/3606_cg06_protected_report_audit.sql").includes("cg06_report_access_immutable"));
 assert.ok(read("src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts").includes("count===item?.value"));
});
// These are static contract assertions only. Real migrations, authenticated
// database transactions, concurrency, provider evidence and UI remain separate.
