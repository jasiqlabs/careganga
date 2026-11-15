# CG-20 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-20-BR01–CG-20-BR07, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01, C44, C45, C46, C47, C49 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-20 owns only permission-filtered reporting query definitions and scheduled read-only delivery. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete scoped analytics and scheduled reporting

`report_definition(id,approved_source_contract,allowed_fields,grouping,filters,visibility)`, `saved_report(id,creator,definition,filter_json,version)`, `report_run(id,requester,scope_snapshot,status,rows,artifact_ref)` and `report_schedule(id,report_ref,recipient_scope,cadence,next_due,status)` never accept arbitrary SQL or unrestricted joins.

Standard report values originate from owner-filtered CG-09 ledger, CG-04/05/06/07/08/10/11/14/15/17 sources. Aggregate counts do not silently become zero on failed APIs. Scheduled export must **recheck recipient's current permission and real scope at execution and download**, not blindly reuse saved administrator rights.

Bound report queries by dates, row/page limit and estimated cost; long exports run bounded job with finite retry and recoverable state. No full-tenant idle polling: scheduler queries eligible due jobs only and uses stable safe checkpoints; measure DB rows/bytes and provider egress.

**QA:** mixed Foundation/center scope filter, denied salary/clinical column, recipient revoked after saving, large report timeout, duplicate scheduled delivery after restart, malicious filter, empty vs API failure and finance report total vs authoritative ledger.

## Real source integration and module-specific QA

**Critical acceptance:** An authorized Foundation admin opens a dashboard with only actual records from already-delivered owners; cross-branch reporter sees no restricted totals or donor/patient/employee fields. Scheduled export re-checks current recipient permission and safe field allowlist at delivery time; job with zero due reports performs no tenant-wide polling or costly joins. Reports reconcile back to CG-09 authoritative journals.

**Contract availability:** Offer empty-but-truthful cards for absent sources; add owner projections and independent QA as CG-05/06/07/10/14/15/17 mature. Never seed fake impact or financial statistics.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/mis-reporting` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-073** — Manager examines business: Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-074** — Authorized user produces reports: Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U01, C44, C45, C46, C47, C49. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01 and implemented scoped owner projections. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.