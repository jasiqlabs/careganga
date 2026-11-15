# CG-07 — Three independently deliverable full-stack stories and 60 manual QA scenarios

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning / GREENFIELD · **DESIGN_SOURCE_REVIEWED** for 3 stories with **60 uniquely identified planned QA cases (20 each)**, current content review/approval hashes recorded in `../../approvals.json` after final review. [Module](module.md), [PRD](../../prd.md) FR-017–019, [HLD](../../hld.md), [UI/UX](uiux.md), [DLD](dld.md), and original indexed A12–A18 Admin audit are mandatory.  
**Development gate:** Global PRD/HLD current-source REVIEW_REQUIRED; authenticated Harness resolver, genuine prior-owner code integration, independently qualified CRITICAL DB/privacy audit, actual migration/backup/restore/EXPLAIN, source code/Web/native/Play/PNG/video/p95/provider QA **NOT_RUN**. Delegated design-content approval does not mean formal READY/SOURCE_COMPLETE; all three implementation stories remain BLOCKED. Development uses one story, manual implement→expert review→fix→re-review→each QA source trace, updating only this tracker; no CI/GH Actions.

## Expert design-reviewed stories — not implemented or released

### US-001 — Original six-step campaign, exact approval and independent public publication

Outcome: Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication.
Requirements: FR-017, CG-07-BR01, CG-07-BR06, CG-07-BR07, CG-07-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Campaign+immutable revision+status PostgreSQL, NestJS typed CG-01/02/03/18 owner facades and CG-19 optional media, original A12–A15 responsive Admin wizard, public Next.js campaign detail and native Public Android current source. Optional real CG-05 project/event and CG-04 volunteer. Internal Android campaign editor/center portal NOT_APPLICABLE.
Acceptance: A real CG-01 Foundation operator starts a six-step A13–A15 general campaign without CG-05 project/CG-04 volunteer/CG-06 beneficiaries, saves/resumes, freezes a reviewed revision and obtains actual CG-03 campaign approval. Public Next.js and native Public Android only show current source when a distinct original CG-18 publication is effective; paused/cancelled/expired/private/consent-revoked campaign never retains a Donate CTA. Backend/source, both Web clients and native client must agree.
Implementation slices: Root-scoped campaign/revision/source migration → CG-01/02 guarded NestJS → actual CG-03 CAMPAIGN_LAUNCH + CG-19 optional media + existing CG-18 CMS_PUBLICATION receiving adapter → Admin A12–A15 → public Next.js campaign → native Public Android card/detail → 20 QA traces. General campaign has no CG-05/04/06/09/20/merchant dependency.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, create and save six-step campaign draft, submit to real review and publish only approved fields. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Check original A12–A15 campaign steps, KPI and published public source against indexed CareGanga colors/sidebar/header/cards/table/wizard/panel and allowed responsive Web/native Public Android presentation. Cover errors/role-hidden action/Back/TalkBack; actual PNG/video/pixel/device QA NOT_RUN.
- **US-001-QA07 — owner regression:** Pending campaign cannot appear on public page after stale cache refresh. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific workflow:** Resume the six-step campaign at media/team stage, submit with an invalid period and missing approval; display validation, then approved publish state separately, never expose a draft donor CTA.
- **US-001-QA09 — Real CG-05 project selection in campaign wizard:** Using actual CG-05 US-001 approved/active project, original A13–A15 Project & Category step selects permitted same-root project/branch in true CG-07 campaign; source missing leaves genuine general campaign usable. No duplicated project master, and CG-09 money not collected by campaign draft.
- **US-001-QA10 — Optional CG-05 event association and revocation:** With genuine CG-05 US-003 event, link authorized safe event to original campaign, reject foreign/closed/stale event and withdraw invalid public CTA after cancel. No inferred event registration, tickets, payment or exposed A05 visit/beneficiary data.
Verification: On actual implementation source-trace US-001-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: Actual CG-01/02/03/18 original source owners (CG-19 if media). CG-05, CG-04, CG-06, CG-09 money and CG-20 never required to create first general campaign.

### US-002 — General/campaign donation, trusted payment verification and one CG-09 posting

Outcome: Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states.
Requirements: FR-018, CG-07-BR02, CG-07-BR03, CG-07-BR09; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-07 donation intent/attempt/verified event PostgreSQL and trusted provider/manual backend validation; one original CG-09 posting facade; protected A16/A17 Admin Web, real public Next.js Donate/status and native Public Android Donate/status. CG-21 merchant only if online configured; no CG-19 issued receipt prerequisite or Internal Android cashier workflow.
Acceptance: A real general donation works with no campaign; authorized A17 manual evidence or genuinely configured provider verifies true money (correct merchant, amount, currency and signed event) and original CG-09 posts once. Link/PENDING/redirect/unknown states never equal paid, receipt US-003 is not a prerequisite, and current public Next.js/native Android and Admin A16/A17 reflect a truthful reconciled status.
Implementation slices: Donation/attempt/verified event/effect source migration → signed provider and authorized manual verifier → original CG-09 immutable posting → Admin A16/A17 → public Next.js Donate/status → native Public Android Donate/status → 20 QA traces. General donation has no US-001 campaign, CG-19 receipt or CG-20 MIS dependency.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, accept donor intent, verify actual provider payment/merchant/amount and post one genuine CG-09 journal. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Check original A16–A17 payment-link, manual proof and donation status against indexed CareGanga colors/sidebar/header/cards/table/wizard/panel and allowed responsive Web/native Public Android presentation. Cover errors/role-hidden action/Back/TalkBack; actual PNG/video/pixel/device QA NOT_RUN.
- **US-002-QA07 — owner regression:** Duplicate/late gateway events do not double-count confirmed donations. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Signed event replay without future receipt dependency:** Provider sends the same verified signed success twice after donor browser loses response. Exactly one donation accepted and one CG-09 immutable posting; donor status accurate and unchanged on replay. CG-19 receipt is a later US-003 issuance, not required to complete US-002; pending/failed excluded from received totals.
- **US-002-QA09 — Source-specific workflow:** Gateway returns pending then delivers the same valid callback twice while a manual payment link is also retried; only one verified donation is recognized with correct donor and merchant source.
Verification: On actual implementation source-trace US-002-QA01–QA09 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: Actual CG-09 finance posting owner and CG-01 Foundation policy; CG-21 configured merchant only for online provider. Original general donation requires no US-001 campaign or CG-19 PDF.

### US-003 — Issue correct authorized receipt, donation history and donor self-service

Outcome: Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress.
Requirements: FR-019, CG-07-BR04, CG-07-BR05, CG-07-BR06, CG-07-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-07 source-linked refund and own donor-safe projection, original CG-09 posted/reversal and CG-19 receipt/correction facade, A16/A18 Admin Web reports, protected donor Next.js and native Public Android receipt/history/net states. CG-18 current safe public campaign progress; no CG-20 MIS, second money ledger or Internal Android private donor editor.
Acceptance: Following one real original CG-09 POSTED donation, CG-19 issues one source-bound document only when eligible; protected donor can retrieve own valid receipt/history through Web and native Public Android. A16/A18 Admin reports and public safe net aggregates follow only actual original CG-09 journal/reversal, with one verified partial/full refund respecting remaining amount and linked CG-19 correction. CG-20 MIS and future donor master are not prerequisites.
Implementation slices: Refund request/source effect migration → CG-09 once-only reversal and CG-19 source-bound receipt/correction → Admin A16/A18 reports and refund → donor-safe Next.js receipt/history → native Public Android own receipt/history → 20 QA traces, preserving original CG-09/19/18.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, produce receipt from verified donation, enforce donor-scoped retrieval, and apply refund/reversal once. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Check original A16/A18 receipt/refund, donor history and net source against indexed CareGanga colors/sidebar/header/cards/table/wizard/panel and allowed responsive Web/native Public Android presentation. Cover errors/role-hidden action/Back/TalkBack; actual PNG/video/pixel/device QA NOT_RUN.
- **US-003-QA07 — owner regression:** Pending payment cannot generate receipt marked PAID. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Source-specific workflow:** Correct/refund an already receipted donation, including a partial refund; preserve old receipt history and post the verified refund reversal once, while campaign net progress and CG-09 books reconcile.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002 actual CG-09 confirmed posting and original CG-19 issued receipt/reversal facades; no CG-20 MIS or future donor identity.

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
