import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";

/** Read-only inspection. Run only on a disposable migrated PostgreSQL QA DB.
 * It does not create or mutate real Foundation staff, sessions, or patient data.
 */
test("CG-MB-001 new CG02 source: real composite FKs, immutable history and active-scope uniqueness",
 {timeout:20000},async()=>{
 const url=process.env.DATABASE_URL;
 assert.ok(url,"Use DATABASE_URL for a disposable migrated CareGanga QA database");
 const db=new Client({connectionString:url,connectionTimeoutMillis:5000,
  statement_timeout:9000,application_name:"careganga-cg02-staff-scope-qa"});
 await db.connect();
 try{
  await db.query("BEGIN READ ONLY");
  const table=await db.query<{name:string|null}>(
   "SELECT to_regclass('cg02_staff_scope_assignment')::text AS name");
  assert.equal(table.rows[0]?.name,"cg02_staff_scope_assignment");
  const fks=await db.query<{definition:string}>(`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c WHERE c.conrelid='cg02_staff_scope_assignment'::regclass
      AND c.contype='f'`);
  for(const name of ["account","branch","geography_area"])
   assert.ok(fks.rows.some(x=>x.definition.includes("REFERENCES "+name+"(")
     &&x.definition.includes("root_realm_id")),
     "Missing same-root source FK for "+name);
  const idx=await db.query<{indexname:string;indexdef:string}>(
   "SELECT indexname,indexdef FROM pg_indexes WHERE tablename='cg02_staff_scope_assignment'");
  assert.ok(idx.rows.some(x=>x.indexname==="ux_cg02_active_staff_scope"&&
   x.indexdef.includes("ended_at IS NULL")));
  assert.ok(idx.rows.some(x=>x.indexname==="ux_cg02_staff_scope_end_key"));
  assert.ok(idx.rows.some(x=>x.indexname==="ux_cg02_active_staff_all_branches"&&
   x.indexdef.includes("scope_kind")&&x.indexdef.includes("ALL_BRANCHES")));
  const checkExpr=await db.query<{definition:string}>(
   "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint "+
   "WHERE conrelid='cg02_staff_scope_assignment'::regclass AND contype='c'");
  assert.ok(checkExpr.rows.some(x=>x.definition.includes("ALL_BRANCHES")));
  const triggers=await db.query<{tgname:string;enabled:string;definition:string}>(`
    SELECT t.tgname,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t WHERE t.tgrelid='cg02_staff_scope_assignment'::regclass
      AND NOT t.tgisinternal`);
  const immutable=triggers.rows.find(x=>x.tgname==="cg02_staff_scope_no_retarget");
  assert.ok(immutable&&["O","A"].includes(immutable.enabled));
  assert.match(immutable?.definition??"",/BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/);
  const checks=await db.query<{definition:string}>(`
    SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='cg02_staff_scope_assignment'::regclass AND contype='c'`);
  assert.ok(checks.rows.some(x=>x.definition.includes("scope_kind")));
  assert.ok(checks.rows.some(x=>x.definition.includes("ended_at")));
  await db.query("ROLLBACK");
 }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
 finally{await db.end();}
});
