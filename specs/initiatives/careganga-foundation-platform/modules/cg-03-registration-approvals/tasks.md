# CG-03 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT aligned with current corrected PRD/HLD v1.1 and CG-03 module/UIUX/DLD; [module](module.md), [PRD](../../prd.md) FR-006, FR-007, FR-008, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Approved task definitions

**Approval truth:** These definitions are PROPOSED/NOT_YET_APPROVED, despite the machine-required heading. Authenticated local Harness resolver and current-hash delegated PRD/HLD/Planning/UIUX/DLD approvals must pass before `READY`; no source/runtime/visual QA has run.

### US-001 — Create real version-pinned CG-01 access-change cases

Outcome: Create an actual CG-03 case for a verified existing CG-01 account/role protected change, freeze owner revision/payload digest and review route, and show a scoped readable application reference/status without requiring CG-19 or future owner records.
Requirements: FR-006, CG-03-BR01, CG-03-BR02, CG-03-BR03, CG-03-BR04, CG-03-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Real authorized proposer submits one immutable CG-01 account/role change with verified eligible reviewer steps, process version and source revision/digest. Concurrent retry with same key returns same accepted case; mismatched digest/foreign target or missing real root account denies. In initial flow no CG-19 file, branch, member, provider, payroll or center record is required. Admin Web and permitted Internal Android show the actual scoped case/state in CareGanga U11–U13/B29 styling.
QA cases:
- **US-001-QA01:** Submit an actual protected grant-change for one existing CG-01 account/role; verify a frozen proposed change, immutable source revision/digest, configured review-route version and one visible permitted case reference. No dummy membership/branch/documents or public Android admin route.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent same-source submissions or response lost after commit return one case for the same immutable revision; mismatched digest with reused idempotency key returns CONFLICT, never overwrites approved content.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — future source independence:** The actual CG-01 access-change case completes with no CG-19 storage/attachment, CG-02 branch or CG-04/10/14 provider/member/employee record. Attempt to submit a future owner kind with no real owner facade → safe NOT_AVAILABLE, no fake application.
- **US-001-QA08 — approval revision boundary:** Submit one frozen CG-01 protected change, simulate correction after return and create a newly versioned case linked to the prior immutable case/history. Old case/decision must never approve current edited source.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Review and decide real cases under current authorization

Outcome: Permitted CG-01 reviewer decides a genuine version-pinned CG-03 case through approve/return/reject/forward with immutable timeline and business-language outcome; changed or revoked reviewer grants, self-approval and stale concurrent decisions are denied.
Requirements: FR-007, CG-03-BR05, CG-03-BR06, CG-03-BR07, CG-03-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Assigned, currently authorized reviewer can take only allowed step decisions on the pinned source/process revision; commit one decision, actor/time/remarks and state atomically. Return requires new submitted owner revision to proceed; rejected case cannot finalize. Same-step concurrent reviewers yield one accepted decision, one CONFLICT. CG-19 files are optional for the initial case; only later genuinely required file checks block later owner submissions. Web/Internal Android show U11–U13/B29 original CareGanga states.
QA cases:
- **US-002-QA01:** Assigned authorized reviewer opens real CG-01 access-change case and submits Approve, Return, Reject or Forward as applicable; verify persisted step, remarks, actor/time and immutable prior history on both authorized Admin Web/Internal Android.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — reviewer race:** Two assigned reviewers decide same current step under concurrent expected revision; exactly one wins and other gets safe CONFLICT. A revoked, wrong-scope or self-approving actor cannot bypass decision guard or cause grant mutation.
- **US-002-QA08 — genuine document boundary:** On initial CG-01 no-attachment case, approval works without CG-19 storage. After CG-19 is delivered, on an actual document-required owner case only, unauthorized reviewer may see permitted case summary but not file preview, and missing mandatory CG-19 verification blocks final approval. No migration/table may depend on future CG-19 initially.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Finalize one genuine protected CG-01 grant effect

Outcome: A final CG-03 decision for the frozen initial CG-01 protected-change case triggers one guarded idempotent CG-01 grant application, with source-effect pending/confirmed/failed distinction; future owners implement their own source finalizers when delivered.
Requirements: FR-008, CG-03-BR09; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-03 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: On verified final authorized decision matching the frozen source revision, CG-03 records one unique owner-effect claim and calls the protected CG-01 finalizer with stable key. CG-01 revalidates current account/role security and last-root rule and commits at most one change/audit. If CG-01 is unavailable/unknown after commit CG-03 remains PENDING_OWNER until actual confirmed effect, no fake active state or duplicated grant; no branch/member/provider/payment outcome is required.
QA cases:
- **US-003-QA01:** Approve real CG-01 protected access-change case with matching revision; verify one authorized CG-01 grant and access-audit record, CG-03 final decision and actual OWNER_COMPLETED status on permitted Web/Internal Android. No branch/member/provider master is created.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs U11, U12, U13, B29, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — finalization regression:** Replayed final decision, timeout and duplicate owner callback use same owner effect key and create at most one CG-01 grant/audit; stale source digest, last-root policy, revoked final authority and forged callback are denied.
- **US-003-QA08 — actual owner outage/race:** Concurrent final reviewers and duplicate callbacks while CG-01 finalizer temporarily unavailable → one signed final case decision, one pending owner-effect record, then one CG-01 authorized grant on recovery. Never assert a member/branch/provider ID, payment or other future owner effect that does not exist.
- **US-003-QA09 — source/decision revision:** Replay FINAL_APPROVED after CG-01 unknown write status; query CG-01 with the original immutable finalization key and preserve PENDING_OWNER until verified, then owner confirmed exactly once. Older approved CG-03 case cannot apply to newly edited source revision; future branch/member outcome NOT_APPLICABLE until delivered.
Verification: On actual implementation source-trace US-003-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
