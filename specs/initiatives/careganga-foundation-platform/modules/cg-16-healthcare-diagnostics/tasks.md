# CG-16 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Manage diagnostic test master, codes/category/sample type, center-specific…

Outcome: Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history.
Requirements: FR-055, CG-16-BR01, CG-16-BR02, CG-16-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create real center test/package catalog with sample type, category, approved price and version. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-001-QA01:** Given correctly scoped actor and genuine delivered owner records, create real center test/package catalog with sample type, category, approved price and version. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — business regression:** Unsupported test or unapproved center price is not offered as orderable. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-001-QA08 — Healthcare source-specific boundary:** Admin edits a test code and package test list while a previous lab order is already accepted; historic order shows original included parameters and fee, current public published price follows approved effective version.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Create authorized patient test/package order and track collection…

Outcome: Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state.
Requirements: FR-056, CG-16-BR04, CG-16-BR05, CG-16-BR06, CG-16-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Order test for verified patient, track sample and release actual validated report with provider signature/status. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-002-QA01:** Given correctly scoped actor and genuine delivered owner records, order test for verified patient, track sample and release actual validated report with provider signature/status. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — business regression:** Draft/unreviewed result cannot appear to public patient or wrong center. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-002-QA08 — Healthcare source-specific boundary:** Center staff receives patient test order, collects sample, uploads a private result and requests professional release; upload alone leaves it unreleased, authorized clinician release changes source state and records version/time.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — View published lab/service menus, real price and discounts where authorized

Outcome: View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician.
Requirements: FR-057, CG-16-BR06, CG-16-BR07, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Expose approved lab service menus and genuine price/discount accurately, without fake booking or payment result. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-003-QA01:** Given correctly scoped actor and genuine delivered owner records, expose approved lab service menus and genuine price/discount accurately, without fake booking or payment result. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — business regression:** Stale invalid fee or unapproved discount cannot become confirmed total. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-003-QA08 — Healthcare source-specific boundary:** Authorized patient opens own released report and center clinician with actual care relationship sees it; guessed signed URL and staff from another center cannot access unapproved or private report.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Show approved center/service information with enquiry/contact actions

Outcome: Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch.
Requirements: FR-058, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Publish only approved center/service info and real enquiry contact action, not invented pharmacy/order features. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-004-QA01:** Given correctly scoped actor and genuine delivered owner records, publish only approved center/service info and real enquiry contact action, not invented pharmacy/order features. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — business regression:** Unpublished provider and leaked patient clinical data are blocked from directory. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-004-QA08 — Healthcare source-specific boundary:** Public center card for lab/medicine/nursing displays verified service, applicable contact and any approved information-only benefit; unsupported online checkout or fabricated price is not clickable.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
