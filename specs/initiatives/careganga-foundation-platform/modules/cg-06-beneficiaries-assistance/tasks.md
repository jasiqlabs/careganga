# CG-06 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-015, FR-016, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Maintain restricted beneficiary profile/geography and project associations…

Outcome: Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history.
Requirements: FR-015, CG-06-BR01, CG-06-BR03, CG-06-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-06 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Material and cash aid require genuine owner movement, no duplicate stock/expense.
QA cases:
- **US-001-QA01:** Given a permitted **Staff registers beneficiary** and valid existing source records, perform: **Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A07, A08, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Material and cash aid require genuine owner movement, no duplicate stock/expense, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record aid category, money/item, quantity/value, date and responsible person

Outcome: Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy.
Requirements: FR-016, CG-06-BR02, CG-06-BR03, CG-06-BR04, CG-06-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-06 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Material and cash aid require genuine owner movement, no duplicate stock/expense.
QA cases:
- **US-002-QA01:** Given a permitted **Approved aid is delivered** and valid existing source records, perform: **Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A07, A08, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Material and cash aid require genuine owner movement, no duplicate stock/expense, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
