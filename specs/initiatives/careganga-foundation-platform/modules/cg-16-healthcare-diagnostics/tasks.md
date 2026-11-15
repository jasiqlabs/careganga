# CG-16 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Manage diagnostic test master, codes/category/sample type, center-specific…

Outcome: Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history.
Requirements: FR-055, CG-16-BR01, CG-16-BR02, CG-16-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No public lab checkout or release of private patient report to strangers.
QA cases:
- **US-001-QA01:** With a permitted **Center/central Admin configures lab** and verified real source records, perform: **Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No public lab checkout or release of private patient report to strangers, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Healthcare source-specific boundary:** Admin edits a test code and package test list while a previous lab order is already accepted; historic order shows original included parameters and fee, current public published price follows approved effective version.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Create authorized patient test/package order and track collection…

Outcome: Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state.
Requirements: FR-056, CG-16-BR04, CG-16-BR05, CG-16-BR06, CG-16-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No public lab checkout or release of private patient report to strangers.
QA cases:
- **US-002-QA01:** With a permitted **Center books lab service internally** and verified real source records, perform: **Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No public lab checkout or release of private patient report to strangers, with one accepted source transaction and correct downstream totals.
- **US-002-QA08 — Healthcare source-specific boundary:** Center staff receives patient test order, collects sample, uploads a private result and requests professional release; upload alone leaves it unreleased, authorized clinician release changes source state and records version/time.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — View published lab/service menus, real price and discounts where authorized

Outcome: View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician.
Requirements: FR-057, CG-16-BR06, CG-16-BR07, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No public lab checkout or release of private patient report to strangers.
QA cases:
- **US-003-QA01:** With a permitted **Patient/provider views service** and verified real source records, perform: **View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No public lab checkout or release of private patient report to strangers, with one accepted source transaction and correct downstream totals.
- **US-003-QA08 — Healthcare source-specific boundary:** Authorized patient opens own released report and center clinician with actual care relationship sees it; guessed signed URL and staff from another center cannot access unapproved or private report.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Show approved center/service information with enquiry/contact actions

Outcome: Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch.
Requirements: FR-058, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No public lab checkout or release of private patient report to strangers.
QA cases:
- **US-004-QA01:** With a permitted **Additional service CTA appears publicly** and verified real source records, perform: **Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No public lab checkout or release of private patient report to strangers, with one accepted source transaction and correct downstream totals.
- **US-004-QA08 — Healthcare source-specific boundary:** Public center card for lab/medicine/nursing displays verified service, applicable contact and any approved information-only benefit; unsupported online checkout or fabricated price is not clickable.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
