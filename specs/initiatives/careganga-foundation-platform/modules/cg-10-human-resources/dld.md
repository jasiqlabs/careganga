# CG-10 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-10-BR01–CG-10-BR15, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Employment/ID, attendance/leave, transfers/exits, performance, letters** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Employment/ID:** source attributes/status from CG-10-BR01–CG-10-BR15; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **attendance/leave:** source attributes/status from CG-10-BR01–CG-10-BR15; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **transfers/exits:** source attributes/status from CG-10-BR01–CG-10-BR15; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **performance:** source attributes/status from CG-10-BR01–CG-10-BR15; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **letters:** source attributes/status from CG-10-BR01–CG-10-BR15; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **New/review/active/probation/hold/exit; leave pending/approved/rejected; Employment not login; payroll/salary and bank data remain private/owned**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete employee lifecycle and protected HR data

`employee(id,verified_account_ref,employee_number,approved_branch,designation,employment_type,hire_date,status,revision)` distinguishes CG-01 login from employment and generates employee ID only after real CG-03 final approval. `employee_private_profile` holds restricted identity/bank/tax/qualification references and CG-19 private file links; ordinary directory `options` exposes minimal safe name/designation without salary or KYC.

`shift_policy(id,work_start,end,break,grace,weekly_off,effective_from)`, `attendance(employee_id,date,shift_ref,status,revision)` unique employee/day/authorized shift; `leave_request` and correction maintain requester, reviewer, dates, status and conflict checks. A late leave/attendance correction does not silently edit a frozen CG-11 payroll run.

`employee_change(id,kind,old_assignment,new_assignment,effective_date,approval,status)` covers transfer/promotion/exit, protects real branch and role change sequencing and audited prior history. `employee_letter(source_employee,kind,template_version,status,dispatch_or_receipt)` generates from CG-19, not a second document engine.

**QA:** duplicate employee ID, rejected activation, wrong-scope salary/bank export, overlapping leave, two attendance corrections, shift grace, transfer into unauthorized branch, exit with pending payroll and cross-channel staff permission revocation.

## Typed API and coordination

An authenticated `/api/human-resources` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-029** — HR enrolls employee: Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-030** — Employee reports work: Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-031** — HR manages employment: Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-032** — HR issues official record: Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-033** — Employee requests allowance: Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-02, CG-03, CG-19 and CG-09 claims. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.