# CG-07 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-017, FR-018, FR-019, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Campaign owner proposes fundraiser

Outcome: Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication.
Requirements: FR-017, CG-07-BR01, CG-07-BR06, CG-07-BR07, CG-07-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-07 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pending money never receipt, provider replay never duplicate finance posting.
QA cases:
- **US-001-QA01:** Authorized Campaign owner proposes fundraiser uses a real account and allowed input to Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-001-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A12, A13, A14, A15, A16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pending money never receipt, provider replay never duplicate finance posting, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Donor makes contribution

Outcome: Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states.
Requirements: FR-018, CG-07-BR02, CG-07-BR03, CG-07-BR09; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-07 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pending money never receipt, provider replay never duplicate finance posting.
QA cases:
- **US-002-QA01:** Authorized Donor makes contribution uses a real account and allowed input to Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-002-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A12, A13, A14, A15, A16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pending money never receipt, provider replay never duplicate finance posting, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Donation completes/reverses

Outcome: Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress.
Requirements: FR-019, CG-07-BR04, CG-07-BR05, CG-07-BR06, CG-07-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-07 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pending money never receipt, provider replay never duplicate finance posting.
QA cases:
- **US-003-QA01:** Authorized Donation completes/reverses uses a real account and allowed input to Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-003-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs A12, A13, A14, A15, A16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pending money never receipt, provider replay never duplicate finance posting, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
