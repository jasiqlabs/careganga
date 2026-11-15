# CG-08 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Capture organization, contact, proposed support, proof/agreement

Outcome: Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process.
Requirements: FR-020, CG-08-BR01, CG-08-BR02, CG-08-BR03, CG-08-BR05, CG-08-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pledge not money; funding allocation not utilization; no shadow ledger.
QA cases:
- **US-001-QA01:** Given a permitted **CSR partner submits application** and real source data, perform: **Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pledge not money; funding allocation not utilization; no shadow ledger, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record funding proposals, documented CSR/Foundation commitments, received…

Outcome: Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance.
Requirements: FR-021, CG-08-BR03, CG-08-BR04, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pledge not money; funding allocation not utilization; no shadow ledger.
QA cases:
- **US-002-QA01:** Given a permitted **Foundation funds a project** and real source data, perform: **Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pledge not money; funding allocation not utilization; no shadow ledger, with one accepted source transaction and correct downstream totals.
- **US-002-QA08 — Critical integrated scenario:** An approved CSR partner commits funding but bank receipt is not verified, while manager attempts to allocate it as received cash. Expected: proposal and commitment can be shown, Finance cash remains unchanged, allocations cannot exceed actually available approved funding and labels distinguish pledged/received/utilized.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Report approved, pending, committed, received and utilized contributions…

Outcome: Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval.
Requirements: FR-022, CG-08-BR05, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Valid authorized operation and source status, negative access, input validation, duplicate/concurrency protection, accurate cross-channel reporting and original theme fidelity. Pledge not money; funding allocation not utilization; no shadow ledger.
QA cases:
- **US-003-QA01:** Given a permitted **Finance or partner manager examines funding** and real source data, perform: **Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval**. Expected: the UI shows the actual confirmed or pending outcome; backend validates current actor/action/resource scope; database commits exactly one authorized source event and audit.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07:** Race/replay/rollback of sensitive money/stock/booking/approval/report state preserves Pledge not money; funding allocation not utilization; no shadow ledger, with one accepted source transaction and correct downstream totals.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: READY | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
