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