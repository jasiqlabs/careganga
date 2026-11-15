# CG-17 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-059, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Configure eligible provider/doctor/service, fixed/percentage contribution…

Outcome: Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy.
Requirements: FR-059, CG-17-BR01, CG-17-BR02, CG-17-BR03, CG-17-BR04; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-001-QA01:** Given a permitted **Foundation configures benefit** and real source data, perform: **Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Healthcare source-specific boundary:** Configure 50% consultation support at an approved center with maximum cap; eligible fee quote respects cap and effective date, while an exceptional 100% grant remains PENDING until protected approval.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Display gross fee, actually approved/eligible Foundation support and patient…

Outcome: Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%.
Requirements: FR-060, CG-17-BR02, CG-17-BR05, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-002-QA01:** Given a permitted **Patient sees appointment price** and real source data, perform: **Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Healthcare source-specific boundary:** At booking summary show gross ₹1,000 with an applicable approved 50% contribution of ₹500 and patient payable ₹500; a changed fee/policy after acceptance does not rewrite that historical split.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Provide online payment only through the verified healthcare center's own…

Outcome: Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections.
Requirements: FR-061, CG-17-BR08, CG-17-BR09, CG-17-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-003-QA01:** Given a permitted **Patient selects online or center payment** and real source data, perform: **Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-003-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
- **US-003-QA08 — Healthcare source-specific boundary:** Center has no verified own merchant credentials yet patient chooses online payment; checkout is unavailable and pay-at-center remains legitimate with DUE, not a silently used Foundation merchant key.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Record authorized on-site payment, part-pay, overdue follow-up, receipts…

Outcome: Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement.
Requirements: FR-062, CG-17-BR11, CG-17-BR12, CG-17-BR13, CG-17-BR14; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-004-QA01:** Given a permitted **Center receives payment or encounters due** and real source data, perform: **Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-004-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
- **US-004-QA08 — Healthcare source-specific boundary:** Center cashier records ₹300 of ₹500 payable in-person and later collects ₹200; partial/due/paid, receipt and overdue aging reconcile, and a duplicate cash-submit cannot collect twice.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Keep the center's patient collections, the Foundation's approved liability…

Outcome: Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments.
Requirements: FR-063, CG-17-BR15, CG-17-BR16, CG-17-BR17, CG-17-BR18, CG-17-BR19; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-005-QA01:** Given a permitted **Foundation owes provider** and real source data, perform: **Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-005-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
- **US-005-QA08 — Healthcare source-specific boundary:** Monthly provider settlement combines approved Foundation obligations across several real appointments; one partial bank payment does not mark entire month settled, and returned/canceled services adjust dues auditably.
Verification: On actual implementation source-trace US-005-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-006 — Reconcile verified patient receipts (center-owned), refunds and monthly…

Outcome: Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion.
Requirements: FR-064, CG-17-BR18, CG-17-BR19, CG-17-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-006-QA01:** Given a permitted **Money has to be accounted for** and real source data, perform: **Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-006-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
- **US-006-QA08 — Healthcare source-specific boundary:** Verify Center A patient ₹500 payment and separate Foundation ₹500 obligation: the center receipt does not debit or credit Foundation cash; only authorized Foundation disbursement posts exactly once into CG-09 with linked source.
Verification: On actual implementation source-trace US-006-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

### US-007 — Publish only approved current rates

Outcome: Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap.
Requirements: FR-065, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-007-QA01:** Given a permitted **CMS presents discount claim** and real source data, perform: **Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap**. Expected: UI reports actual committed or pending state; backend enforces action plus real resource scope, and persists one correctly audited owner transition.
- **US-007-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-007-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-007-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-007-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-007-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-007-QA07 — Healthcare source-specific boundary:** CMS tries to publish a mockup 40% lab or 20% medicine support badge without CG-17 approved policy; prohibit unsupported percentage, while standard eligible consultation benefit and approved exceptional full aid use actual policy source.
Verification: On actual implementation source-trace US-007-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-007: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
