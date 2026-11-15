# CG-09 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Finance Admin opens accounts

Outcome: Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses.
Requirements: FR-023, CG-09-BR01, CG-09-BR02, CG-09-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-001-QA01:** Authorized Finance Admin opens accounts uses a real account and allowed input to Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-001-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Finance user posts a transaction

Outcome: Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state.
Requirements: FR-024, CG-09-BR02, CG-09-BR04, CG-09-BR06, CG-09-BR07, CG-09-BR08, CG-09-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-002-QA01:** Authorized Finance user posts a transaction uses a real account and allowed input to Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-002-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Employee/volunteer requests reimbursement

Outcome: Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses.
Requirements: FR-025, CG-09-BR09, CG-09-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-003-QA01:** Authorized Employee/volunteer requests reimbursement uses a real account and allowed input to Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-003-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Authorized user invoices or receipts

Outcome: Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states.
Requirements: FR-026, CG-09-BR11, CG-09-BR12; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-004-QA01:** Authorized Authorized user invoices or receipts uses a real account and allowed input to Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-004-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Finance allocates budget

Outcome: Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down.
Requirements: FR-027, CG-09-BR13, CG-09-BR14, CG-09-BR15, CG-09-BR16; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-005-QA01:** Authorized Finance allocates budget uses a real account and allowed input to Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-005-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-005-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

### US-006 — Reviewer checks statements

Outcome: See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit.
Requirements: FR-028, CG-09-BR03, CG-09-BR05, CG-09-BR14, CG-09-BR15, CG-09-BR16, CG-09-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Balanced journal, one source posting, correct funds vs commitment, no fake payment.
QA cases:
- **US-006-QA01:** Authorized Reviewer checks statements uses a real account and allowed input to See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit; UI shows true saved/pending business state, API authorizes, DB commits one record and audit.
- **US-006-QA02:** Wrong role/branch/center or revoked user calls Web/native/detail/options/export directly → safe denial, no DB write or private data leak.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, provider failure or unexpected timeout → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs A17, A18, A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Balanced journal, one source posting, correct funds vs commitment, no fake payment, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-006-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
