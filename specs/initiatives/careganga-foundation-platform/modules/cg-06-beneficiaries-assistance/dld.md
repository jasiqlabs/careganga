# CG-06 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-015, FR-016, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-06-BR01–CG-06-BR05, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A07, A08 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-06 owns only restricted beneficiary identity and assistance source record. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete beneficiary confidentiality and aid distribution

`beneficiary(id,verified_contact_or_local_ref,approved_area,status,restricted_profile)` and `beneficiary_project(beneficiary_id,project_id,validity)` link only permitted real project and geography. Sensitive beneficiary identity, addresses and eligibility evidence are not available to general public or unauthorized staff, even via search/export.

`assistance_event(id,beneficiary_id,category,quantity,value,actor,project_ref,source_type,source_ref,status,version)` is the source of each delivered aid event, not a duplicate CG-12 stock or CG-09 expense ledger. Material assistance completes only against a valid authorized inventory issue; cash assistance completes only against a verified source posting/payment. Reversal references original movement and event.

Repeated aid to same beneficiary may be legitimate and must remain traceable; dedupe only **same request/source event**, not distinct actual help. Public impact projection exposes aggregated approved totals without personally identifying beneficiaries.

**QA:** cross-area beneficiary lookup, duplicate request/retry, valid repeated help on two dates, item issue without available stock, finance paid vs initiated, partial delivery/reversal and public de-identification/consent.

## CG-06 receiving-owner material assistance from actual CG-12 stock

**Narrow integration correction; not full CG-06 approval.** CG-12 independently owns physical item/store, reservation, immutable stock issue/return and B19 Distribution Log; CG-06 **US-002 owns actual private beneficiary aid/recipient and its introducing integration**. Only after real CG-06 beneficiary/project eligibility and permission, submit typed idempotent CG-12 material issue for the approved aid source. CG-12 locks source available/held stock and returns exactly one CONFIRMED physical issue event. CG-06 records exactly one link to that original event and marks delivered **only after confirmed physical source**. A submitted/approved request, money promised or stock hold is not delivered aid. When CG-12 shortage or access fails, keep PENDING_STOCK/UNAVAILABLE, reconcile the original event key after unknown response and prevent duplicate deductions. Authorized return/reversal links both original CG-12 movement and CG-06 private assistance history; no second stock balance or CG-09 cash effect.

**Full receiving channels:** A07/A08 private Foundation Admin beneficiary/assistance form with CG-12 restricted item/location available selector, correct approved vs issued/partial status, permitted staff native Internal Android assistance delivery/confirmation with optional real CG-19 proof, NestJS current CG-01+CG-02+CG-06 beneficiary and CG-12 warehouse authorization, PostgreSQL same-root original event reference/unique source key and append-only audit. Original B19 remains CG-12 internal stock UI, **never** a public beneficiary list. CG-06 US-001 beneficiary profile remains independently usable. This integration is required for CG-06 US-002, not claimed delivered when CG-12 is design approved.

**CG-06 US-002 concrete receiving data/API:** `assistance_event(root,id,beneficiary_ref,project_ref,item_ref_nullable,qty_decimal_nullable,stock_event_ref_nullable,kind,state,event_key,revision)` persists one UNIQUE(root,event_key), genuine private same-root beneficiary/project FKs and a confirmed original CG-12 issue reference for material aid only; no `cg06_stock_balance`. `POST /api/v1/assistance/:ref/deliver-material` accepts frozen approved assistance revision, true CG-12 item/location, qty and immutable idempotency key. Use a typed original CG-12 issue/return owner facade with current protected source/recipient grant and **one short same-database local transaction or durable PENDING+bounded reconciliation** before DELIVERED (never independent unverified two-system success). Last-unit race, partial then full, duplicate timeout, cancellation, CG-19 evidence unavailable and private beneficiary leakage must be tested via CG-06 US-002 QA. Separate cash aid calls real CG-09 and is not automatically paid.


## Cross-owner contracts and story-specific QA

**Core tests:** Register a beneficiary and log valid project-linked help; enforce privacy for search, profile, documents, export and public summary. If assistance consumes inventory or cash, require a real CG-12 stock or CG-09 expense effect and unique source link; two concurrent issues cannot double-decrement stock or double-pay. Reversal restores correct quantity/value and retains audit.

**Current versus later sources:** Profile and non-financial eligibility can work before a stock/payment option is configured; hide cash/material fulfillment paths until their already delivered owner contracts are available. Never silently substitute fake inventory or money.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/beneficiaries-assistance` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-015** — Staff registers beneficiary: Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-016** — Approved aid is delivered: Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A07, A08. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02, CG-05; CG-12 stock and CG-09 money. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.