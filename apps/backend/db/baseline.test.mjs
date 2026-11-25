import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {cleanDump,requireLedger,requirePrefix,disposable,direct,order,assertAtomicUpgrade,validateUpgrades} from "./baseline.mjs";

const one={filename:"0001_cg01_identity.sql",sha256:"a".repeat(64)};
const two={filename:"9999_cg20_reports.sql",sha256:"b".repeat(64)};
const three={filename:"10000_cg15_add_index.sql",sha256:"c".repeat(64)};
const four={filename:"10001_cg15_add_field.sql",sha256:"d".repeat(64)};
const expected=[one,two,three,four];
test("future migration prefixes sort numerically without disturbing existing ties",()=>{
 assert.deepEqual([three.filename,two.filename,one.filename].sort(order),[one.filename,two.filename,three.filename]);
 assert.ok(order("1438_cg19_original_patient_private_files.sql","1438_cg19_patient_owned_private_files.sql")<0);
});
test("ledger comparison rejects missing, unknown and changed checksums",()=>{
 assert.doesNotThrow(()=>requireLedger([two,one],[one,two]));
 assert.throws(()=>requireLedger([one],[one,two]));
 assert.throws(()=>requireLedger([one,two,three],[one,two]));
 assert.throws(()=>requireLedger([one,{...two,sha256:one.sha256}],[one,two]));
});
test("only a contiguous known prefix can be upgraded",()=>{
 assert.equal(requirePrefix([one,two],expected,[one,two]),false);
 assert.equal(requirePrefix(expected,expected,[one,two]),true);
 assert.throws(()=>requirePrefix([one,two,four],expected,[one,two]));
 assert.throws(()=>requirePrefix([one],expected,[one,two]));
 assert.throws(()=>requirePrefix([...expected,{filename:"10002_cg15_unknown.sql",sha256:one.sha256}],expected,[one,two]));
});
test("disposable generator rejects nonlocal or wrong-name DBs",()=>{
 assert.equal(disposable("postgresql://u:p@127.0.0.1/careganga_baseline_a").hostname,"127.0.0.1");
 assert.throws(()=>disposable("postgresql://u:p@db.example.com/careganga_baseline_a"));
 assert.throws(()=>disposable("postgresql://u:p@localhost/careganga"));
 assert.throws(()=>disposable("postgresql://u:p@localhost/careganga_baseline_a?host=elsewhere"));
 assert.throws(()=>direct("postgresql://u:p@db-pooler.example.com/careganga"));
 assert.throws(()=>direct("postgresql://u:p@localhost/careganga?host=elsewhere"));
 assert.equal(direct("postgresql://u:p@localhost/careganga").port,"5432");
});
test("dump guard strips only the matching psql wrapper and rejects other meta commands",()=>{
 const sql="-- PostgreSQL database dump\nCREATE TABLE x(a int);\n";
 assert.equal(cleanDump(sql),sql);
 assert.equal(cleanDump("\\restrict abc\n"+sql+"\\unrestrict abc\n"),sql);
 assert.throws(()=>cleanDump("\\restrict abc\n"+sql+"\\unrestrict def\n"));
 assert.throws(()=>cleanDump(sql+"\\connect other\n"));
 assert.throws(()=>cleanDump("SELECT 1"));
});

test("release-only upgrades must have unique forward prefixes",()=>{
 const first={...three,sql:"ALTER TABLE public.account ADD COLUMN example text;"};
 const next={...four,sql:"CREATE INDEX example_idx ON public.account(example);"};
 assert.doesNotThrow(()=>validateUpgrades([one,two],[first,next]));
 assert.doesNotThrow(()=>validateUpgrades([one,two],[]));
 assert.throws(()=>validateUpgrades([one,two],[{...two,sql:"SELECT 1"}]));
 assert.throws(()=>validateUpgrades([one,two],[first,{...next,filename:"10000_cg15_other.sql"}]));
 assert.throws(()=>validateUpgrades([one,two],[next,first]));
});
test("future upgrade SQL must leave release transaction under operator control",()=>{
 assert.doesNotThrow(()=>assertAtomicUpgrade("-- COMMIT;\nALTER TABLE public.account ADD COLUMN note text DEFAULT 'COMMIT;';"));
 assert.doesNotThrow(()=>assertAtomicUpgrade("CREATE FUNCTION test() RETURNS void LANGUAGE plpgsql AS $body$ BEGIN NULL; END; $body$;"));
 assert.doesNotThrow(()=>assertAtomicUpgrade("/* outer /* nested */ COMMIT; */ SELECT 1;"));
 for(const sql of ["BEGIN; SELECT 1;","SELECT 1; COMMIT;","ROLLBACK;","START TRANSACTION;","PREPARE TRANSACTION 'x';","SET TRANSACTION READ ONLY;","COPY x FROM STDIN;","\\connect other","SELECT 'unclosed","SELECT $$unclosed"])assert.throws(()=>assertAtomicUpgrade(sql),sql);
});

test("prebuilt release checks work without historical SQL and reject stale or corrupt artifacts",()=>{
 const dir=mkdtempSync(join(tmpdir(),"careganga-db-release-"));
 try{
  const db=join(dir,"db"),history=join(db,"migrations"),baseline=join(db,"baseline"),upgrades=join(db,"upgrades");
  for(const p of [db,history,baseline,upgrades])mkdirSync(p,{recursive:true});
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)),"baseline.mjs"),join(db,"baseline.mjs"));
  const hash=s=>createHash("sha256").update(s).digest("hex");
  const hsql="CREATE TABLE example (id int);",schema="CREATE TABLE example (id int);\n";
  const filename="0001_cg01_identity.sql";
  writeFileSync(join(history,filename),hsql);
  const manifest={format:1,postgresMajor:17,migrations:[{filename,sha256:hash(hsql)}],sqlSha256:hash(schema)};
  writeFileSync(join(baseline,"schema.sql"),schema);
  writeFileSync(join(baseline,"manifest.json"),JSON.stringify(manifest));
  const run=command=>spawnSync(process.execPath,[join(db,"baseline.mjs"),command],{encoding:"utf8"});
  const ok=command=>{const r=run(command);assert.equal(r.status,0,r.stderr);};
  const fail=command=>{const r=run(command);assert.notEqual(r.status,0,command+" should fail");};
  ok("contract");fail("check"); // compiled app entries must be present
  const main=join(dir,"dist/src/main.js"),root=join(dir,"dist/src/modules/cg-01-identity-access/infrastructure/bootstrap-root.js");
  for(const p of [main,root]){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,"// fixture");}
  ok("check");
  writeFileSync(join(history,filename),hsql+" -- changed");fail("contract");
  writeFileSync(join(history,filename),hsql);
  writeFileSync(join(upgrades,"10000_cg01_example.sql"),"ALTER TABLE example ADD COLUMN label text;");fail("check");
  ok("contract");ok("check");
  rmSync(history,{recursive:true,force:true});ok("check"); // prebuilt image excludes archive
  writeFileSync(join(baseline,"schema.sql"),schema+" -- modified");fail("check");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
