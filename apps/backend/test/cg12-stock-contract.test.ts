import {test} from "node:test";
import assert from "node:assert/strict";
import type {PoolClient} from "pg";
import {inventoryQuantity,inventoryDate} from "../src/modules/cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
import {parseReceiptDraft} from "../src/modules/cg-12-inventory-suppliers/application/inventory-stock.service";
import {parseMaterialDraft} from "../src/modules/cg-12-inventory-suppliers/application/inventory-material.service";
import {parseOperation} from "../src/modules/cg-12-inventory-suppliers/application/inventory-operation.service";
import {csvCell} from "../src/modules/cg-12-inventory-suppliers/application/inventory-report.service";
import {lockStockBalances,applyStockMovements,type StockDelta} from "../src/modules/cg-12-inventory-suppliers/application/inventory-stock-command";
const id=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const base={requestKey:id(1),locationRef:id(2),itemRef:id(3),quantity:"6",reason:"Internal delivery"};
test("canonical exact quantities reject zero, excess scale, negatives, exponents and overflow",()=>{
 assert.equal(inventoryQuantity("001.230",3),"1.23");assert.equal(inventoryQuantity("10",0),"10");
 for(const v of ["0","-1","1e3","0.5","1000000000000000",1,NaN])assert.throws(()=>inventoryQuantity(v,0));
});
test("receipt validates real date and unique lines and canonical mixed quantities",()=>{
 const raw={requestKey:id(1),supplierRef:id(4),locationRef:id(2),receiptDate:"2026-11-22",sourceNote:"Delivery reference",lines:[{itemRef:id(5),quantity:"2.125",unit:"KG"},{itemRef:id(3),quantity:"10",unit:"PIECE"}]};
 const v=parseReceiptDraft(raw);assert.equal(v.lines[0].itemRef,id(3));assert.equal(v.lines[1].quantity,"2.125");
 assert.throws(()=>parseReceiptDraft({...raw,lines:[raw.lines[0],raw.lines[0]]}));
 assert.throws(()=>parseReceiptDraft({...raw,paid:true}));
 assert.throws(()=>inventoryDate("2026-02-30"));
});
test("request rejects caller supplied approval and repeated item lines",()=>{
 const v={requestKey:id(1),locationRef:id(2),priority:"NORMAL",dueDate:"2026-11-23",reason:"Supply request",lines:[{itemRef:id(3),unit:"PIECE",quantity:"10"}]};
 assert.equal(parseMaterialDraft(v).lines[0].quantity,"10");
 assert.throws(()=>parseMaterialDraft({...v,status:"APPROVED"}));
 assert.throws(()=>parseMaterialDraft({...v,lines:[v.lines[0],v.lines[0]]}));
});
test("physical operations require exact source shape and permit zero count only for adjustment",()=>{
 assert.equal(parseOperation({...base,kind:"ISSUE",requestRef:id(6),requestLineRef:id(7),expectedRequestVersion:2}).version,2);
 assert.equal(parseOperation({...base,kind:"ADJUSTMENT",quantity:"0"}).quantity,"0");
 assert.throws(()=>parseOperation({...base,kind:"ISSUE",quantity:"0"}));
 assert.throws(()=>parseOperation({...base,kind:"RETURN"}));
 assert.throws(()=>parseOperation({...base,kind:"TRANSFER",destinationRef:id(2)}));
 assert.throws(()=>parseOperation({...base,kind:"ISSUE",rootRealmId:id(8)}));
});
test("CSV export protects formula prefixes and quotes including leading whitespace",()=>{
 for(const value of ["=1+1","  +SUM(1,2)","@test","\t-1"])assert.match(csvCell(value),/^"'[\s\S]+"/);
 assert.equal(csvCell('a"b'),'"a""b"');assert.equal(csvCell("a\nb"),'"a b"');
});
test("balance commands acquire deterministic unique row locks and bind exact hold consumption",async()=>{
 const calls:{sql:string;values:unknown[]}[]=[];
 const tx={query:async(sql:string,values:unknown[])=>{calls.push({sql,values});return {rows:[{version:2}],rowCount:1};}} as unknown as PoolClient;
 const a:StockDelta={itemRef:id(3),locationRef:id(2),unit:"PIECE",scale:0,delta:"-6",reservedDelta:"-6",lineNo:1};
 const b:StockDelta={...a,locationRef:id(1),delta:"6",reservedDelta:"0",lineNo:2};
 await lockStockBalances(tx,id(9),[a,b,a]);assert.equal(calls.length,4);assert.equal(calls[0].values[2],id(1));assert.equal(calls[2].values[2],id(2));
 calls.length=0;await applyStockMovements(tx,id(9),id(10),"ISSUE",[a]);
 assert.equal(calls.length,2);assert.deepEqual(calls[0].values,[id(9),id(3),id(2),"-6","-6"]);assert.match(calls[0].sql,/on_hand_qty\+\$4::numeric>=reserved_qty\+\$5::numeric/);
 assert.match(calls[1].sql,/INSERT INTO stock_movement/);
});
test("failed balance update never appends a movement",async()=>{
 let calls=0;const tx={query:async()=>{calls++;return {rows:[],rowCount:0};}} as unknown as PoolClient;
 await assert.rejects(applyStockMovements(tx,id(9),id(10),"ISSUE",[{itemRef:id(3),locationRef:id(2),unit:"PIECE",scale:0,delta:"-1",lineNo:1}]));assert.equal(calls,1);
});
