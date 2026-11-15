# CG-02 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-02-BR01–CG-02-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U18, U19, U20, U21, U22 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Foundation profile, region hierarchy, branches, departments/committees** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Foundation profile:** source attributes/status from CG-02-BR01–CG-02-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **region hierarchy:** source attributes/status from CG-02-BR01–CG-02-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **branches:** source attributes/status from CG-02-BR01–CG-02-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **departments/committees:** source attributes/status from CG-02-BR01–CG-02-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Draft/submitted/returned/rejected/approved/active/closed; Only finally approved branches activate or receive code; geography never invented**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete geography, branch and governance design

`foundation_profile` holds verified Foundation identity only. `geography_unit(id,level,parent_id,name,code,status)` validates level order (state→district→subdivision→block), noncyclic parent, actual authorized owner and uniqueness within parent; no fabricated region defaults.

`branch(id,area_id,legal_name,contacts,opening_date,status,approval_case_id,branch_code,version)` keeps branch code NULL until verified final CG-03 approval; unique non-null generated code and approved activation. `branch_draft(branch_id,step,version,payload,document_refs)` persists seven registration steps and completeness safely; pending/returned/rejected draft cannot silently become an active branch or appear publicly.

`department(id,branch_id,parent_department_id,type,name,head_employee_ref,status)` supports department/committee hierarchy and prevents self-parent/cycle. Employee, project, membership and budget references are verified through CG-10/05/04/09 owners only when they exist, not copied as local master rows.

**CG-01 integration:** When real branch activation exists, CG-02 exposes scope-limited branch/area `options` with names/context and validates actual ownership for role-assignment integration. Role grants do not infer global branch permission. **QA:** seven-step resume/invalid upload; two admin code races; forged region path; pending branch activation attempt; department parent loop; inactive branch revocation; unpublished branch public search.

## Specific owner contracts and verification

- **Geography & branches:** `geography_area(id,level,parent_id,code,name,status)` rejects orphan/cyclic hierarchy and duplicate normalized names within parent. `branch_registration(id,foundation_id,current_step,draft_version,status,approval_case_id)` preserves seven-stage draft with CG-19 file refs, missing-document completion and verification status. `branch(id,approved_registration_id,area_id,branch_code,operational_status)` receives a unique non-null branch code only on real CG-03 final approval.
- **Departments and scope:** `department(id,branch_id,parent_id,type,head_employee_ref,status)` rejects parent cycles; real CG-10 head/manager links are added when that module exists, not invented now. A new branch is private and CG-01 scoped access only binds to actual active branch.
- **QA:** resume any draft step, invalid geography parent, simultaneous branch code generation, pending branch without code, unauthorized branch export and approval finalization retries.

## Typed API and coordination

An authenticated `/api/foundation-structure` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-004** — Admin configures Foundation: Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-005** — Branch manager starts branch setup: Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U18, U19, U20, U21, U22. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01; CG-03 active branch approval. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.