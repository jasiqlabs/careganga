# CG-13 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-039, FR-040, FR-041, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — dependency ordered, NOT YET APPROVED

### US-001 — Manage rank thresholds and benefits, point conversion/redemption rules…

Outcome: Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage.
Requirements: FR-040, CG-13-BR03, CG-13-BR04, CG-13-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Configure actual reward tiers, thresholds and validity before any points/stock redemption. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-001-QA01:** Given correctly scoped actor and genuine delivered owner records, configure actual reward tiers, thresholds and validity before any points/stock redemption. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — business regression:** Inactive tier and retroactive configuration change must not silently rewrite earned points. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-001-QA08 — Source-specific workflow:** Configure overlapping rank thresholds or reward points cost while a redemption is pending; reject invalid rank configuration, preserve accepted redemption point price and show eligible rank history.
- **US-001-QA09 — Physical reward product real CG-12 item:** In B16 authorized Add Reward Product, PHYSICAL reward selects true CG-12 active item and real stock-safe option with points cost, without a second CG-13 quantity ledger or creating CG-12 stock from reward form. DIGITAL reward has no mandatory physical picker.
- **US-001-QA10 — B14/B15 source removal and status:** When original CG-12 item/store goes inactive or unavailable, CG-13 physical product cannot display fulfillable stock from cached card; active digital products and real CG-13 point configuration continue.
Verification: On actual implementation source-trace US-001-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record attributed referral, qualify only after defined approved event…

Outcome: Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank.
Requirements: FR-039, CG-13-BR01, CG-13-BR02, CG-13-BR03, CG-13-BR04; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Bind referral to verified eligible CG-04 event and issue one unique points credit, not to a mere clicked link. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-002-QA01:** Given correctly scoped actor and genuine delivered owner records, bind referral to verified eligible CG-04 event and issue one unique points credit, not to a mere clicked link. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — business regression:** Self-referral, circular record and replayed event produce zero additional points. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-002-QA08 — Source-specific workflow:** One applicant opens two referral links but registers and qualifies once as a verified member; points only credit the approved attribution once and later qualification reversal adjusts history.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Confirm eligibility/points, register one redemption, manage…

Outcome: Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue.
Requirements: FR-041, CG-13-BR06, CG-13-BR07, CG-13-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-13 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Validate real point balance and CG-12 stock/CG-09 value before exactly one redemption and status change. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-003-QA01:** Given correctly scoped actor and genuine delivered owner records, validate real point balance and CG-12 stock/CG-09 value before exactly one redemption and status change. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B11, B12, B13, B14, B15, B16, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — business regression:** Two simultaneous redemptions for the last eligible reward cannot both succeed. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-003-QA08 — Source-specific workflow:** Two approved members request the last physical reward at the same time; only one CG-12 stock reservation and one points debit may complete, while canceled/failed fulfillment reverses the losing reservation safely.
- **US-003-QA09 — Two members one last physical reward:** With actual CG-04 eligible members and last real CG-12 piece, two CG-13 redemptions race. Exactly one accepted original CG-12 reservation and eligible points hold, losing member not debited and not Fulfilled; source event key/replay safe.
- **US-003-QA10 — Actual original issue gates completion:** After true CG-03 approval where required, confirm exactly one CG-12 physical ISSUE linked to real redemption, then original CG-13 completed points debit and Issued status; pending stock hold never means delivered item.
- **US-003-QA11 — Cancel/return/replay compensation:** Cancel/reject physical redemption or return original issue; CG-12 hold release/RETURN and CG-13 linked points restoration each occur once, even duplicate callbacks/unknown lost reply. No double stock issue/points credit.
- **US-003-QA12 — Original B14–B16 Web/public native and privacy:** Admin product/fulfillment and allowed member/volunteer Web/Public Android display source-backed CG-12 physical availability and original CG-13 points. Wrong root, false stock reference, unauthorized reward actor and protected supplier metadata denied in CG-13+CG-12 typed API.
Verification: On actual implementation source-trace US-003-QA01–QA12 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001, US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
