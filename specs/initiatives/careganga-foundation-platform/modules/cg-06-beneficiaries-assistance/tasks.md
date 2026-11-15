# CG-06 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-015, FR-016, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Maintain restricted beneficiary profile/geography and project associations…

Outcome: Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history.
Requirements: FR-015, CG-06-BR01, CG-06-BR03, CG-06-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-06 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Register private beneficiary linked to real Foundation geography/project and consent; unauthorized exports denied. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, register private beneficiary linked to real Foundation geography/project and consent; unauthorized exports denied. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A07, A08, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** Potential duplicate beneficiary does not silently merge aid histories. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific workflow:** Register a beneficiary with two real approved CG-05 projects in different areas; an authorized scope sees only permitted relationship/history, and an unrelated staff search/export hides personal details.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record aid category, money/item, quantity/value, date and responsible person

Outcome: Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy.
Requirements: FR-016, CG-06-BR02, CG-06-BR03, CG-06-BR04, CG-06-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-06 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Record item/cash assistance against real CG-12 quantity or CG-09 posting with one source event. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, record item/cash assistance against real CG-12 quantity or CG-09 posting with one source event. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A07, A08, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Simultaneous last-item requests cannot issue more stock than available. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Module-critical regression:** Two staff try to issue the last stock units to the same approved beneficiary/project while a financial-aid request is merely pending. Expected: material delivery completes only against one permitted CG-12 movement, pending money is not counted as paid CG-09 assistance, both outcomes remain audit-linked and correctly reported.
- **US-002-QA09 — Source-specific workflow:** Try issuing the same requested food/material assistance twice while CG-12 holds only one available item; exactly one verified stock issue and one corresponding CG-06 distribution event may complete, the other remains denied/pending without false quantity.
- **US-002-QA10 — Real stock-backed material aid once:** With real beneficiary, approved CG-06 aid 6 pieces and real CG-12 stock 10, authorized A07/A08 Admin or Internal Android confirms physical delivery via CG-12 original issue with CG-06 unique key. One immutable CG-12 issue and one private CG-06 assistance DELIVERED entry; no extra balance/payment.
- **US-002-QA11 — Last-unit conflict and retry:** Two genuine delivery staff race for final CG-12 item, only one original issue accepted. Losing CG-06 aid remains PENDING_STOCK/SHORTAGE; unknown response queries same original event key and never duplicates benefit or stock issue.
- **US-002-QA12 — Partial return and linked correction:** Approve 10, physically deliver 6 then 4 when available, show partial/full against original issue refs; authorized return creates one CG-12 RETURN and CG-06 corrected assistance event, preserves immutable history and cannot return more than issued.
- **US-002-QA13 — Current scope and recipient privacy:** Foreign branch, revoked CG-01 employee, guessed beneficiary or missing CG-12 stock source denied at both APIs. Private beneficiary data absent from ordinary CG-12 B19 Distribution Log and Public Android; original A07/A08 uses true error/status, no fake success.
Verification: On actual implementation source-trace US-002-QA01–QA13 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
