import test from "node:test";
import assert from "node:assert/strict";
import {parsePartner} from "../src/modules/cg-08-csr-funding/application/csr-partners.service";
const key="11111111-1111-4111-8111-111111111111",branch="22222222-2222-4222-8222-222222222222";
const draft={requestKey:key,branchRef:branch,legalName:"  Community Partner Ltd  ",contactName:"  CSR Coordinator  ",contactEmail:"  csr@example.org  ",supportSummary:"  Support education programmes  "};
test("US001-QA09/14: normalized private draft, nullable registration and Foundation/branch scope",()=>{
 const v=parsePartner(draft);assert.equal(v.legalName,"Community Partner Ltd");assert.equal(v.contactEmail,"csr@example.org");
 assert.equal(v.expectedVersion,null);assert.equal(v.contactMobile,null);
 assert.equal(parsePartner({...draft,branchRef:null,contactEmail:null,contactMobile:"+919876543210"}).branchRef,null);
});
test("US001-QA02/04/14: no tenant, status, approval, finance, unsafe or extra fields accepted",()=>{
 for(const extra of [{rootRealmId:key},{status:"APPROVED"},{partnerRef:key},{approved:true},{receivedMinor:"100"},{publicLogo:true},{legalName:"<script>"},{contactEmail:"bad"},{contactMobile:"1234"},{branchRef:"not-a-uuid"},{supportSummary:"x"}]){
  assert.throws(()=>parsePartner({...draft,...extra}),JSON.stringify(extra));
 }
 assert.throws(()=>parsePartner({...draft,contactEmail:null,contactMobile:null}));
});
test("US001-QA03/13/15: protected current revision and request identity are mandatory",()=>{
 assert.equal(parsePartner({...draft,expectedVersion:3}).expectedVersion,3);
 for(const version of [0,-1,1.5,"2",2147483647])assert.throws(()=>parsePartner({...draft,expectedVersion:version}));
 assert.throws(()=>parsePartner({...draft,requestKey:"same-token"}));
});
