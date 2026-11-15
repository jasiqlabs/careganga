# CG-18 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT / OWNER_SCOPE_TRANSFER_APPLIED (15 Nov 2026): CG-18 owns Login/Profile, Membership Join and Volunteer Join public publication controls from CG-21. See [module](module.md), [PRD](../../prd.md) FR-066–069, [HLD](../../hld.md), [UIUX](uiux.md), [DLD](dld.md). Full CG-18 review/approval remains pending.  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Manage homepage, About/Our Work, projects, team, hero images/typography…

Outcome: Manage genuine homepage/About/Our Work content and CG-18-owned Login/Profile, Member Join and Volunteer Join public publication flags, with draft/preview/approve/publish controlling the same effective Public Web and Public Android navigation. No CG-21 public settings or fake CG-04 joins.
Requirements: FR-066, CG-18-BR01, CG-18-BR02, CG-18-BR03, CG-18-BR04, CG-18-BR08, CG-18-BR09, CG-18-BR10, CG-18-BR11, CG-18-BR25, CG-18-BR26; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the publisher's responsive Admin CMS Web, original approved public navigation revision/source database/API, and public Next.js Web plus Public Android native consumer using the same effective revision. No native CMS Admin editor; actual Login belongs to CG-01 and future Member/Volunteer join to CG-04. No CG-21 configuration dependency or fake join flow.
Acceptance: Editor can draft/preview/publish real homepage and separate Login/Profile, Member Join and Volunteer Join flags with immutable effective CG-18 revision. The same published safe projection drives Web + Public Android; disabling/unpublishing hides it on both. Login uses genuine CG-01. Without CG-04 real join routes, the Member/Volunteer CTAs are NOT_AVAILABLE_FOR_PUBLICATION, not actionable fake forms; style matches C50 toggles and prevents stale/unauthorized publish.
QA cases:
- **US-001-QA01:** Starting from actual authorized actor and implemented owner record: create/edit/preview/approve/publish real homepage/About/Our Work content with source-preserving navigation and media. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — source-owned public toggles:** Editor sets Login/Profile, Member Join and Volunteer Join independently, saves/preview/reviews/publishes one effective revision; Web/Public Android render only genuinely available published destinations. Login works via CG-01; without delivered CG-04 registration target both joins are unavailable; no CG-21 mirror or fabricated join.
- **US-001-QA08 — public/nav regression:** Unauthorized or revoked publisher, stale revision/replayed publish, public Web/Android stale cache and forbidden deep link are denied/updated correctly. Unpublishing removes CTA on both while backend auth still guards target. Verify C50 source styling, native accessibility, no private/draft URL and no fake Join activation; runtime/visual/native QA NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Publish editable Impact groups, geography/charts/stories with appropriate…

Outcome: Publish editable Impact groups, geography/charts/stories with appropriate provenance; maintain 80G/PAN/registration, annual and financial disclosure pages/documents.
Requirements: FR-067, CG-18-BR12, CG-18-BR13, CG-18-BR14, CG-18-BR15, CG-18-BR16, CG-18-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Publish approved de-identified impact sections only from true operational owner projections or genuine editorial content. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-002-QA01:** Starting from actual authorized actor and implemented owner record: publish approved de-identified impact sections only from true operational owner projections or genuine editorial content. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Source-specific contract:** Edit ten Impact groups and an 80G/PAN compliance page with authorized source/date and document; reject unauthorized patient story/invalid certification claim and keep old public version until approved.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Manage galleries, videos, publications, media, articles, updates, events…

Outcome: Manage galleries, videos, publications, media, articles, updates, events, notices and public enquiries with controlled fields, review, ordering, preview and status.
Requirements: FR-068, CG-18-BR05, CG-18-BR06, CG-18-BR07, CG-18-BR08, CG-18-BR24, CG-18-BR27; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Manage authorized public gallery, publication, video/news/event revision and media rights with clear publish state. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-003-QA01:** Starting from actual authorized actor and implemented owner record: manage authorized public gallery, publication, video/news/event revision and media rights with clear publish state. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-003-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — Source-specific contract:** Publish a media/gallery article with scheduled date, display order and visibility; an upload that is private or virus-scan pending is not offered as public media, and unpublishing invalidates public route.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-004 — Show approved directory/category cards, provider profiles, doctors, current…

Outcome: Show approved directory/category cards, provider profiles, doctors, current price/facility/benefit messaging; don't allow CMS to overwrite provider verification, scheduling or contribution ownership.
Requirements: FR-069, CG-18-BR18, CG-18-BR19, CG-18-BR20, CG-18-BR21, CG-18-BR22, CG-18-BR23, CG-18-BR28; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Show only genuinely approved/published provider/doctor/service directory data when owning CG-14/17 sources exist. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-004-QA01:** Starting from actual authorized actor and implemented owner record: show only genuinely approved/published provider/doctor/service directory data when owning CG-14/17 sources exist. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-004-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — Source-specific contract:** Create healthcare category/landing page editorial content before provider network is built, but render no fabricated center/doctor/percentage; when CG-14/17 sources are real, use their approved projection only, with actual price/status and source-owner tests.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
