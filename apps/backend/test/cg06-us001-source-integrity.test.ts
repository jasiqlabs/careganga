import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

// Contract/source-integrity guards; execution against a real PostgreSQL database
// remains a distinct QA gate. These assertions prevent malformed or repeated
// migration contents being mistaken for a successful source checkpoint.
const sql=readFileSync(join(import.meta.dirname,"../db/migrations/3601_cg06_beneficiary_private_intake.sql"),"utf8");
test("US-001-QA19: 3601 migration is exactly one coherent additive source",()=>{
 for(const table of ["beneficiary","beneficiary_command","beneficiary_verification_event","beneficiary_project_link"]){
  assert.equal(sql.match(new RegExp("CREATE TABLE "+table+" \\(","g"))?.length,1,table+" must appear once");
 }
 assert.ok(sql.length<12000,"unexpected duplicated or concatenated migration");
 assert.match(sql,/contact_mobile text CHECK\(contact_mobile IS NULL OR contact_mobile ~ '\^\[\+\]/);
 assert.match(sql,/representative_contact text CHECK\(representative_contact IS NULL OR representative_contact ~ '\^\[\+\]/);
 assert.match(sql,/beneficiary_id uuid NOT NULL/);
 assert.match(sql,/reason text NOT NULL DEFAULT ''/);
 assert.match(sql,/payload_digest char\(64\).*\{64\}\$'/);
 assert.match(sql,/UNIQUE\(root_realm_id,actor_ref,request_key\)/);
 assert.match(sql,/UNIQUE\(root_realm_id,display_ref\)/);
 assert.doesNotMatch(sql,/UNIQUE\(.*contact_mobile/);
});
test("US-001-QA02/19: every private owner uses real root-branch foreign keys",()=>{
 for(const rel of ["beneficiary","beneficiary_project_link","beneficiary_verification_event","beneficiary_command"])
  assert.match(sql,new RegExp("CREATE TABLE "+rel+"[\\s\\S]*?root_realm_id uuid NOT NULL"));
 assert.match(sql,/FOREIGN KEY\(branch_scope_id,root_realm_id\) REFERENCES branch\(id,root_realm_id\)/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,project_ref\) REFERENCES project\(root_realm_id,id\)/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,beneficiary_id\) REFERENCES beneficiary\(root_realm_id,id\)/);
});
test("US-001-QA11/12: unapproved profile cannot claim verified",()=>{
 assert.match(sql,/verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL/);
 assert.match(sql,/consent_revoked_at/);
 assert.match(sql,/CREATE TRIGGER cg06_command_immutable/);
 assert.match(sql,/CREATE TRIGGER cg06_verification_immutable/);
});
