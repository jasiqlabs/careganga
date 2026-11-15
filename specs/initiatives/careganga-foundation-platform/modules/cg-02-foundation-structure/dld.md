# CG-02 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-02-BR01–CG-02-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U18, U19, U20, U21, U22 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Data ownership and decision boundary

CG-02 owns exactly one Foundation profile, the geography tree, editable seven-step branch registration, the final branch directory, and branch-scoped departments/committees. CG-01 owns authenticated actors; CG-03 owns approval decisions; CG-19 owns protected file bytes. A business actor, not a fabricated employee, may be linked during the initial branch draft. CG-10 employment/CG-05 projects/CG-04 memberships/CG-09 budgets introduce their own real links after they exist.

Only a completed authorized CG-03 decision may activate a branch and issue its unique code. Draft and approved data remain distinguishable, with one idempotent finalization for one registration. Store all cross-owner references as verified opaque keys; render readable business names, not identifiers.

## Canonical database and workflow contracts

- foundation_profile(id, legal_name, contact_details, legal_registration_ref, version, updated_at): verified single Foundation identity, auditable changes. Internal profile fields are not automatically public.
- geography_area(id, level, parent_area_id, display_name, normalized_name, code, status, version): one canonical geography table, not a second geography_unit alias. Enforce allowed parent level, self/cycle prohibition, unique (parent_area_id, normalized_name), and scoped lookup. A user may select only actually configured areas; no seeded fictional districts.
- branch_registration(id, foundation_id, current_step, draft_version, status, requested_by, submitted_at, approval_case_ref, profile_payload): one editable seven-step draft with step-specific validation; CG-19 protected document references are attached by verified owner. Status DRAFT -> SUBMITTED -> RETURNED/REJECTED or FINAL_APPROVED. Returned submissions are revised and resubmitted without losing original evidence or reviewer history. Only a published real CG-03 case can confirm FINAL_APPROVED.
- branch(id, registration_id, geography_area_id, branch_code, status, version, activated_at): UNIQUE registration_id and UNIQUE non-null branch_code, created/activated once by the finalizer after verified approval. There is no second provisional branch master populated merely for a draft.
- department(id, branch_id, parent_department_id, kind, name, active, head_account_ref, version): parent must belong to the same active branch and cannot produce cycles. An actual CG-01 account may be head if authorized; future CG-10 employee assignment is a later owner-supplied integration, not a required fake foreign key.

Commands: GET scoped geography/options, POST/GET/PATCH Foundation profile and department, POST/GET/PATCH branch-registration draft with expected draft_version, POST submit branch-registration (returns PENDING_APPROVAL), and POST finalize-approved-registration (CG-03 protected owner callback only). For creation return saved reference + authoritative state; do not expose implementation UUID in UI. Every write verifies current actor/capability/scope, expected revision and source-idempotency key; authorized queries are bounded and filtered at the database.

Transaction: finalizer locks approved registration and unique-source claim, checks CG-03 final decision, generates unique code, inserts/activates branch, writes redacted audit, commits once. Conflicting callback, duplicate normalized geography, stale draft, inaccessible documents and foreign-branch department parent return distinct controlled errors without partial changes.

## Forward-owner integrations and source QA

CG-02 never requires an employee, project, budget, member, or public CMS record to complete its own creation and activation path. When CG-10/05/09/04/18 subsequently provides those owners, that later module adds verified selectors, links, authorization and end-to-end QA; absence today appears as an unavailable optional section, not a fabricated completed link.

Source cases: complete seven-stage draft -> submit -> actual CG-03 decision -> one branch code; reject approval -> no branch; resume/revise after step 3; duplicate finalizer replay; concurrent branch codes; cross-scope geography/departments; parent cycle; unpublished branch not public; protected file access only via actual CG-19. Test every form, drawer, progress step and review state against the original U18-U22 UI reference, with rendered visual parity NOT_RUN.

## Typed API and coordination

An authenticated `/api/foundation-structure` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-004** — Admin configures Foundation: Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-005** — Branch manager starts branch setup: Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U18, U19, U20, U21, U22. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01; CG-03 active branch approval. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.