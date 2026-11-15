# CG-05 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-05-BR01–CG-05-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-05 owns only project master, task/event and field-visit source events. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete project, activity and field visit implementation

`project(id,code,category,scope,status,priority,owner,due_dates,budget_source_ref,version)` has unique human business code and grounded real CG-02 area. Planned/projected budget is not the CG-09 accounting total; funds and utilization read from authorized finance contracts only. CG-18 owns which project teaser is published.

`project_task(id,project_id,assignee_ref,priority,due_at,status,revision)` and `project_activity(id,project_id,category,scheduled_at,actual_at,status)` support authorized assignment, overdue and status transitions; assignee must be real allowed CG-10 employee or other approved relationship, not a fabricated contact.

`field_visit(id,project_id,actor,check_in_at,check_out_at,latitude,longitude,location_source,status)` and `visit_evidence(visit_id,file_ref,type,recorded_at)` keep GPS precision/trust and private CG-19 media references. Offline or location-permission denial is an honest pending/unverified state, never invented GPS success. Historical check-in/out and supervisor review remain auditable.

**QA:** forged project/employee ID, concurrent task reassignment, visit checkout before checkin, location permission denied, photo upload failure, inaccurate route evidence, public draft project leak and real budget source mismatch.

## Cross-owner contracts and story-specific QA

**Core tests:** Create an approved project with a real CG-02 branch; plan a field task; record authorized GPS visit/check-in and linked private evidence using CG-19. Reject check-out before check-in, invalid coordinate provenance, inactive branch, swapped location and stale approval. Project budget and beneficiary counts must reflect real CG-09/06 owners rather than manually maintained duplicate numbers.

**Current versus later sources:** Real CG-10 employee assignment is available only after HR delivers it; until then actual CG-01 permitted operators can own projects/tasks. CG-06 provides beneficiary impact when live; CG-20 reads projections.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/projects-field-operations` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-012** — Project owner sets up work: Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-013** — Coordinator assigns work: Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-014** — Field worker visits project: Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02, real CG-10 assignee and CG-19 evidence. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.