// Explicit operator commands only. Never imported from application startup.
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync,renameSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {Pool} from "pg";

const dbDir=dirname(fileURLToPath(import.meta.url));
const backend=resolve(dbDir,"..");
const baseline=join(dbDir,"baseline");
const contractFile=join(backend,"dist/db/schema-contract.json");
const sha=s=>createHash("sha256").update(s).digest("hex");
const filenamePattern=/^\d+_cg\d+_[a-z0-9_-]+\.sql$/;
const digestPattern=/^[a-f0-9]{64}$/;
const order=(a,b)=>Number(a.split("_")[0])-Number(b.split("_")[0])||(a<b?-1:a>b?1:0);
function sourceContract(){
 const names=readdirSync(join(dbDir,"migrations")).filter(n=>n.endsWith(".sql")).sort(order);
 if(!names.length||names.some(n=>!filenamePattern.test(n)||!Number.isSafeInteger(Number(n.split("_")[0]))))
  throw Error("Invalid migration source names");
 return names.map(filename=>({filename,sha256:sha(readFileSync(join(dbDir,"migrations",filename),"utf8"))}));
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function requireLedger(actual,expected,{exact=true}={}){
 const hashes=new Map(actual.map(e=>[e.filename,e.sha256]));
 if((exact&&hashes.size!==expected.length)||expected.some(e=>hashes.get(e.filename)!==e.sha256))
  throw Error("Database migration history is incompatible with the expected release");
}
function requirePrefix(rows,current,baselineEntries){
 requireLedger(rows,baselineEntries,{exact:false});
 // A valid existing ledger is an exact contiguous prefix of the current release.
 // No applying a skipped earlier migration after a later migration.
 requireLedger(rows,current.slice(0,rows.length));
 if(rows.length>current.length)throw Error("Existing database release incompatible");
 return rows.length===current.length;
}
function direct(value){
 if(!value)throw Error("A direct database connection must be configured");
 let u;try{u=new URL(value);}catch{throw Error("Invalid database connection configuration");}
 if(!["postgres:","postgresql:"].includes(u.protocol)||!u.hostname||!u.pathname.slice(1)||u.hostname.includes("-pooler."))
  throw Error("A direct PostgreSQL connection is required");
 return u;
}
function disposable(value){
 const u=direct(value);
 if(!["localhost","127.0.0.1","[::1]"].includes(u.hostname)||
    !/^\/careganga_baseline_[a-z0-9_]+$/.test(u.pathname)||
    [...u.searchParams.keys()].some(k=>k!=="sslmode"))
  throw Error("Baseline generation requires an isolated local careganga_baseline_* database");
 return u;
}
async function withDb(url,fn){
 const p=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:15000,application_name:"careganga-db-release"});
 try{const c=await p.connect();try{return await fn(c);}finally{c.release();}}finally{await p.end();}
}
async function ledger(c){
 const r=await c.query("SELECT to_regclass('public.schema_migration') AS present");
 if(!r.rows[0]?.present)return null;
 return (await c.query("SELECT filename,sha256 FROM public.schema_migration")).rows;
}
async function blank(c){
 const r=await c.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND left(nspname,3)<>'pg_') OR EXISTS(SELECT 1 FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_proc x JOIN pg_namespace n ON n.oid=x.pronamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_type x JOIN pg_namespace n ON n.oid=x.typnamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') AS occupied");
 if(r.rows[0]?.occupied!==false)throw Error("Database is not empty; refusing initialization");
}
async function major(c){return Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num)/10000);}
async function locked(c,fn){
 const r=await c.query("SELECT pg_try_advisory_lock(16041115,1) AS locked");
 if(!r.rows[0]?.locked)throw Error("Another database release is running; retry after it completes");
 try{return await fn();}finally{await c.query("SELECT pg_advisory_unlock(16041115,1)").catch(()=>{});}
}
function runMigration(u,existing=false){
 const result=spawnSync(process.execPath,[join(backend,"dist/db/migrate.js"),...(existing?["--existing-only"]:[])],
  {cwd:backend,env:{...process.env,DATABASE_MIGRATION_URL:u.toString()},stdio:"ignore"});
 if(result.error||result.status!==0)throw Error("Migration execution failed; run the existing migration diagnostic privately on the isolated target");
}
function cleanDump(sql){
 // PostgreSQL plain dumps may have a paired psql restrict token. The generated
 // dump is executed using node-postgres, not psql; reject other meta commands.
 const lines=sql.split("\n");
 const restricted=lines.filter(l=>/^\\(?:un)?restrict [A-Za-z0-9]+(?:\r)?$/.test(l));
 if(restricted.length!==0&&(restricted.length!==2||
   !restricted[0].startsWith("\\restrict ")||
   restricted[0].trim().split(" ")[1]!==restricted[1].trim().split(" ")[1]||
   !restricted[1].startsWith("\\unrestrict ")))throw Error("Unexpected PostgreSQL dump guard");
 const result=lines.filter(l=>!/^\\(?:un)?restrict [A-Za-z0-9]+(?:\r)?$/.test(l)).join("\n");
 if(/^[ \t]*\\/m.test(result)||!result.includes("PostgreSQL database dump"))throw Error("Unsupported PostgreSQL dump format");
 return result;
}
function dump(u,mode=[]){
 const host=u.hostname.replace(/^\[|\]$/g,"");
 const version=spawnSync("pg_dump",["--version"],{encoding:"utf8"});
 if(version.error||version.status!==0)throw Error("Matching PostgreSQL client tools are required on the developer machine");
 // Prevent inherited libpq routing/service/options variables from overriding
 // the verified local disposable connection.
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith("PG")));
 const result=spawnSync("pg_dump",["--format=plain","--no-owner","--no-privileges","--inserts",...mode],
  {env:{...env,PGHOST:host,PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",PGCONNECT_TIMEOUT:"15"},
   encoding:"utf8",maxBuffer:64*1024*1024,stdio:["ignore","pipe","pipe"]});
 if(result.error||result.status!==0)throw Error("PostgreSQL baseline export failed");
 return cleanDump(result.stdout);
}
function loadBundle(){
 if(!existsSync(join(baseline,"schema.sql"))||!existsSync(join(baseline,"manifest.json")))
  throw Error("Verified database baseline missing. Generate and validate it before packaging the first release");
 const sql=readFileSync(join(baseline,"schema.sql"),"utf8");
 const manifest=JSON.parse(readFileSync(join(baseline,"manifest.json"),"utf8"));
 if(manifest.format!==1||!Number.isInteger(manifest.postgresMajor)||!Array.isArray(manifest.migrations)||!manifest.migrations.length||
    manifest.migrations.some(e=>!e||!filenamePattern.test(e.filename)||!digestPattern.test(e.sha256))||
    new Set(manifest.migrations.map(e=>e.filename)).size!==manifest.migrations.length||
    manifest.sqlSha256!==sha(sql))throw Error("Database baseline checksum or manifest invalid");
 const current=sourceContract();
 if(!existsSync(contractFile)||!equal(JSON.parse(readFileSync(contractFile,"utf8")),current))throw Error("Release build schema contract missing or stale; rebuild the backend");
 if(!equal(current.slice(0,manifest.migrations.length),manifest.migrations))throw Error("Baseline source history changed; regenerate before first release or reconcile explicitly");
 const highest=Number(manifest.migrations.at(-1).filename.split("_")[0]);
 const pending=current.slice(manifest.migrations.length).map(e=>Number(e.filename.split("_")[0]));
 if(pending.some(n=>n<=highest)||new Set(pending).size!==pending.length)throw Error("New upgrades must use unique increasing migration prefixes");
 return {sql,manifest,current};
}
async function restore(c,sql,expected){
 await c.query("BEGIN");
 try{
  await c.query(sql);
  await c.query("SET LOCAL search_path TO public, pg_catalog");
  const rows=await ledger(c);
  if(!rows)throw Error("Baseline restore did not produce a schema ledger");
  requireLedger(rows,expected);
  await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}
}
async function generate(){
 if(!process.argv.includes("--confirm-disposable"))throw Error("Explicit disposable database confirmation required");
 if(existsSync(join(baseline,"schema.sql"))||existsSync(join(baseline,"manifest.json")))
  throw Error("Baseline already exists; do not overwrite a published baseline");
 const source=disposable(process.env.CAREGANGA_BASELINE_SOURCE_URL);
 const verify=disposable(process.env.CAREGANGA_BASELINE_VERIFY_URL);
 if(source.pathname===verify.pathname)throw Error("Use two different disposable databases");
 const expected=sourceContract();
 const pgMajor=await withDb(source,async c=>{await blank(c);return major(c);});
 await withDb(verify,async c=>{await blank(c);if(await major(c)!==pgMajor)throw Error("PostgreSQL major versions differ");});
 const v=spawnSync("pg_dump",["--version"],{encoding:"utf8"});
 if(v.error||v.status!==0||Number(v.stdout.match(/(\d+)\.\d+/)?.[1])!==pgMajor)throw Error("pg_dump major version must match the target PostgreSQL version");
 runMigration(source);
 await withDb(source,async c=>{const rows=await ledger(c);if(!rows)throw Error("Migration history missing");requireLedger(rows,expected);});
 // Both DBs must remain isolated: do not start the app, provision root, or add
 // test/operational records. Full dump includes only migration-produced defaults.
 const sql=dump(source);
 const schema=dump(source,["--schema-only"]);
 await withDb(verify,async c=>locked(c,async()=>{await blank(c);await restore(c,sql,expected);}));
 if(dump(verify,["--schema-only"])!==schema||dump(verify)!==sql)
  throw Error("Baseline restore differs from original schema/default data; inspect isolated databases");
 if(!equal(sourceContract(),expected))throw Error("Migration sources changed during generation");
 mkdirSync(baseline,{recursive:true});
 writeFileSync(join(baseline,"schema.sql.tmp"),sql,{mode:0o600});
 writeFileSync(join(baseline,"manifest.json.tmp"),JSON.stringify({format:1,postgresMajor:pgMajor,migrations:expected,sqlSha256:sha(sql)},null,2)+"\n",{mode:0o600});
 renameSync(join(baseline,"schema.sql.tmp"),join(baseline,"schema.sql"));
 renameSync(join(baseline,"manifest.json.tmp"),join(baseline,"manifest.json"));
 console.log("Baseline generated and round-trip verified. Review mandatory defaults, database privileges and original runtime QA before committing.");
}
async function init(){
 if(!process.argv.includes("--confirm-new-db"))throw Error("Explicit --confirm-new-db required");
 const {sql,manifest,current}=loadBundle(),u=direct(process.env.DATABASE_MIGRATION_URL);
 await withDb(u,async c=>locked(c,async()=>{
  if(await major(c)!==manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
  const rows=await ledger(c);
  if(rows){
   requirePrefix(rows,current,manifest.migrations);
   console.log("Database already initialized; no SQL applied.");return;
  }
  await blank(c);await restore(c,sql,manifest.migrations);
  console.log("CareGanga database initialized from the verified baseline.");
 }));
}
async function upgrade(){
 const {manifest,current}=loadBundle(),u=direct(process.env.DATABASE_MIGRATION_URL);
 const currentAlreadyApplied=await withDb(u,async c=>{
  if(await major(c)!==manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
  const rows=await ledger(c);if(!rows)throw Error("Run explicit first installation before upgrading");
  return requirePrefix(rows,current,manifest.migrations);
 });
 if(currentAlreadyApplied){console.log("Database release already current; no SQL applied.");return;}
 runMigration(u,true);
 await withDb(u,async c=>{const rows=await ledger(c);if(!rows)throw Error("Upgrade history missing");requireLedger(rows,current);});
 console.log("Database release version verified.");
}
export {cleanDump,requireLedger,requirePrefix,disposable,direct,order};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 switch(process.argv[2]){
  case "contract": mkdirSync(dirname(contractFile),{recursive:true});writeFileSync(contractFile,JSON.stringify(sourceContract())+"\n");break;
  case "generate": await generate();break;
  case "init": await init();break;
  case "upgrade": await upgrade();break;
  case "check": loadBundle();console.log("Database release bundle checksum and source history verified.");break;
  default: throw Error("Use contract, generate, init, upgrade or check");
 }
}catch(e){
 // Only allow reviewed operator messages, never connection strings or SQL errors.
 const message=e instanceof Error&&/^(?:A direct|Invalid database|Invalid migration|Database migration history|Baseline generation|Database is not empty|Another database|Migration execution|Unexpected PostgreSQL|Unsupported PostgreSQL|Matching PostgreSQL|PostgreSQL baseline export|Verified database baseline|Database baseline checksum|Baseline source history|New upgrades|Baseline restore|Explicit|Baseline already|Use two|PostgreSQL major|pg_dump major|Migration history|Migration sources|Target PostgreSQL|Existing database|Run explicit|Upgrade history|Release build schema contract|Use contract)/.test(e.message)?e.message:"Database release operation failed. Inspect protected local diagnostics.";
 console.error(message);process.exitCode=1;
}
