import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=(file:string)=>readFileSync(join(process.cwd(),file),"utf8");

test("US002-QA01/03/16/20: original signed commitment goes to original CG03, never CG09 posting",()=>{
 const cg03=source("src/modules/cg-03-registration-approvals/application/csr-funding-review.service.ts");
 const cg08=source("src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts");
 assert.ok(cg03.includes("CSR_FUNDING_REVIEW"));
 assert.ok(cg03.includes("csr_funding_review_snapshot"));
 assert.ok(cg03.includes("await this.funding.freezeForFundingReview(tx,a,id,version,file)"));
 assert.ok(cg03.includes('await this.proof.requireCurrentProof(tx,a,id,version,file)'));
 assert.ok(cg03.includes("await this.funding.acceptFundingReviewEffect"));
 assert.ok(cg08.includes("async freezeForFundingReview"));
 assert.ok(cg08.includes('status=\'SUBMITTED\',version=version+1'));
 assert.ok(cg08.includes('status=$3,version=version+1,updated_by=$4'));
 for(const code of [cg03,cg08]){
  assert.ok(!code.includes("INSERT INTO finance_journal"));
  assert.ok(!code.includes("INSERT INTO finance_receipt"));
  assert.ok(!code.includes("INSERT INTO finance_budget_event"));
 }
 assert.ok(cg03.includes("Approved commitment is not verified cash"));
});
test("US002-QA02/04/07/08: original reviewer root and distinct self-approval restrictions",()=>{
 const code=source("src/modules/cg-03-registration-approvals/application/csr-funding-review.service.ts");
 for(const token of [
  'this.sessions.requireAction(bearer,"approvals.review")',
  'this.sessions.requireAction(bearer,"csr.partners.review")',
  'this.owner.verifyReviewer(tx,a,"approvals.review",true)',
  'this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId)',
  'if(c.proposer_id===a.accountId)',
  'this.sessions.requireFreshFoundationRootProof(tx,a,password)',
  'const prior=(await tx.query',
  'if(c.status!=="SUBMITTED"||c.revision!==expected)throw stale()',
  'if(changed.rowCount!==1)throw stale()'
 ])assert.ok(code.includes(token),token);
});
test("US002-QA03/04/14/19: immutable exact source snapshot and reviewer evidence checks",()=>{
 const cg03=source("src/modules/cg-03-registration-approvals/application/csr-funding-review.service.ts");
 const cg19=source("src/modules/cg-19-documents-notifications/application/csr-funding-agreement-evidence.service.ts");
 for(const token of [
  'csrDigest(["CG08_FUNDING_REVIEW_SOURCE_V1",r.source_snapshot])',
  'csrDigest(["CG08_FUNDING_REVIEW_SOURCE_V1",expected])',
  'await this.proof.requireCurrentProof(tx,a,r.proposal_id,',
  'this.proof.prepareFundingReviewFile(tx,a,',
  'this.proof.readPreparedFundingReviewFile(pending.file)',
  'this.proof.assertFundingReviewFileUnchanged(tx,a,'
 ])assert.ok(cg03.includes(token),token);
 assert.ok(cg19.includes("source.version!==version+1"));
 assert.ok(cg19.includes("current.verified_sha256!==prepared.verified_sha256"));
 assert.ok(cg19.includes("current.object_version!==prepared.object_version"));
});
test("US002-QA02/03/07/17: PostgreSQL frozen case, decision and deferred signed-source guards",()=>{
 const sql=source("db/migrations/3408_cg03_csr_funding_review.sql");
 for(const token of [
  "CREATE TABLE csr_funding_review_snapshot",
  "csr_funding_review_snapshot_immutable",
  "cg03_funding_review_exact_fk",
  "cg03_funding_review_disjoint",
  "ux_cg03_funding_review_pending",
  "cg03_funding_process_current_guard",
  "cg03_funding_case_write",
  "cg03_funding_decision_insert",
  "cg08_funding_status_proof_after",
  "DEFERRABLE INITIALLY DEFERRED",
  "f.owner_kind='CG08_FUNDING_AGREEMENT'",
  "f.revoked_at IS NULL",
  "d.actor_id<>c.proposer_id",
  "c.status=CASE NEW.status"
 ])assert.ok(sql.includes(token),token);
 assert.ok(sql.includes("NEW.status IN('DRAFT','SUBMITTED','APPROVED')"));
 assert.ok(sql.includes("NEW.status IN('APPROVED','RETURNED','REJECTED')"));
 assert.ok(sql.includes("csr_funding_source_version+1=OLD.version"));
 assert.ok(!sql.includes("INSERT INTO finance_journal"));
});
test("US002-QA04/19: returned draft correction is current-version and immutable-request replay only",()=>{
 const cg08=source("src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts");
 const sql=source("db/migrations/3408_cg03_csr_funding_review.sql");
 for(const token of [
  "async resumeReturned(",
  'if(row.status!=="RETURNED"||row.version!==expected)throw changed()',
  'const prior=await this.replay(tx,a,key,hash,"RESUME",id)',
  'return this.event(tx,a,id,key,hash,"RESUME",updated.version)',
  "CHECK(action IN('CREATE','EDIT','RESUME'))",
  "OLD.status='RETURNED' AND NEW.status='DRAFT'"
 ])assert.ok((cg08+"\n"+sql).includes(token),token);
});
test("US002-QA05/06/16/20: Web/native B08 source and protected approval screens are integrated",()=>{
 const bff=source("../web/src/app/api/csr/funding-proposals/[[...parts]]/route.ts");
 const reviewer=source("../web/src/app/api/csr/funding-reviews/[[...parts]]/route.ts");
 const web=source("../web/src/features/csr/csr-funding-agreement-panel.tsx");
 const admin=source("../web/src/app/(admin)/admin/csr/page.tsx");
 const native=source("../android-internal/src/features/identity-access/staff-authentication-screen.tsx");
 const agreement=source("../android-internal/src/features/csr/native-csr-funding-agreement-panel.tsx");
 assert.ok(bff.includes('["submit","resume"]'));
 assert.ok(bff.includes('parts[1]==="review-history"'));
 assert.ok(bff.includes('req.headers.get("origin")!==req.nextUrl.origin'));
 assert.ok(reviewer.includes("/api/v1/csr-funding-reviews"));
 assert.ok(web.includes('"/api/csr/funding-proposals/"+proposalRef+"/submit"'));
 assert.ok(agreement.includes('"/api/v1/csr/funding-proposals/"+proposalRef+"/submit"'));
 assert.ok(admin.includes("CsrFundingReviewWorkspace"));
 assert.ok(native.includes("NativeCsrFundingReviews"));
 assert.ok(native.includes("FUNDING_REVIEWS"));
});
test("US002-QA02/06: scope refresh never restores stale protected reviewer details on Web/native",()=>{
 const web=source("../web/src/features/csr/csr-funding-review-workspace.tsx");
 const native=source("../android-internal/src/features/csr/native-csr-funding-review-panel.tsx");
 assert.ok(web.includes("listSeq=useRef(0),detailSeq=useRef(0)"));
 assert.ok(web.includes("current!==detailSeq.current"));
 assert.ok(web.includes("live&&listSeq.current===current"));
 assert.ok(native.includes("seq=useRef(0),detailSeq=useRef(0)"));
 assert.ok(native.includes("detailSeq.current!==current"));
 assert.ok(native.includes("detailSeq.current++;setDetail(null);setQuery(v)"));
});
