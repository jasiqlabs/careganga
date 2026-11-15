# CG-15 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Configure doctor-center working days, time windows, capacity, consultation…

Outcome: Configure doctor-center working days, time windows, capacity, consultation type, holidays, blocks and approved leave while preserving already confirmed bookings.
Requirements: FR-047, CG-15-BR01, CG-15-BR02; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Configure real doctor-center schedule, leave/holiday/blocked windows and versioned capacity, preserving confirmed visits. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-001-QA01:** Given correctly scoped actor and genuine delivered owner records, configure real doctor-center schedule, leave/holiday/blocked windows and versioned capacity, preserving confirmed visits. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — business regression:** Late schedule adjustment must not silently cancel confirmed bookings. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-001-QA08 — Healthcare source-specific boundary:** Doctor works at Center A then submits an overlapping leave/blocked period at Center B; both center schedules share doctor occupancy, and a change cannot silently cancel confirmed historical bookings.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Support center-first or doctor/date/slot-first journey using one doctor-aware…

Outcome: Support center-first or doctor/date/slot-first journey using one doctor-aware center-specific schedule that prevents overlapping in-person appointments across centers; show the requested center and available slot before payment; when multiple centers match the same time, present an explicit center choice rather than silently selecting one.
Requirements: FR-048, CG-15-BR03, CG-15-BR04, CG-15-BR05, CG-15-BR06, CG-15-BR07, CG-15-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Use center-first and date/slot-first queries on one actual doctor-wide inventory; show center, fee and address before choice. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-002-QA01:** Given correctly scoped actor and genuine delivered owner records, use center-first and date/slot-first queries on one actual doctor-wide inventory; show center, fee and address before choice. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — business regression:** Overlapping doctor slots across centers and two last-capacity clients cannot both confirm. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-002-QA08 — Healthcare source-specific boundary:** Two patients select the same doctor's 10:00 in-person slot at different centers via center-first and time-first flows; only one doctor-wide reservation may commit, and any multiple-center choice must be explicit before fee acceptance.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Register or securely locate patient with verified mobile, appropriate profile…

Outcome: Register or securely locate patient with verified mobile, appropriate profile and consent, optional uploaded reports/identity; assign a unique patient ID without duplicates or unverified cross-linking.
Requirements: FR-049, CG-15-BR09, CG-15-BR10, CG-15-BR11, CG-15-BR12, CG-15-BR13, CG-15-BR14, CG-15-BR15, CG-15-BR16; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Verify existing patient or create consented patient with unique patient reference and protected clinical documents. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-003-QA01:** Given correctly scoped actor and genuine delivered owner records, verify existing patient or create consented patient with unique patient reference and protected clinical documents. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — business regression:** Unverified phone or guessed patient number must not reveal reports or merge another patient. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-003-QA08 — Healthcare source-specific boundary:** Two registrants use the same mobile number with different identities; secure verification and duplicate-patient review prevents automatic confidential record merge, preserves consent version and one unique virtual patient ID per actual patient.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-004 — Capture patient, doctor, center, slot, consultation type and reason

Outcome: Capture patient, doctor, center, slot, consultation type and reason; show editable summary, payment choice and current booking status without exceeding center capacity or overlapping the same doctor's in-person appointments at different centers.
Requirements: FR-050, CG-15-BR17, CG-15-BR18; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Reserve and confirm actual doctor/center/patient/slot/fee snapshot once; payment remains DUE unless verified. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-004-QA01:** Given correctly scoped actor and genuine delivered owner records, reserve and confirm actual doctor/center/patient/slot/fee snapshot once; payment remains DUE unless verified. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — business regression:** Expired hold and late callback cannot overbook or claim paid without CG-17. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-004-QA08 — Healthcare source-specific boundary:** Patient changes doctor/center/consultation mode at review screen while last slot is held; price/support snapshot must be recalculated for the chosen real center and booking confirmation cannot exceed capacity.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002, US-003

### US-005 — Issue authentic reference/Booking ID, download/print/share and guarded…

Outcome: Issue authentic reference/Booking ID, download/print/share and guarded QR/barcode verification and calendar export; protect identifiers and symptoms.
Requirements: FR-051, CG-15-BR19, CG-15-BR20, CG-15-BR21, CG-15-BR24; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Issue real unique Booking ID/slip with restricted QR lookup and correct fee/payment state. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-005-QA01:** Given correctly scoped actor and genuine delivered owner records, issue real unique Booking ID/slip with restricted QR lookup and correct fee/payment state. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-005-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07 — business regression:** QR scan by anonymous user cannot expose symptoms or full patient data. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-005-QA08 — Healthcare source-specific boundary:** Generate the booking slip, human Booking ID, add-to-calendar and QR from one confirmed appointment; public QR reveals minimal valid booking status, not symptoms, clinical documents or identity accessible by guessing ID.
Verification: On actual implementation source-trace US-005-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-006 — Manage reception check-in, queue/token…

Outcome: Manage reception check-in, queue/token, waiting/consultation/completed/canceled/no-show state with authorized updates and patient/center appointment history.
Requirements: FR-052, CG-15-BR22, CG-15-BR25; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Check patient into correct center and move queue token through waiting/consulting/completed/no-show. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-006-QA01:** Given correctly scoped actor and genuine delivered owner records, check patient into correct center and move queue token through waiting/consulting/completed/no-show. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-006-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07 — Healthcare source-specific boundary:** Reception at Center A checks in a real appointment and issues queue token; Center B front desk cannot alter it, no-show/cancellation update timeline correctly and queues show genuine waiting/in-consultation counts.
Verification: On actual implementation source-trace US-006-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

### US-007 — Reschedule/cancel when permitted

Outcome: Reschedule/cancel when permitted; restore appropriate capacity, preserve history, update true due/refund and notify relevant parties.
Requirements: FR-053, CG-15-BR23, CG-15-BR24; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Reschedule/cancel under policy, release old capacity, preserve accepted fee history and truthful refund due. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-007-QA01:** Given correctly scoped actor and genuine delivered owner records, reschedule/cancel under policy, release old capacity, preserve accepted fee history and truthful refund due. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-007-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-007-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-007-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-007-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-007-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-007-QA07 — Healthcare source-specific boundary:** Patient reschedules after an online payment completes late for an expired hold; safely release/rebook capacity and reconcile any charge/refund rather than overbook or create a second paid appointment.
Verification: On actual implementation source-trace US-007-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-008 — See authorized own appointments, receipts, patient ID and permitted reports

Outcome: See authorized own appointments, receipts, patient ID and permitted reports; patient and professionally uploaded report access are included; general dependent/family booking and electronic prescription authoring are not active initial-launch functions.
Requirements: FR-054, CG-15-BR14, CG-15-BR15, CG-15-BR16, CG-15-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-15 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Display verified patient's own appointments, reports and receipts only when their source owner exists. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-008-QA01:** Given correctly scoped actor and genuine delivered owner records, display verified patient's own appointments, reports and receipts only when their source owner exists. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-008-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-008-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-008-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-008-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-008-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-008-QA07 — business regression:** Family/dependent or e-prescription placeholder cannot grant unauthorized record access. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-008-QA08 — Healthcare source-specific boundary:** Authenticated patient opens own appointments, documents and reports from Web/Android; another patient's identifier or unverified family-member claim must not grant access to prescriptions or clinical reports.
Verification: On actual implementation source-trace US-008-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003, US-005

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-007: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-008: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
