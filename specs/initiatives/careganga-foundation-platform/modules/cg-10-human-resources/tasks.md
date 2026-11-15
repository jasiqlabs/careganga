# CG-10 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Capture employment, branch/department, reporting line, needed…

Outcome: Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access.
Requirements: FR-029, CG-10-BR01, CG-10-BR02, CG-10-BR03, CG-10-BR12; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Employment not login; payroll/salary and bank data remain private/owned.
QA cases:
- **US-001-QA01:** Given a permitted **HR enrolls employee** and real source data, perform: **Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Employment not login; payroll/salary and bank data remain private/owned, with one accepted source transaction and correct downstream totals.
- **US-001-QA08 — Critical integrated scenario:** HR links an existing login to an employee and submits restricted bank/identity documents while a branch reviewer is out of scope. Expected: one employee relationship and ID only after genuine final approval, CG-01 role not automatically escalated and bank/ID documents inaccessible to unrelated roles.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave…

Outcome: Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history.
Requirements: FR-030, CG-10-BR04, CG-10-BR05, CG-10-BR06, CG-10-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Employment not login; payroll/salary and bank data remain private/owned.
QA cases:
- **US-002-QA01:** Given a permitted **Employee reports work** and real source data, perform: **Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Employment not login; payroll/salary and bank data remain private/owned, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Record performance assessments, assignments, transfer/promotion…

Outcome: Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit.
Requirements: FR-031, CG-10-BR07, CG-10-BR08, CG-10-BR14; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Employment not login; payroll/salary and bank data remain private/owned.
QA cases:
- **US-003-QA01:** Given a permitted **HR manages employment** and real source data, perform: **Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Employment not login; payroll/salary and bank data remain private/owned, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos…

Outcome: Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates.
Requirements: FR-032, CG-10-BR09, CG-10-BR13, CG-10-BR15; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Employment not login; payroll/salary and bank data remain private/owned.
QA cases:
- **US-004-QA01:** Given a permitted **HR issues official record** and real source data, perform: **Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-004-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Employment not login; payroll/salary and bank data remain private/owned, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-003

### US-005 — Submit and track allowance/claim from applicable Internal Android or Admin…

Outcome: Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment.
Requirements: FR-033, CG-10-BR10, CG-10-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-10 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Employment not login; payroll/salary and bank data remain private/owned.
QA cases:
- **US-005-QA01:** Given a permitted **Employee requests allowance** and real source data, perform: **Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-005-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Employment not login; payroll/salary and bank data remain private/owned, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-005-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-004

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-005: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
