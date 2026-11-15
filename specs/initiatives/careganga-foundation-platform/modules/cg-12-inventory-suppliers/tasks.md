# CG-12 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-037, FR-038, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Maintain item/supplier master, receipts, issuance, authorized adjustment…

Outcome: Maintain item/supplier master, receipts, issuance, authorized adjustment, availability, low-stock alerts and transaction history.
Requirements: FR-037, CG-12-BR01, CG-12-BR02, CG-12-BR03, CG-12-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-12 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Atomic stock, no duplicate issues or unauthorized negative balance.
QA cases:
- **US-001-QA01:** With a permitted **Inventory officer manages stock** and verified real source records, perform: **Maintain item/supplier master, receipts, issuance, authorized adjustment, availability, low-stock alerts and transaction history**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Admin global shell; no separate verified capture, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Atomic stock, no duplicate issues or unauthorized negative balance, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Source-specific workflow:** Two warehouse operators try issuing the last available unit of the same item at the same location; atomic movement validation allows one and denies the other, and the availability dashboard equals accepted stock events.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Submit and track request through approval/rejection and fulfilled quantity…

Outcome: Submit and track request through approval/rejection and fulfilled quantity, with project, beneficiary and reward consumption linked to one stock inventory.
Requirements: FR-038, CG-12-BR04, CG-12-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-12 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Atomic stock, no duplicate issues or unauthorized negative balance.
QA cases:
- **US-002-QA01:** With a permitted **Staff requests material** and verified real source records, perform: **Submit and track request through approval/rejection and fulfilled quantity, with project, beneficiary and reward consumption linked to one stock inventory**. Expected: UI shows actual committed or pending state; API checks actor/action/actual record scope, persistence commits one valid owner outcome with audit.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Admin global shell; no separate verified capture, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Atomic stock, no duplicate issues or unauthorized negative balance, with one accepted source transaction and correct downstream totals.
- **US-002-QA08 — Source-specific workflow:** Approve a request for ten units but fulfill six in one delivery and four later; the second delivery is idempotent, authorized inventory/beneficiary/reward consumers see the same movements, and an extra fifth unit is rejected.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
