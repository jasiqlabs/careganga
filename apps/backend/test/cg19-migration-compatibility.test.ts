import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {composeCg19HistoricalMigration} from "../db/cg19-migration-compatibility";

const names=["1402_cg19_health_draft_evidence.sql","1407_cg19_doctor_original_private_license.sql","1411_cg19_doctor_private_portrait_source.sql","1415_cg19_original_center_content_media_and_rights.sql","1417_cg19_center_support_original_attachments.sql"];
for(const name of names)test("CG19 historical source composition: "+name,()=>{
 const original=readFileSync(join(process.cwd(),"db/migrations",name),"utf8");
 const result=composeCg19HistoricalMigration(name,original);
 assert.notEqual(result,original);
 assert.match(result,/CG09_CLAIM/);
 assert.match(result,/FINANCE_CLAIM_BILL/);
 assert.match(result,/CG02_BRANCH/);
 assert.match(result,/CG14_DRAFT/);
 assert.throws(()=>composeCg19HistoricalMigration(name,original+" "),/bytes changed/);
 if(name.startsWith("1402"))assert.match(result,/DROP CONSTRAINT cg19_intent_owner_kind_voucher/);
 if(name.startsWith("1402")||name.startsWith("1407"))assert.match(result,/num_nonnulls\(case_id,registration_id,branch_id,voucher_id,claim_id,reconciliation_id,health_provider_id/);
});
test("ordinary migration SQL is unchanged",()=>assert.equal(composeCg19HistoricalMigration("other.sql","SELECT 1"),"SELECT 1"));
