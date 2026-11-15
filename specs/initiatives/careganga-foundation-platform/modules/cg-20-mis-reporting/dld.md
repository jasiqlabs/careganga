# CG-20 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-20-BR01–CG-20-BR07, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01, C44, C45, C46, C47, C49 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Dashboards, standard/custom/saved reports, scheduled exports** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Dashboards:** source attributes/status from CG-20-BR01–CG-20-BR07; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **standard/custom/saved reports:** source attributes/status from CG-20-BR01–CG-20-BR07; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **scheduled exports:** source attributes/status from CG-20-BR01–CG-20-BR07; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Report draft/running/completed/failed; schedule active/disabled; No cross-scope report, shadow accounting or unbounded scheduled polling**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete scoped analytics and scheduled reporting

`report_definition(id,approved_source_contract,allowed_fields,grouping,filters,visibility)`, `saved_report(id,creator,definition,filter_json,version)`, `report_run(id,requester,scope_snapshot,status,rows,artifact_ref)` and `report_schedule(id,report_ref,recipient_scope,cadence,next_due,status)` never accept arbitrary SQL or unrestricted joins.

Standard report values originate from owner-filtered CG-09 ledger, CG-04/05/06/07/08/10/11/14/15/17 sources. Aggregate counts do not silently become zero on failed APIs. Scheduled export must **recheck recipient's current permission and real scope at execution and download**, not blindly reuse saved administrator rights.

Bound report queries by dates, row/page limit and estimated cost; long exports run bounded job with finite retry and recoverable state. No full-tenant idle polling: scheduler queries eligible due jobs only and uses stable safe checkpoints; measure DB rows/bytes and provider egress.

**QA:** mixed Foundation/center scope filter, denied salary/clinical column, recipient revoked after saving, large report timeout, duplicate scheduled delivery after restart, malicious filter, empty vs API failure and finance report total vs authoritative ledger.

## Specific reporting contracts and source-QA

- **Data:** `report_definition(id,source_module,approved_columns,filter_schema,visibility)`, `saved_report(id,owner_ref,filters,revision)`, `report_run(id,actor_ref,recipient_scope,source_watermark,status,export_file_ref)` and `report_schedule(id,recipient_ref,next_due_at,cadence,enabled)`. Reports do not independently own copies of patient, salary, financial or provider business records.
- **Owner reads and permission:** CG-20 calls typed permission-filtered projections of **already implemented** modules only. A scheduled report or asynchronous export rechecks current recipient and source record scope at run time *and* download time, not just when saving the filter. Custom reporting accepts approved data sources, column/group/filter allowlists, not arbitrary SQL or private cross-domain joins. Future module metrics appear as unavailable/omitted, not false zeros.
- **Performance and background:** bound page size, date window, download bytes and export job timeout; due-job query indexes on enabled+next_due_at and skips idle tenants. Cancel/retry is idempotent and does not send a report after permission revocation.
- **QA:** revoked recipient with queued report, unrelated center report export, invalid saved filter after source schema change, high-volume query budget, no scheduled work idle, report counts reconcile with CG-09/15/17 and safely redacted diagnostics.

## Typed API and coordination

An authenticated `/api/mis-reporting` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-073** — Manager examines business: Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-074** — Authorized user produces reports: Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U01, C44, C45, C46, C47, C49. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01 and implemented scoped owner projections. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.