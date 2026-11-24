import {test} from "node:test";
import assert from "node:assert/strict";
import {createDecipheriv,randomBytes} from "node:crypto";
import {componentMinor,date,minor,parsePolicy,parseSalary,fiscalYearFor,payrollMonth} from "../src/modules/cg-11-payroll-compensation/domain/payroll-input";
import {parsePayout,protectPayout} from "../src/modules/cg-11-payroll-compensation/domain/payout-instruction";
const key="00000000-0000-4000-8000-000000000001";
const branch="00000000-0000-4000-8000-000000000002";
const policy={requestKey:key,branchRef:branch,label:"Monthly salary",effectiveFrom:"2026-11-01",components:[{code:"HRA",label:"Housing allowance",kind:"ALLOWANCE",mode:"PERCENT",basisPoints:1250,taxClass:"NOT_CONFIGURED"}]};
test("effective dates and minor units reject invalid and overflowing values",()=>{
 assert.equal(date("2028-02-29"),"2028-02-29");assert.throws(()=>date("2026-02-29"));assert.throws(()=>minor("100000000000000"));assert.throws(()=>minor("1.2"));assert.throws(()=>minor("0"));
});
test("policy validates components, rates, duplicate code and statutory input",()=>{
 assert.equal(parsePolicy(policy).components[0].bp,1250);
 assert.throws(()=>parsePolicy({...policy,components:[policy.components[0],policy.components[0]]}));
 assert.throws(()=>parsePolicy({...policy,components:[{...policy.components[0],basisPoints:10001}]}));
 assert.throws(()=>parsePolicy({...policy,components:[{...policy.components[0],code:"PF",label:"Provident Fund"}]}));
 assert.throws(()=>parsePolicy({...policy,effectiveTo:"2026-10-31"}));
});
test("salary proposal pins policy and predecessor",()=>{
 const s=parseSalary({requestKey:key,policyRef:branch,policyRevision:1,effectiveFrom:"2026-12-01",supersedesRef:key,baseMinor:"5000000"});
 assert.equal(s.supersedes,key);assert.equal(s.baseMinor,"5000000");assert.equal(s.policyRevision,1);
});
test("integer arithmetic rounds half up once and refuses missing rate",()=>{
 assert.equal(componentMinor("101",{mode:"PERCENT",minor:null,bp:5000}),51n);
 assert.equal(componentMinor("1000",{mode:"FIXED",minor:"25",bp:null}),25n);
 assert.throws(()=>componentMinor("1000",{mode:"PERCENT",minor:null,bp:null}));
});
test("employee bank instructions encrypt, mask, and bind to original source",()=>{
 const previous=process.env.CG11_PAYOUT_ENCRYPTION_KEY;
 try{
  delete process.env.CG11_PAYOUT_ENCRYPTION_KEY;
  const v=parsePayout({requestKey:key,effectiveFrom:"2026-12-01",accountHolder:"Test Employee",accountNumber:"123456789012",ifsc:"ABCD0123456"});
  assert.throws(()=>protectPayout(branch,key,key,v));
  const secret=randomBytes(32);process.env.CG11_PAYOUT_ENCRYPTION_KEY=secret.toString("base64");
  const one=protectPayout(branch,key,key,v),two=protectPayout(branch,key,key,v);
  assert.equal(one.maskedDigits,"9012");assert.equal(one.maskedIfsc,"ABCD*******");
  assert.equal(one.fingerprint,two.fingerprint);assert.equal(one.requestDigest,two.requestDigest);assert.notEqual(one.nonce,two.nonce);
  assert.ok(!JSON.stringify(one).includes(v.account));
  const open=(employee:string)=>{const cipher=createDecipheriv("aes-256-gcm",secret,Buffer.from(one.nonce,"base64url"));cipher.setAAD(Buffer.from(JSON.stringify(["CG11_PAYOUT_V1",branch,employee,key])));cipher.setAuthTag(Buffer.from(one.tag,"base64url"));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(one.ciphertext,"base64url")),cipher.final()]).toString());};
  assert.equal(open(key).account,v.account);assert.throws(()=>open(branch));
 }finally{if(previous===undefined)delete process.env.CG11_PAYOUT_ENCRYPTION_KEY;else process.env.CG11_PAYOUT_ENCRYPTION_KEY=previous;}
});

test("Foundation scope and policy-derived financial years",()=>{
 assert.equal(parsePolicy({...policy,branchRef:"FOUNDATION"}).branch,null);
 assert.equal(parsePolicy({...policy,branchRef:null}).branch,null);
 assert.equal(parsePolicy(policy).branch,branch);
 assert.deepEqual(fiscalYearFor("2027-03-31"),{label:"2026-2027",from:"2026-04-01",until:"2027-04-01"});
 assert.equal(fiscalYearFor("2027-04-01").label,"2027-2028");
 assert.equal(payrollMonth("2026-2027","2027-03").periodUntil,"2027-04-01");
 assert.equal(payrollMonth("2026-2027","2026-12").periodUntil,"2027-01-01");
 assert.throws(()=>payrollMonth("2026-2027","2027-04"));
 assert.throws(()=>payrollMonth("2026-2027","2026-13"));
});
