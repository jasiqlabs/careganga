# CG-10 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Capture employment, branch/department, reporting line, needed…

Outcome: Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access.
Requirements: FR-029, CG-10-BR01, CG-10-BR02, CG-10-BR03, CG-10-BR12; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Register employee from real account/branch/department with protected private fields and source approval. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, register employee from real account/branch/department with protected private fields and source approval. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** Transfer revokes old branch access but preserves HR history. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Critical integrated scenario:** HR links an existing login to an employee and submits restricted bank/identity documents while a branch reviewer is out of scope. Expected: one employee relationship and ID only after genuine final approval, CG-01 role not automatically escalated and bank/ID documents inaccessible to unrelated roles.
- **US-001-QA09 — Source-specific workflow:** Enroll a verified staff applicant into a real branch/department, follow configured CG-03 review, issue official employee ID only on approval, and ensure an existing member/account is linked rather than duplicated.
Verification: On actual implementation source-trace US-001-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave…

Outcome: Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history.
Requirements: FR-030, CG-10-BR04, CG-10-BR05, CG-10-BR06, CG-10-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Record shift/attendance/leave plus reviewed correction with actual state and period. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, record shift/attendance/leave plus reviewed correction with actual state and period. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Overlapping attendance and concurrent leave decisions reject stale revisions. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Source-specific workflow:** An employee records a late punch within configured grace then submits leave overlapping a weekly-off; monthly attendance must use the approved shift/rules and only authorized HR correction changes the record.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Record performance assessments, assignments, transfer/promotion…

Outcome: Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit.
Requirements: FR-031, CG-10-BR07, CG-10-BR08, CG-10-BR14; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Record genuine performance assessment, promotion/transfer with role and branch authorization. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, record genuine performance assessment, promotion/transfer with role and branch authorization. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner regression:** Pending transfer never implies access to target branch. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Source-specific workflow:** Transfer a supervisor between branches while promotion and resignation requests are pending; retain effective dates/old reporting history, revoke prior branch access and ensure salary changes are not applied without proper approval.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-004 — Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos…

Outcome: Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates.
Requirements: FR-032, CG-10-BR09, CG-10-BR13, CG-10-BR15; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Issue protected versioned letter/memo and preserve original signed dispatch proof. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-004-QA01:** Given an authorized actor and actual prerequisite records, issue protected versioned letter/memo and preserve original signed dispatch proof. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-004-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — owner regression:** Reissue does not silently replace old issued document. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-004-QA08 — Source-specific workflow:** Generate official appointment letter, ID card and later reissue after name correction; CG-19 versions/signature and received-copy audit must remain linked, with no unauthorized private employee fields in PDF.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-005 — Submit and track allowance/claim from applicable Internal Android or Admin…

Outcome: Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment.
Requirements: FR-033, CG-10-BR10, CG-10-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Employee submits scoped allowance/claim in Internal Android and sees real approval/payment state. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-005-QA01:** Given an authorized actor and actual prerequisite records, employee submits scoped allowance/claim in Internal Android and sees real approval/payment state. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-005-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07 — owner regression:** Unverified CG-09 payment cannot show PAID or duplicate expense. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-005-QA08 — Source-specific workflow:** Internal Android employee requests travel allowance with evidence; pending approval does not produce money, CG-09 creates at most one payable after actual authorization and the employee sees correct status.
Verification: On actual implementation source-trace US-005-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
