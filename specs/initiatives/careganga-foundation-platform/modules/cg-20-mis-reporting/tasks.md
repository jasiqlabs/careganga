# CG-20 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Show scope-filtered dashboards and quick actions for Foundation, modules…

Outcome: Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records.
Requirements: FR-073, CG-20-BR01, CG-20-BR02, CG-20-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-20 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Read accurate real owner KPI/project/finance/healthcare records under one current actor scope, with correct drilldown. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-001-QA01:** Starting from actual authorized actor and implemented owner record: read accurate real owner KPI/project/finance/healthcare records under one current actor scope, with correct drilldown. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U01, C44, C45, C46, C47, C49, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner-specific regression:** Aggregate must not expose cross-branch, patient, payroll or donor-restricted values. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-001-QA08 — Source-specific contract:** Open cross-module Foundation dashboard before payroll or healthcare financial sources are delivered; missing module tiles say not yet available instead of showing fictional zero totals, while existing allowed KPIs match their real owner.
- **US-001-QA09 — Actual CG-05 operational KPIs with real scope:** When CG-05 has genuine project/task/visit/activity states, CG-20 C44–C49 and Admin aggregated project tiles use only scoped source read facade/current CG-01+CG-02 grants; compare to original CG-05 US-005 A01/A02/A09/A10. Missing CG-05 shows honest no-source; no shadow project counts or GPS.
Verification: On actual implementation source-trace US-001-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Use standard and custom/saved/grouped reports, filters, supported export…

Outcome: Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope.
Requirements: FR-074, CG-20-BR03, CG-20-BR04, CG-20-BR05, CG-20-BR06, CG-20-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-20 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Save scoped report filters/export schedule with real recipient permission rechecked at delivery. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-002-QA01:** Starting from actual authorized actor and implemented owner record: save scoped report filters/export schedule with real recipient permission rechecked at delivery. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U01, C44, C45, C46, C47, C49, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner-specific regression:** Revoked recipient cannot receive older queued report, idle scheduler causes zero repeated scans. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-002-QA08 — Source-specific contract:** Schedule a report for an authorized center manager then revoke center access before delivery; queued export revalidates recipient at send/download time, masks patient/salary data and cannot leak stale private spreadsheet.
- **US-002-QA09 — Project and visit report source/finance privacy:** Export permitted CG-05 project/task due/activity/visit status with original CG-09 budget/payment as separate verified source and consistent cutoff; filter wrong/old branch, private GPS/CG-19 photo/beneficiary data and stale project change denied. Original CG-05 operational report remains independent of CG-20.
Verification: On actual implementation source-trace US-002-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
