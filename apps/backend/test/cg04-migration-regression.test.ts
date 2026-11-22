import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=(name:string)=>readFileSync(new URL("../db/migrations/"+name,import.meta.url),"utf8");
const count=(source:string,fragment:string)=>source.split(fragment).length-1;
test("CG04 US002 QA07/18: one original refund source, correct column and immutable guard",()=>{
 const m=migration("3206_cg09_membership_fee_source.sql");
 assert.equal(count(m,"CREATE TABLE finance_membership_refund_posting("),1);
 assert.equal(count(m,"CREATE FUNCTION cg09_member_refund_posting_guard"),1);
 assert.equal(count(m,"CREATE VIEW finance_membership_verified_refund"),1);
 assert.equal(count(m,"CREATE FUNCTION cg09_membership_fee_pin_guard"),1);
 assert.match(m,/transfer_reference text NOT NULL CHECK\(transfer_reference ~ '\^\[A-Za-z0-9\.\_\/: -\]\{4,100\}\$'\),password_verified_at timestamptz NOT NULL/);
 assert.doesNotMatch(m,/^\),password_verified_at/m);
 assert.match(m,/original_reconciliation_id/);
 assert.match(m,/scan_status='CLEAN_VERIFIED'/);
 assert.match(m,/WHERE r.status='VERIFIED'/);
});
test("CG04 US002 QA07: preserve existing invoice refunds and add only exact original member source",()=>{
 const original=migration("0930_cg09_issued_invoice_credit_notes_and_refunds.sql");
 const extension=migration("3210_cg09_membership_refund_guard_alignment.sql");
 for(const key of ["cg09_require_invoice_adjustment_proof","cg09_guard_refund_statement_match"]){
  assert.match(original,new RegExp("CREATE FUNCTION "+key));
  assert.match(extension,new RegExp("CREATE OR REPLACE FUNCTION "+key));
 }
 assert.match(extension,/FROM finance_membership_refund_posting/);
 assert.match(extension,/FROM finance_invoice_refund/);
 assert.match(extension,/m\.request_key=NEW\.immutable_source_event_key/);
 assert.match(extension,/NEW\.bank_item_ref IS DISTINCT FROM requested\.transfer_reference/);
 assert.match(extension,/NEW\.statement_amount_minor IS DISTINCT FROM -requested\.amount_minor/);
});
test("CG04 US002 QA14/18: no second member identity, keep immutable historical term",()=>{
 const m=migration("3208_cg04_membership_renewal.sql");
 assert.match(m,/CREATE OR REPLACE FUNCTION cg04_term_insert_guard/);
 assert.match(m,/NEW\.effect_kind='RENEW'/);
 assert.match(m,/daterange\(t\.starts_on,t\.expires_on,'\[\)'\)&&daterange/);
 assert.match(m,/t\.expires_on IS NULL/);
 assert.match(m,/CREATE TRIGGER cg04_renewal_effect_insert/);
});
