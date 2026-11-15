# CG-02 — User Stories & Manual QA

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Maintain organization details, geography, branches, departments/committees…

Outcome: Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication.
Requirements: FR-004, CG-02-BR01, CG-02-BR02, CG-02-BR06, CG-02-BR07, CG-02-BR08, CG-02-BR09, CG-02-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-02 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create actual Foundation geography/department and reject a different-branch or cyclic parent with no source mutation. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, create actual Foundation geography/department and reject a different-branch or cyclic parent with no source mutation. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U18, U19, U20, U21, U22, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — Source-specific boundary:** Create a department with a parent in a different branch or a cyclic parent chain; the source validates an active same-branch hierarchy, rejects the new parent and leaves existing department/staff relations intact.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Complete seven-stage draft/review/submit registration with contacts…

Outcome: Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code.
Requirements: FR-005, CG-02-BR03, CG-02-BR04, CG-02-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-02 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Complete seven-step branch registration, resume draft, obtain genuine CG-03 final approval and generate a unique branch code exactly once. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, complete seven-step branch registration, resume draft, obtain genuine CG-03 final approval and generate a unique branch code exactly once. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U18, U19, U20, U21, U22, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Two duplicate approval callbacks cannot create a second branch or code. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Module-critical regression:** An authorized branch manager completes seven registration steps, saves/resumes drafts, submits missing document and then receives a valid CG-03 final decision. Expected: incomplete submission remains draft/returned, no premature active branch/code; approved one gets one unique code, Web shows correct status and DB retains stage/reviewer history.
- **US-002-QA09 — Source-specific boundary:** Save the seven-stage branch registration after step 3 with missing legal agreements, reopen it at step 4, submit and receive approval; show complete status and issue unique branch code only after CG-03 final decision, never on draft/submission.
Verification: On actual implementation source-trace US-002-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
