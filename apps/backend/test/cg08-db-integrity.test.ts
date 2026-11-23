import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Read-only original CG08 US001-QA19 schema verification on an already
 * migrated disposable PostgreSQL QA database. No production mutations. */
test("CG08 3401-3403 original partner/CG19/CG03 schema protection",{timeout:20_000},async()=>{
 const url=process.env.TEST_DATABASE_URL;
 assert.ok(url,"Set a disposable migrated TEST_DATABASE_URL (not production)");
 assert.match(new URL(url).pathname.toLowerCase(),/test|qa/,"Refuse a DB name without test/qa marker");
 const db=new Client({connectionString:url,connectionTimeoutMillis:5000,
  statement_timeout:9000,application_name:"careganga-cg08-readonly-qa"});
 await db.connect();
 try{
  await db.query("BEGIN READ ONLY");
  for(const name of ["csr_partner","csr_partner_command","csr_partner_review_snapshot",
   "cg19_csr_evidence_event","cg03_csr_process_current"]){
   const q=await db.query<{ref:string|null}>("SELECT to_regclass($1)::text AS ref",[name]);
   assert.ok(q.rows[0]?.ref,"Missing real migrated owner table: "+name);
  }
  const migrations=["3401_cg08_csr_partner_drafts.sql",
   "3402_cg19_csr_agreement_evidence.sql","3403_cg03_csr_partner_review.sql"];
  const applied=await db.query<{filename:string}>(
   "SELECT filename FROM schema_migration WHERE filename=ANY($1::text[])",[migrations]);
  assert.equal(applied.rowCount,3,"CG08 migration family must be complete");
  const owners=["csr_partner","csr_partner_command","csr_partner_review_snapshot",
   "cg19_csr_evidence_event","cg03_csr_process_current","cg19_upload_intent",
   "cg19_stored_file","cg03_case","cg03_case_decision"];
  const result=await db.query<{rel:string;name:string;enabled:string;deferred:boolean}>(
   "SELECT c.relname AS rel,t.tgname AS name,t.tgenabled AS enabled,t.tgdeferrable AS deferred "+
   "FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
   "WHERE c.relname=ANY($1::text[]) AND NOT t.tgisinternal",[owners]);
  const triggers=new Map(result.rows.map(x=>[x.name,x]));
  for(const name of ["cg08_partner_write_guard","cg08_partner_status_proof_after",
   "cg08_partner_command_no_change","csr_partner_snapshot_immutable",
   "cg03_csr_process_current_guard","cg03_csr_case_write","cg03_csr_decision_insert",
   "cg19_csr_evidence_event_immutable","cg19_csr_intent_owner_immutable",
   "cg19_csr_file_owner_immutable"]){
    const row=triggers.get(name);
    assert.ok(row,"Original source protection trigger missing: "+name);
    assert.ok(["O","A"].includes(row.enabled),"Disabled original guard: "+name);
  }
  assert.equal(triggers.get("cg08_partner_status_proof_after")?.deferred,true,
   "Proof of CG03 decision must be checked at COMMIT");
  assert.equal(triggers.get("cg03_csr_case_write")?.rel,"cg03_case");
  assert.equal(triggers.get("cg03_csr_decision_insert")?.rel,"cg03_case_decision");
  const constraints=await db.query<{rel:string;definition:string}>(
   "SELECT c.relname AS rel,pg_get_constraintdef(o.oid) AS definition "+
   "FROM pg_constraint o JOIN pg_class c ON c.oid=o.conrelid "+
   "WHERE c.relname=ANY($1::text[]) AND o.contype IN('f','c','u','p')",
   [["csr_partner","csr_partner_review_snapshot","cg19_upload_intent",
    "cg19_stored_file","cg03_case","cg03_process"]]);
  const defs=(name:string)=>constraints.rows.filter(x=>x.rel===name).map(x=>x.definition).join("\n");
  assert.match(defs("csr_partner"),/UNIQUE \(root_realm_id, legal_name_norm\)/);
  assert.match(defs("csr_partner"),/FOREIGN KEY \(branch_ref, root_realm_id\) REFERENCES branch/);
  assert.match(defs("csr_partner_review_snapshot"),/REFERENCES cg19_stored_file/);
  assert.match(defs("cg03_case"),/REFERENCES csr_partner_review_snapshot/);
  assert.match(defs("cg03_case"),/CSR_PARTNER_REVIEW/);
  assert.match(defs("cg03_process"),/CSR_PARTNER_REVIEW/);
  assert.match(defs("cg19_upload_intent"),/CG08_CSR_AGREEMENT/);
  assert.match(defs("cg19_upload_intent"),/CSR_AGREEMENT/);
  assert.match(defs("cg19_stored_file"),/CG08_CSR_AGREEMENT/);
  const cols=await db.query<{table_name:string}>(
   "SELECT table_name FROM information_schema.columns "+
   "WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) "+
   "AND column_name='csr_partner_id'",[["cg19_upload_intent","cg19_stored_file"]]);
  assert.deepEqual(new Set(cols.rows.map(x=>x.table_name)),
   new Set(["cg19_upload_intent","cg19_stored_file"]));
  await db.query("ROLLBACK");
 }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
 finally{await db.end();}
});
