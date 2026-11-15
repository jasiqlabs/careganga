# CG-11 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-034, FR-035, FR-036, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-11-BR01–CG-11-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C01, C02, C03, C04, C05, C06, C07, C08, C09, C10 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-11 owns only versioned salary rules, immutable pay-period calculation, approval and source payout instruction. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete salary calculation and one-time payout

`salary_structure(id,components,statutory_policy,valid_from,version)` and `employee_compensation(real_employee_ref,effective_from,revision,approved_components)` preserve salary/adjustment history without copying CG-10 employee master. Salary/bank details are accessible only to protected payroll/finance roles.

`payroll_run(period,financial_year,version,attendance_snapshot_ref,policy_version,status)` has unique approved period/version and `payroll_line(run_id,employee_id,basic,allowance,deduction,arrears,gross,net,hold)` calculates deterministic gross/net with approved rounding and leave/late/hold rules. Frozen run snapshots remain unchanged when later attendance changes; create an auditable correction/arrears run instead.

`payment_batch(run_id,approved_by,bank_instruction_ref,provider_payment_ref,status)` never marks PAID on mere submission. Verified actual payout links one CG-09 journal/payment by unique batch+employee source and produces private CG-19 payslip from approved run version; no duplicate salary expense.

**QA:** competing draft runs same month, approval before calculation, stale employee compensation, leave revision after lock, blocked bank account, partial bank transfer, duplicate callback, private payslip and Foundation-only money posting.

## CG-11 receiving owner: HR change proposals, attendance revisions and exit dues (CG-10 FR-031/BR14, CG-11 BR02/09/11)

**This is a narrowed owning-module insertion, NOT a full CG-11 approval.** CG-10 US-003 owns only a protected proposed salary/date/role/branch and genuine HR transfer/promotion/exit decision; it **does not** set an accepted payroll salary structure, recalculate an approved payroll run or mark any payout. **CG-11 US-001** independently owns the authorized effective-dated employee salary structure and compensation/bank adjustment, using an eligible actual approved CG-10 employee. When an actual CG-10 US-003 authorized promotion/change exists, CG-11 US-001 introduces a version-pinned read of the proposal+CG-03 final decision and independently applies its financial structure revision after CG-11's own permitted payroll approval. No CG-10 proposed amount is automatically payable; original CG-11 salary setup also works with no promotion request. Source-money outcomes remain CG-09.

**CG-11 US-002** consumes actual immutable CG-10 approved attendance/leave/policy version for a pay period. If an authorized late correction is committed after CG-11 freezes a payroll run, CG-11 **introduces** a source-revision change/arrears review and trace within its own payroll calculation; never silently rewrite the original approved run, payslip or paid ledger. If CG-10 source status/permission is missing, calculation blocks or honestly excludes ineligible staff—not assumed present.

**CG-11 US-003** alone owns actual final salary-due payroll source, private payslip and verified batch settlement through original CG-09 linked payment. An HR exit clearance from CG-10 is NOT proof of money paid; CG-11 later introduces the real verified payroll-dues projection back to CG-10 status when both source owners exist. Distinguish PENDING_DUES/APPROVED_RUN/PAYMENT_REQUESTED/PAID_VERIFIED and a truly closed exit; a provider bank ACK alone is not payout. Do not import CG-10 role/branch assignment ownership or create a second accounting payable. Receiving-owner cases live in these CG-11 own stories, and may not be marked complete merely because CG-10 documented an interface. Global CG-11 DLD/UIUX/tasks source must later be independently reviewed before CG-11 approval.

**Receiving SQL/API sketch:** `employee_compensation(root,id,actual_employee_ref,approved_source_revision,effective_from,effective_to,source_hr_change_ref_nullable,case_ref,approved_components,version)` has actual same-root real CG-10 employee FK, nonoverlapping effective compensation ranges (GIST exclusion or independently reviewed row-locked equivalent), unique approved HR source-event key and immutable accepted version. `GET /api/v1/payroll/compensation/proposals?employee` reads only current authorized CG-10 HR proposal/decision and cannot mutate the HR source; `POST /api/v1/payroll/compensation/apply` accepts CG-11 approved exact revision/idempotency, not client-specified accepted salary. Payroll run stores pinned `cg10_attendance_snapshot_revision` and CG-11 source version; `payroll_adjustment`/next arrears run is separate from original frozen run. `GET /api/v1/payroll/employee-exit-dues/:employeeRef` returns safe CG-11 payment proof status to eligible CG-10 reviewer only, no raw bank info. No CG-10 source table mirrored, no speculative CG-09 payment accepted.


## Cross-owner contracts and story-specific QA

**Core tests:** Calculate a deterministic payroll preview for a real CG-10 employee and approved period: unpaid leave, arrears/deductions and rounding use a frozen rule/version. Re-running the same period before posting may revise draft; approved payout posts once to real CG-09, duplicate trigger cannot issue another payment. Payslip represents actual current pay/paid state and never claims bank transfer from an unverified instruction.

**Current versus later sources:** CG-10 is the employee owner, CG-03 the actual approval owner, CG-09 the sole accounting owner, CG-19 the payslip generator. No separate payroll cash ledger.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/payroll-compensation` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-034** — Payroll Admin configures compensation: Set approved salary components, allowances/deductions, periods, attendance rules, tax/statutory settings, bank instructions, arrears, holds and effective dates. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-035** — Payroll officer runs period: Produce draft payroll from approved eligible employee/attendance data; calculate, validate, adjust, review and obtain required approvals. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-036** — Authorized payroll payment occurs: Track reserves/batches/payment outcomes, generate private payslips, record history/audit and reconcile exactly one expense/payment outcome in CG-09. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C01, C02, C03, C04, C05, C06, C07, C08, C09, C10. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-10, CG-09, CG-03 and CG-19. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.