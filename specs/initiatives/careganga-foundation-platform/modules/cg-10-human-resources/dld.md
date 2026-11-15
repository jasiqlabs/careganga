# CG-10 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-10-BR01–CG-10-BR15, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-10 owns only employee employment record, attendance/leave, transfer/performance and HR source letters. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete employee lifecycle and protected HR data

`employee(id,verified_account_ref,employee_number,approved_branch,designation,employment_type,hire_date,status,revision)` distinguishes CG-01 login from employment and generates employee ID only after real CG-03 final approval. `employee_private_profile` holds restricted identity/bank/tax/qualification references and CG-19 private file links; ordinary directory `options` exposes minimal safe name/designation without salary or KYC.

`shift_policy(id,work_start,end,break,grace,weekly_off,effective_from)`, `attendance(employee_id,date,shift_ref,status,revision)` unique employee/day/authorized shift; `leave_request` and correction maintain requester, reviewer, dates, status and conflict checks. A late leave/attendance correction does not silently edit a frozen CG-11 payroll run.

`employee_change(id,kind,old_assignment,new_assignment,effective_date,approval,status)` covers transfer/promotion/exit, protects real branch and role change sequencing and audited prior history. `employee_letter(source_employee,kind,template_version,status,dispatch_or_receipt)` generates from CG-19, not a second document engine.

**QA:** duplicate employee ID, rejected activation, wrong-scope salary/bank export, overlapping leave, two attendance corrections, shift grace, transfer into unauthorized branch, exit with pending payroll and cross-channel staff permission revocation.

## CG-10-owned branch employment association (transferred CG-02-BR06)

Store CG-10 employee/coordinator identity plus versioned current/history of CG-02 branch/department assignment within CG-10, using genuine CG-02 ACTIVE branch and same-branch department scoped projections; never create a CG-02 employee link master. On enrollment and transfer, validate CG-01 HR action/scope, active destination branch and related department, source version and old/new access; preserve history and prohibit cross-branch data leakage. A linked existing CG-01 login is not automatically elevated. Test US-001-QA10 and US-003-QA09 without CG-11 payroll payout or future modules.

## Cross-owner contracts and story-specific QA

**Core tests:** Create employee with actual CG-01 identity and CG-02 branch, protect bank/salary and leave notes; transfer across branches preserves employment history while revoking old scope. Attendance/leave adjustments are versioned; staff cannot approve own sensitive change if policy forbids it; duplicate payroll inputs and invalid overlaps fail safely. Source letters use real CG-19 issued reference.

**Current versus later sources:** CG-11 owns compensation calculation/payout; CG-09 owns cash reimbursement; CG-04 volunteer records remain separate. HR can function without the later payroll module; no salary-posting claim before CG-11.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

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