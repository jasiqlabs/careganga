# CG-14 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Foundation or center submits provider

Outcome: Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details.
Requirements: FR-042, CG-14-BR01, CG-14-BR02, CG-14-BR03, CG-14-BR06, CG-14-BR07, CG-14-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-001-QA01:** Authorized Foundation or center submits provider uses a real account and allowed input to Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-001-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves One doctor identity across centers; no fake verified badge or public private bank info, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Foundation verifies provider

Outcome: Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history.
Requirements: FR-043, CG-14-BR04, CG-14-BR05, CG-14-BR18; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-002-QA01:** Authorized Foundation verifies provider uses a real account and allowed input to Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-002-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Foundation or center registers doctor

Outcome: Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees.
Requirements: FR-044, CG-14-BR09, CG-14-BR10, CG-14-BR11, CG-14-BR12, CG-14-BR13; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-003-QA01:** Authorized Foundation or center registers doctor uses a real account and allowed input to Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-003-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-003-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Patient searches healthcare

Outcome: Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits.
Requirements: FR-045, CG-14-BR14, CG-14-BR15, CG-14-BR16, CG-14-BR17, CG-14-BR18, CG-14-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-004-QA01:** Authorized Patient searches healthcare uses a real account and allowed input to Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-004-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-004-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Center maintains permitted presentation

Outcome: Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication.
Requirements: FR-046, CG-14-BR19; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-14 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. One doctor identity across centers; no fake verified badge or public private bank info.
QA cases:
- **US-005-QA01:** Authorized Center maintains permitted presentation uses a real account and allowed input to Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-005-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-005-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
