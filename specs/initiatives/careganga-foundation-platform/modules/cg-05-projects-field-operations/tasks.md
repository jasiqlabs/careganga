# CG-05 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Create/maintain projects, responsible staff, locations, dates, budgets…

Outcome: Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards.
Requirements: FR-012, CG-05-BR01, CG-05-BR02, CG-05-BR03, CG-05-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No fake GPS, duplicate CMS project or shadow financial/beneficiary source.
QA cases:
- **US-001-QA01:** Given a permitted **Project owner sets up work** and valid existing source records, perform: **Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Create, assign and monitor tasks, events and activities with owners…

Outcome: Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display.
Requirements: FR-013, CG-05-BR04, CG-05-BR05, CG-05-BR09, CG-05-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No fake GPS, duplicate CMS project or shadow financial/beneficiary source.
QA cases:
- **US-002-QA01:** Given a permitted **Coordinator assigns work** and valid existing source records, perform: **Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Record geotag/GPS/location, check-in/out, photos/video, notes, documents…

Outcome: Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests.
Requirements: FR-014, CG-05-BR06, CG-05-BR07, CG-05-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No fake GPS, duplicate CMS project or shadow financial/beneficiary source.
QA cases:
- **US-003-QA01:** Given a permitted **Field worker visits project** and valid existing source records, perform: **Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-003-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
