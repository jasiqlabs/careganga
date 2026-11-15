# CG-05 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Create/maintain projects, responsible staff, locations, dates, budgets…

Outcome: Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards.
Requirements: FR-012, CG-05-BR01, CG-05-BR02, CG-05-BR03, CG-05-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create real branch-scoped project, task ownership, dates and related funding reference; statuses reflect actual approval. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, create real branch-scoped project, task ownership, dates and related funding reference; statuses reflect actual approval. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — Source-specific boundary:** Create a scoped project with a planned CG-09 budget but no verified expense; project list shows allocated versus utilized truth without independent amount edits, and CG-18 sees no public teaser until approved publication.
- **US-001-QA08 — transferred branch owner QA:** With genuine active CG-02 branches, create and transfer one CG-05 project using allowed branch selector; owner records keep current branch and history, permissions scoped before/after transfer, foreign/closed branch and concurrent stale edit denied. CG-02 does not create a second project association/master and actual CG-09 budgets remain a read-only finance source.
- **US-001-QA09 — transferred public project owner QA:** Create real CG-05 approved project in actual CG-02 branch with source CG-09 budget if genuinely available, then introduce safe project name/status/dates/category into CG-18 C27–C30 editorial placement/Web/Public Android. No duplicate CG-18 project record/date/budget. Wrong branch, revoked permission, source project closure or changed date removes/revises public projection; original CG-18 Home works with no projects.
Verification: On actual implementation source-trace US-001-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Create, assign and monitor tasks, events and activities with owners…

Outcome: Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display.
Requirements: FR-013, CG-05-BR04, CG-05-BR05, CG-05-BR09, CG-05-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Assign task/event to real permitted operator and track completion evidence with correct project status. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, assign task/event to real permitted operator and track completion evidence with correct project status. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Source-specific boundary:** Reassign an overdue high-priority task between two real workers in different authorized branches; only permitted assignee/location is selectable, source due history stays correct, and revoked previous assignee cannot change it.
- **US-002-QA08 — transferred operational event owner QA:** With a real CG-05 approved event/activity, introduce actual safe event title/date/location/status into separately published CG-18 site/app Events/Updates and verify owner-sourced revision, withdrawal and privacy. CG-18 ordinary news still works with no CG-05 event; canceled/foreign/edited event is not an active public booking or invented seat/payment, and CMS never writes CG-05 event master.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Record geotag/GPS/location, check-in/out, photos/video, notes, documents…

Outcome: Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests.
Requirements: FR-014, CG-05-BR06, CG-05-BR07, CG-05-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-05 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Capture field visit with authentic GPS, check-in/out, photo/evidence and review history; no invented route. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, capture field visit with authentic GPS, check-in/out, photo/evidence and review history; no invented route. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — Module-critical regression:** Field worker refuses GPS access or loses connectivity during check-in/photo upload. Expected: the visit remains draft/pending/unverified with actual collected evidence and no invented route/time; later authorized sync/retry cannot create duplicate accepted visit or falsely complete approval.
- **US-003-QA08 — Source-specific boundary:** Record a field visit with denied GPS permission and a failed photo upload; mobile may preserve a safe draft but must not show verified check-in/evidence or complete supervisor approval until actual supporting data exists.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
