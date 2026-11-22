import test from "node:test";
import assert from "node:assert/strict";
import {rosterCsvCell} from "../src/modules/cg-04-membership-volunteers/domain/roster-csv-cell";

test("CG04 US002 QA19: private roster export rejects spreadsheet formula interpretation",()=>{
 const attacks=["=HYPERLINK(\"https://example.invalid\")","+SUM(1,2)","-1+2","@NOW()","   =1+1"," \t@SUM(1,2)","\ufeff=1+1","\u200b=1+1"];
 for(const value of attacks){
  const encoded=rosterCsvCell(value);
  assert.ok(encoded.startsWith("\"'"),"Formula-like cell must start with a literal apostrophe: "+JSON.stringify(value));
 }
 assert.equal(rosterCsvCell("Sam \"Example\""),"\"Sam \"\"Example\"\"\"");
 assert.equal(rosterCsvCell("A\nB"),"\"A B\"");
 assert.equal(rosterCsvCell(null),"\"\"");
});
