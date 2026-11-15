# CG-13 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-039, FR-040, FR-041, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — dependency ordered, NOT YET APPROVED

### US-001 — Manage rank thresholds and benefits, point conversion/redemption rules…

Outcome: Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage.
Requirements: FR-040, CG-13-BR03, CG-13-BR04, CG-13-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No unearned points or repeated redemption/stock issue.
QA cases:
- **US-001-QA01:** With a permitted **Admin configures loyalty program** and verified real source records, perform: **Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No unearned points or repeated redemption/stock issue, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Source-specific workflow:** Configure overlapping rank thresholds or reward points cost while a redemption is pending; reject invalid rank configuration, preserve accepted redemption point price and show eligible rank history.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record attributed referral, qualify only after defined approved event…

Outcome: Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank.
Requirements: FR-039, CG-13-BR01, CG-13-BR02, CG-13-BR03, CG-13-BR04; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No unearned points or repeated redemption/stock issue.
QA cases:
- **US-002-QA01:** With a permitted **Eligible member/volunteer refers new applicant** and verified real source records, perform: **Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No unearned points or repeated redemption/stock issue, with one accepted source transaction and correct downstream totals.
- **US-002-QA08 — Source-specific workflow:** One applicant opens two referral links but registers and qualifies once as a verified member; points only credit the approved attribution once and later qualification reversal adjusts history.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Confirm eligibility/points, register one redemption, manage…

Outcome: Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue.
Requirements: FR-041, CG-13-BR06, CG-13-BR07, CG-13-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. No unearned points or repeated redemption/stock issue.
QA cases:
- **US-003-QA01:** With a permitted **Member/volunteer redeems** and verified real source records, perform: **Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves No unearned points or repeated redemption/stock issue, with one accepted source transaction and correct downstream totals.
- **US-003-QA08 — Source-specific workflow:** Two approved members request the last physical reward at the same time; only one CG-12 stock reservation and one points debit may complete, while canceled/failed fulfillment reverses the losing reservation safely.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001, US-002

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
