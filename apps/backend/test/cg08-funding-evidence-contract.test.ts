import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseCsrFundingAgreementUpload} from "../src/modules/cg-19-documents-notifications/application/csr-funding-agreement-evidence.service";

const proposal="11111111-1111-4111-8111-111111111111";
const key="22222222-2222-4222-8222-222222222222";
const good={proposalRef:proposal,sourceVersion:3,requestKey:key,
 mime:"application/pdf",sizeBytes:1024,sha256:"f".repeat(64)};
const source=(file:string)=>readFileSync(join(process.cwd(),file),"utf8");
test("US002-QA02/04/14: only explicit current proposal upload inputs",()=>{
 assert.deepEqual(parseCsrFundingAgreementUpload(good),good);
 for(const invalid of [
  {proposalRef:"foreign"}, {sourceVersion:0},{sourceVersion:"3"},
  {requestKey:"bad"}, {mime:"text/html"},{sizeBytes:0},
  {sizeBytes:10485761},{sizeBytes:"1024"},{sha256:"0".repeat(63)},
  {status:"APPROVED"},{receivedMinor:"2000"},{sourceRealmId:proposal},
  {fundingDecision:"SIGNED"},{storageProvider:"public"}
 ])assert.throws(()=>parseCsrFundingAgreementUpload({...good,...invalid}),
  "Forged or unsafe CG19 proof metadata must fail: "+JSON.stringify(invalid));
});
test("US002-QA02/04/19: CG19 checks original current CG01/02/05/08 and document grants",()=>{
 const owner=source("src/modules/cg-19-documents-notifications/application/csr-funding-agreement-evidence.service.ts");
 const proposalSource=source("src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts");
 for(const x of [
  'await this.funding.guardFundingAgreement(tx,a,v.proposalRef,v.sourceVersion,true)',
  'await this.funding.guardFundingAgreement(tx,a,i.funding_proposal_id,',
  'this.sessions.requireAction(bearer,action)',
  'await this.identity.assertCurrent(tx,a,action)',
  'this.objects.verifyPrivateObject',
  'proof.state==="CLEAN_VERIFIED"',
  "AND i.classification='CSR_FUNDING_AGREEMENT'",
  "AND f.revoked_at IS NULL",
  'await this.run(bearer,false,(tx,a)=>this.file(tx,a,fileRef))',
  'newest.object_key!==f.object_key',
  'newest.verified_sha256!==f.verified_sha256',
  'newest.verified_size_bytes!==f.verified_size_bytes',
  'newest.original_mime!==f.original_mime',
  'newest.proposal_revision!==f.proposal_revision'
 ])assert.ok(owner.includes(x),x);
 for(const x of [
  'await this.branches.projectBranch(tx,a,p.branch_ref)',
  'await this.identity.assertCurrent(tx,a,"projects.view")',
  'await assertCsrFundingProject(tx,a,p.project_ref,p.branch_ref,p.project_source_version!)',
  'sponsor.status!=="APPROVED"',
  'if(sourceVersion!==null&&p.version!==sourceVersion)throw changed()',
  'if(write&&p.status!=="DRAFT")throw changed()'
 ])assert.ok(proposalSource.includes(x),x);
});
test("US002-QA01/16/18: verified file not signature, CSR funding approval or CG09 cash",()=>{
 const owner=source("src/modules/cg-19-documents-notifications/application/csr-funding-agreement-evidence.service.ts");
 for(const missing of ["INSERT INTO finance_journal","UPDATE csr_funding_proposal SET status=",
  "INSERT INTO cg03_case_decision","received_minor","utilized_minor"])
  assert.ok(!owner.includes(missing),"CG19 cannot claim "+missing);
 assert.ok(owner.includes("NOT that the agreement was signed or that cash was received"));
});
test("US002-QA02/04/17: CG19 migration preserves existing guards, root+proposal+revision proof FKs",()=>{
 const sql=source("db/migrations/3407_cg19_csr_funding_agreement_evidence.sql");
 for(const x of [
  "cg19_funding_intent_proposal_fk",
  "cg19_funding_file_proposal_fk",
  "cg19_funding_file_intent_fk",
  "REFERENCES cg19_upload_intent(id,realm_id,funding_proposal_id,proposal_revision)",
  "cg19_funding_intent_disjoint",
  "cg19_funding_file_disjoint",
  "cg19_intent_branch_source",
  "cg19_file_branch_source",
  "cg19_intent_source_classification",
  "cg19_funding_evidence_event_immutable",
  "cg19_funding_intent_owner_immutable",
  "cg19_funding_file_owner_immutable"
 ])assert.ok(sql.includes(x),x);
 assert.ok(sql.indexOf("uq_cg19_funding_intent_owner")<
  sql.indexOf("CREATE TABLE cg19_funding_evidence_event"));
});
test("US002-QA05/06/20: Web and Internal Android expose only protected current-source proof",()=>{
 const web=source("../web/src/features/csr/csr-funding-workspace.tsx");
 const native=source("../android-internal/src/features/csr/native-csr-funding.tsx");
 const bff=source("../web/src/app/api/csr/funding-agreements/[[...parts]]/route.ts");
 const app=source("../android-internal/src/features/identity-access/staff-authentication-screen.tsx");
 assert.ok(web.includes('selected&&canReadAgreement&&<CsrFundingAgreementPanel'));
 assert.ok(native.includes('selected&&canReadAgreement&&<NativeCsrFundingAgreementPanel'));
 assert.ok(bff.includes('req.headers.get("origin")!==req.nextUrl.origin'));
 assert.ok(bff.includes('["intents","proposals","files"]'));
 assert.ok(app.includes('canUploadAgreement={roleActions.includes("documents.files.manage")'));
 assert.ok(source("../web/src/app/(admin)/admin/csr/page.tsx")
  .includes('canReadAgreement={actions.includes("documents.files.view")}'));
});
