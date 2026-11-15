# CG-06 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-015, FR-016, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-06-BR01–CG-06-BR05, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A07, A08 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Restricted beneficiary and project-linked assistance events** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Restricted beneficiary and project-linked assistance events:** source attributes/status from CG-06-BR01–CG-06-BR05; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Beneficiary new/verified; aid requested/approved/issued/reversed; Material and cash aid require genuine owner movement, no duplicate stock/expense**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete beneficiary confidentiality and aid distribution

`beneficiary(id,verified_contact_or_local_ref,approved_area,status,restricted_profile)` and `beneficiary_project(beneficiary_id,project_id,validity)` link only permitted real project and geography. Sensitive beneficiary identity, addresses and eligibility evidence are not available to general public or unauthorized staff, even via search/export.

`assistance_event(id,beneficiary_id,category,quantity,value,actor,project_ref,source_type,source_ref,status,version)` is the source of each delivered aid event, not a duplicate CG-12 stock or CG-09 expense ledger. Material assistance completes only against a valid authorized inventory issue; cash assistance completes only against a verified source posting/payment. Reversal references original movement and event.

Repeated aid to same beneficiary may be legitimate and must remain traceable; dedupe only **same request/source event**, not distinct actual help. Public impact projection exposes aggregated approved totals without personally identifying beneficiaries.

**QA:** cross-area beneficiary lookup, duplicate request/retry, valid repeated help on two dates, item issue without available stock, finance paid vs initiated, partial delivery/reversal and public de-identification/consent.

## Typed API and coordination

An authenticated `/api/beneficiaries-assistance` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-015** — Staff registers beneficiary: Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-016** — Approved aid is delivered: Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A07, A08. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02, CG-05; CG-12 stock and CG-09 money. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.