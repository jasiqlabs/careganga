# CG-09 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-09-BR01–CG-09-BR17, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Account chart, balanced journals, vouchers, claims/invoices, budgets and reconciliation** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Account chart:** source attributes/status from CG-09-BR01–CG-09-BR17; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **balanced journals:** source attributes/status from CG-09-BR01–CG-09-BR17; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **vouchers:** source attributes/status from CG-09-BR01–CG-09-BR17; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **claims/invoices:** source attributes/status from CG-09-BR01–CG-09-BR17; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **budgets and reconciliation:** source attributes/status from CG-09-BR01–CG-09-BR17; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Draft/review/approved/posted/paid/reversed; Balanced journal, one source posting, correct funds vs commitment, no fake payment**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete finance contracts (mandatory DLD refinement)

**Schema:** `accounts(id,code,group,normal_balance,active,scope)` (unique normalized code); `journals(id,source_owner,source_ref,posting_kind,financial_year,status,posted_at,revision)` unique `(source_owner,source_ref,posting_kind,revision)`; `journal_lines(journal_id,account_id,debit,credit,branch_or_project_scope)`. Both debit and credit are nonnegative; each line has exactly one nonzero side. **Before POSTED, the same transaction must verify sum(debits)=sum(credits)** and all accounts active/in scope. Rejected/unbalanced journal has no posting and no misleading success.

**Voucher/claim/invoice:** versioned `voucher` + `voucher_lines` with quantity, rate, unit, charges/tax and calculated subtotal/total; `expense_claim` links its single authorized payable/voucher/journal/payment; `invoice` retains approval and issued/paid states separately. A claim cannot create a fresh expense on every workflow stage. A posted journal/receipt is immutable; reverse with a linked correction journal.

**Budget:** `budget` plus allocation/release/utilization events, with separate proposed, committed, approved, allocated, utilized, released and remaining/over-budget projections. Source cash/bank balance is never inferred from pledges. Safe `accounts/options` returns authorized labels for payment-entry pickers without granting full account ledger view (BrickOps selector lesson).

**Transactions/review:** narrow row locks on source-idempotency and account/period where needed, append-only audit, source callback dedupe, branch/project scope in all queries, and approved financial-year controls. QA source trace includes simultaneous source replay, unbalanced debit/credit, approved-but-unpaid voucher, refund/reversal, duplicate payroll/donation posting, protected ledger export, broken selector and reporting reconciliation.

**Pattern decision:** one double-entry posting service + typed owner posting facade + guarded status transitions. Reject per-module mini-ledgers, universal accounting-rule DSL, silently editable posted rows and independent mobile calculation.

## Typed API and coordination

An authenticated `/api/finance-accounting` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-023** — Finance Admin opens accounts: Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-024** — Finance user posts a transaction: Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-025** — Employee/volunteer requests reimbursement: Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-026** — Authorized user invoices or receipts: Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-027** — Finance allocates budget: Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-028** — Reviewer checks statements: See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03 and CG-02 when scoped. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.