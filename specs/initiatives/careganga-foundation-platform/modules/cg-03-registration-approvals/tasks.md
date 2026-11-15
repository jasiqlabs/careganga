# CG-03 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-006, FR-007, FR-008, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Give application number and tracking

Outcome: Give application number and tracking; support application-specific documents, verifications, notes, evidence and configurable stepwise routing.
Requirements: FR-006, CG-03-BR01, CG-03-BR02, CG-03-BR03, CG-03-BR04, CG-03-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Submit real CG-01 protected access-change source and display correct case/step/version and scoped pending reviewer. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, submit real CG-01 protected access-change source and display correct case/step/version and scoped pending reviewer. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** A missing future provider/member source cannot be submitted as a fake case. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific boundary:** Submit a real CG-01 protected-access request through the current verified account/role contract; receive an actual case reference and frozen reviewer route, not fabricated branch/member/provider records.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Approve, reject, return for correction or forward

Outcome: Approve, reject, return for correction or forward; show pending and prior steps, reviewer, remarks and time; prevent action by unrelated or revoked reviewer.
Requirements: FR-007, CG-03-BR05, CG-03-BR06, CG-03-BR07, CG-03-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Review one real case with return/reject/forward/approve; retain actor, remarks, version and protected history. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, review one real case with return/reject/forward/approve; retain actor, remarks, version and protected history. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Competing reviewers at the same step accept one version and reject stale one. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Source-specific boundary:** Open U12/U13 document verification as a reviewer without permission to view linked CG-19 attachment; allow case summary but block file, deny approval until mandatory document checks/reviewer steps pass.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Produce exactly one owner-domain effect (member/employee/provider/branch…

Outcome: Produce exactly one owner-domain effect (member/employee/provider/branch activation, entitlement or authorized financial outcome), never from a pending stage.
Requirements: FR-008, CG-03-BR09; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Apply final source decision to CG-01 exactly once; owner temporarily unavailable remains pending, never ACTIVE. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, apply final source decision to CG-01 exactly once; owner temporarily unavailable remains pending, never ACTIVE. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner regression:** Replay/timeout of owner callback never grants duplicate or unauthorized role. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Module-critical regression:** Two final approvers or a retried owner callback attempt to finalize the same application during an owner-service outage. Expected: one approved CG-03 decision, source owner applies exactly one authorized activation/entitlement/posting (or visibly remains pending), no duplicate member/branch/provider ID or payment.
- **US-003-QA09 — Source-specific boundary:** Replay a FINAL_APPROVED decision after its source-owner finalizer times out; case retains truthful pending-finalization status, re-query uses the same finalization key, and no role/branch/member business effect is created twice.
Verification: On actual implementation source-trace US-003-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
