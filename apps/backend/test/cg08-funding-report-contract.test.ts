import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const src=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const report=()=>src("src/modules/cg-08-csr-funding/application/csr-funding-reports.service.ts");

test("US003-QA01/08/09/10/11/14: requested and committed never become CG09 bank cash by implication",()=>{
 const s=report();
 for(const x of [
  "FROM csr_funding_proposal f","finance_csr_verified_receipt_link",
  "finance_bank_reconciliation rec","cg19_stored_file file",
  "file.scan_status='CLEAN_VERIFIED'","finance_csr_budget_effect link",
  "finance_budget_event ev","v.status===\"APPROVED\"?v.requestedMinor:\"0\"",
  "receivedMinor:v.receivedMinor","allocatedMinor:v.allocatedMinor",
  "utilizedMinor:v.utilizedMinor","financeStatus:recheck?",
  "RECEIPT_PENDING","NOT_APPROVED","REVALIDATION_REQUIRED"
 ])assert.ok(s.includes(x),x);
 assert.ok(!s.includes("INSERT INTO journal("));
 assert.ok(!s.includes("INSERT INTO finance_budget_event("));
});
test("US003-QA02/12/18/19: report intersects real CG01/CG02 permissions, keeps private owner data excluded",()=>{
 const s=report();
 for(const x of [
  'requireAction(bearer,"csr.partners.view")',
  'requireAction(bearer,"finance.reports.view")',
  'financeReportScope(bearer,"finance.reports.view")',
  "projectBranchScope(tx,actor)",
  "const all=csr.all&&finances.all",
  "requireFinanceActiveBranch(tx,actor,id",
  "requireFinanceRootScope(tx,actor",
  "if(f.projectRef&&!projects)throw new ForbiddenException",
  "AND pr.branch_ref IS NOT DISTINCT FROM f.branch_ref",
  "WHERE f.root_realm_id=$1",
  "AND ($2::boolean OR f.branch_ref=ANY($3::uuid[]))"
 ])assert.ok(s.includes(x),x);
 for(const x of ["contact_private","registration_ref","downloadUrl","cg19_file_bytes",
  "donation_bank_collection","finance_membership_collection"]){
  assert.ok(!s.includes("SELECT "+x),x);
 }
});
test("US003-QA03/04/07/16: fail-closed report, no stale or revoked bank money",()=>{
 const s=report();
 for(const x of [
  'BEGIN ISOLATION LEVEL REPEATABLE READ',
  "file.revoked_at IS NULL","intent.status='VALIDATED'",
  "reversal.status='POSTED'","rec.status='VERIFIED'",
  "rec.variance_minor=0","invalid>0n||allocated>received||utilized>allocated",
  'new ServiceUnavailableException("Original CG09 report unavailable.',
  "recheck?null:String(received-allocated)"
 ])assert.ok(s.includes(x),x);
});
test("US003-QA06/15/17: private reports have bounded cursor, guarded CSV, no CG20 dependency",()=>{
 const s=report();
 const controller=src("src/modules/cg-08-csr-funding/http/csr-funding-reports.controller.ts");
 const proxy=src("../web/src/app/api/csr/funding-reports/[[...parts]]/route.ts");
 for(const x of [
  "LIMIT $14","ORDER BY f.updated_at DESC,f.id DESC",
  "f.updated_at,f.id)<($12::timestamptz,$13::uuid)",
  "max===26?25:1000","records.length>items.length",
  "AT TIME ZONE 'Asia/Kolkata'",
  "if(result.hasMore)throw new ConflictException",
 ].filter(Boolean))assert.ok(s.includes(x),x);
 assert.ok(s.includes("^[=+\\-@]"));
 assert.ok(controller.includes('@Get("export/csv")'));
 assert.ok(controller.includes('@Header("Cache-Control","private, no-store")'));
 assert.ok(proxy.includes('cookies()')&&proxy.includes('cg_staff_session'));
 assert.ok(proxy.includes("Content-Disposition"));
 assert.ok(!s.includes("cg-20"));
});
test("US003-QA05/06/20: original Foundation Admin and Internal Android screen both restrict finance reports",()=>{
 const admin=src("../web/src/app/(admin)/admin/csr/page.tsx");
 const web=src("../web/src/features/csr/csr-funding-reports-workspace.tsx");
 const shell=src("../android-internal/src/features/identity-access/staff-authentication-screen.tsx");
 const mobile=src("../android-internal/src/features/csr/native-csr-funding-reports-panel.tsx");
 assert.ok(admin.includes('actions.includes("csr.partners.view")&&actions.includes("finance.reports.view")'));
 assert.ok(admin.includes("CsrFundingReportsWorkspace"));
 assert.ok(shell.includes('canReports=canDrafts&&roleActions.includes("finance.reports.view")'));
 assert.ok(shell.includes("NativeCsrFundingReports"));
 for(const text of [web,mobile]){
  for(const x of ["CSR Funding Reports","Committed","Received","Allocated","Utilized","Previous","Next 25"])
   assert.ok(text.includes(x),x);
 }
});

test("US003-QA13/18: public partner attribution stays under original CG08 rights plus independent CG18 editorial approval",()=>{
 const partners=src("src/modules/cg-08-csr-funding/application/csr-partner-public-source.ts")
  .replace(/\\'/g,"'");
 const cms=src("src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts");
 const publicPage=src("../web/src/app/collaboration/page.tsx");
 const publicSource=src("../web/src/features/cms-public-content/cms-public-source.ts");
 const publicAndroid=src("../android-public/src/features/cms/public-cms-screen.tsx");
 for(const x of [
  "p.status='APPROVED'","r.state='AUTHORIZED'",
  "s.evidence_file_id=r.evidence_file_id",
  "f.scan_status='CLEAN_VERIFIED'","f.revoked_at IS NULL",
  "i.status='VALIDATED'","c.status='OWNER_COMPLETED'",
  "r.version AS \"rightsVersion\"",
  "currentCards(db:Pool|PoolClient"
 ])assert.ok(partners.includes(x),x);
 for(const x of [
  "partnerRevisionCurrent","this.csrPartners.currentCards",
  "kind===\"PARTNERS\"","PARTNER_CARDS"
 ])assert.ok(cms.includes(x),x);
 assert.ok(publicPage.includes('publishedCmsPage("collaboration")'));
 assert.ok(publicPage.includes("safeCards"));
 assert.ok(publicSource.includes('source.kind==="PARTNERS"&&slug!=="collaboration"'));
 for(const x of [
  'collaboration:"PARTNERS"',
  'section.kind==="PARTNER_CARDS"&&page.kind==="PARTNERS"',
  '"/collaboration"',
  'Corporate Partners',
  'const url=safeImage(logo)',
  'No partner identities are currently approved for public display.'
 ])assert.ok(publicAndroid.includes(x),x);
 assert.ok(!publicPage.includes("finance_csr_verified_receipt_link"));
 assert.ok(!publicAndroid.includes("finance_csr_verified_receipt_link"));
});
