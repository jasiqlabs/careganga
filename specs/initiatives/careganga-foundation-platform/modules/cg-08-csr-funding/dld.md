# CG-08 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-08-BR01–CG-08-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B02 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **CSR partners, funding proposals/agreements, commitments and allocations** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **CSR partners:** source attributes/status from CG-08-BR01–CG-08-BR08; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **funding proposals/agreements:** source attributes/status from CG-08-BR01–CG-08-BR08; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **commitments and allocations:** source attributes/status from CG-08-BR01–CG-08-BR08; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Partner requested/approved/returned; amount proposed/committed/received/allocated; Pledge not money; funding allocation not utilization; no shadow ledger**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete CSR partnership and fund states

`csr_partner(id,legal_name,contact,verification_state,approval_ref)` is the approved partner source; publication is separate from business verification. `funding_proposal(id,partner_ref,project_ref,purpose,requested_amount,status)` requires real CG-05 project and actual CG-03 approval; evidence includes agreements and reviewer history without copying documents out of CG-19.

`funding_commitment(id,proposal_ref,source_type,committed_amount,due_by,status)`, `fund_receipt(id,commitment_ref,finance_posting_ref,verified_amount)` and `fund_allocation(id,project_ref,source_fund_ref,category,approved_amount,utilized_amount)` preserve **requested ≠ committed ≠ received ≠ allocated ≠ utilized**. CG-09 alone recognizes cash/bank and project budget balances.

A Foundation/CSR split is versioned, sums must reconcile to approved amounts, and unreceived commitments cannot be represented as spendable cash. Corrections are linked reversals/adjustments, not silent replacement.

**QA:** incomplete agreement, foreign CSR proposal, returned application, 70/30 split total, two sponsors for one project, pledge versus cash, duplicate bank receipt and public partner marketing without approval.

## Typed API and coordination

An authenticated `/api/csr-funding` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-020** — CSR partner submits application: Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-021** — Foundation funds a project: Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-022** — Finance or partner manager examines funding: Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B02. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, CG-05 and CG-09. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.