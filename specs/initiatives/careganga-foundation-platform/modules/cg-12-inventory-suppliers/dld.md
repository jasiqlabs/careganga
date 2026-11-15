# CG-12 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-037, FR-038, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-12-BR01–CG-12-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Admin global shell; no separate verified capture · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Item/supplier catalog, stock movement ledger, material requests/fulfilment** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Item/supplier catalog:** source attributes/status from CG-12-BR01–CG-12-BR06; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **stock movement ledger:** source attributes/status from CG-12-BR01–CG-12-BR06; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **material requests/fulfilment:** source attributes/status from CG-12-BR01–CG-12-BR06; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Request draft/approved/rejected/fulfilled; receipt/issue/reversal; Atomic stock, no duplicate issues or unauthorized negative balance**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete inventory ledger and source issue rules

`inventory_item(id,sku,name,unit,category,status)` unique normalized item code per applicable source; `supplier(id,name,contact,status)` serves inventory procurement references while actual vendor payable remains CG-09 finance. `stock_location(id,real_branch_ref,status)` cannot accept an unapproved or guessed location.

`stock_movement(id,item_ref,location_ref,source_owner,source_ref,kind,signed_qty,status,revision)` unique `(source_owner,source_ref,kind,revision)`. A guarded transaction locks the affected item/location balance (or an equivalent proven DB constraint) for last-unit issue; no negative available quantity except a documented approved adjustment policy. Reversal creates a compensating movement.

`material_request(id,requester,location,status,version)` plus item lines, approved quantities and fulfilled quantities supports pending/rejected/partial/full states, with idempotent fulfillment linked to actual movements. CG-06 aid and CG-13 rewards must consume verified movement references, not edit item stock directly.

**QA:** parallel last-unit issue, replayed material fulfillment, stock transfer between real branches, wrong-branch options, adjusted negative stock, item unit mismatch, low-stock alert without idle scan and export matching movement history.

## Specific owner contracts and source-QA

- **Stock source:** `item(id,sku,unit,category,status)`, `supplier(id,name,contact,status)`, `stock_location(branch_ref,status)`, `stock_movement(id,item_ref,location_ref,kind,signed_quantity,source_owner,source_ref,revision)` UNIQUE per source operation, and `material_request(id,requester,location,status,revision)` with item lines and fulfillments. Finance/vendor ledgers remain CG-09.
- **Atomic issue:** lock the (item,location) balance row or equivalent proven transaction while checking approved request remainder and available stock; concurrent last-unit issue cannot make stock negative. Partial fulfillment and reversal generate compensating movements. Low-stock notifications trigger on real movements or bounded schedules, not perpetual tenant-wide scanning.
- **QA:** two last-item issues, duplicate approved material fulfillment, wrong location scope, mixed quantity units, cancelled request with issue already made, attempted negative adjustment and stock ledger/report reconciliation.

## Typed API and coordination

An authenticated `/api/inventory-suppliers` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-037** — Inventory officer manages stock: Maintain item/supplier master, receipts, issuance, authorized adjustment, availability, low-stock alerts and transaction history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-038** — Staff requests material: Submit and track request through approval/rejection and fulfilled quantity, with project, beneficiary and reward consumption linked to one stock inventory. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Admin global shell; no separate verified capture. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02 actual storage and CG-03. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.