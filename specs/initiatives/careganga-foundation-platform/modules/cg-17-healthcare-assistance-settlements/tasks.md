# CG-17 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-059, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Foundation configures benefit

Outcome: Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy.
Requirements: FR-059, CG-17-BR01, CG-17-BR02, CG-17-BR03, CG-17-BR04; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-001-QA01:** Authorized Foundation configures benefit uses a real account and allowed input to Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-001-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Patient sees appointment price

Outcome: Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%.
Requirements: FR-060, CG-17-BR02, CG-17-BR05, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-002-QA01:** Authorized Patient sees appointment price uses a real account and allowed input to Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-002-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Patient selects online or center payment

Outcome: Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections.
Requirements: FR-061, CG-17-BR08, CG-17-BR09, CG-17-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-003-QA01:** Authorized Patient selects online or center payment uses a real account and allowed input to Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-003-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Center receives payment or encounters due

Outcome: Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement.
Requirements: FR-062, CG-17-BR11, CG-17-BR12, CG-17-BR13, CG-17-BR14; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-004-QA01:** Authorized Center receives payment or encounters due uses a real account and allowed input to Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-004-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Foundation owes provider

Outcome: Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments.
Requirements: FR-063, CG-17-BR15, CG-17-BR16, CG-17-BR17, CG-17-BR18, CG-17-BR19; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-005-QA01:** Authorized Foundation owes provider uses a real account and allowed input to Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-005-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-005-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-006 — Money has to be accounted for

Outcome: Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion.
Requirements: FR-064, CG-17-BR18, CG-17-BR19, CG-17-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-006-QA01:** Authorized Money has to be accounted for uses a real account and allowed input to Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-006-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-006-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

### US-007 — CMS presents discount claim

Outcome: Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap.
Requirements: FR-065, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash.
QA cases:
- **US-007-QA01:** Authorized CMS presents discount claim uses a real account and allowed input to Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-007-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-007-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-007-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-007-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-007-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
Verification: On actual implementation source-trace US-007-QA01–QA06 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-006

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-007: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
