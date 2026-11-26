// Explicit operator commands and guarded deployment preparation share one release engine.
import {createHash,randomBytes} from "node:crypto";
import dns from "node:dns";
try{dns.setDefaultResultOrder?.("ipv4first");}catch{}
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync,renameSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const dbDir=dirname(fileURLToPath(import.meta.url));
const backend=resolve(dbDir,"..");
const baseline=join(dbDir,"baseline");
const history=join(dbDir,"migrations"); // Frozen historical source; never packaged for deployment.
const upgradeDir=join(dbDir,"upgrades");
const contractFile=join(backend,"dist/db/schema-contract.json");
const sha=s=>createHash("sha256").update(s).digest("hex");
const filenamePattern=/^\d+_cg\d+_[a-z0-9_-]+\.sql$/;
const digestPattern=/^[a-f0-9]{64}$/;
const order=(a,b)=>Number(a.split("_")[0])-Number(b.split("_")[0])||(a<b?-1:a>b?1:0);
function sqlFiles(folder,{allowEmpty=false}={}){
 const names=readdirSync(folder).filter(n=>n.endsWith(".sql")).sort(order);
 if((!allowEmpty&&!names.length)||names.some(n=>!filenamePattern.test(n)||!Number.isSafeInteger(Number(n.split("_")[0]))))
  throw Error("Invalid migration source names");
 return names.map(filename=>{const sql=readFileSync(join(folder,filename),"utf8");return {filename,sha256:sha(sql),sql};});
}
const entry=({filename,sha256})=>({filename,sha256});
const sourceContract=()=>sqlFiles(history).map(entry);
function validateUpgrades(baselineEntries,upgrades){
 const highest=Number(baselineEntries.at(-1).filename.split("_")[0]);
 const numbers=upgrades.map(e=>Number(e.filename.split("_")[0]));
 if(numbers.some((n,i)=>!Number.isSafeInteger(n)||n<=highest||(i>0&&n<=numbers[i-1])))
  throw Error("New upgrades must use unique increasing migration prefixes");
 for(const e of upgrades)assertAtomicUpgrade(e.sql);
}
// Only release-authored SQL is accepted. Reject explicit transaction control
// and psql commands outside quotes/comments so a file cannot commit the outer
// release transaction. Use dollar-quoted function bodies.
function assertAtomicUpgrade(sql){
 if(typeof sql!=="string"||!sql.trim())throw Error("Invalid migration SQL");
 let i=0,words=[];
 const check=()=>{
  const first=words[0],second=words[1];
  if(["BEGIN","END","COMMIT","ROLLBACK","ABORT","SAVEPOINT","RELEASE","COPY"].includes(first)||
     (["START","PREPARE","SET"].includes(first)&&second==="TRANSACTION")||
     (first==="SET"&&second==="SESSION"))
   throw Error("New upgrades must not contain transaction control or COPY");
  words=[];
 };
 while(i<sql.length){
  const c=sql[i],n=sql[i+1];
  if(c==="-"&&n==="-"){const end=sql.indexOf("\n",i+2);i=end<0?sql.length:end+1;continue;}
  if(c==="/"&&n==="*"){let depth=1;i+=2;while(i<sql.length&&depth){if(sql.slice(i,i+2)==="/*"){depth++;i+=2;}else if(sql.slice(i,i+2)==="*/"){depth--;i+=2;}else i++;}if(depth)throw Error("Invalid migration SQL");continue;}
  if(c==="'"||c==='"'){const quote=c;const escaped=quote==="'"&&i>0&&/[eE]/.test(sql[i-1])&&(i===1||!/[A-Za-z0-9_]/.test(sql[i-2]));i++;let closed=false;while(i<sql.length){if(escaped&&sql[i]==="\\"){i+=2;continue;}if(sql[i]===quote){if(sql[i+1]===quote){i+=2;continue;}i++;closed=true;break;}i++;}if(!closed)throw Error("Invalid migration SQL");continue;}
  if(c==="$"){const tag=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];if(tag){const end=sql.indexOf(tag,i+tag.length);if(end<0)throw Error("Invalid migration SQL");i=end+tag.length;continue;}}
  if(c===";"){check();i++;continue;}
  if(c==="\\")throw Error("New upgrades must not contain psql commands");
  if(/[A-Za-z_]/.test(c)){let end=i+1;while(end<sql.length&&/[A-Za-z0-9_$]/.test(sql[end]))end++;if(words.length<2)words.push(sql.slice(i,end).toUpperCase());i=end;continue;}
  i++;
 }
 check();
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
 if(!["postgres:","postgresql:"].includes(u.protocol)||!u.hostname||!u.username||!u.pathname.slice(1)||u.hash||u.hostname.includes("-pooler."))
  throw Error("A direct PostgreSQL connection is required");
 const allowed=new Set(["sslmode","sslrootcert","sslcert","sslkey","channel_binding","connect_timeout","application_name"]);
 if([...u.searchParams.keys()].some(k=>!allowed.has(k)))throw Error("Unsupported PostgreSQL connection option");
 if(!u.port)u.port="5432";
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
 const {Pool}=await import("pg");
 const p=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:15000,application_name:"careganga-db-release"});
 try{
  let c;
  for(let attempt=1;attempt<=3;attempt++){
   try{c=await p.connect();break;}catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,1000*attempt));}
  }
  if(!c)throw Error("Database connection unavailable");
  try{return await fn(c);}finally{c.release();}
 }finally{await p.end();}
}
async function ledger(c){
 const r=await c.query("SELECT to_regclass('public.schema_migration') AS present");
 if(!r.rows[0]?.present)return null;
 return (await c.query("SELECT filename,sha256 FROM public.schema_migration")).rows;
}
async function blank(c){
 const r=await c.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND left(nspname,3)<>'pg_') OR EXISTS(SELECT 1 FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_proc x JOIN pg_namespace n ON n.oid=x.pronamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_type x JOIN pg_namespace n ON n.oid=x.typnamespace WHERE n.nspname='public') OR EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') OR EXISTS(SELECT 1 FROM pg_event_trigger) OR EXISTS(SELECT 1 FROM pg_foreign_server) OR EXISTS(SELECT 1 FROM pg_publication) OR EXISTS(SELECT 1 FROM pg_largeobject_metadata) AS occupied");
 if(r.rows[0]?.occupied!==false)throw Error("Database is not empty; refusing initialization");
}
async function major(c){return Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num)/10000);}
async function locked(c,fn,{wait=false}={}){
 let acquired=false;
 for(let attempt=0;attempt<(wait?120:1);attempt++){
  const r=await c.query("SELECT pg_try_advisory_lock(16041115,1) AS locked");
  if(r.rows[0]?.locked){acquired=true;break;}
  if(wait&&attempt<119)await new Promise(r=>setTimeout(r,1000));
 }
 if(!acquired)throw Error("Another database release is running; retry after it completes");
 try{return await fn();}finally{await c.query("SELECT pg_advisory_unlock(16041115,1)").catch(()=>{});}
}
function runHistoricalReplay(u){
 const result=spawnSync(process.execPath,[join(backend,"dist/db/migrate.js")],
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
 const result=spawnSync("pg_dump",["--no-password","--format=plain","--no-owner","--no-privileges","--inserts",...mode],
  {env:{...env,PGHOST:host,PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",PGCONNECT_TIMEOUT:"15"},
   encoding:"utf8",maxBuffer:64*1024*1024,stdio:["ignore","pipe","pipe"]});
 if(result.error||result.status!==0)throw Error("PostgreSQL baseline export failed");
 return cleanDump(result.stdout);
}
function readRelease({verifyArchive=false}={}){
 if(!existsSync(join(baseline,"schema.sql"))||!existsSync(join(baseline,"manifest.json")))
  throw Error("Verified database baseline missing. Include the committed schema and manifest");
 const sql=readFileSync(join(baseline,"schema.sql"),"utf8");
 const manifest=JSON.parse(readFileSync(join(baseline,"manifest.json"),"utf8"));
 if(manifest.format!==1||manifest.postgresMajor!==17||!Array.isArray(manifest.migrations)||!manifest.migrations.length||
    manifest.migrations.some(e=>!e||!filenamePattern.test(e.filename)||!digestPattern.test(e.sha256))||
    new Set(manifest.migrations.map(e=>e.filename)).size!==manifest.migrations.length||
    manifest.migrations.some((e,i)=>i>0&&order(manifest.migrations[i-1].filename,e.filename)>=0)||
    manifest.sqlSha256!==sha(sql))throw Error("Database baseline checksum or manifest invalid");
 if(verifyArchive&&!equal(sourceContract(),manifest.migrations))
  throw Error("Baseline source history changed; historical SQL is frozen");
 const upgrades=sqlFiles(upgradeDir,{allowEmpty:true});
 validateUpgrades(manifest.migrations,upgrades);
 const current=[...manifest.migrations,...upgrades.map(entry)];
 return {sql,manifest,current,upgrades};
}
function loadBundle(){
 const release=readRelease();
 if(!existsSync(contractFile)||!equal(JSON.parse(readFileSync(contractFile,"utf8")),release.current))
  throw Error("Release build schema contract missing or stale; rebuild the backend");
 return release;
}
async function transaction(c,fn){
 await c.query("BEGIN");
 try{await fn();await c.query("COMMIT");}
 catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}
}
async function applyUpgrades(c,upgrades){
 // Restore SQL may disable validation locally; future SQL is always validated
 // with the normal built-in-first search path and function checks enabled.
 await c.query("SET LOCAL search_path TO public");
 await c.query("SET LOCAL check_function_bodies TO true");
 for(const u of upgrades){
  await c.query(u.sql);
  await c.query("INSERT INTO public.schema_migration(filename,sha256) VALUES ($1,$2)",[u.filename,u.sha256]);
 }
}
async function restore(c,sql,expected,upgrades=[]){
 await transaction(c,async()=>{
  await c.query(sql);
  const rows=await ledger(c);
  if(!rows)throw Error("Baseline restore did not produce a schema ledger");
  requireLedger(rows,expected);
  await applyUpgrades(c,upgrades);
  requireLedger(await ledger(c),[...expected,...upgrades.map(entry)]);
 });
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
 runHistoricalReplay(source);
 await withDb(source,async c=>{const rows=await ledger(c);if(!rows)throw Error("Migration history missing");requireLedger(rows,expected);const accounts=await c.query("SELECT EXISTS(SELECT 1 FROM public.account) AS present");if(accounts.rows[0]?.present!==false)throw Error("Scratch database contains accounts; baseline export refused");});
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
// Decide from the actual ledger, not environment flags, file existence or row counts.
function deploymentPlan(rows,release){
 if(rows===null)return "initialize";
 return requirePrefix(rows,release.current,release.manifest.migrations)?"current":"upgrade";
}
// A random advisory-lock challenge proves both URLs refer to the SAME database
// on the SAME PostgreSQL cluster, including direct/pooler aliases. It is held
// on the direct connection, never as a session lock on the pooled connection.
async function assertSameDatabase(owner,runtime){
 const {rows:[db]}=await owner.query("SELECT current_database() AS name,current_user AS role");
 const key=randomBytes(8),a=key.readInt32BE(0),b=key.readInt32BE(4);
 await owner.query("SELECT pg_advisory_lock($1::int,$2::int)",[a,b]);
 try{
  const result=await runtime.query("SELECT current_database() AS name,current_user AS role,pg_try_advisory_xact_lock($1::int,$2::int) AS acquired",[a,b]);
  const live=result.rows[0];
  if(!live||live.name!==db.name||live.acquired!==false)
   throw Error("Database connections do not target the same database");
  return {ownerRole:db.role,runtimeRole:live.role};
 }finally{await owner.query("SELECT pg_advisory_unlock($1::int,$2::int)",[a,b]);}
}
const ident=s=>'"'+String(s).replaceAll('"','""')+'"';
// Only installation-created application objects receive runtime grants. Existing
// business-table permissions are not widened during an upgrade. Never give the
// runtime role ledger writes, schema CREATE, ownership or administrative rights.
async function grantFreshRuntime(c,role){
 const q=ident(role);
 await c.query("GRANT USAGE ON SCHEMA public TO "+q);
 const tables=await c.query("SELECT relname,relkind FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind IN ('r','p','v','m','S') ORDER BY relname");
 for(const x of tables.rows){
  const name="public."+ident(x.relname);
  if(x.relkind==="S"){await c.query("GRANT USAGE,SELECT ON SEQUENCE "+name+" TO "+q);continue;}
  const access=x.relname==="schema_migration"||x.relname==="cms_release_install"||x.relkind==="v"||x.relkind==="m"?"SELECT":x.relname==="cms_release_asset"?"SELECT,INSERT,DELETE":"SELECT,INSERT,UPDATE,DELETE";
  await c.query("GRANT "+access+" ON TABLE "+name+" TO "+q);
 }
 // The install marker is insert-once with an immutable database trigger.
 await c.query("GRANT INSERT ON TABLE public.cms_release_install TO "+q);
}
async function grantCmsUpgradeRuntime(c,role){
 const q=ident(role);
 await c.query("GRANT SELECT,INSERT ON TABLE public.cms_release_install TO "+q);
 await c.query("GRANT SELECT,INSERT,DELETE ON TABLE public.cms_release_asset TO "+q);
}
// The only normal startup DDL path. The build contract, database major, exact
// historical checksums, blank check and release lock are mandatory. No reset,
// guessed repair, historical replay, credential provisioning or destructive DDL.
async function prepareDeployment(){
 const release=loadBundle();
 const runtimeUrl=process.env.DATABASE_URL;
 if(!runtimeUrl)throw Error("Missing DATABASE_URL");
 await withDb(new URL(runtimeUrl),async runtime=>{
  // Healthy restarts need no DDL connection or write privileges.
  if(await major(runtime)!==release.manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
  const initial=await ledger(runtime);
  if(deploymentPlan(initial,release)==="current"){
   const proof=await runtime.query("SELECT to_regclass('public.account') IS NOT NULL AS present");
   if(!proof.rows[0]?.present)throw Error("Database release objects are unavailable");
   console.log("Database release already current; no SQL applied.");return;
  }
  const ownerUrl=direct(process.env.DATABASE_MIGRATION_URL||runtimeUrl);
  await withDb(ownerUrl,async owner=>locked(owner,async()=>{
   const roles=await assertSameDatabase(owner,runtime);
   if(await major(owner)!==release.manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
   const rows=await ledger(owner),plan=deploymentPlan(rows,release);
   if(plan==="current"){console.log("Database release already current; no SQL applied.");return;}
   if(plan==="initialize"){
    await blank(owner);
    await transaction(owner,async()=>{
     await owner.query(release.sql);
     requireLedger(await ledger(owner),release.manifest.migrations);
     await applyUpgrades(owner,release.upgrades);
     requireLedger(await ledger(owner),release.current);
     if(roles.ownerRole!==roles.runtimeRole)await grantFreshRuntime(owner,roles.runtimeRole);
    });
    console.log("CareGanga database initialized from verified baseline and current upgrades.");
   }else{
    const pending=release.upgrades.slice(rows.length-release.manifest.migrations.length);
    await transaction(owner,async()=>{
     await applyUpgrades(owner,pending);
     if(roles.ownerRole!==roles.runtimeRole&&pending.some(x=>x.filename==="10000_cg18_release_baseline_install.sql"))
      await grantCmsUpgradeRuntime(owner,roles.runtimeRole);
     requireLedger(await ledger(owner),release.current);
    });
    console.log("CareGanga database upgraded and verified.");
   }
  },{wait:true}));
  const final=await ledger(runtime);
  if(!final)throw Error("Database release objects are unavailable");
  requireLedger(final,release.current);
 });
}
async function init(){
 if(!process.argv.includes("--confirm-new-db"))throw Error("Explicit --confirm-new-db required");
 const {sql,manifest,current,upgrades}=loadBundle(),u=direct(process.env.DATABASE_MIGRATION_URL);
 await withDb(u,async c=>locked(c,async()=>{
  if(await major(c)!==manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
  const rows=await ledger(c);
  if(rows){
   if(!requirePrefix(rows,current,manifest.migrations))
    throw Error("Existing database release is older; run db:upgrade");
   console.log("Database already initialized; no SQL applied.");return;
  }
  await blank(c);await restore(c,sql,manifest.migrations,upgrades);
  console.log("CareGanga database initialized from the verified baseline.");
 }));
}
async function upgrade(){
 const {manifest,current,upgrades}=loadBundle(),u=direct(process.env.DATABASE_MIGRATION_URL);
 await withDb(u,async c=>locked(c,async()=>{
  if(await major(c)!==manifest.postgresMajor)throw Error("Target PostgreSQL major version differs from baseline");
  const rows=await ledger(c);if(!rows)throw Error("Run explicit first installation before upgrading");
  if(requirePrefix(rows,current,manifest.migrations)){console.log("Database release already current; no SQL applied.");return;}
  const pending=upgrades.slice(rows.length-manifest.migrations.length);
  await transaction(c,async()=>{await applyUpgrades(c,pending);requireLedger(await ledger(c),current);});
  console.log("Database release upgraded and verified.");
 }));
}
export {cleanDump,requireLedger,requirePrefix,disposable,direct,order,assertAtomicUpgrade,validateUpgrades,readRelease,loadBundle,deploymentPlan,assertSameDatabase,prepareDeployment};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 switch(process.argv[2]){
  case "contract": {const {current}=readRelease({verifyArchive:true});mkdirSync(dirname(contractFile),{recursive:true});writeFileSync(contractFile,JSON.stringify(current)+"\n");break;}
  case "generate": await generate();break;
  case "init": await init();break;
  case "upgrade": await upgrade();break;
  case "prepare": await prepareDeployment();break;
  case "check":
   loadBundle();
   if(!existsSync(join(backend,"dist/src/main.js"))||!existsSync(join(backend,"dist/src/modules/cg-01-identity-access/infrastructure/bootstrap-root.js")))
    throw Error("Release build schema contract or compiled backend entry missing; rebuild the backend");
   console.log("Database release bundle checksum, compiled schema contract and backend entry verified.");break;
  default: throw Error("Use contract, generate, init, upgrade, prepare or check");
 }
}catch(e){
 // Only allow reviewed operator messages, never connection strings or SQL errors.
 const message=e instanceof Error&&/^(?:A direct|Missing DATABASE_URL|Database connections do not target|Database release objects|Invalid database|Invalid migration|Database migration history|Baseline generation|Database is not empty|Another database|Migration execution|Unexpected PostgreSQL|Unsupported PostgreSQL|Matching PostgreSQL|PostgreSQL baseline export|Verified database baseline|Database baseline checksum|Baseline source history|New upgrades|Baseline restore|Explicit|Baseline already|Use two|PostgreSQL major|pg_dump major|Migration history|Migration sources|Target PostgreSQL|Existing database|Run explicit|Upgrade history|Release build schema contract|Scratch database contains accounts|Unsupported PostgreSQL connection option|Use contract)/.test(e.message)?e.message:"Database release operation failed. Inspect protected local diagnostics.";
 console.error(message);process.exitCode=1;
}
