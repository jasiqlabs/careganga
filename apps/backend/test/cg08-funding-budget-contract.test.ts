import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
const sql=()=>read("db/migrations/3410_cg09_csr_budget_effect_links.sql");
const finance=()=>read("src/modules/cg-09-finance-accounting/application/finance-csr-receipt-source.facade.ts");
const csr=()=>read("src/modules/cg-08-csr-funding/application/csr-funding-proposals.service.ts");

test("US002-QA07/10/15: one CG09 budget event attributed once in exact same root/branch/project",()=>{
 const v=sql();
 for(const x of [
  "CREATE TABLE finance_csr_budget_effect",
  "UNIQUE(root_realm_id,budget_event_id)",
  "UNIQUE(root_realm_id,actor_ref,request_key)",
  "FOREIGN KEY(root_realm_id,funding_proposal_id)",
  "REFERENCES csr_funding_proposal(root_realm_id,id)",
  "REFERENCES finance_budget_event(id)",
  "CREATE TRIGGER cg09_csr_budget_effect_immutable",
  "CREATE TRIGGER cg09_csr_budget_effect_source_guard",
  "p.status<>'APPROVED'",
  "e.budget_status<>'APPROVED'",
  "bud.status AS budget_status INTO e",
  "e.branch_id IS DISTINCT FROM p.branch_ref",
  "e.project_ref IS DISTINCT FROM p.project_ref",
  "FOR UPDATE"
 ])assert.ok(v.includes(x),x);
 assert.ok(!/\b(received_minor|amount_minor|utilized_minor)\s+bigint\b/i.test(v),
  "Attribution must not create its own money ledger");
});

test("US002-QA08/09/18: funded budget allocation requires live CG09 bank verification and current CG19 statement",()=>{
 const v=sql();
 for(const x of [
  "finance_csr_verified_receipt_link",
  "link.remitter_attested",
  "rec.status='VERIFIED'",
  "rec.variance_minor=0",
  "f.owner_kind='CG09_BANK_STATEMENT'",
  "f.scan_status='CLEAN_VERIFIED'",
  "f.revoked_at IS NULL",
  "i.status='VALIDATED'",
  "reversal.reversal_of_id=j.id",
  "ev.kind='ALLOCATE'",
  "allocated+e.amount_minor>received"
 ])assert.ok(v.includes(x),x);
});

test("US002-QA11/16/19: utilization requires original posted expense and cannot overrun assigned allocation",()=>{
 const v=sql(),f=finance();
 for(const x of [
  "e.kind NOT IN('ALLOCATE','UTILIZE','DEALLOCATE')",
  "utilized+e.amount_minor>allocated",
  "e.source_journal_id",
  "reversal_of_id=e.source_journal_id",
  "finance_budget_event(root_realm_id,budget_id,kind,amount_minor,",
  "finance_csr_budget_effect(root_realm_id,funding_proposal_id,",
  "INSERT INTO finance_budget_command(",
  "INSERT INTO finance_event(",
  "CG09_CSR_BUDGET_EFFECT_V1",
  "this.eligibleBudgetExpenses(tx,a,p,budget)",
  "this.eligibleBudgets(tx,a,p)"
 ])assert.ok((v+"\n"+f).includes(x),x);
 assert.ok(!f.includes("INSERT INTO journal("));
});

test("US002-QA02/04/17: correction/duplicate response safe and original protected scopes inside transaction",()=>{
 const f=finance(),c=csr();
 for(const x of [
  "pg_advisory_xact_lock",
  "request_digest!==hash",
  "replayed:true",
  "replayed:false",
  'this.scope(tx,a,p,"finance.budgets.manage")',
  'this.scope(tx,a,p,"finance.reports.view")',
  'await this.branches.requireFinanceActiveBranch(tx,a,p.branchRef,action)',
  'await this.branches.requireFinanceRootScope(tx,a,action)'
 ])assert.ok(f.includes(x),x);
 assert.ok(c.includes('this.receipts.recordBudgetEffect(tx,a,source,'));
 assert.ok(c.includes('if(source.sourceVersion!==v.expectedVersion)throw changed()'));
});

test("US002-QA05/06/20: five original B08 Web blocks use actual CG05, CG09 and CG19 sources",()=>{
 const web=read("../web/src/features/csr/csr-funding-workspace.tsx"),
  docs=read("../web/src/features/csr/csr-funding-agreement-panel.tsx"),
  budget=read("../web/src/features/csr/csr-funding-budget-panel.tsx"),
  project=read("../web/src/features/csr/csr-funding-project-context.tsx"),
  controller=read("src/modules/cg-08-csr-funding/http/csr-funding-proposals.controller.ts"),
  bff=read("../web/src/app/api/csr/funding-proposals/[[...parts]]/route.ts");
 for(const v of [
  'aria-label="1. Funder, contact & period"',
  'aria-label="2. Project Details & funding parties"',
  'aria-label="3. Budget Details & agreement terms"',
  'aria-label="5. Documents & Agreement"',
  "CsrFundingProjectContext",
  'mode="PROJECT"',
  'mode="TEAM"',
  'aria-label="4. Team & Members"',
  "CsrFundingBudgetPanel",
  "CsrFundingAgreementPanel"
 ])assert.ok(web.includes(v),v);
 for(const v of [
  "projectContext","eligibleFinanceBudgets",
  "eligibleFinanceExpenses","applyFinanceBudgetEffect"
 ])assert.ok(controller.includes(v),v);
 assert.ok(bff.includes('parts[4]==="expenses"'));
 assert.ok(budget.includes("Unutilized posted voucher")||
  budget.includes("unutilized posted voucher"));
 assert.ok(budget.includes("Record original CG09 budget effect"));
 assert.ok(project.includes("4. Team & Members"));
 assert.ok(docs.includes("funding"));
});

test("US002-QA05/11/16/18: B07 shows source-backed six numbers or true finance revalidation",()=>{
 const f=finance(),
  web=read("../web/src/features/csr/csr-funding-workspace.tsx"),
  native=read("../android-internal/src/features/csr/native-csr-funding.tsx");
 for(const v of [
  "finance_csr_budget_effect link",
  "ev.kind='ALLOCATE'",
  "ev.kind='UTILIZE'",
  "allocatedMinor:allocated.toString()",
  "utilizedMinor:utilized.toString()",
  "availableMinor:needsRevalidation?null",
  "needsRevalidation"
 ])assert.ok(f.includes(v),v);
 for(const code of [web,native]){
  assert.ok(code.includes("Utilization %"));
  assert.ok(code.includes("Utilized · CG09"));
  assert.ok(code.includes("Available · CG09"));
  assert.ok(code.includes("verifiedFinance"));
 }
});

test("US002-QA07/11: CG09 original event has no status; protected budget does",()=>{
 const original=read("db/migrations/0919_cg09_original_foundation_budgets.sql");
 const guard=sql();
 const start=original.indexOf("CREATE TABLE finance_budget_event(");
 const end=original.indexOf(");",start);
 assert.ok(start>=0&&end>start);
 assert.ok(!/\bstatus\s+text\b/.test(original.slice(start,end)));
 assert.ok(guard.includes("bud.status AS budget_status INTO e"));
 assert.ok(guard.includes("e.budget_status<>'APPROVED'"));
 assert.ok(!guard.includes("e.status<>'APPROVED'"));
});

test("US002-QA06: B08 original CG09 itemized category quantity/rate belongs to budget revision",()=>{
 const schema=read("db/migrations/3412_cg09_budget_itemized_revision.sql");
 const owner=read("src/modules/cg-09-finance-accounting/application/finance-budget.service.ts");
 const reviewer=read("src/modules/cg-09-finance-accounting/application/finance-budget-source.facade.ts");
 const financeWeb=read("../web/src/features/finance-accounting/finance-budget-workspace.tsx");
 const financeNative=read("../android-internal/src/features/finance-accounting/finance-native-budgets.tsx");
 const web=read("../web/src/features/csr/csr-funding-budget-panel.tsx");
 const native=read("../android-internal/src/features/csr/native-csr-funding-budget-panel.tsx");
 for(const x of [
  "CREATE TABLE finance_budget_item_revision",
  "PRIMARY KEY(root_realm_id,budget_id,version,line_no)",
  "REFERENCES finance_budget_revision(root_realm_id,budget_id,version)",
  "line_total_minor bigint GENERATED ALWAYS",
  "cg09_budget_item_revision_immutable"
 ])assert.ok(schema.includes(x),x);
 const freeze=read("db/migrations/3414_cg09_budget_item_revision_freeze.sql");
 for(const x of [
  "cg09_budget_item_revision_insert_guard",
  "cg09_budget_itemized_submit_guard",
  "source.status='RETURNED' AND NEW.version=source.version+1",
  "line_count>0 AND item_total<>NEW.approved_ceiling_minor"
 ])assert.ok(freeze.includes(x),x);
 for(const x of ["budgetItems(v.items,minor(v.ceiling))",
  "product%1000n!==0n","finance_budget_item_revision",
  "p.items.entries()","items:items.rows"])
  assert.ok(owner.includes(x),x);
 assert.ok(reviewer.includes("items:lines.rows"));
 assert.ok(financeWeb.includes("Original CG09 itemized budget"));
 assert.ok(financeNative.includes("Original CG09 budget items"));
 assert.ok(financeNative.includes("items:(x.items??[]).map"));
 assert.ok(financeNative.includes("Original Finance item breakdown"));
 assert.ok(web.includes("Original CG09 budget itemization"));
 assert.ok(native.includes("Original category / quantity / rate"));
});
test("US002-QA07/19: CG09 immutable deallocation cannot reverse spent cash or outlive original source",()=>{
 const correction=read("db/migrations/3413_cg09_original_budget_deallocation.sql");
 const link=sql(),financeOwner=finance(),csrOwner=csr();
 const web=read("../web/src/features/csr/csr-funding-budget-panel.tsx");
 const native=read("../android-internal/src/features/csr/native-csr-funding-budget-panel.tsx");
 for(const x of [
  "DEALLOCATE","allocated-deallocated-used",
  "cg09_deallocation_source_commit",
  "DEFERRABLE INITIALLY DEFERRED",
  "cg09_deallocation_has_csr_provenance"
 ])assert.ok(correction.includes(x),x);
 for(const x of [
  "correction_of_event_id","correction.correction_of_event_id",
  "original_link.party_kind=NEW.party_kind",
  "net_allocated-e.amount_minor<net_utilized",
  "corrected+e.amount_minor>original_allocation.amount_minor"
 ])assert.ok(link.includes(x),x);
 assert.ok(financeOwner.includes("eligibleBudgetAllocations"));
 assert.ok(financeOwner.includes("kind:\"ALLOCATE\"|\"UTILIZE\"|\"DEALLOCATE\""));
 assert.ok(financeOwner.includes("correctionOfEventRef:"));
 assert.ok(csrOwner.includes("eligibleFinanceAllocations"));
 assert.ok(csrOwner.includes('v.kind==="DEALLOCATE"'));
 for(const s of [web,native])assert.ok(s.includes("DEALLOCATE"));
});
