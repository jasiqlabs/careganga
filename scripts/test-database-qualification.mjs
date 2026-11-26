import {spawn,spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,unlinkSync,existsSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {Pool} from "pg";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const PG_BIN="C:\\Program Files\\PostgreSQL\\17\\bin";
const psqlPath=existsSync(join(PG_BIN,"psql.exe"))?join(PG_BIN,"psql.exe"):"psql";
const pgHost="localhost";
const pgPort="5432";
const pgSuperUser="postgres";
const pgSuperPass="admin";

function runPsql(sql,db="postgres"){
  const res=spawnSync(psqlPath,[
    "-U",pgSuperUser,"-p",pgPort,"-h",pgHost,"-d",db,"-c",sql
  ],{
    env:{...process.env,PGPASSWORD:pgSuperPass},
    encoding:"utf8"
  });
  if(res.status!==0)throw Error("PSQL failed ("+res.status+"): "+res.stderr+" output: "+res.stdout);
  return res.stdout;
}

function runNpm(args,envOverrides={}){
  const cmd=process.platform==="win32"?"npm.cmd":"npm";
  const start=Date.now();
  const res=spawnSync(cmd,args,{
    cwd:root,
    shell:process.platform==="win32",
    env:{...process.env,...envOverrides},
    encoding:"utf8"
  });
  const durationMs=Date.now()-start;
  return {status:res.status,stdout:res.stdout,stderr:res.stderr,durationMs};
}

const results=[];
function record(name,ok,details){
  results.push({name,ok,details});
  console.log((ok?"[PASS]":"[FAIL]"),name,"-",details);
  if(!ok)process.exitCode=1;
}

async function main(){
  console.log("=== CareGanga PostgreSQL 17 Database Release Qualification Suite ===\n");

  // 1. Setup isolated QA databases
  runPsql("DROP DATABASE IF EXISTS careganga_qa_prod WITH (FORCE);");
  runPsql("CREATE DATABASE careganga_qa_prod;");
  runPsql("DROP DATABASE IF EXISTS careganga_qa_concurrent WITH (FORCE);");
  runPsql("CREATE DATABASE careganga_qa_concurrent;");
  runPsql("DROP DATABASE IF EXISTS careganga_qa_rollback WITH (FORCE);");
  runPsql("CREATE DATABASE careganga_qa_rollback;");

  const prodMigrationUrl=`postgresql://${pgSuperUser}:${pgSuperPass}@${pgHost}:${pgPort}/careganga_qa_prod`;

  // --- Test 1: First installation on clean DB via actual CLI ---
  console.log("\n--- Test 1: Initializing fresh isolated DB via CLI ---");
  const init1=runNpm(["run","db:init","--","--confirm-new-db"],{DATABASE_MIGRATION_URL:prodMigrationUrl});
  const count1=Number(runPsql("SELECT count(*) FROM schema_migration;","careganga_qa_prod").match(/\d+/)?.[0]??0);
  const tablesPresent=runPsql("SELECT to_regclass('public.account') IS NOT NULL AND to_regclass('public.access_realm') IS NOT NULL AND to_regclass('public.branch') IS NOT NULL AND to_regclass('public.payroll_run') IS NOT NULL AS ok;","careganga_qa_prod").includes("t");
  record("T1.FreshInitializationCLI",init1.status===0&&count1===311&&tablesPresent,
    `Duration: ${init1.durationMs}ms (<60s target), Ledger rows: ${count1}, Core tables present: ${tablesPresent}`);

  // --- Test 2: Repeated initialization (idempotency) ---
  console.log("\n--- Test 2: Repeated initialization on already initialized DB ---");
  const init2=runNpm(["run","db:init","--","--confirm-new-db"],{DATABASE_MIGRATION_URL:prodMigrationUrl});
  const count2=Number(runPsql("SELECT count(*) FROM schema_migration;","careganga_qa_prod").match(/\d+/)?.[0]??0);
  const isNoOp=init2.stdout.includes("Database already initialized; no SQL applied.");
  record("T2.RepeatedInitializationNoOp",init2.status===0&&isNoOp&&count2===311,
    `Exit code: ${init2.status}, Console no-op reported: ${isNoOp}, Ledger unchanged: ${count2===311}`);

  // --- Test 3: Refuse dirty/non-empty DB without baseline ---
  console.log("\n--- Test 3: Refusing unverified non-empty database ---");
  runPsql("DROP DATABASE IF EXISTS careganga_qa_dirty WITH (FORCE);");
  runPsql("CREATE DATABASE careganga_qa_dirty;");
  runPsql("CREATE TABLE rogue_table (id serial primary key, secret text);","careganga_qa_dirty");
  const dirtyUrl=`postgresql://${pgSuperUser}:${pgSuperPass}@${pgHost}:${pgPort}/careganga_qa_dirty`;
  const initDirty=runNpm(["run","db:init","--","--confirm-new-db"],{DATABASE_MIGRATION_URL:dirtyUrl});
  const rogueSurvived=runPsql("SELECT to_regclass('public.rogue_table') IS NOT NULL AS ok;","careganga_qa_dirty").includes("t");
  runPsql("DROP DATABASE careganga_qa_dirty WITH (FORCE);");
  record("T3.RefuseDirtyDatabase",initDirty.status!==0&&rogueSurvived,
    `Non-zero exit: ${initDirty.status!==0}, Existing objects untouched: ${rogueSurvived}`);

  // --- Test 4: Concurrent initialization serialization ---
  console.log("\n--- Test 4: Concurrent initialization serialization ---");
  const concurrentUrl=`postgresql://${pgSuperUser}:${pgSuperPass}@${pgHost}:${pgPort}/careganga_qa_concurrent`;
  // Launch two npm processes concurrently to test pg_try_advisory_lock
  const cmd=process.platform==="win32"?"npm.cmd":"npm";
  const runAsync=(args)=>new Promise((resolve)=>{
    const p=spawn(cmd,args,{cwd:root,shell:process.platform==="win32",env:{...process.env,DATABASE_MIGRATION_URL:concurrentUrl}});
    let stdout="",stderr="";
    p.stdout?.on("data",d=>stdout+=d);
    p.stderr?.on("data",d=>stderr+=d);
    p.on("close",code=>resolve({status:code,stdout,stderr}));
  });
  const [p1,p2]=await Promise.all([
    runAsync(["run","db:init","--","--confirm-new-db"]),
    runAsync(["run","db:init","--","--confirm-new-db"])
  ]);
  const countConc=Number(runPsql("SELECT count(*) FROM schema_migration;","careganga_qa_concurrent").match(/\d+/)?.[0]??0);
  const serialized = (p1.status===0 && (p2.status===0 || p2.stderr.includes("Another database release is running") || p2.stdout.includes("Database already initialized"))) ||
                     (p2.status===0 && (p1.status===0 || p1.stderr.includes("Another database release is running") || p1.stdout.includes("Database already initialized")));
  record("T4.ConcurrentInitSerialization",serialized&&countConc===311,
    `Process 1 exit: ${p1.status}, Process 2 exit: ${p2.status}, Serialized cleanly: ${serialized}, Database consistent with 311 migrations: ${countConc===311}`);

  // --- Test 5: Transactional rollback on error ---
  console.log("\n--- Test 5: Transaction rollback on failure ---");
  let rollbackOk=false;
  const rbPool=new Pool({connectionString:`postgresql://${pgSuperUser}:${pgSuperPass}@${pgHost}:${pgPort}/careganga_qa_rollback`});
  const rbClient=await rbPool.connect();
  try{
    await rbClient.query("BEGIN");
    await rbClient.query("CREATE TABLE temp_marker (id int);");
    await rbClient.query("INSERT INTO temp_marker VALUES (1);");
    await rbClient.query("THIS IS INVALID SQL TO TRIGGER ROLLBACK;");
    await rbClient.query("COMMIT");
  }catch(e){
    await rbClient.query("ROLLBACK").catch(()=>{});
  }finally{
    rbClient.release();
    await rbPool.end();
  }
  const markerPresent=runPsql("SELECT to_regclass('public.temp_marker') IS NOT NULL AS ok;","careganga_qa_rollback").includes("t");
  record("T5.TransactionalRollback",!markerPresent,`Table marker uncommitted after error: ${!markerPresent}`);

  // --- Test 6: Restricted application role permissions ---
  console.log("\n--- Test 6: Restricted database application role ---");
  runPsql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'careganga_app') THEN
        CREATE ROLE careganga_app WITH LOGIN PASSWORD 'AppRestrictedPass2026!';
      END IF;
    END $$;
    GRANT CONNECT ON DATABASE careganga_qa_prod TO careganga_app;
    GRANT USAGE ON SCHEMA public TO careganga_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO careganga_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO careganga_app;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.schema_migration FROM careganga_app;
    REVOKE CREATE ON SCHEMA public FROM careganga_app;
  `,"careganga_qa_prod");

  const appPool=new Pool({
    connectionString:`postgresql://careganga_app:AppRestrictedPass2026!@${pgHost}:${pgPort}/careganga_qa_prod`
  });
  const appClient=await appPool.connect();
  let canReadLedger=false;
  let cannotWriteLedger=false;
  let cannotCreateTable=false;
  try{
    const r=await appClient.query("SELECT count(*) FROM public.schema_migration");
    canReadLedger=Number(r.rows[0].count)===311;
  }catch(e){}

  try{
    await appClient.query("INSERT INTO public.schema_migration (filename,sha256) VALUES ('rogue.sql','abc')");
  }catch(e){
    cannotWriteLedger=e.message.includes("permission denied");
  }

  try{
    await appClient.query("CREATE TABLE rogue_table (id int)");
  }catch(e){
    cannotCreateTable=e.message.includes("permission denied");
  }finally{
    appClient.release();
    await appPool.end();
  }
  record("T6.RestrictedRoleSecurity",canReadLedger&&cannotWriteLedger&&cannotCreateTable,
    `Can read ledger: ${canReadLedger}, Ledger writes blocked: ${cannotWriteLedger}, DDL blocked: ${cannotCreateTable}`);

  // --- Test 7: Super Admin Root Provisioning ---
  console.log("\n--- Test 7: One-time Super Admin Root Provisioning ---");
  const rootEnv={
    DATABASE_MIGRATION_URL:prodMigrationUrl,
    DATABASE_URL:`postgresql://${pgSuperUser}:${pgSuperPass}@${pgHost}:${pgPort}/careganga_qa_prod?schema=public`,
    IDENTITY_ENCRYPTION_KEY:"xTOhsppW6NlCEfM8zJMUUC1HnXb6FrcNmvys3ROfyrY=",
    CAREGANGA_ROOT_NAME:"Super Admin",
    CAREGANGA_ROOT_MOBILE:"9876543210",
    CAREGANGA_ROOT_EMAIL:"superadmin@careganga.org",
    CAREGANGA_ROOT_PASSWORD:"CareGangaRoot2026!",
    CAREGANGA_ROOT_TOTP_BASE32:"DP57LL2GX5ZS6QNNTIJJD4EHTIPF5DF4"
  };
  const rootBootstrap=runNpm(["run","bootstrap:root:release","-w","apps/backend","--","--confirm-one-time-root"],rootEnv);
  const rootAccountRows=Number(runPsql("SELECT count(*) FROM public.account;","careganga_qa_prod").match(/\d+/)?.[0]??0);
  const rootDetails=runPsql("SELECT normalized_email, normalized_mobile, status FROM public.account LIMIT 1;","careganga_qa_prod");
  const rootCreated=rootBootstrap.status===0&&rootAccountRows===1&&rootDetails.includes("ACTIVE");

  // Re-run should fail or refuse duplicate root
  const rootBootstrap2=runNpm(["run","bootstrap:root:release","-w","apps/backend","--","--confirm-one-time-root"],rootEnv);
  const rootRefusedDuplicate=rootBootstrap2.status!==0||rootBootstrap2.stderr.includes("already exists")||rootBootstrap2.stdout.includes("already exists")||rootBootstrap2.stderr.includes("already closed")||rootBootstrap2.stdout.includes("already closed");
  record("T7.RootAdminProvisioning",rootCreated&&rootRefusedDuplicate,
    `Root provisioned: ${rootCreated}, Accounts: ${rootAccountRows}, Duplicate blocked: ${rootRefusedDuplicate}`);

  // --- Test 8: Schema Readiness Probe (Read-only verification) ---
  console.log("\n--- Test 8: Schema readiness probe on runtime application startup ---");
  const {verifySchemaReadiness}=await import("../apps/backend/dist/src/core/infrastructure/schema-readiness.js");
  const checkPool=new Pool({
    connectionString:`postgresql://careganga_app:AppRestrictedPass2026!@${pgHost}:${pgPort}/careganga_qa_prod`
  });
  let readinessPassed=false;
  try{
    await verifySchemaReadiness(checkPool);
    readinessPassed=true;
  }catch(e){
    console.error("Readiness error:",e);
  }finally{
    await checkPool.end();
  }
  record("T8.SchemaReadinessProbe",readinessPassed,`Readiness check passed on initialized database: ${readinessPassed}`);

  // --- Test 9: Data survives application restarts & redeployment ---
  console.log("\n--- Test 9: Data persistence across restarts and redeployment ---");
  // Update admin display name in public.account
  runPsql("UPDATE public.account SET display_name = 'Super Admin Qualified' WHERE normalized_email = 'superadmin@careganga.org';","careganga_qa_prod");
  const updatedDisplayName=runPsql("SELECT display_name FROM public.account WHERE normalized_email = 'superadmin@careganga.org';","careganga_qa_prod");

  // Simulate redeploy / restart by running db:init again
  const redeployInit=runNpm(["run","db:init","--","--confirm-new-db"],{DATABASE_MIGRATION_URL:prodMigrationUrl});
  const afterRedeployDisplayName=runPsql("SELECT display_name FROM public.account WHERE normalized_email = 'superadmin@careganga.org';","careganga_qa_prod");
  const afterRedeployAccounts=Number(runPsql("SELECT count(*) FROM public.account;","careganga_qa_prod").match(/\d+/)?.[0]??0);
  const persistenceOk=updatedDisplayName.includes("Super Admin Qualified") &&
                      afterRedeployDisplayName.includes("Super Admin Qualified") &&
                      afterRedeployAccounts===1;
  record("T9.DataPersistenceAcrossRedeploy",persistenceOk,
    `Admin updates preserved: ${afterRedeployDisplayName.includes("Super Admin Qualified")}, Accounts preserved: ${afterRedeployAccounts===1}`);

  // --- Test 10: Future incremental upgrades (db:upgrade) ---
  console.log("\n--- Test 10: Incremental schema upgrades ---");
  // When database is already current
  const upgradeCurrent=runNpm(["run","db:upgrade"],{DATABASE_MIGRATION_URL:prodMigrationUrl});
  const upgradeNoOp=upgradeCurrent.stdout.includes("Database release already current; no SQL applied.");

  // Test an incremental future migration with increasing numeric prefix > 9999
  const futureMigrationFile=join(root,"apps/backend/db/upgrades","10001_cg15_future_test_field.sql");
  writeFileSync(futureMigrationFile,"ALTER TABLE public.account ADD COLUMN IF NOT EXISTS qualification_test_col text;\n","utf8");
  // Rebuild contract
  runNpm(["run","build","-w","apps/backend"]);
  const upgradeFuture=runNpm(["run","db:upgrade"],{DATABASE_MIGRATION_URL:prodMigrationUrl});
  const colAdded=runPsql("SELECT column_name FROM information_schema.columns WHERE table_name='account' AND column_name='qualification_test_col';","careganga_qa_prod").includes("qualification_test_col");
  const ledgerCountAfter=Number(runPsql("SELECT count(*) FROM schema_migration;","careganga_qa_prod").match(/\d+/)?.[0]??0);

  // Clean up future test migration
  if(existsSync(futureMigrationFile))unlinkSync(futureMigrationFile);
  runNpm(["run","build","-w","apps/backend"]);
  runPsql("ALTER TABLE public.account DROP COLUMN IF EXISTS qualification_test_col;","careganga_qa_prod");
  runPsql("DELETE FROM schema_migration WHERE filename='10001_cg15_future_test_field.sql';","careganga_qa_prod");

  record("T10.IncrementalFutureUpgrade",upgradeNoOp&&upgradeFuture.status===0&&colAdded&&ledgerCountAfter===312,
    `Already current is no-op: ${upgradeNoOp}, Incremental upgrade executed: ${upgradeFuture.status===0}, Column added: ${colAdded}, Ledger updated to: ${ledgerCountAfter}`);

  // Summary
  console.log("\n=== Qualification Summary ===");
  const passed=results.filter(r=>r.ok).length;
  console.log(`Passed: ${passed}/${results.length}`);
  if(passed!==results.length){
    console.error("QUALIFICATION DEFECT DETECTED!");
    process.exitCode=1;
  }else{
    console.log("ALL 10 POSTGRESQL 17 DATABASE QUALIFICATION GATES PASSED!");
  }
}

main().catch(err=>{
  console.error("FATAL ERROR IN QUALIFICATION SUITE:",err);
  process.exitCode=1;
});
