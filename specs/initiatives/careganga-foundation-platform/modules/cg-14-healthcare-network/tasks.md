# CG-14 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Register center organization and own operating locations with type/code…

Outcome: Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details.
Requirements: FR-042, CG-14-BR01, CG-14-BR02, CG-14-BR03, CG-14-BR06, CG-14-BR07, CG-14-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-001-QA01:** With a permitted **Foundation or center submits provider** and verified real source records, perform: **Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves One doctor identity across centers; no fake verified badge or public private bank info, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Healthcare source-specific boundary:** Register a provider with two genuine clinic locations; the applicant uploads restricted registration proof and bank settlement reference, but a publicly viewed location displays neither private document nor bank details.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Review center identity/documents/facilities, approve/reject/return and…

Outcome: Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history.
Requirements: FR-043, CG-14-BR04, CG-14-BR05, CG-14-BR18; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-002-QA01:** With a permitted **Foundation verifies provider** and verified real source records, perform: **Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Healthcare source-specific boundary:** Foundation reviewer rejects an unverifiable center, then approves corrected evidence; only the final approved and separately published center is searchable, and suspension immediately prevents future bookings/public visibility.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Maintain verified professional identity, licenses/qualifications…

Outcome: Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees.
Requirements: FR-044, CG-14-BR09, CG-14-BR10, CG-14-BR11, CG-14-BR12, CG-14-BR13; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-003-QA01:** With a permitted **Foundation or center registers doctor** and verified real source records, perform: **Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — Healthcare source-specific boundary:** Register one doctor professional license linked to two verified centers with different fee/version and working location; a duplicate professional profile is rejected and changes do not alter accepted historical booking fees.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Search/filter/sort doctor or center by location, specialty, facilities…

Outcome: Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits.
Requirements: FR-045, CG-14-BR14, CG-14-BR15, CG-14-BR16, CG-14-BR17, CG-14-BR18, CG-14-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-004-QA01:** With a permitted **Patient searches healthcare** and verified real source records, perform: **Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — Healthcare source-specific boundary:** Public website and Public Android search by category, specialty, state/district/PIN and verified fee; unpublished providers and unsupported ratings/badges cannot appear, while directions point to the actual selected center.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Submit provider photos, services, published information/FAQs and own-center…

Outcome: Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication.
Requirements: FR-046, CG-14-BR19; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-005-QA01:** With a permitted **Center maintains permitted presentation** and verified real source records, perform: **Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-005-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07 — Healthcare source-specific boundary:** Center operator edits own facilities/photos and FAQ but attempts a second center's profile; edit stays pending Foundation publication when required, other-center update fails and previously published fees remain owner-controlled.
Verification: On actual implementation source-trace US-005-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
