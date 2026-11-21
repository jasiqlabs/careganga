import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const folder=join(root,"apps/backend/db/migrations");
const names=readdirSync(folder).filter(n=>n.endsWith(".sql")).sort();
const fail=[];
const requireTrue=(ok,message)=>{if(!ok)fail.push(message);};
const digest=text=>createHash("sha256").update(text,"utf8").digest("hex");
const valid=/^\d+_cg\d+_[a-z0-9_-]+\.sql$/;
requireTrue(names.every(n=>valid.test(n)),"Unexpected migration filename: "+
 names.filter(n=>!valid.test(n)).join(", "));
requireTrue(new Set(names).size===names.length,"Duplicate migration filename");
const canonical="1438_cg19_original_patient_private_files.sql";
const legacy="1438_cg19_patient_owned_private_files.sql";
const supplement="1445_cg19_patient_file_supplemental_integrity.sql";
const historicalSha="4d6fdea87c43adf79248d610978512f10e2b3f2017f23912e3fad93500ac8579";
requireTrue(names.indexOf(canonical)>=0&&names.indexOf(canonical)<names.indexOf(legacy),
 "Canonical 1438 must run before the historic duplicate");
requireTrue(names.indexOf(legacy)>=0&&names.indexOf(legacy)<names.indexOf(supplement),
 "Forward-only supplemental 1445 must run after both 1438 filenames");
const contents=n=>names.includes(n)?readFileSync(join(folder,n),"utf8"):"";
requireTrue(digest(contents(legacy))===historicalSha,
 "A merged historical CG19 migration was rewritten; restore the exact main checksum");
requireTrue(contents(canonical).includes("CREATE TABLE cg19_patient_file_intent(")&&
 contents(canonical).includes("CREATE TABLE cg19_patient_private_file(")&&
 contents(canonical).includes("CREATE TABLE cg19_patient_file_event("),
 "Canonical original CG19 patient tables are missing");
requireTrue(contents(supplement).includes("ADD CONSTRAINT cg19_patient_photo_not_pdf")&&
 !contents(supplement).includes("CREATE TABLE cg19_patient_"),
 "CG19 supplemental migration must be strictly additive");
const runner=readFileSync(join(root,"apps/backend/db/migrate.ts"),"utf8");
requireTrue(runner.includes("legacyDuplicate1438")&&runner.includes(historicalSha)&&
 runner.includes("information_schema.columns")&&
 runner.includes("INSERT INTO schema_migration (filename,sha256)")&&
 runner.includes('prior.rows[0].sha256 !== digest'),
 "Migration runner must preserve historical exact hash, table proof and checksum guard");
requireTrue(runner.includes("pg_advisory_lock")&&runner.includes('await client.query("ROLLBACK")'),
 "Migration runner must retain serialized transactional rollback behavior");

console.log("CareGanga migration source review:",names.length,
 "SQL files, canonical 1438 hash preserved, one exact-history guarded no-op,",
 "forward-only supplement and checksum/locking checks.");
console.log("This is a source check, NOT a PostgreSQL parse/migrate/restore PASS.");
if(fail.length){for(const issue of fail)console.error("FAIL:",issue);process.exitCode=1;}
else console.log("SOURCE_CONSISTENT: migration history guard checks passed.");
