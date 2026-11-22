import {test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {parseInventoryThreshold,parseInventoryItem,parseInventoryLocation,parseInventorySupplier} from "../src/modules/cg-12-inventory-suppliers/application/inventory-catalog.service";
const requestKey="12345678-1234-4234-8234-123456789abc";
const item={requestKey,sku:" sample-01 ",name:"Sample item",category:"General",description:"",unit:"PIECE",scale:0,threshold:"5"};
test("normalizes code, preserves canonical whole-unit threshold",()=>{
 assert.equal(parseInventoryItem(item).sku,"SAMPLE-01");
 assert.equal(parseInventoryItem(item).threshold,"5");
 assert.equal(parseInventoryItem({...item,unit:"KG",scale:3,threshold:"1.125"}).threshold,"1.125");
});
test("rejects quantity overflow, invalid units, fractional pieces and spoofed authority",()=>{
 for(const change of [{threshold:"0.5"},{threshold:"1e3"},{threshold:"-1"},{threshold:"1000000000000000"},{threshold:1},{unit:"USD"},{scale:2},{unit:"KG",scale:4},{rootRealmId:requestKey},{onHand:"2"},{status:"ACTIVE"}])
  assert.throws(()=>parseInventoryItem({...item,...change}),BadRequestException);
});
test("genuine warehouse can start at Foundation without fabricated branch",()=>{
 assert.equal(parseInventoryLocation({requestKey,code:"WH-01",label:"Main warehouse",branchRef:null}).branchRef,null);
 assert.throws(()=>parseInventoryLocation({requestKey,code:"WH-01",label:"Main warehouse",branchRef:"fake"}),BadRequestException);
});
test("supplier catalog command rejects finance and scope spoofing",()=>{
 const supplier={requestKey,code:"vendor1",legalName:"Sample supplier",displayName:"Supplier",category:"General"};
 assert.equal(parseInventorySupplier(supplier).code,"VENDOR1");
 for(const change of [{paid:true},{balance:"10"},{rootRealmId:requestKey},{bankAccount:"123"}])
  assert.throws(()=>parseInventorySupplier({...supplier,...change}),BadRequestException);
});

test("catalog and warehouse threshold accepts exact persisted decimal zero padding, not fractions beyond precision",()=>{
 assert.equal(parseInventoryThreshold("5.000",0),"5");
 assert.equal(parseInventoryThreshold("0.000",0),"0");
 assert.equal(parseInventoryItem({...item,threshold:"5.000"}).threshold,"5");
 assert.equal(parseInventoryThreshold("1.250",2),"1.25");
 assert.throws(()=>parseInventoryThreshold("5.001",0),BadRequestException);
 assert.throws(()=>parseInventoryThreshold("1.251",2),BadRequestException);
});
