import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const migration=()=>read("db/migrations/3409_cg09_csr_verified_bank_receipt_links.sql");
const finance=()=>read("src/modules/cg-09-finance-accounting/application/finance-csr-receipt-source.facade.ts");
const funding=()=>read("src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts");

test("US002-QA01/08/09: CG09 is original actual money source, no shadow GL",()=>{
 const sql=migration(),src=finance(),owner=funding();
 assert.match(sql,/CREATE TABLE finance_csr_verified_receipt_link/);
 assert.doesNotMatch(sql,/\b(?:received_minor|amount_minor|allocated_minor|utilized_minor)\s+bigint\b/i,
  "CG09 provenance link cannot store a second cash balance");
 assert.match(sql,/FOREIGN KEY\(reconciliation_id,root_realm_id\)/);
 assert.match(sql,/REFERENCES finance_bank_reconciliation\(id,root_realm_id\)/);
 assert.match(sql,/CREATE TRIGGER cg09_csr_receipt_link_immutable/);
 assert.doesNotMatch(src,/INSERT INTO journal\s*\(/);
 assert.doesNotMatch(owner,/INSERT INTO journal\s*\(/);
});
test("US002-QA02/03/07/17: independent signed CG09 bank+CG19+CG03 proof is mandatory",()=>{
 const sql=migration();
 for(const v of ["c.csr_funding_proposal_id=NEW.funding_proposal_id",
  "c.csr_funding_source_version+2=f.version",
  "d.action='APPROVE'","d.actor_id<>c.proposer_id",
  "rec.status='VERIFIED'","rec.variance_minor=0",
  "d.action='VERIFY'","d.password_verified_at IS NOT NULL",
  "evidence.owner_kind='CG09_BANK_STATEMENT'",
  "evidence.scan_status='CLEAN_VERIFIED'",
  "evidence.revoked_at IS NULL",
  "intent.status='VALIDATED'","command.command_kind='GENERAL_POST'",
  "j.posting_kind='GENERAL'","rec.posted_amount_minor>0",
  "eligible<>2","g.category IN('INCOME','FUND')",
  "finance_invoice_receipt","donation_bank_collection",
  "finance_membership_collection"])
  assert.ok(sql.includes(v),"Missing original owner guard: "+v);
});
test("US002-QA04/13/15: one verified deposit only, root+party total capped with reversal correction",()=>{
 const sql=migration(),src=finance();
 for(const v of ["UNIQUE(root_realm_id,reconciliation_id)",
  "UNIQUE(root_realm_id,actor_ref,request_key)",
  "f.csr_requested_minor","f.foundation_requested_minor",
  "used+r.posted_amount_minor>cap",
  "linked.party_kind=NEW.party_kind",
  "reversal.reversal_of_id=original.id",
  "NOT EXISTS(SELECT 1 FROM journal reversal",
  "FOR UPDATE","US002_SOURCE_IMMUTABLE_NEVER"]) {
   if(v==="US002_SOURCE_IMMUTABLE_NEVER")assert.ok(!sql.includes(v));
   else assert.ok(sql.includes(v),v);
 }
 for(const v of ["pg_advisory_xact_lock","CG09_CSR_RECEIPT_LINK_V2",
  "request_digest!==hash","replayed:true","replayed:false"])
  assert.ok(src.includes(v),v);
});
test("US002-QA02/05/11/19: CG01+CG02 source scopes, real current finance permissions",()=>{
 const src=finance(),owner=funding();
 for(const v of ["this.identity.assertCurrent(tx,a,action)",
  "requireFinanceRootScope","requireFinanceActiveBranch",
  'this.scope(tx,a,p,"finance.reconciliation.manage")',
  'this.scope(tx,a,p,"finance.reports.view")',
  "approvedFinanceSource","current.status!==\"APPROVED\"",
  "await assertCsrFundingProject","guardAgreement",
  "P3409"])assert.ok((src+"\n"+owner).includes(v),v);
});
test("US002-QA06/16/20: both staff channels use original protected CG09 receipt paths",()=>{
 const controller=read("src/modules/cg-08-csr-funding/http/csr-funding-proposals.controller.ts");
 const bff=read("../web/src/app/api/csr/funding-proposals/[[...parts]]/route.ts");
 const admin=read("../web/src/app/(admin)/admin/csr/page.tsx");
 const native=read("../android-internal/src/features/identity-access/staff-authentication-screen.tsx");
 const web=read("../web/src/features/csr/csr-funding-receipts-panel.tsx");
 const phone=read("../android-internal/src/features/csr/native-csr-funding-receipts-panel.tsx");
 for(const v of ["finance/eligible-receipts","finance/receipts","verifiedFinance"])
  assert.ok(controller.includes(v)||controller.includes(v.split("/").at(-1)!),v);
 for(const v of ['parts[2]==="eligible-receipts"','parts[2]==="receipts"',
  'req.headers.get("origin")!==req.nextUrl.origin'])
  assert.ok(bff.includes(v),v);
 for(const v of ['actions.includes("finance.reports.view")',
  'actions.includes("finance.reconciliation.manage")'])
  assert.ok(admin.includes(v),v);
 for(const v of ['roleActions.includes("finance.reports.view")',
  'roleActions.includes("finance.reconciliation.manage")'])
  assert.ok(native.includes(v),v);
 assert.ok(web.includes("finance/receipts")||web.includes('"/receipts"'));
 assert.ok(phone.includes('"/receipts"'));
});
test("US002-QA16/18/19: invalidated proof/reversal is NOT current bank receipt or available allocation",()=>{
 const src=finance(),sql=migration();
 for(const v of ["csrNeedsRevalidationMinor","foundationNeedsRevalidationMinor",
  "reversal.reversal_of_id=j.id","f.revoked_at IS NULL",
  "i.status='VALIDATED'","source:\"CG09_VERIFIED_BANK_RECONCILIATION\""])
  assert.ok(src.includes(v),v);
 assert.ok(sql.includes("linked.party_kind=NEW.party_kind"));
 assert.ok(sql.includes("original.id AND reversal.posting_kind='REVERSAL'"));
 assert.doesNotMatch(src.slice(0,src.indexOf("recordBudgetEffect")),/INSERT INTO finance_budget_event/);
});

test("US002-QA04/07/08: real payer must be attested by operator before immutable CG09 receipt attribution",()=>{
 const sql=migration(),src=finance(),owner=funding();
 const web=read("../web/src/features/csr/csr-funding-receipts-panel.tsx");
 const native=read("../android-internal/src/features/csr/native-csr-funding-receipts-panel.tsx");
 assert.ok(sql.includes("remitter_attested boolean NOT NULL CHECK(remitter_attested)"));
 assert.ok(src.includes("if(input.remitterConfirmed!==true)"));
 assert.ok(src.includes("CG09_CSR_RECEIPT_LINK_V2"));
 assert.ok(src.includes("actor_ref,remitter_attested"));
 assert.ok(owner.includes("v.remitterConfirmed!==true"));
 assert.ok(web.includes("I checked the actual CG09 bank statement"));
 assert.ok(web.includes("remitterConfirmed:true as const"));
 assert.ok(native.includes("remitterConfirmed:true as const"));
 assert.ok(native.includes("Bank reconciliation alone does not prove"));
});
test("US002-QA05/06/08/11/18: six B07 tiles separate actual CG09 money from unavailable allocations",()=>{
 const sourceOwner=funding(),financeOwner=finance();
 const web=read("../web/src/features/csr/csr-funding-workspace.tsx");
 const native=read("../android-internal/src/features/csr/native-csr-funding.tsx");
 for(const value of [
  'financeReportScope(bearer,"finance.reports.view")',
  'const all=scope.all&&financeScope.all',
  'csrBranches.filter(x=>financeScope!.branchRefs.includes(x))',
  'this.receipts.dashboardSummary(tx,a,',
  'summary:{...summary,verifiedFinance}'
 ])assert.ok(sourceOwner.includes(value),value);
 for(const value of [
  "WITH selected AS MATERIALIZED",
  "f.status='APPROVED'",
  "finance_csr_verified_receipt_link",
  "rec.status='VERIFIED'",
  "reversal.reversal_of_id=j.id",
  "file.revoked_at IS NULL",
  "allocatedMinor:allocated.toString()",
  "utilizedMinor:utilized.toString()",
  'await this.branches.requireFinanceRootScope(tx,a,"finance.reports.view")',
  'await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.reports.view")'
 ])assert.ok(financeOwner.includes(value),value);
 for(const text of [web,native]){
  assert.ok(text.includes("Total Fund / CSR requested"));
  assert.ok(text.includes("Received · CG09 verified"));
  assert.ok(text.includes("Committed · CG03 approved"));
  assert.ok(text.includes("Utilization %"));
  assert.ok(text.includes("Utilized · CG09"));
  assert.ok(text.includes("Available · CG09"));
 }
});
