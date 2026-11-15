# CG-05 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-05-BR01–CG-05-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Projects, tasks, events/activity, GPS visit and private evidence** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Projects:** source attributes/status from CG-05-BR01–CG-05-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **tasks:** source attributes/status from CG-05-BR01–CG-05-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **events/activity:** source attributes/status from CG-05-BR01–CG-05-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **GPS visit and private evidence:** source attributes/status from CG-05-BR01–CG-05-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Planned/active/hold/completed/cancelled; No fake GPS, duplicate CMS project or shadow financial/beneficiary source**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete project, activity and field visit implementation

`project(id,code,category,scope,status,priority,owner,due_dates,budget_source_ref,version)` has unique human business code and grounded real CG-02 area. Planned/projected budget is not the CG-09 accounting total; funds and utilization read from authorized finance contracts only. CG-18 owns which project teaser is published.

`project_task(id,project_id,assignee_ref,priority,due_at,status,revision)` and `project_activity(id,project_id,category,scheduled_at,actual_at,status)` support authorized assignment, overdue and status transitions; assignee must be real allowed CG-10 employee or other approved relationship, not a fabricated contact.

`field_visit(id,project_id,actor,check_in_at,check_out_at,latitude,longitude,location_source,status)` and `visit_evidence(visit_id,file_ref,type,recorded_at)` keep GPS precision/trust and private CG-19 media references. Offline or location-permission denial is an honest pending/unverified state, never invented GPS success. Historical check-in/out and supervisor review remain auditable.

**QA:** forged project/employee ID, concurrent task reassignment, visit checkout before checkin, location permission denied, photo upload failure, inaccurate route evidence, public draft project leak and real budget source mismatch.

## Specific owner contracts and source-QA

- **Projects/tasks:** `project(id,code,status,location_ref,coordinator_ref,budget_ref,revision)`, `project_task(id,project_ref,assignee_ref,priority,due_at,status,revision)`, `activity(id,project_ref,kind,starts_at,status)`. Validate real CG-02 location and actual eligible CG-10/04 assignee (not shadow employee/volunteer). Budget utilization remains CG-09 truth; CG-18 owns public teaser.
- **Field visit:** `field_visit(id,project_ref,assigned_actor_ref,check_in_at,check_out_at,geo_lat,geo_long,verification_state)` plus source-linked CG-19 media/notes/route and supervisor review history. User-entered coordinate is not falsely marked GPS-verified; check-out cannot precede check-in; upload failures keep evidence pending.
- **QA:** forged field GPS, denied location permission, duplicate field visit while offline retry, reversed task completion, wrong project scope, project published without approval and finance/beneficiary links from real source.

## Typed API and coordination

An authenticated `/api/projects-field-operations` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-012** — Project owner sets up work: Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-013** — Coordinator assigns work: Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-014** — Field worker visits project: Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02, real CG-10 assignee and CG-19 evidence. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.