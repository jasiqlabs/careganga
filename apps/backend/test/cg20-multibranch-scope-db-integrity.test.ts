import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Read-only schema check; run on a disposable fully migrated CareGanga database. */
test("CG-MB-008/009 actual PostgreSQL CG20 original report scope cannot silently widen",{
 timeout:20000},async()=>{
 const url=process.env.DATABASE_URL;
 assert.ok(url,"Use a migrated disposable PostgreSQL DATABASE_URL, never production");
 const db=new Client({connectionString:url,connectionTimeoutMillis:5000,statement_timeout:9000,
  application_name:"cg20-multibranch-readonly-integrity"});
 await db.connect();
 try{
  await db.query("BEGIN READ ONLY");
  const columns=await db.query<{column_name:string;data_type:string;udt_name:string}>(`
    SELECT column_name,data_type,udt_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='cg20_report_run'
    AND column_name IN('original_scope_all','original_scope_branch_refs')`);
  assert.deepEqual(columns.rows.map(x=>x.column_name).sort(),
   ["original_scope_all","original_scope_branch_refs"]);
  assert.equal(columns.rows.find(x=>x.column_name==="original_scope_all")?.data_type,"boolean");
  assert.equal(columns.rows.find(x=>x.column_name==="original_scope_branch_refs")?.udt_name,"_uuid");
  const c=await db.query<{conname:string;definition:string}>(`
    SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='cg20_report_run'::regclass AND contype='c'`);
  for(const name of ["cg20_report_run_original_scope_proof","cg20_finance_ready_scope_guard"])
   assert.ok(c.rows.some(x=>x.conname===name));
  const triggers=await db.query<{tgname:string;tgenabled:string;definition:string}>(`
    SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition
    FROM pg_trigger WHERE tgrelid='cg20_report_run'::regclass AND NOT tgisinternal`);
  assert.ok(triggers.rows.some(x=>x.tgname==="cg20_report_run_scope_no_retarget"&&
   ["O","A"].includes(x.tgenabled)&&/BEFORE UPDATE/.test(x.definition)));
  await db.query("ROLLBACK");
 }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
 finally{await db.end();}
});
