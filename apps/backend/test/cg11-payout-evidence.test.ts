import {test} from "node:test";
import assert from "node:assert/strict";
import {matchesPayoutEvidence,parsePayout,protectPayout} from "../src/modules/cg-11-payroll-compensation/domain/payout-instruction";
test("bank proof binds exact original root, employee, account and IFSC, preserving leading zeros",()=>{
 const previous=process.env.CG11_PAYOUT_ENCRYPTION_KEY;
 process.env.CG11_PAYOUT_ENCRYPTION_KEY=Buffer.alloc(32,42).toString("base64");
 try{
  const id="00000000-0000-4000-8000-000000000001",root="00000000-0000-4000-8000-000000000002",employee="00000000-0000-4000-8000-000000000003";
  const evidence={accountHolder:"Synthetic Employee",accountNumber:"000123456789",ifsc:"TEST0001234"};
  const protectedValue=protectPayout(root,employee,id,parsePayout({requestKey:id,effectiveFrom:"2026-11-01",...evidence}));
  assert.equal(matchesPayoutEvidence(root,employee,protectedValue.fingerprint,evidence),true);
  assert.equal(matchesPayoutEvidence(root,employee,protectedValue.fingerprint,{...evidence,accountNumber:"000123456788"}),false);
  assert.equal(matchesPayoutEvidence(root,employee,protectedValue.fingerprint,{...evidence,ifsc:"TEST0001235"}),false);
  assert.equal(matchesPayoutEvidence(root,employee,protectedValue.fingerprint,{...evidence,accountHolder:"Another Employee"}),false);
  assert.equal(matchesPayoutEvidence(id,employee,protectedValue.fingerprint,evidence),false);
  assert.equal(matchesPayoutEvidence(root,id,protectedValue.fingerprint,evidence),false);
  assert.equal(matchesPayoutEvidence(root,employee,"0".repeat(63),evidence),false);
  assert.throws(()=>matchesPayoutEvidence(root,employee,protectedValue.fingerprint,{...evidence,unexpected:"field"}));
 }finally{if(previous===undefined)delete process.env.CG11_PAYOUT_ENCRYPTION_KEY;else process.env.CG11_PAYOUT_ENCRYPTION_KEY=previous;}
});
