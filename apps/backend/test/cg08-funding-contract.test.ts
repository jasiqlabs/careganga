import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseFundingProposal} from "../src/modules/cg-08-csr-funding/domain/funding-proposal-input";

const uid="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const partner="33333333-3333-4333-8333-333333333333";
const base={
 requestKey:uid,branchRef:branch,partnerRef:partner,projectRef:null,
 projectVersion:null,purpose:"Support a real Foundation activity",fundType:"MIXED",
 amountMinor:"10001",csrShareBps:7000,foundationShareBps:3000,
 proposedFrom:"2026-11-23",proposedUntil:"2027-02-23",
 agreementSummary:"Terms require independent review"
};
test("US002-QA01/03/04: proposed 70/30 split is exact integer paise, never posted cash",()=>{
 const v=parseFundingProposal(base);
 assert.equal(v.csrRequestedMinor,"7000");
 assert.equal(v.foundationRequestedMinor,"3001");
 assert.equal(BigInt(v.csrRequestedMinor)+BigInt(v.foundationRequestedMinor),BigInt(v.amountMinor));
 assert.equal(v.projectRef,null);
});
test("US002-QA01/09: Foundation purpose needs neither CSR partner nor CG05 project",()=>{
 const v=parseFundingProposal({...base,branchRef:null,partnerRef:null,fundType:"FOUNDATION",
  csrShareBps:0,foundationShareBps:10000});
 assert.equal(v.partnerRef,null);assert.equal(v.projectRef,null);
 assert.equal(v.csrRequestedMinor,"0");
});
test("US002-QA04/12/14: prevent forged approval, finance posting, split errors and stale CG05 pointers",()=>{
 for(const extra of [
  {status:"APPROVED"},{receivedMinor:"10001"},{committedMinor:"10001"},
  {rootRealmId:uid},{currency:"USD"},{cashReceived:true},
  {csrShareBps:7000,foundationShareBps:2900},
  {projectRef:uid,projectVersion:null},{projectRef:null,projectVersion:1},
  {fundType:"FOUNDATION",csrShareBps:7000},
  {fundType:"CSR_PARTNER",csrShareBps:7000},
  {fundType:"MIXED",csrShareBps:10000,foundationShareBps:0},
  {amountMinor:"1.50"},{amountMinor:"0"},{amountMinor:"1000000000000000"},
  {proposedFrom:"2027-02-23",proposedUntil:"2026-11-23"},
  {requestKey:"not-a-uuid"},{purpose:"<script>"}
 ])assert.throws(()=>parseFundingProposal({...base,...extra}),JSON.stringify(extra));
});
test("US002-QA02/12/17: current CG02 role/branch and actual CG05 project source enforce scope",()=>{
 const s=readFileSync(join(process.cwd(),"src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts"),"utf8");
 assert.ok(s.includes('await this.branches.projectBranch(tx,a,v.branchRef)'));
 assert.ok(s.includes('await assertCsrFundingProject(tx,a,v.projectRef,v.branchRef,v.projectVersion!)'));
 assert.ok(s.includes('await this.original(tx,a,id,true)'));
 assert.ok(s.includes('await this.branches.projectBranchScope(tx,a)'));
 assert.ok(s.includes('WHERE f.root_realm_id=$1 AND ($2::boolean OR f.branch_ref=ANY($3::uuid[]))'));
 assert.ok(!s.includes('INSERT INTO finance_journal'));
});
test("US002-QA05/06/18: B07/B08 Web uses original four steps, not synthetic available cash",()=>{
 const s=readFileSync(join(process.cwd(),"../web/src/features/csr/csr-funding-workspace.tsx"),"utf8");
 for(const token of ['"Fund information"','"Project & split"','"Agreement notes"','"Review & save"',
   'const detailEpoch=useRef(0)',
   'const request=++detailEpoch.current',
   'if(request!==detailEpoch.current)return;',
   'invalidateDetail();setFilter(e.target.value)',
   'invalidateDetail();setStatus(e.target.value)',
   'setPending(command)','setPending(null)'])
  assert.ok(s.includes(token),token);
 assert.ok(s.includes('This is a request, not an approved commitment or received cash.'));
 assert.ok(s.includes('disabled={busy||!!pending||!canManage||!!selected&&selected.status!=="DRAFT"}'));
});
