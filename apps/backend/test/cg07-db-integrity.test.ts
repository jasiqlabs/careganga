import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/**
 * CG07 G07-01/02 actual PostgreSQL migration smoke check (3301–3305).
 * Run ONLY on a disposable migrated test database with DATABASE_URL set.
 * This does not insert sample donations, fake approvals or alter live data.
 * It is not a substitute for the original 20-case scenario/transaction QA.
 */
test("CG07 3301–3305 installed: guarded lifecycle, CG19 media and protected CG03 cases",{
 timeout:15_000
},async()=>{
 const url=process.env.DATABASE_URL;
 assert.ok(url,"DATABASE_URL required: select a disposable migrated CareGanga QA database. No silent skips.");
 const client=new Client({connectionString:url,connectionTimeoutMillis:5000,
  statement_timeout:7000,application_name:"careganga-cg07-migration-qa"});
 await client.connect();
 try{
  await client.query("BEGIN READ ONLY");
  const table=await client.query<{relname:string}>(`
   SELECT relname FROM pg_class
   WHERE oid IN(to_regclass('campaign'),to_regclass('campaign_revision'),
     to_regclass('campaign_status_event'),to_regclass('campaign_review_snapshot'))
     AND relkind='r'`);
  assert.deepEqual(new Set(table.rows.map(x=>x.relname)),
   new Set(["campaign","campaign_revision","campaign_status_event","campaign_review_snapshot"]));

  const triggers=await client.query<{tgname:string;tgenabled:string;tgdeferrable:boolean}>(`
   SELECT t.tgname,t.tgenabled,t.tgdeferrable
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.oid='campaign'::regclass AND NOT t.tgisinternal`);
  const selected=new Map(triggers.rows.map(x=>[x.tgname,x]));
  assert.equal(selected.has("cg07_campaign_draft_only"),false,
   "3303 must retire the 3301 temporary draft-only blocker, otherwise CG03 submission always fails");
  assert.equal(selected.get("cg07_campaign_status_proof_after")?.tgdeferrable,true,
   "3303 must install deferred lifecycle proof before retiring the blocker");
  assert.ok(["O","A"].includes(selected.get("cg07_campaign_status_proof_after")?.tgenabled??""),
   "CG07 lifecycle protection must be enabled");

  const ownerTriggers=await client.query<{relname:string;tgname:string;tgenabled:string}>(`
   SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t
   JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.oid IN('cg03_case'::regclass,'cg03_case_decision'::regclass)
    AND t.tgname IN('cg03_campaign_case_write','cg03_campaign_decision_insert')
    AND NOT t.tgisinternal`);
  assert.deepEqual(new Set(ownerTriggers.rows.map(x=>x.tgname)),
   new Set(["cg03_campaign_case_write","cg03_campaign_decision_insert"]));
  assert.ok(ownerTriggers.rows.every(x=>["O","A"].includes(x.tgenabled)),
   "CG03 independent review constraints must remain enabled");

  const fks=await client.query<{conname:string;definition:string}>(`
   SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
   WHERE conrelid='campaign'::regclass AND contype='f'`);
  const descriptions=fks.rows.map(x=>x.definition).join("\n");
  for(const owner of ["campaign_revision","project","project_activity","volunteer"])
   assert.match(descriptions,new RegExp("REFERENCES "+owner+"\\("),
    "Original CG07 campaign must remain bound to current same-root source: "+owner);

  const processChecks=await client.query<{definition:string}>(`
   SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
   WHERE conrelid='cg03_process'::regclass AND contype='c'`);
  const caseChecks=await client.query<{definition:string}>(`
   SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
   WHERE conrelid='cg03_case'::regclass AND contype='c'`);
  assert.ok(processChecks.rows.some(x=>x.definition.includes("CAMPAIGN_LAUNCH")),
   "Original CG03 process requires a real campaign kind");
  assert.ok(caseChecks.rows.some(x=>x.definition.includes("CAMPAIGN_LAUNCH")),
   "Original CG03 review case requires a real campaign kind");

  const immutable=await client.query<{tgname:string}>(`
   SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND
    ((tgrelid='campaign_revision'::regclass AND tgname='cg07_campaign_revision_immutable') OR
     (tgrelid='campaign_status_event'::regclass AND tgname='cg07_campaign_event_immutable'))`);
  assert.equal(immutable.rowCount,2,"Campaign revisions and events must be immutable");
  const media=await client.query<{tgname:string;tgenabled:string}>(`
    SELECT tgname,tgenabled FROM pg_trigger
    WHERE tgrelid IN('cg19_upload_intent'::regclass,'cg19_stored_file'::regclass,'campaign'::regclass)
      AND tgname IN('cg19_campaign_intent_identity','cg19_campaign_file_identity','cg07_campaign_media_proof_after')
      AND NOT tgisinternal`);
  assert.deepEqual(new Set(media.rows.map(x=>x.tgname)),
    new Set(['cg19_campaign_intent_identity','cg19_campaign_file_identity','cg07_campaign_media_proof_after']));
  assert.ok(media.rows.every(x=>['O','A'].includes(x.tgenabled)),"CG19 media guard must be enabled");
  const lifecycle=await client.query<{definition:string}>(`
    SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='campaign_status_event'::regclass
      AND conname='cg07_campaign_event_operation_check'`);
  assert.equal(lifecycle.rowCount,1,"3305 original protected campaign lifecycle migration required");
  for(const action of ['PAUSE','RESUME','CLOSE','WITHDRAW','CANCEL_DRAFT'])
    assert.ok(lifecycle.rows[0].definition.includes(action),"missing 3305 operation "+action);
  const columns=await client.query<{table_name:string}>(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name IN('cg19_upload_intent','cg19_stored_file')
      AND column_name='campaign_id'`);
  assert.deepEqual(new Set(columns.rows.map(x=>x.table_name)),
    new Set(['cg19_upload_intent','cg19_stored_file']));
  await client.query("COMMIT");
 }catch(error){
  try{await client.query("ROLLBACK");}catch{/* retain exact test failure */}
  throw error;
 }finally{await client.end();}
});
