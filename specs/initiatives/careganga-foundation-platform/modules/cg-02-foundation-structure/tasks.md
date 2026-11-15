# CG-02 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Maintain organization details, geography, branches, departments/committees…

Outcome: Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication.
Requirements: FR-004, CG-02-BR01, CG-02-BR02, CG-02-BR06, CG-02-BR07, CG-02-BR08, CG-02-BR09, CG-02-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-02 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Only finally approved branches activate or receive code; geography never invented.
QA cases:
- **US-001-QA01:** Given a permitted **Admin configures Foundation** and valid existing source records, perform: **Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U18, U19, U20, U21, U22, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Complete seven-stage draft/review/submit registration with contacts…

Outcome: Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code.
Requirements: FR-005, CG-02-BR03, CG-02-BR04, CG-02-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-02 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Only finally approved branches activate or receive code; geography never invented.
QA cases:
- **US-002-QA01:** Given a permitted **Branch manager starts branch setup** and valid existing source records, perform: **Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U18, U19, U20, U21, U22, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Only finally approved branches activate or receive code; geography never invented, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
