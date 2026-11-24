import test from "node:test";
import assert from "node:assert/strict";
import {
 parseProfile,parseChange,parseLink,parseUnlink,parseRevoke,parseListQuery,ref,revision,nextCursor
} from "../src/modules/cg-06-beneficiaries-assistance/domain/beneficiary-input";

const key="11111111-1111-4111-8111-111111111111";
const project="22222222-2222-4222-8222-222222222222";
const state="33333333-3333-4333-8333-333333333333";
const district="44444444-4444-4444-8444-444444444444";
const draft={requestKey:key,name:"Safiya Khan",stateRef:state,districtRef:district,
 beneficiaryType:"Community Assistance",gender:"NOT_SPECIFIED",ageGroup:"ADULT",
 consentKind:"SELF",consentPurpose:"Access agreed Foundation assistance",
 consentAcknowledged:true};

test("US-001-QA01/10: first private beneficiary requires no project, stock, payment or identity number",()=>{
 const v=parseProfile(draft,true);
 assert.equal(v.branch,null);assert.equal(v.contact,null);assert.equal(v.state,state);
 assert.equal(v.ageGroup,"ADULT");assert.equal(v.expected,null);
});
test("US-001-QA02/10: no root/branch/internal status spoofing",()=>{
 for(const injected of [{rootRealmId:key},{verificationState:"VERIFIED"},{lifecycle:"ACTIVE"},{accountRef:key},{consentRevokedAt:"now"}]){
  assert.throws(()=>parseProfile({...draft,...injected},true));
 }
 assert.throws(()=>parseProfile({...draft,branchRef:project},false));
});
test("US-001-QA10/17: explicit consent and guardian proof are required for a minor",()=>{
 for(const x of [{consentAcknowledged:false},{consentPurpose:"no"},
   {ageGroup:"CHILD"},{ageGroup:"CHILD",consentKind:"GUARDIAN",representativeName:""},
   {consentKind:"REPRESENTATIVE",representativeName:""}])
  assert.throws(()=>parseProfile({...draft,...x},true));
 const guardian=parseProfile({...draft,ageGroup:"CHILD",consentKind:"GUARDIAN",
   representativeName:"Parent Khan",representativeContact:"+919876543210"},true);
 assert.equal(guardian.consentKind,"GUARDIAN");
 assert.equal(guardian.representativeContact,"+919876543210");
});
test("US-001-QA04/19: strict contact, geography and version validation",()=>{
 const valid=parseProfile({...draft,contactMobile:"+919876543210"},true);
 assert.equal(valid.contact,"+919876543210");
 for(const bad of ["9876543210","+0123456789","+1234","not a phone","+919876543210000000"]){
  assert.throws(()=>parseProfile({...draft,contactMobile:bad},true));
 }
 assert.throws(()=>parseProfile({...draft,stateRef:"invalid"},true));
 assert.throws(()=>parseProfile({...draft,districtRef:"invalid"},true));
 assert.throws(()=>parseProfile({...draft,expectedRevision:0},false));
 assert.equal(parseProfile({...draft,expectedRevision:2},false).expected,2);
 assert.throws(()=>revision(1.1));assert.throws(()=>ref("not-a-uuid"));
});
test("US-001-QA03: commands require opaque immutable request keys and revisions",()=>{
 const base={requestKey:key,expectedRevision:1};
 assert.equal(parseChange({...base,lifecycle:"INACTIVE",reason:"Consent no longer active"}).lifecycle,"INACTIVE");
 assert.equal(parseLink({...base,projectRef:project}).project,project);
 assert.equal(parseUnlink({...base,linkRef:project}).link,project);
 assert.equal(parseRevoke({...base,reason:"Subject withdrew consent"}).reason,"Subject withdrew consent");
 for(const bad of [{...base,expectedRevision:0,lifecycle:"ACTIVE",reason:"Valid reason"},
   {...base,lifecycle:"VERIFIED",reason:"Wrong transition"},
   {...base,lifecycle:"INACTIVE",reason:"x"}])assert.throws(()=>parseChange(bad));
 assert.throws(()=>parseLink({...base,projectRef:project,rootRealmId:key}));
});
test("US-001-QA15: bounded private search, honest pending-filter and opaque cursor",()=>{
 const p=parseListQuery({verification:"PENDING",branchRef:project,q:"Safiya"});
 assert.equal(p.status,"PENDING");assert.equal(p.branch,project);
 const cur=nextCursor("2026-11-24T08:00:00.000Z",key);
 assert.equal(parseListQuery({cursor:cur}).before?.id,key);
 for(const bad of [{verification:"APPROVED"},{lifecycle:"VERIFIED"},{cursor:"invalid"},
  {q:"x".repeat(81)},{branchRef:"invalid"}])assert.throws(()=>parseListQuery(bad));
});

test("US-001-QA15: demographic filters use only approved enum values",()=>{
 const f=parseListQuery({gender:"FEMALE",ageGroup:"CHILD"});
 assert.equal(f.gender,"FEMALE");assert.equal(f.ageGroup,"CHILD");
 for(const bad of [{gender:"unknown"},{ageGroup:"2"}])assert.throws(()=>parseListQuery(bad));
});

test("US-001-QA15: current geography pair and valid inclusive registration date range",()=>{
 const q=parseListQuery({stateRef:state,districtRef:district,registeredFrom:"2026-11-01",registeredTo:"2026-11-30"});
 assert.equal(q.state,state);assert.equal(q.district,district);assert.equal(q.from,"2026-11-01");assert.equal(q.to,"2026-11-30");
 for(const bad of [{districtRef:district},{registeredFrom:"2026-02-30"},{registeredTo:"2026-1-01"},{registeredFrom:"2026-12-01",registeredTo:"2026-11-01"},{registeredFrom:"0000-01-01"}])assert.throws(()=>parseListQuery(bad));
});
