# CG-08 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DESIGN_SOURCE_REVIEWED; current SHA-256 approval record required; formal Harness resolver, independent CRITICAL DB, actual code and live QA NOT_RUN;  [module](module.md), [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Complete three-story design-source review; planned QA only, implementation blocked

### US-001 — Capture organization, contact, proposed support, proof/agreement

Outcome: Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process.
Requirements: FR-020, CG-08-BR01, CG-08-BR02, CG-08-BR03, CG-08-BR05, CG-08-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Actual CSR partner identity/application/status and protected contact/agreement. Integrate original CG-03 reviewer case and original CG-19 file authority inside these owners. Responsive Foundation Admin Web CSR B02, optional public-safe CG-18 editorial only after separate approval; **native CSR admin NOT_APPLICABLE**. No CG-05 project/CG-09 cash needed.
Acceptance: Register real CSR partner/contact with protected agreement, verified scope and genuine proposal. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, register real CSR partner/contact with protected agreement, verified scope and genuine proposal. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner regression:** Duplicate partner and unrelated reviewer cannot expose agreement. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-001-QA08 — Source-specific workflow:** CSR company supplies organizational proof and agreement but is returned for missing documentation; only the reviewer can finalize verified partner, and public partner listing remains unpublished.
- **US-001-QA09 — First CSR partner without any project:** With original CG-01 Foundation role, CG-02 root and true CG-03/19 access, register signed CSR organization/contact, submit for verified CG-03 CSR_PARTNER_REVIEW; no CG-05 project, CG-09 receipt, CG-07 donation or CG-20 report exists.
- **US-001-QA10 — Genuine protected proof:** CG-19 validates actual license/CSR registration/agreement file via scan/rights/expiry; old/foreign/unsafe or confidential CG-19 attachment may not appear in public CG-18 logo or unauthorized CSR export.
- **US-001-QA11 — Original approval authority:** CG-03 CSR_PARTNER_REVIEW case/remarks/digest/decision are created in real CG-03, and CG-08 applies one final source effect; old version, self-approval, denied reviewer and case retry do not create a second approval master.
- **US-001-QA12 — Contact privacy and scope:** Verified two different Foundation roots with similarly named CSR partners remain separate; privileged current partner manager alone sees private registration/contact/bank evidence, public/center/volunteer actor denied.
- **US-001-QA13 — Correction instead of duplicate partner:** Reviewer returns application with remarks; applicant edits valid fields/new immutable revision, resubmits new approval with historical correspondence preserved, without duplicate partner or forged document.
- **US-001-QA14 — Natural-source invalid input:** Reject empty legal name/invalid contact/unsafe link/oversized upload/bogus registration number and forbidden duplicate normalized legal identity with helpful field errors and no fake partner activation.
- **US-001-QA15 — Duplicate/concurrent application:** Two submissions or lost review response with same root/source key converge to one partner/source case; new payload/different digest conflicts, no doubled CRM person/CG-01 account.
- **US-001-QA16 — CSR partner status versus public CMS:** Approved CSR partner does not automatically publish logo/support claim; only CG-18 current approved editorial safe projection can make public partner info visible, with sensitive contact hidden.
- **US-001-QA17 — Center/branch authorization:** A CG-02 branch-limited actor can only view/create a permitted CSR proposal from true Foundation branch; applicant selector and export do not expose other regions' contacts or private agreements.
- **US-001-QA18 — Original B02 CSR Admin UI:** Source B02 partner record/application, B03–B08 overview/review history consistent with CareGanga original navy sidebar/blue selection, KPI/filter/status table/right-side verified details and readable human error; visual pixel/render QA NOT_RUN.
- **US-001-QA19 — CRITICAL PostgreSQL migration:** Validate root+partner composite FKs, uniqueness normalized source key, immutable revision/case digest and index(root,verification_status,created_at), CAS race and backup/restore (real SQL/EXPLAIN independent QA NOT_RUN).
- **US-001-QA20 — Complete original owner trace:** File:function source review for B02 Admin Web → CG-01 role/CG-02 scope → CG-19 protected agreement → CG-03 original approval → CG-08 scoped PostgreSQL → separate safe CG-18 publication; native CSR Admin N/A, no runtime/visual PASS.
Verification: On actual implementation source-trace US-001-QA01–QA20 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Record funding proposals, documented CSR/Foundation commitments, received…

Outcome: Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance.
Requirements: FR-021, CG-08-BR03, CG-08-BR04, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Original CG-08 source proposal, approved commitment/split, optional real CG-05 project, current genuine CG-03 agreement review, protected CG-19 docs and original CG-09 verified money+budget allocation. Admin B03–B08 form/report source. No shadow CG-09 journal or CG-05 budget, no native CSR Admin app.
Acceptance: Keep requested/committed original CG-08 funding distinct from original CG-09 verified received/allocated/utilized money; a general Foundation proposal does **not** require CG-05, while any project-linked proposal requires the actual eligible CG-05 project. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, keep committed/received/allocated/utilized CSR funds distinct using CG-09 and actual CG-05 project. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner regression:** Two reviewers cannot over-allocate the same approved pledge. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-002-QA08 — Critical integrated scenario:** An approved CSR partner commits funding but bank receipt is not verified, while manager attempts to allocate it as received cash. Expected: proposal and commitment can be shown, Finance cash remains unchanged, allocations cannot exceed actually available approved funding and labels distinguish pledged/received/utilized.
- **US-002-QA09 — Source-specific workflow:** Foundation and CSR each commit a split amount, but only CSR money is bank-received; allocation choices cannot treat unreceived Foundation pledge as spendable bank funds.
- **US-002-QA10 — Real CG-05 project in CSR original source:** With actual eligible CG-05 active same-root project and genuine CG-08 approved proposal/CG-09 original finance budget, link project to CSR funding and safely allocate authorized amount through CG-09 only. Reject closed/transferred/foreign project, duplicate replay and split over budget; draft pledge is not bank money.
- **US-002-QA11 — No independent project money master:** For 70/30 approved CSR project split, original CG-09 budget_event/journal is sole utilized/available financial authority; compare CSR proposal/receipt/allocations and CG-05 read-only budget panel to true posted finance sources. No duplicate CG-08 utilization balance.
- **US-002-QA12 — General purpose funding without project:** Verified CSR sponsor can pledge legitimate Foundation program/purpose with no CG-05 project and no CG-09 receipt; requested/committed source is usable independently and not counted as received Foundation cash.
- **US-002-QA13 — Actual CG-05 project optional:** With actual CG-05 eligible project, link approved same-root/branch project and current version to proposal/CG-09 allocation; no CSR project creation, fake global project budget or forbidden center scope.
- **US-002-QA14 — Mixed CSR/Foundation split:** Signed 70/30 split over one proposal sums to precisely 100% with same currency and rounded minor units; invalid total/negative/zero/currency mismatch blocked and Foundation 30% pledge not silently converted to cash.
- **US-002-QA15 — Two CSR sponsors to one project:** A real CG-05 project accepts permitted two sponsor commitments, separate agreement/due/status and finance refs; CG-09 accepts only eligible project/category allocation within original approved budget, no duplicate fund utilization.
- **US-002-QA16 — Signed pledge versus original received cash:** Approve agreement but omit bank receipt, verify CG-08 COMMITTED and CG-09 zero received; only actual verified bank evidence and original CG-09 one balanced POSTED creates received amount.
- **US-002-QA17 — Duplicate or provider-unknown receipt:** Replay genuine same bank/merchant receipt or lose response after CG-09 post, CG-08 queries original CG-09 source key/digest and one original amount, never duplicates journal/receipt/CSR allocation.
- **US-002-QA18 — Allocation and utilization owner boundary:** CG-08 allocation request is proposed association; CG-09 alone approves/posts real allocation/utilization and rejects unreceived or restricted funds, no independent CG-08 utilized_amount balance.
- **US-002-QA19 — Correction and inactive project:** Withdraw CG-05 project or amend old approved proposal while committed/received money exists; new allocations blocked, historical original CG-09 sources preserved, adjustments/reversals linked without mutating previous proof.
- **US-002-QA20 — B03–B08 end-to-end source QA:** Trace signed partner/agreement → genuine CG-03 CSR_FUNDING_REVIEW → optional current CG-05 project → original CG-09 received/allocation/utilization → Admin Web proposal/split/finance truthful status, current scope and DB constraints; live money/SQL/browser QA NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA20 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001 only for CSR-partner pledge; genuine Foundation self-funding/general-purpose path can use independently approved CG-01/02/03/09 sources without CG-05 project. CG-09 becomes required only to claim actual received or allocated money; CG-19 protected agreement when used.

### US-003 — Report approved, pending, committed, received and utilized contributions…

Outcome: Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval.
Requirements: FR-022, CG-08-BR05, CG-08-BR06, CG-08-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Original CG-08 partner/proposal source and original CG-09 received/allocated/utilized status report, actual CG-05 safe project where linked, current CG-18 approved public attribution only when published. B02/B03–B08 responsive Foundation Admin reports/export. CG-20 generic MIS and native CSR Admin NOT_APPLICABLE.
Acceptance: Reconcile partner reports to authoritative received fund and scoped project sources. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, reconcile partner reports to authoritative received fund and scoped project sources. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** Revoked, unauthorized or cross-scope actor opens a deep link, direct API, selector or export → server rejects without leaking protected data or mutating state; UI displays a safe denial.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B02, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner regression:** Refund or reversal updates report, not an unverified cached received amount. Assert relevant DB constraint/rollback, scoped API error, unchanged other-client state and correct user notice.
- **US-003-QA08 — Source-specific workflow:** Export a proposal report with pledged, committed, received, approved and utilized columns; compare to actual CG-09 journal/project budget and deny an unrelated branch or partner access to private company documents.
- **US-003-QA09 — Real source-based multi-sponsor report:** Two actual CSR partners and one CG-05 project show requested/approved/pledged/CG-09 posted received/allocated/actually utilized as separate numbers with correct sources, not doubled per sponsor.
- **US-003-QA10 — General purpose report without project:** Approved Foundation-purpose commitments without any CG-05 project still produce authorized partner/purpose/status report and exclude nonexistent project breakdown, without fake zero project selector.
- **US-003-QA11 — Restricted pending versus posted:** An approved but unpaid 70/30 agreement appears Committed/Pending Receipt with no bank-income or utilization in financial KPI. Once verified CG-09 posts, receipt/actual allocated and utilized update with exact snapshot.
- **US-003-QA12 — Wrong actor/root/branch private exports:** Revoked CSR staff, unrelated Foundation branch and public user attempt partner agreement/bank contact/finance export/read using guessed references; CG-01 scope + original CG-19 download + CG-09 data filter deny.
- **US-003-QA13 — Source-safe public partner attribution:** CG-18 separate approved CSR editorial placement is necessary for a public logo/success figure, historical/expired/withdrawn agreement removes unapproved claim from Web/native public editorial, no private agreement leaks.
- **US-003-QA14 — CG-09 cash reconciliation:** Compare real CG-08 commitments and original CG-09 posted receipt/refund, project allocation/utilization; partial/reversal correction adjusts report exactly once with stable original reference and currency.
- **US-003-QA15 — Pagination and timestamp filter:** Filter organization, period, branch, project/purpose, source stage; large CSR report uses indexed scoped cursor and stable totals, export permissions/PII masking and no full multi-root scan or idle scheduled broker.
- **US-003-QA16 — Actual UI error states:** B02/B03–B08 original CareGanga Web KPI/table/partner detail/finance breakdown distinguish confirmed empty, pending bank check, denied, missing project, data source unavailable and lost response, no fake green received total.
- **US-003-QA17 — CG-20 not prerequisite:** Generate accurate original CG-08 internal report while CG-20 generic MIS not yet present, then later CG-20 only consumes authorized original source-safe CSR projection; no second report/store.
- **US-003-QA18 — No cross-module double-counting:** Verify CG-07 donations and CG-17 patient-service Foundation contributions do not enter CG-08 CSR received figures without true original funding source and explicit policy; CG-09 remains one actual cash source.
- **US-003-QA19 — Database/public privacy and NFR:** Validate scoped report indexes, real CG-09 finance source joins via typed owner not duplicate direct journal master, latest approval and safe redacted logs, 100 concurrent reads/pagination; actual SQL/EXPLAIN/performance NOT_RUN.
- **US-003-QA20 — Story-level final regression:** Trace B02–B08 Admin/report/export → current CG-08 source→ genuine CG-03/05/09/19 and optional published CG-18 → authorized read, correct exact money and protected cross-branch/partner data; source code/DB/browser/visual/Play QA NOT_RUN.
Verification: On actual implementation source-trace US-003-QA01–QA20 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
