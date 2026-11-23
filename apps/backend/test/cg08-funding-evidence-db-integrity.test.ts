import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Read-only against a disposable already-migrated test/qa PostgreSQL DB.
 * Never invoke this on production. Complements manual 2-branch/provider QA. */
test("CG08 US002 3406–3408 current funding/CG19/CG03 proof integrity",
 {timeout:20_000},async()=>{
 const url=process.env.TEST_DATABASE_URL;
 assert.ok(url,"Set disposable migrated TEST_DATABASE_URL, never production.");
 assert.match(new URL(url).pathname.toLowerCase(),/test|qa/,"Non-test DB refused");
 const pg=new Client({connectionString:url,connectionTimeoutMillis:5000,
  statement_timeout:9000,application_name:"careganga-cg08-funding-proof-readonly-qa"});
 await pg.connect();
 try{
  await pg.query("BEGIN READ ONLY");
  const migrations=["3406_cg08_csr_funding_proposals.sql",
   "3407_cg19_csr_funding_agreement_evidence.sql",
   "3408_cg03_csr_funding_review.sql",
   "3409_cg09_csr_verified_bank_receipt_links.sql"];
  const m=await pg.query<{filename:string}>(
   "SELECT filename FROM schema_migration WHERE filename=ANY($1::text[])",[migrations]);
  assert.equal(m.rowCount,migrations.length,"All three original funding migrations are required");
  for(const name of ["csr_funding_proposal","csr_funding_command",
   "cg19_upload_intent","cg19_stored_file","cg19_funding_evidence_event",
   "csr_funding_review_snapshot","cg03_funding_process_current",
   "finance_csr_verified_receipt_link"]){
   const t=await pg.query<{ref:string|null}>("SELECT to_regclass($1)::text AS ref",[name]);
   assert.ok(t.rows[0]?.ref,name+" missing");
  }
  const constraints=await pg.query<{rel:string;name:string;def:string}>(
   "SELECT c.relname AS rel,k.conname AS name,pg_get_constraintdef(k.oid) AS def "+
   "FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid "+
   "WHERE c.relname=ANY($1::text[]) AND k.contype IN('f','c','u')",
   [["csr_funding_proposal","cg19_upload_intent","cg19_stored_file",
    "csr_funding_review_snapshot","cg03_case",
    "finance_csr_verified_receipt_link"]]);
  const by=new Map(constraints.rows.map(v=>[v.name,v]));
  for(const name of ["cg19_funding_intent_proposal_fk",
    "cg19_funding_file_proposal_fk","cg19_funding_file_intent_fk",
    "cg19_funding_intent_disjoint","cg19_funding_file_disjoint",
    "uq_cg19_funding_intent_identity","uq_cg19_funding_intent_owner",
    "uq_cg19_funding_file_owner","cg03_funding_review_exact_fk",
    "cg03_funding_review_disjoint"]){
   assert.ok(by.has(name),"Missing original CG19 protected funding guard: "+name);
  }
  const payerAttestation=await pg.query<{required:boolean;type:string}>(
   "SELECT attnotnull AS required,format_type(atttypid,atttypmod) AS type "+
   "FROM pg_attribute WHERE attrelid='finance_csr_verified_receipt_link'::regclass "+
   "AND attname='remitter_attested' AND NOT attisdropped");
  assert.equal(payerAttestation.rows[0]?.required,true,
   "An original bank deposit cannot be attributed without finance operator attestation");
  assert.equal(payerAttestation.rows[0]?.type,"boolean");
  assert.ok(constraints.rows.some(v=>v.rel==="finance_csr_verified_receipt_link"&&
   v.def.includes("UNIQUE (root_realm_id, reconciliation_id)")),
   "One original reconciled bank deposit cannot be attributed twice");
  assert.ok(constraints.rows.some(v=>v.rel==="finance_csr_verified_receipt_link"&&
   v.def.includes("FOREIGN KEY (root_realm_id, funding_proposal_id)")),
   "Original approved CG08 funding parent must share Foundation root");
  assert.match(by.get("cg19_funding_file_intent_fk")!.def,
   /FOREIGN KEY \(upload_intent_id, realm_id, funding_proposal_id, proposal_revision\)/);
  const props=constraints.rows.filter(v=>v.rel==="csr_funding_proposal")
   .map(v=>v.def).join("\n");
  assert.match(props,/csr_share_bps \+ foundation_share_bps/);
  assert.match(props,/REFERENCES csr_partner/);
  assert.match(props,/REFERENCES project/);
  const trigger=await pg.query<{name:string;enabled:string;deferred:boolean}>(
   "SELECT tgname AS name,tgenabled AS enabled,tgdeferrable AS deferred FROM pg_trigger t "+
   "JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname=ANY($1::text[]) "+
   "AND NOT t.tgisinternal",
   [["csr_funding_proposal","cg19_upload_intent","cg19_stored_file",
     "cg19_funding_evidence_event","csr_funding_review_snapshot",
     "cg03_case","cg03_case_decision",
     "finance_csr_verified_receipt_link"]]);
  const triggers=new Map(trigger.rows.map(v=>[v.name,v]));
  for(const name of ["cg08_funding_source_guard",
    "cg19_funding_intent_owner_immutable","cg19_funding_file_owner_immutable",
    "cg19_funding_evidence_event_immutable",
    "csr_funding_review_snapshot_immutable","cg03_funding_case_write",
    "cg03_funding_decision_insert","cg08_funding_status_proof_after",
    "cg09_csr_receipt_link_immutable","cg09_csr_receipt_link_source_guard"]){
   const v=triggers.get(name);assert.ok(v,name+" missing");
   assert.ok(["O","A"].includes(v.enabled),name+" disabled");
  }
  assert.equal(triggers.get("cg08_funding_status_proof_after")?.deferred,true,
   "Commitment status proof must be checked at COMMIT");
  await pg.query("ROLLBACK");
 }catch(e){await pg.query("ROLLBACK").catch(()=>{});throw e;}
 finally{await pg.end();}
});
