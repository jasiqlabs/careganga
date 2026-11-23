import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Read-only verification of actual CG07 US002/003 database changes.
 * Run against a disposable migrated PostgreSQL QA DB. This test never
 * claims to have performed donor payments, external webhooks or a backup. */
test("CG07 US002/003: 3306–3319 installed and finance/receipt evidence guards enabled",
 {timeout:20000},async()=>{
  const url=process.env.DATABASE_URL;
  assert.ok(url,"Set DATABASE_URL for an isolated migrated CareGanga QA PostgreSQL DB");
  const db=new Client({connectionString:url,connectionTimeoutMillis:5000,
   statement_timeout:9000,application_name:"careganga-cg07-donation-migration-qa"});
  await db.connect();
  try{
   await db.query("BEGIN READ ONLY");
   const tables=["donation","donation_payment_attempt","donation_payment_event",
    "donation_finance_effect","donation_manual_evidence","cg07_public_request_bucket",
    "cg19_donation_receipt_document","donation_refund_request","cg19_donation_receipt_correction",
    "cg19_donation_receipt_message","cg19_donation_private_proof","donation_bank_collection",
    "donation_provider_refund"];
   for(const name of tables){
    const found=await db.query<{ref:string|null}>("SELECT to_regclass($1)::text AS ref",[name]);
    assert.ok(found.rows[0]?.ref,"Missing migrated CG07/CG19 table: "+name);
   }
   const triggers=await db.query<{table_name:string;tgname:string;tgenabled:string;
     tgdeferrable:boolean;definition:string}>(`
    SELECT c.relname AS table_name,t.tgname,t.tgenabled,t.tgdeferrable,
      pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname=ANY($1::text[]) AND NOT t.tgisinternal
    `,[tables]);
   const map=new Map(triggers.rows.map(t=>[t.tgname,t]));
   const essential=[
    "cg07_donation_finance_guard","cg07_payment_event_immutable",
    "cg07_guard_payment_event","cg07_manual_proof_immutable",
    "cg07_refund_source_reserve","cg07_refund_requires_posted_finance",
    "cg19_donation_receipt_proof","cg19_donation_receipt_no_rewrite",
    "cg19_correction_history_guard","cg19_correction_posted_refund",
    "cg19_donation_message_guard","cg19_donation_proof_guard",
    "cg07_bank_collection_immutable","cg07_bank_collection_posted_proof",
    "cg07_provider_refund_no_retarget","cg07_refund_channel_no_retarget",
    "cg07_provider_refund_requires_channel","cg07_donation_branch_no_retarget"];
   for(const name of essential){
    const t=map.get(name);
    assert.ok(t,"Missing critical source protection trigger: "+name);
    assert.ok(t&&["O","A"].includes(t.tgenabled),"Disabled source guard: "+name);
   }
   assert.equal(map.get("cg07_donation_finance_guard")?.tgdeferrable,true);
   assert.match(map.get("cg07_donation_finance_guard")?.definition??"",/AFTER INSERT OR UPDATE/);
   assert.equal(map.get("cg07_refund_requires_posted_finance")?.tgdeferrable,true);
   assert.equal(map.get("cg19_donation_receipt_proof")?.tgdeferrable,true);
   assert.equal(map.get("cg19_correction_posted_refund")?.tgdeferrable,true);
   assert.equal(map.get("cg07_bank_collection_posted_proof")?.tgdeferrable,true);
   const constraints=await db.query<{table_name:string;conname:string;definition:string}>(`
    SELECT c.relname AS table_name,co.conname,pg_get_constraintdef(co.oid) AS definition
    FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
    WHERE c.relname=ANY($1::text[])
     AND co.contype IN('f','u','p','c')
    `,[tables]);
   for(const table of ["donation","donation_payment_attempt","donation_payment_event",
    "donation_finance_effect","donation_refund_request","cg19_donation_receipt_document","cg19_donation_receipt_correction",
    "cg19_donation_receipt_message","cg19_donation_private_proof","donation_bank_collection",
    "donation_provider_refund"]){
    assert.ok(constraints.rows.some(x=>x.table_name===table&&x.definition.includes("root_realm_id")),
     "No root-scoped integrity contract found for "+table);
   }
   const dd=constraints.rows.filter(x=>x.table_name==="donation_finance_effect");
   assert.ok(dd.some(x=>/REFERENCES journal\(/.test(x.definition)),
    "CG07 finance effect must point to original CG09 journal");
   const doc=constraints.rows.filter(x=>x.table_name==="cg19_donation_receipt_document");
   assert.ok(doc.some(x=>/REFERENCES donation\(/.test(x.definition)),
    "CG19 document must link to the original same-root donation");
   const originalProvider=constraints.rows.filter(x=>x.table_name==="donation_provider_refund");
   assert.ok(originalProvider.some(x=>x.definition.includes("root_realm_id")),
    "Original provider refund must be root-scoped and reference the original donation/payment");
   assert.ok(originalProvider.some(x=>x.definition.includes("provider_receipt")),
    "Original provider refund unique merchant receipt is mandatory");
   const providerTrigger=map.get("cg07_provider_refund_no_retarget");
   assert.ok(providerTrigger&&providerTrigger.definition.includes("BEFORE INSERT OR UPDATE OR DELETE"),
    "Immutable merchant refund evidence trigger must protect all modifications");
   const donationBranchGuard=map.get("cg07_donation_branch_no_retarget");
   assert.ok(donationBranchGuard&&donationBranchGuard.definition.includes("BEFORE INSERT OR UPDATE"),
    "Original campaign donation branch must be checked on creation and immutable thereafter");
      const channel=map.get("cg07_refund_channel_no_retarget");
   assert.ok(channel&&channel.definition.includes("BEFORE UPDATE"),
    "Refund cash versus online settlement method must remain immutable");
      const payment=await db.query<{indexdef:string}>(`
    SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema()
     AND tablename='donation_payment_event'`);
   assert.ok(payment.rows.some(x=>x.indexdef.includes("external_event_id")&&
     x.indexdef.includes("merchant_reference")),"Signed event dedupe index is mandatory");
   await db.query("COMMIT");
  }catch(e){try{await db.query("ROLLBACK");}catch{}throw e;}
  finally{await db.end();}
 });
