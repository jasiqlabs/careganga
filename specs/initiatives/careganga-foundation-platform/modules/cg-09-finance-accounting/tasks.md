# CG-09 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Configure chart of accounts/groups, financial year, branch/project…

Outcome: Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses.
Requirements: FR-023, CG-09-BR01, CG-09-BR02, CG-09-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create valid chart/year/bank/cash accounts with real branch/project scope and opening balance integrity. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, Create valid chart/year/bank/cash accounts with real branch/project scope and opening balance integrity. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** Closed period or duplicate normalized account code cannot be used for new posting. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific workflow:** Admin defines a new financial year and bank/cash account with controlled opening balance; duplicate account code and unauthorized branch scope are rejected without changing chart or trial balance.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Enter authorized balanced journal, payment/expense/contra voucher with…

Outcome: Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state.
Requirements: FR-024, CG-09-BR02, CG-09-BR04, CG-09-BR06, CG-09-BR07, CG-09-BR08, CG-09-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Post balanced debits/credits once per immutable source event; correct paid vs approved state. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, Post balanced debits/credits once per immutable source event; correct paid vs approved state. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Two revisions of one source event cannot bypass the unique posting key. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Critical integrated scenario:** Operator submits a voucher/journal with unequal debits and credits or a replay of a previously posted source event. Expected: backend rejects imbalance before posting, creates neither orphan line nor phantom bank balance; duplicate source returns original accepted posting and finance reports reconcile.
- **US-002-QA09 — Source-specific workflow:** Post a multi-item voucher with tax/charges and account picker; select a cashier account using a permitted minimum-label selector without broad ledger permission, reject a missing balancing debit/credit side and do not mark the voucher paid.
Verification: On actual implementation source-trace US-002-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Submit claim with purpose/amount/date/project and bill

Outcome: Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses.
Requirements: FR-025, CG-09-BR09, CG-09-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create reviewed reimbursement claim linked to one approved payable/voucher and actual payment evidence. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, Create reviewed reimbursement claim linked to one approved payable/voucher and actual payment evidence. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner regression:** A rejected claim never creates another expense or payable under retry. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Source-specific workflow:** Submit employee reimbursement with proof, route final CG-03 decision, create one payable/voucher, and reconcile bank payment once; a pending claim must not inflate expense totals twice.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-004 — Use staged invoice/receipt preparation, items, dates/amounts, attachments…

Outcome: Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states.
Requirements: FR-026, CG-09-BR11, CG-09-BR12; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create validated itemized invoice/receipt, calculate tax/charges and preserve issue/payment history. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-004-QA01:** Given an authorized actor and actual prerequisite records, Create validated itemized invoice/receipt, calculate tax/charges and preserve issue/payment history. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-004-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — owner regression:** Posted total is corrected by linked reversal rather than editing old lines. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-004-QA08 — Source-specific workflow:** Create an invoice in stages, save draft with items then approve, issue PDF through CG-19 and record partial payment; receipt/print must show the approved snapshot, not a later edited total.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-005 — Create/approve budgets and reveal committed, allocated, utilized, released…

Outcome: Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down.
Requirements: FR-027, CG-09-BR13, CG-09-BR14, CG-09-BR15, CG-09-BR16; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Approve one budget, distinguish committed/allocated/utilized/released and real balance. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-005-QA01:** Given an authorized actor and actual prerequisite records, Approve one budget, distinguish committed/allocated/utilized/released and real balance. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-005-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07 — owner regression:** Two concurrent allocations exceeding available funds cannot both commit. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-005-QA08 — Source-specific workflow:** Allocate a budget with committed funding and utilized/released amounts; over-budget and available figures must remain distinct under two concurrent allocation requests.
Verification: On actual implementation source-trace US-005-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-006 — See scoped general ledger, cash/bank/day books, trial balance…

Outcome: See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit.
Requirements: FR-028, CG-09-BR03, CG-09-BR05, CG-09-BR14, CG-09-BR15, CG-09-BR16, CG-09-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-09 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Show scoped day book, cash/bank ledger, trial balance and reconciliation from posted lines. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-006-QA01:** Given an authorized actor and actual prerequisite records, Show scoped day book, cash/bank ledger, trial balance and reconciliation from posted lines. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-006-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07 — owner regression:** Foreign branch export and account picker do not leak financial data. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-006-QA08 — Source-specific workflow:** Run general ledger/trial balance/cash-book/vendor and project scoped exports after reversal; reconciled total debit=credit, private branch data hidden and original/reversal journals both traceable.
Verification: On actual implementation source-trace US-006-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-006: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
