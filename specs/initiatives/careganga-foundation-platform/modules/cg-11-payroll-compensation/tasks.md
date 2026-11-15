# CG-11 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-034, FR-035, FR-036, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Set approved salary components, allowances/deductions, periods, attendance…

Outcome: Set approved salary components, allowances/deductions, periods, attendance rules, tax/statutory settings, bank instructions, arrears, holds and effective dates.
Requirements: FR-034, CG-11-BR01, CG-11-BR02, CG-11-BR09, CG-11-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-11 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Configure versioned compensation component and eligible real employees/period without losing prior approved salary terms. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-001-QA01:** Given correctly scoped actor and genuine delivered owner records, configure versioned compensation component and eligible real employees/period without losing prior approved salary terms. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — business regression:** Unapproved pay component or stale salary version cannot change locked payroll. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-001-QA08 — Source-specific workflow:** Change approved salary component rules effective next month while current-period attendance is frozen; current payroll uses historic component/tax version, not today's changed configuration.
- **US-001-QA09 — Real CG-10 approved salary proposal ownership:** With genuine approved CG-10 US-003 salary proposal/current branch and CG-03 decision, CG-11 US-001 authorizes a separate effective salary_structure/employee_compensation revision in actual payroll with source digest; CG-10 HR amount alone is NOT_APPLIED and cannot create payslip/payment.
- **US-001-QA10 — No promotion required for basic salary setup:** Using only CG-10 US-001 genuine active employee and CG-11 current payroll policy, create first valid salary setup without needing a CG-10 promotion; deny stale/wrong-branch/bank-private version, overlap and replay with same effective period.
- **US-001-QA11 — Salary effective version and original B43 control:** Open B43 Payroll Setup/restricted C-series payroll modal; show current/proposed effective dates, approved salary+bank adjustment status and permission-hidden fields. Two concurrent updates do not produce overlapping approved compensation; SQL/index/real source integration NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA11 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Produce draft payroll from approved eligible employee/attendance data

Outcome: Produce draft payroll from approved eligible employee/attendance data; calculate, validate, adjust, review and obtain required approvals.
Requirements: FR-035, CG-11-BR03, CG-11-BR04, CG-11-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-11 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Calculate one real payroll draft using actual attendance/leave, deterministic rounding and rule version. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-002-QA01:** Given correctly scoped actor and genuine delivered owner records, calculate one real payroll draft using actual attendance/leave, deterministic rounding and rule version. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — business regression:** Running same period again does not duplicate committed net-pay liability. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-002-QA08 — Source-specific workflow:** Run payroll for active, probation and suspended employees, apply leave/arrears/hold and statutory deductions; two operators cannot both approve conflicting versions of the same period.
- **US-002-QA09 — Late attendance after payroll freeze:** Freeze a genuine CG-10 attendance/leave source revision in CG-11 run; approve CG-10 attendance correction afterward and verify original payroll remains immutable with explicit CG-11 adjustment/arrears draft, no automatic recalculation or private payslip change.
- **US-002-QA10 — Ineligible/transferred staff payroll source check:** With genuine CG-10 exit/transfer effective period verify CG-11 current eligibility and branch-source snapshots, no duplicated pay line or wrong branch charge; missing original employee/attendance becomes PENDING/UNAVAILABLE, never auto-filled attendance.
Verification: On actual implementation source-trace US-002-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Track reserves/batches/payment outcomes, generate private payslips, record…

Outcome: Track reserves/batches/payment outcomes, generate private payslips, record history/audit and reconcile exactly one expense/payment outcome in CG-09.
Requirements: FR-036, CG-11-BR05, CG-11-BR06, CG-11-BR07, CG-11-BR08, CG-11-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-11 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Apply approved payroll, verified batch payment, one CG-09 posting and private CG-19 payslip matching paid/pending state. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-003-QA01:** Given correctly scoped actor and genuine delivered owner records, apply approved payroll, verified batch payment, one CG-09 posting and private CG-19 payslip matching paid/pending state. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — business regression:** Retry/timeout cannot pay twice or mark unresolved transfer as settled. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-003-QA08 — Critical integrated scenario:** Two payroll officers retry payment for the same approved period and the bank returns partial/unknown payout. Expected: one approved run, unique employee disbursement source, unpaid staff remain pending/due, CG-09 posting only for verified outcomes and no duplicate payslip labelled paid.
- **US-003-QA09 — Source-specific workflow:** A bank file is accepted for one employee but transfer fails for another; mark individual outcomes, never all as paid, reconcile CG-09 once for verified payments and show each own payslip privately.
- **US-003-QA10 — Final salary dues and CG-10 exit clearance:** With actual CG-10 approved exit and genuine CG-11 final payroll due, produce verified individual payment through CG-09, return safe original current PAID_VERIFIED or PENDING_DUES to CG-10 B48 HR clearance; a created batch/provider ACK cannot be called paid, and no duplicate CG-09 salary expense.
Verification: On actual implementation source-trace US-003-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
