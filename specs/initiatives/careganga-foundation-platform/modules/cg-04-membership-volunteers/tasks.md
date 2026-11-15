# CG-04 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Select configured public membership tier, provide…

Outcome: Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**.
Requirements: FR-009, CG-04-BR01, CG-04-BR02, CG-04-BR03, CG-04-BR04, CG-04-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Approved fee and case precede member ID; rejected paid membership requires authorized refund.
QA cases:
- **US-001-QA01:** Given a permitted **Person applies as member** and valid existing source records, perform: **Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions****. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Configure tier price, validity, benefits/appearance and publication

Outcome: Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes.
Requirements: FR-010, CG-04-BR02, CG-04-BR04, CG-04-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Approved fee and case precede member ID; rejected paid membership requires authorized refund.
QA cases:
- **US-002-QA01:** Given a permitted **Admin manages membership** and valid existing source records, perform: **Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Apply with personal/geographic profile, skills, experience, preferred…

Outcome: Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments.
Requirements: FR-011, CG-04-BR07, CG-04-BR08, CG-04-BR09, CG-04-BR10, CG-04-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Approved fee and case precede member ID; rejected paid membership requires authorized refund.
QA cases:
- **US-003-QA01:** Given a permitted **Person volunteers** and valid existing source records, perform: **Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments**. Expected: the Web/native screen displays the actual confirmed or pending result; backend validates the active action and resource scope; database commits one correct owner transition with audit.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-003-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
