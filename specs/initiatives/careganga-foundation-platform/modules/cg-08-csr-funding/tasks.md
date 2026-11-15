# CG-08 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Capture organization, contact, proposed support, proof/agreement

Outcome: Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process.
Requirements: FR-020, CG-08-BR01, CG-08-BR02, CG-08-BR03, CG-08-BR05, CG-08-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Register real CSR partner/contact with protected agreement, verified scope and genuine proposal. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, Register real CSR partner/contact with protected agreement, verified scope and genuine proposal. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** Duplicate partner and unrelated reviewer cannot expose agreement. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific workflow:** CSR company supplies organizational proof and agreement but is returned for missing documentation; only the reviewer can finalize verified partner, and public partner listing remains unpublished.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record funding proposals, documented CSR/Foundation commitments, received…

Outcome: Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance.
Requirements: FR-021, CG-08-BR03, CG-08-BR04, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Keep committed/received/allocated/utilized CSR funds distinct using CG-09 and actual CG-05 project. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, Keep committed/received/allocated/utilized CSR funds distinct using CG-09 and actual CG-05 project. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Two reviewers cannot over-allocate the same approved pledge. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Critical integrated scenario:** An approved CSR partner commits funding but bank receipt is not verified, while manager attempts to allocate it as received cash. Expected: proposal and commitment can be shown, Finance cash remains unchanged, allocations cannot exceed actually available approved funding and labels distinguish pledged/received/utilized.
- **US-002-QA09 — Source-specific workflow:** Foundation and CSR each commit a split amount, but only CSR money is bank-received; allocation choices cannot treat unreceived Foundation pledge as spendable bank funds.
Verification: On actual implementation source-trace US-002-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Report approved, pending, committed, received and utilized contributions…

Outcome: Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval.
Requirements: FR-022, CG-08-BR05, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-08 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Reconcile partner reports to authoritative received fund and scoped project sources. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, Reconcile partner reports to authoritative received fund and scoped project sources. Verify actual Web/Android (when applicable) confirmation/pending state, backend guard, one committed owner record and audit without invented future data.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner regression:** Refund or reversal updates report, not an unverified cached received amount. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Source-specific workflow:** Export a proposal report with pledged, committed, received, approved and utilized columns; compare to actual CG-09 journal/project budget and deny an unrelated branch or partner access to private company documents.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
