import test from "node:test";
import assert from "node:assert/strict";
import {cleanDump,requireLedger,requirePrefix,disposable,direct,order} from "./baseline.mjs";

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
