# CG-09 — Finance Accounting

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-09-BR01–CG-09-BR17, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Account chart, balanced journals, vouchers, claims/invoices, budgets and reconciliation state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Account chart, balanced journals, vouchers, claims/invoices, budgets and reconciliation. **Delivery-critical, already-delivered owners:** CG-01 permissions, CG-02 real branch scope, CG-03 actual review/approval case when applicable. **Later owned integrations, never required to fake this module's first working path:** CG-04/07/08/10/11/12/17 create their own source financial events later, calling CG-09 posting facade instead of creating ledgers. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

**State and invariant:** Draft/review/approved/posted/paid/reversed. Balanced journal, one source posting, correct funds vs commitment, no fake payment. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-023/A-09:** Finance Admin opens accounts — Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses
- **FR-024/A-09:** Finance user posts a transaction — Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state
- **FR-025/A-09:** Employee/volunteer requests reimbursement — Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses
- **FR-026/A-09:** Authorized user invoices or receipts — Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states
- **FR-027/A-09:** Finance allocates budget — Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down
- **FR-028/A-09:** Reviewer checks statements — See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit

Detailed authoritative clauses:
- **CG-09-BR01:** Manage chart of accounts and groups (assets, liabilities, funds/equity, income, expense), account codes/status/opening balances, cash/bank accounts and financial years.
- **CG-09-BR02:** Preserve linked debit/credit postings by date, account, source reference, branch/project, amount, payment method and status with audit history.
- **CG-09-BR03:** Provide general ledger, cash book, bank book, day book, project and CSR ledgers; trial balance, transaction list, summaries and permissioned exports.
- **CG-09-BR04:** Provide authorized guided manual journal/ledger entries with required accounting allocations and references, without bypassing approval rules.
- **CG-09-BR05:** Dashboard shows account balances, cash flow, income vs expenses, available budget, outstanding payables, salary totals and scoped financial metrics.
- **CG-09-BR06:** Support payment, expense, journal and contra vouchers with unique number, date, employee/department, project, payee/vendor, GST when applicable, payment mode/bank, invoice/ref, category and remarks.
- **CG-09-BR07:** Support multi-item vouchers with description, quantity, unit, rate, subtotal, applicable tax, other charges, calculated total, amount in words, remarks and attachment references. Display source-specific project/ITPA code, project/campaign, available budget, GST, bank, invoice reference/date, creator/department and category fields where applicable.
- **CG-09-BR08:** Submit vouchers for verification and multi-level approvals, with approved, rejected, pending and payment-released states.
- **CG-09-BR09:** Employees or eligible volunteers can claim expenses/allowances using purpose, date, category, project, amount, preferred payment method and bill/proof; track approval, payable and payment.
- **CG-09-BR10:** Keep original expense claim, approved voucher, payment and ledger posting linked. A reimbursement request does not create multiple separate expenses merely because it moves through screens.
- **CG-09-BR11:** Maintain internal invoices and receipts with a draftable, multi-stage entry flow: (1) person/organization/member/vendor, invoice type, linked campaign/project/program, date/due/currency/purpose; (2) item descriptions/categories/units/quantities/prices/discounts/totals; (3) invoice/proof attachments, number or manual reference, fiscal year, branch/department, template, payment method/terms, notes/tags; (4) responsible verifier/approver, submit/review and resulting ledger link. Generate authorized PDFs and communication records without shadow invoice masters.
- **CG-09-BR12:** Send/download/print invoices/receipts; email/WhatsApp sharing only through configured channels and permitted templates.
- **CG-09-BR13:** Create and approve project/branch/category budgets by period, with authorized allocation, utilized and remaining amounts.
- **CG-09-BR14:** Track vendor/payee information and outstanding/bank reconciliation consistently where financial transactions require it.
- **CG-09-BR15:** Provide finance search/filter/report/exports by branch, project, period, account, payment method, creator, approver, status and amount.
- **CG-09-BR16:** Budgets and fund summaries expose **approved, committed, allocated, utilized, released, remaining and over-budget** amounts as distinct concepts with authorized definitions and linked accounting sources; show supporting period, branch/project, funder and category drill-down rather than reconciling manually duplicated dashboard totals.
- **CG-09-BR17:** Guided manual ledger-entry screens may let an operator select debit or credit and account, but the accepted accounting transaction must be complete, balanced, approved where required, attributable to its source and traceable through general ledger, cash book, bank book, day book, project/CSR ledger and trial balance.

## Independently deliverable vertical flow

**Concrete acceptance:** Configure real accounts and post balanced debit/credit with one immutable source event key; concurrent duplicate payments, stale voucher, wrong-branch accounts and invalid journal lines cannot create extra cash or misleading totals. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.