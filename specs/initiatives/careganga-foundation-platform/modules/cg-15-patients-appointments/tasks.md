# CG-15 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Configure doctor-center working days, time windows, capacity, consultation…

Outcome: Configure doctor-center working days, time windows, capacity, consultation type, holidays, blocks and approved leave while preserving already confirmed bookings.
Requirements: FR-047, CG-15-BR01, CG-15-BR02; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-001-QA01:** With a permitted **Doctor/center schedules availability** and verified real source records, perform: **Configure doctor-center working days, time windows, capacity, consultation type, holidays, blocks and approved leave while preserving already confirmed bookings**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Support center-first or doctor/date/slot-first journey using one doctor-aware…

Outcome: Support center-first or doctor/date/slot-first journey using one doctor-aware center-specific schedule that prevents overlapping in-person appointments across centers; show the requested center and available slot before payment; when multiple centers match the same time, present an explicit center choice rather than silently selecting one.
Requirements: FR-048, CG-15-BR03, CG-15-BR04, CG-15-BR05, CG-15-BR06, CG-15-BR07, CG-15-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-002-QA01:** With a permitted **Patient chooses doctor/visit** and verified real source records, perform: **Support center-first or doctor/date/slot-first journey using one doctor-aware center-specific schedule that prevents overlapping in-person appointments across centers; show the requested center and available slot before payment; when multiple centers match the same time, present an explicit center choice rather than silently selecting one**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Register or securely locate patient with verified mobile, appropriate profile…

Outcome: Register or securely locate patient with verified mobile, appropriate profile and consent, optional uploaded reports/identity; assign a unique patient ID without duplicates or unverified cross-linking.
Requirements: FR-049, CG-15-BR09, CG-15-BR10, CG-15-BR11, CG-15-BR12, CG-15-BR13, CG-15-BR14, CG-15-BR15, CG-15-BR16; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-003-QA01:** With a permitted **New/existing patient identifies self** and verified real source records, perform: **Register or securely locate patient with verified mobile, appropriate profile and consent, optional uploaded reports/identity; assign a unique patient ID without duplicates or unverified cross-linking**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Capture patient, doctor, center, slot, consultation type and reason

Outcome: Capture patient, doctor, center, slot, consultation type and reason; show editable summary, payment choice and current booking status without exceeding center capacity or overlapping the same doctor's in-person appointments at different centers.
Requirements: FR-050, CG-15-BR17, CG-15-BR18; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-004-QA01:** With a permitted **Patient/staff confirms appointment** and verified real source records, perform: **Capture patient, doctor, center, slot, consultation type and reason; show editable summary, payment choice and current booking status without exceeding center capacity or overlapping the same doctor's in-person appointments at different centers**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Issue authentic reference/Booking ID, download/print/share and guarded…

Outcome: Issue authentic reference/Booking ID, download/print/share and guarded QR/barcode verification and calendar export; protect identifiers and symptoms.
Requirements: FR-051, CG-15-BR19, CG-15-BR20, CG-15-BR21, CG-15-BR24; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-005-QA01:** With a permitted **Booking is validly confirmed** and verified real source records, perform: **Issue authentic reference/Booking ID, download/print/share and guarded QR/barcode verification and calendar export; protect identifiers and symptoms**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-005-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-005-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-006 — Manage reception check-in, queue/token…

Outcome: Manage reception check-in, queue/token, waiting/consultation/completed/canceled/no-show state with authorized updates and patient/center appointment history.
Requirements: FR-052, CG-15-BR22, CG-15-BR25; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-006-QA01:** With a permitted **Center serves patient** and verified real source records, perform: **Manage reception check-in, queue/token, waiting/consultation/completed/canceled/no-show state with authorized updates and patient/center appointment history**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-006-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-006-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

### US-007 — Reschedule/cancel when permitted

Outcome: Reschedule/cancel when permitted; restore appropriate capacity, preserve history, update true due/refund and notify relevant parties.
Requirements: FR-053, CG-15-BR23, CG-15-BR24; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-007-QA01:** With a permitted **Patient or authorized center changes booking** and verified real source records, perform: **Reschedule/cancel when permitted; restore appropriate capacity, preserve history, update true due/refund and notify relevant parties**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-007-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-007-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-007-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-007-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-007-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-007-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-006

### US-008 — See authorized own appointments, receipts, patient ID and permitted reports

Outcome: See authorized own appointments, receipts, patient ID and permitted reports; patient and professionally uploaded report access are included; general dependent/family booking and electronic prescription authoring are not active initial-launch functions.
Requirements: FR-054, CG-15-BR14, CG-15-BR15, CG-15-BR16, CG-15-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy.
QA cases:
- **US-008-QA01:** With a permitted **Patient opens account** and verified real source records, perform: **See authorized own appointments, receipts, patient ID and permitted reports; patient and professionally uploaded report access are included; general dependent/family booking and electronic prescription authoring are not active initial-launch functions**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-008-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-008-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-008-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-008-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-008-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-008-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-008-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-007

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-007: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-008: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
