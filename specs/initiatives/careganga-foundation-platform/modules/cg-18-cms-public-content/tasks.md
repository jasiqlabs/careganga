# CG-18 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning / CURRENT_SOURCE_REVIEW_REQUIRED after CG-18 expert first-source/owner-transfer correction. Four original stories, PRD FR-066–069, original DLD/UIUX and receiving-owner integrations are under review. Full latest-hash delegated design approval pending.
**Development gate:** PRD/HLD current-hash REVIEW_REQUIRED; authenticated Harness resolver, independent database/SQL/migration/restore, code-review, real Web/Public Android and original pixel/motion QA NOT_RUN. No CI/GitHub Actions. Implementation remains BLOCKED.

## Expert-reviewed task definitions — pending latest-source delegated decision

**Approval truth:** Source corrections are not an authenticated Harness PASS or development authorization; exactly four CG-18 story definitions remain BLOCKED until current-hash delegated approval is recorded and all external gates are complete.

### US-001 — Publish original editorial Homepage/About/Hero/Team and CG-18 public navigation, without future project masters

Outcome: Publish original CG-18 homepage/About/Our Work/editorial public team/hero/SEO and separately versioned Login/Profile, Member Join and Volunteer Join flags with real CG-03 approval and CG-19 proof where media is used. US-001 introduces actual CMS_PUBLICATION case adapter **inside CG-03** and CG-18 draft media adapter **inside CG-19**; no assumed prior finance/CMS case. Effective public Web and Public Android read one snapshot. No CG-05 project master, CG-04 fake Join or CG-21 public toggle.
Requirements: FR-066, CG-18-BR01, CG-18-BR02, CG-18-BR03 (consented public biography), CG-18-BR04 (CG-05 later introducing operational project), CG-18-BR08, CG-18-BR09, CG-18-BR10, CG-18-BR11, CG-18-BR25, CG-18-BR26; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the publisher's responsive Admin CMS Web, original approved public navigation revision/source database/API, and public Next.js Web plus Public Android native consumer using the same effective revision. No native CMS Admin editor; actual Login belongs to CG-01 and future Member/Volunteer join to CG-04. No CG-21 configuration dependency or fake join flow.
Acceptance: With genuinely delivered CG-01+original CG-03/19, editor creates independent text-only Home/hero/About without future owner data; introduces actual CG-03 owner CMS approval process and, when media is used, genuine CG-19 original draft file source adapter, then drafts/previews/publishes independently. Public Login/Profile, Member Join and Volunteer Join are separate flags with one immutable CG-18 effective snapshot. The same published safe projection drives Web + Public Android; disabling/unpublishing hides it on both. Login uses genuine CG-01. Without CG-04 real join routes, the Member/Volunteer CTAs are NOT_AVAILABLE_FOR_PUBLICATION, not actionable fake forms; style matches C50 toggles and prevents stale/unauthorized publish.
QA cases:
- **US-001-QA01:** Starting from actual authorized actor and implemented owner record: create/edit/preview/approve/publish real homepage/About/Our Work content with source-preserving navigation and media. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — source-owned public toggles:** Editor sets Login/Profile, Member Join and Volunteer Join independently, saves/preview/reviews/publishes one effective revision; Web/Public Android render only genuinely available published destinations. Login works via CG-01; without delivered CG-04 registration target both joins are unavailable; no CG-21 mirror or fabricated join.
- **US-001-QA08 — public/nav regression:** Unauthorized or revoked publisher, stale revision/replayed publish, public Web/Android stale cache and forbidden deep link are denied/updated correctly. Unpublishing removes CTA on both while backend auth still guards target. Verify C50 source styling, native accessibility, no private/draft URL and no fake Join activation; runtime/visual/native QA NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Publish ten original Impact groups and proof-bound 80G/registration disclosures

Outcome: Publish the ten original U23–U29 editorial Impact groups (hero, pillars, stats, growth, geography, breakdown, focus, stories, updates, CTA) with explicit data origin and consent; maintain U30 80G/PAN/registration/annual report pages and CG-19 validated proof, no invented CG-05/07/17/20 data or statutory validity assertion.
Requirements: FR-067, CG-18-BR12, CG-18-BR13, CG-18-BR14, CG-18-BR15, CG-18-BR16, CG-18-BR17; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns responsive Admin CMS Web/editor, public responsive Web, Public Android *content consumer* of the approved effective page and root-scoped API/DB. No native CMS Admin editor, no other owner's operational data master. Implement all required BR fields, real references and domain rules, not mock future owners.
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

### US-003 — Publish original gallery, media, articles, public Contact and separately approved CG-19 notices

Outcome: Publish editorial gallery/video/publications/blog/news and ordinary *editorial updates*, with actual CG-19 validated file, existing CG-19 Foundation public Contact/receipt and separately approved allow-listed CG-19 notice/FAQ source. Operational CG-05 events are introduced/tested by CG-05 US-002 later; CG-18 stores no operational event, private enquiry, notice recipients/delivery or original media bytes.
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
- **US-003-QA07 — genuine CG-19 media source:** Publish gallery/article with a real CG-19 VALIDATED safe media ref and authorized CMS scheduled/publication status; a private/scan-pending/expired file is never publicly exposed and unpublishing invalidates its CG-18 route without changing CG-19 object audit.
- **US-003-QA08 — moved public contact and notice ownership:** From a live CG-19 Foundation contact endpoint, the approved CMS Contact page embeds the same form/opaque receipt without any CG-18 contact-message row or inbox. From a real approved CG-19 operational notice, separately publish/withdraw a safe CG-18 public projection, never edit CG-19 original recipients/outbox/provider history or show a private internal notice publicly. CG-19 unavailable/denied returns truthful page state, no fabricated intake/delivery.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-004 — Independently publish healthcare editorial landing and neutral categories only

Outcome: Publish a genuine Foundation healthcare editorial hero, neutral category cards, general explanation and safe informational destination on public Web/Public Android **with zero actual CG-14/15/17 records**. No provider list/search/doctor/fee/booking/support-percent appears until later owners introduce verified source publication into CG-18 slots.
Requirements: FR-069, CG-18-BR18, CG-18-BR19, CG-18-BR20, CG-18-BR21, CG-18-BR22, CG-18-BR23, CG-18-BR28; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-18 owns the full responsive Web/no owned native Android screen (NOT_APPLICABLE)/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: With CG-01, real CG-03 review/CG-18 source and no CG-14/15/17, editor independently publishes static healthcare landing/categories in Web/Public Android without fabricated provider/doctor, rating, fee, discount or bookable slot; later integration belongs to CG-14 US-004/005, CG-15 US-002/004, CG-17 US-007. Revocation, stale cache and CTA safety are enforced before final publication.
QA cases:
- **US-004-QA01:** Starting from actual authorized actor and implemented owner record: show only genuinely approved/published provider/doctor/service directory data when owning CG-14/17 sources exist. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-004-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — independent source and later-owner split:** Publish original safe static healthcare hero/category/neutral copy with real CG-18 publication and zero CG-14/15/17 rows; public Web/Android show it without a provider, fee, benefit percent, search or Book action. Later CG-14/15/17 modules must introduce their own approved real directory, booking and eligible-benefit integrations/QA; do not mark those later scenarios complete within CG-18.
Verification: On actual implementation source-trace US-004-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
