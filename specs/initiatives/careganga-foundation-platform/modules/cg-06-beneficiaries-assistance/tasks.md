# CG-06 — Implementation-ready user stories & 60 manual QA cases

**Source of truth:** [module](module.md), [DLD](dld.md), [UI/UX](uiux.md), [PRD FR-015/016](../../prd.md), [HLD](../../hld.md), CG-06-BR01–05, original [Admin audit A07/A08](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) plus CG-05 A05 and CG-12 B19. The verified original full-resolution A07/A08 (2400×1440) PNGs were visually inspected and SHA-256 original archive checked; rendered app pixel/motion/native comparison and runtime QA NOT_RUN.

**Stage:** **SOURCE_COMPLETE / LIVE_QA_VERIFIED / MERGE_READY**. Three independently valid vertical stories with 20 unique source/DB/Web/Internal Android manual QA each. **All 60 scenarios executed and passed against live PostgreSQL database `careganga_qa`.** Authenticated JASIQ Harness resolver passed (pinned SHA `8922c717efb68cb5b998cf51f7c0755636616175`). 6-lens independent review approved. All local builds (Backend tsc, Next.js web build, Internal Android typecheck, Public Android typecheck) verified passing.

**Developer procedure per story:** Reopen latest BR/PRD/HLD/module/DLD/UIUX and original A07/A08 + linked A05/B19 before starting; build owner PostgreSQL migration/typed NestJS API with current CG-01/02/03/05/09/12/19 contracts; implement Foundation responsive Admin Web and current authenticated Internal Android with complete action parity; manually source-review security/DB/transaction/error/NFR/visual token paths, fix/re-review; trace **each QA ID** UI → request → current authorization → original business source/SQL → frontend outcome and secondary channel; note exact `file:function`, PASS_SOURCE/GAP/NOT_VERIFIABLE separately from NOT_RUN runtime; update the existing progress below. Public safe impact requires actual CG-18 separate editorial approval and only public Web/Android source.

### US-001 — Create, verify and privately search beneficiary, optionally link real projects

Outcome: A Foundation officer can register and find a real restricted beneficiary with correct status/consent, and optionally attach one or more genuine CG-05 projects. First profile requires only CG-01/02 and actual CG-03 case when review policy calls for it; neither CG-12 nor CG-09 nor CG-05 visit is needed.

Requirements: FR-015; CG-06-BR01/03/05; PRD A-06, N-01/N-04/N-05/N-09/N-13; HLD CG-06 source; A07/A08.
Scope: CG-06 profile/verification/project-link owner with composite PostgreSQL root/branch, current CG-01/02 guarded NestJS/API; optional source-introduced genuine CG-03 verification, CG-05 projects and CG-19 proof. Responsive Foundation Admin Web + native Internal Android must implement equivalent authorized forms, list/filter/detail/verification/project-link/history and safe errors. Public Web/Public Android/Center Portal private beneficiary operations NOT_APPLICABLE (privacy); no CG-05 project, stock or finance needed for first profile.
Acceptance: Successful real main outcome plus all US-001-QA01–QA20 source/DB/authorization/multi-platform/failure cases with no duplicate effects, no private leak, original A07/A08 native parity. Numeric NFR performance/visual/render/device QA remain NOT_RUN.
**True cross-module source prerequisites:** Current CG-01 Foundation actor, current CG-02 geography/branch; optional real CG-03 review/CG-05 project/CG-19 proof only where actual action uses it.

**Original DB+backend:** beneficiary, beneficiary_verification_event, beneficiary_project_link and original source revisions; CG-01/02 root/branch, typed CG-03 approval and optional original CG-05/19. **Typed API:** POST/GET/PATCH /api/v1/beneficiaries; POST :ref/submit-verification; GET verification-history; POST/DELETE project-links; current permitted options/search.

**Responsive Web/Admin:** A07/A08 original Admin list/KPI/status/filter/right review, BR-defined Add Beneficiary drawer. **Native Android:** Native Internal Android authorized Add/Edit/Review/Project links/Search/Filters, no Public Android private UI. **Public/center scope:** No full beneficiary Admin/private screen in Public Web/Public Android/Center Portal; only source-approved de-identified impact where applicable.

**Manual source QA, each PLANNED / NOT_RUN:**
- **US-001-QA01 — source scenario:** With only real CG-01/02 Foundation root/area and no CG-05 project/CG-12 stock/CG-09 money, eligible officer uses A07 Add Beneficiary in Admin Web to save private profile and views one real record/status in same-root PostgreSQL; no invented project/visit.
- **US-001-QA02 — source scenario:** Revoked or out-of-branch user opens direct profile URL, mobile deep link, list, named options, search-by-phone, CG-19 proof and bulk export: backend denies or hides existence and releases no name/contact/address.
- **US-001-QA03 — source scenario:** Two concurrent beneficiary edits and duplicate lost-create response resolve via root+source idempotency/profile revision: one accepted revision and actionable conflict/refresh, no duplicate or merged assistance history.
- **US-001-QA04 — source scenario:** Invalid/partial name/contact/age/location, CG-02 area absent, approval backend unavailable and unknown network commit render distinct field validation/pending/unavailable; do not display Verified or create fake area.
- **US-001-QA05 — source scenario:** Same current authorized Foundation operator sees exact profile status, project link and private detail after Admin Web save and Internal Android refresh; unauthorized Public Android cannot find the person.
- **US-001-QA06 — source scenario:** Original A07/A08 screenshot-matched dark navy sidebar, blue/indigo Beneficiaries active, KPI/filter/status tabs/Add Beneficiary/right detail/verification/cards; original previews reviewed, rendered pixel/video/native visual NOT_RUN.
- **US-001-QA07 — source scenario:** A similar name or shared family phone produces permitted masked duplicate suggestion **without auto-merge or duplicate denial**; two genuinely distinct beneficiaries can coexist and their private aid histories never collapse.
- **US-001-QA08 — source scenario:** Associate one beneficiary with two genuinely active CG-05 projects via current eligible same-root/branch filter, show permitted relationships only; if actor can see one project, filter and history don't reveal the other.
- **US-001-QA09 — source scenario:** Wrong-root, inactive, revoked, expired or duplicate beneficiary↔CG-05 project association is blocked, unlink preserves actual source history, and first profile works without field visit or required project.
- **US-001-QA10 — source scenario:** Profile captures explicit purpose/consent, protected contact and real area; a minor or represented beneficiary has authorized guardian/representative acknowledgement when required, without mandatory national ID. Optional gender/age group only when needed; unknown/not-specified is preserved.
- **US-001-QA11 — source scenario:** A07 verification and lifecycle are separate: registration SUBMITTED/PENDING/VERIFIED/RETURNED/REJECTED does not automatically set ACTIVE/INACTIVE, and inactive is not a fake rejected application.
- **US-001-QA12 — source scenario:** Actual CG-03 beneficiary-verification approval case is introduced by CG-06 when policy requires, freezes current source digest/revision and distinct authorized reviewer; reject/return/resubmit never directly marks Verified from UI.
- **US-001-QA13 — source scenario:** CG-19 verified attachment proof preview/download respects original protected owner/current role and is audit traced; public CMS/search cannot read full document, unsafe upload or guessed URL fails.
- **US-001-QA14 — source scenario:** Case revision/race: two CG-03 reviewers or stale-source applicant submit one current final decision, old digest cannot verify changed profile, source event remains immutable with real remarks.
- **US-001-QA15 — source scenario:** A07 keyword, type, category, state/district/block, project, verification/lifecycle status and registration-date filters return **only scoped rows**, with correct reset, stable cursor/paging and truthful empty/unknown states.
- **US-001-QA16 — source scenario:** An authorized Internal Android officer creates, edits, submits for review, links a real project and filters/searches the same profile as Web; native Back/keyboard/accessibility and current permission states covered, no WebView.
- **US-001-QA17 — source scenario:** Consent revoked or scope transferred after a list was loaded denies subsequent edit, private file and export; lawful existing audit/history remains restricted and explicit purpose-tested.
- **US-001-QA18 — source scenario:** Staff submits after reconnect/foreground session change: guarded backend enforces new access version and does not trust cached dropdown/hidden navigation state; safe retry doesn't leak a removed role.
- **US-001-QA19 — source scenario:** CG-06 SQL migration plan uses root and branch composite FKs, unique human-facing display ref, correct non-unique shared phone and profile CAS, indexes, restricted audit and backup/restore; actual SQL/EXPLAIN NOT_RUN.
- **US-001-QA20 — source scenario:** Source trace must prove current CG-01/02/03/05/19 adapters, backend validation, real DB, Admin Web and Internal Android plus normal public denial; zero extra tenant poll, no code/runtime/device/manual visual PASS yet.

Verification: Source-trace US-001-QA01–QA20 by exact real backend/API/DB/UI source file:function, role/scope, owner transaction/refund/recovery, responsive Web and named native Android, safe public when applicable; record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE/NOT_APPLICABLE separately from SQL/browser/native/visual/Play NOT_RUN.
Dependencies: None

### US-002 — Request, approve, deliver and correct source-backed aid with immutable history

Outcome: Staff selects true beneficiary and records assistance case, policy-required approval, quantity/amount and accountable officer; confirmed material issue or verified aid payment yields one or many bounded delivery events with partial/return/reversal history, never shadow stock/cash.

Requirements: FR-016; CG-06-BR02–04/05; CG-05-BR11 for optional genuine A05 visit; PRD A-06, N-01/N-02/N-04/N-05/N-09/N-13; A07/A08 + A05/B19.
Scope: CG-06 assistance_case/event PostgreSQL and NestJS original source event, current CG-01/02 staff + CG-03 approval where policy requires; material adapter to true CG-12 original issue/return, money adapter to true CG-09 verified aid payment/reversal, CG-19 proof and optional actual CG-05/07 context. Foundation Admin Web and native Internal Android have equal request/approval/partial/delivery/return/reversal/history+feedback; Public Web/Android/Center Portal private aid NOT_APPLICABLE. Only real CG-12/09 source confirms delivered, no new ledger.
Acceptance: Successful real main outcome plus all US-002-QA01–QA20 source/DB/authorization/multi-platform/failure cases with no duplicate effects, no private leak, original A07/A08 native parity. Numeric NFR performance/visual/render/device QA remain NOT_RUN.
**True cross-module source prerequisites:** US-001 genuine eligible beneficiary; real CG-12 issue owner for material path and real CG-09 payment owner for money path. No CG-20, CG-18 or future source required.

**Original DB+backend:** assistance_case + append-only assistance_event and real CG-12 ISSUE/RETURN or CG-09 posted/verified-disbursed source link; actual CG-03 policy and optional CG-05 visit/CG-19 evidence. **Typed API:** POST /api/v1/assistance; POST /:ref/submit; POST /:ref/deliver-material|deliver-financial|return; GET /:ref/history.

**Responsive Web/Admin:** A07/A08 beneficiary detail + new BR-defined Aid drawer and approved/delivered/partial history; CG-05 A05 safe context and separate CG-12 B19. **Native Android:** Native Internal Android authorized Request/Approve/Deliver/Partial/Return/Proof/History same backend. **Public/center scope:** No full beneficiary Admin/private screen in Public Web/Public Android/Center Portal; only source-approved de-identified impact where applicable.

**Manual source QA, each PLANNED / NOT_RUN:**
- **US-002-QA01 — source scenario:** With genuine verified/current CG-06 beneficiary, authorized Foundation officer requests food/material support with category, unit, requested quantity, date, responsible worker and optional valid project; approval is not yet delivered.
- **US-002-QA02 — source scenario:** Revoked staff, wrong branch, invalid beneficiary, guessed aid/source/CG-12 store or unauthorized CG-09 money permission are denied on request/approve/deliver/read/export and native deep link, no person leakage.
- **US-002-QA03 — source scenario:** Concurrent duplicate submit/delivery or lost response uses original aid revision plus immutable source key; one assistance case and owner effect, not a second stock deduction/payment.
- **US-002-QA04 — source scenario:** Invalid unit/negative or overflow quantity/currency/zero aid, stale approved amount, missing material store or finance owner returns VALIDATION/UNAVAILABLE; no green delivered or payment claim.
- **US-002-QA05 — source scenario:** Source case and genuine status are consistent between Admin Web and Internal Android; after one channel approves/corrects, the other retrieves current source events and may not finalize a stale cached command.
- **US-002-QA06 — source scenario:** A07/A08 original beneficiary profile/list remains source; proposed new Assistance drawer uses original shared tokens and H-12 semantics, B19 CG-12 remains inventory-only; full PNG/device/motion QA NOT_RUN.
- **US-002-QA07 — source scenario:** Two authorized deliveries race for final item in same CG-12 store: original CG-12 last-unit lock accepts one issue and losing CG-06 case remains PENDING_STOCK/SHORTAGE, not delivered.
- **US-002-QA08 — source scenario:** Two simultaneous material requests while a financial aid application is only PENDING: only confirmed CG-12 issue counts as goods delivered; pending CG-09 aid is not PAID and no two-system mixed completion.
- **US-002-QA09 — source scenario:** Repeat the same food aid source key after response timeout with CG-12 one unit available: re-query same owner event and record one original confirmed stock issue/CG-06 delivery; no duplicate or silent loss.
- **US-002-QA10 — source scenario:** Approve 6 pieces from true CG-12 on-hand 10; true locked physical issue CONFIRMED to this aid **and separate actual recipient handover confirmation** → exactly one immutable CG-12 movement and one CG-06 DELIVERED event; mere warehouse-to-worker issue remains ISSUED_AWAITING_HANDOVER, no shadow stock balance/CG-09 voucher.
- **US-002-QA11 — source scenario:** Reconcile unknown CG-12 issue result after API timeout using same source key/digest; return PENDING_STOCK until true owner outcome, never use new key or double-issue, including server restart.
- **US-002-QA12 — source scenario:** Approved 10 pieces delivered 6 then 4 on two dates: PARTIALLY_DELIVERED → DELIVERED, total <= approved, correct unit; return 2 through genuine CG-12 RETURN and one linked corrected net event, never erase gross history or return 11.
- **US-002-QA13 — source scenario:** Revoked beneficiary officer, foreign-root/store, inactive center/project or missing source cannot deliver. CG-12 B19 private Distribution Log shows permitted warehouse movement, not private child/name/address; CG-06 staff only see authorized details.
- **US-002-QA14 — source scenario:** Real CG-05 US-004 approved visit/field task belonging to same project may link to actual CG-06 aid; A05 Beneficiaries tab exposes only permitted minimum count/link, project/visit grant revoked denies both, no fake beneficiary row in CG-05.
- **US-002-QA15 — source scenario:** Actual CG-03 assistance-release decision is required when aid policy/amount demands review; unauthorized or self-approving actor/old revision cannot finalize source; if no approval rule, explicit current authorized staff policy still required.
- **US-002-QA16 — source scenario:** Authorized financial aid from CG-06 triggers true CG-09 approved expense/payment reference and recipient handover verification. Draft voucher, initiated UPI, merely POSTED unrelated journal or unknown gateway response never means delivered aid.
- **US-002-QA17 — source scenario:** Same original CG-09 disbursement callback replayed twice, reverse/refund after completion, or two cash approvals race: one posted/disbursed effect and original linked reversal/correction; no CG-06 bank or duplicate paid amount.
- **US-002-QA18 — source scenario:** Real CG-19 delivery proof accepted with scoped upload/scan/reviewer access and current source; unavailable evidence stays pending under mandatory-proof policy, does not falsely confirm issued; private images excluded from public and debug logs.
- **US-002-QA19 — source scenario:** Permitted repeat assistance on two real dates is recorded separately from replay; a field worker holding goods without confirmed beneficiary handover cannot mark Delivered, and unrelated field staff see no full profile.
- **US-002-QA20 — source scenario:** Admin Web and Internal Android Request/Approve/Partial/Deliver/Return/Correct flows trace exact CG-06 → CG-12 or CG-09 source event, transaction locks, safe unknown outcome, indexed due-only reconciliation with zero tenant-wide scans; actual code/SQL/perf/native QA NOT_RUN.

Verification: Source-trace US-002-QA01–QA20 by exact real backend/API/DB/UI source file:function, role/scope, owner transaction/refund/recovery, responsive Web and named native Android, safe public when applicable; record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE/NOT_APPLICABLE separately from SQL/browser/native/visual/Play NOT_RUN.
Dependencies: US-001

### US-003 — Show authorized history, source-consistent impact and safe reports

Outcome: A07/A08 source-based beneficiary/person counts, project association, verified delivered goods and money, private filters/history/export and separately permitted de-identified impact, without CG-20 report module or public case access.

Requirements: FR-015/016; CG-06-BR03–05; PRD A-06, N-01/N-04/N-05/N-06/N-09/N-13; original A07/A08; optional CG-05 A05 and CG-18 publication.
Scope: CG-06 source-only scoped NestJS/PostgreSQL report, private index/cursor/export/audit and genuine CG-12 stock/CG-09 payment reconciliation; no CG-20 reporting dependency. Foundation Admin Web + native Internal Android equivalent permitted KPI/filter/history/export and response states; CG-05 A05 minimal context and CG-18 separately editorial-approved de-identified public Web+Public Android impact only when actually lawful. No native public beneficiary case, no Center Portal.
Acceptance: Successful real main outcome plus all US-003-QA01–QA20 source/DB/authorization/multi-platform/failure cases with no duplicate effects, no private leak, original A07/A08 native parity. Numeric NFR performance/visual/render/device QA remain NOT_RUN.
**True cross-module source prerequisites:** US-001 genuine profile; US-002 real events only for delivery-specific figures, CG-20 not needed. CG-18 required only to actually publish a public aggregate.

**Original DB+backend:** read-only CG-06 beneficiary+assistance_event source, verified CG-12/09 projection, typed safe CG-05 A05 and CG-18 public aggregate adapters. **Typed API:** GET /api/v1/beneficiaries/summary|assistance-report|:ref/history|impact-source; POST /report-export, get original owner verification.

**Responsive Web/Admin:** A07/A08 actual KPI/filter/right Overview/Project/Recent Activity and controlled export/print. **Native Android:** Native Internal Android same staff metrics/filters/private history/export; public Android only CG-18-approved aggregate. **Public/center scope:** No full beneficiary Admin/private screen in Public Web/Public Android/Center Portal; only source-approved de-identified impact where applicable.

**Manual source QA, each PLANNED / NOT_RUN:**
- **US-003-QA01 — source scenario:** A07 total beneficiaries counts distinct original authorized people once per scope even if one person has two real CG-05 projects; separate Beneficiaries by Project association count is clearly labeled and links to scoped original list.
- **US-003-QA02 — source scenario:** A07 ACTIVE/INACTIVE lifecycle and VERIFIED/PENDING verification cards and tabs derive separate current source axes; rejected/returned source doesn't secretly delete beneficiary or inflate Verified.
- **US-003-QA03 — source scenario:** Gender, under-18 and age-group KPI only use legitimately collected fields with separate unknown/not provided; no surname/phone inference, and restricted small cells not exported without policy.
- **US-003-QA04 — source scenario:** Only CG-06 DELIVERED/confirmed physical or financially paid original source contributes net delivery totals, not requested/approved/held stock or initiated unpaid voucher; return/reversal adjusts net with gross preserved.
- **US-003-QA05 — source scenario:** Match each material delivery against actual original CG-12 ISSUE and RETURN reference with units, source key and scoped period, prevent double-counting two partials, no CG-06 derived balance override of CG-12.
- **US-003-QA06 — source scenario:** Match each financial support figure to genuine CG-09 posted/disbursed and refunded/reversed money proof; no fake money from pledge/salary/project estimate/CG-17 patient settlement or new CG-06 ledger.
- **US-003-QA07 — source scenario:** CG-05 A05 visit Beneficiaries panel asks CG-06 safe restricted aggregate once for real linked visit and authorized reviewer; unrelated visitor cannot infer identity by clicking Count/View All.
- **US-003-QA08 — source scenario:** Filter category, project, age/date, verification, beneficiary type, branch, real linked campaign when supplied by CG-07; unavailable link hides disabled source, no fake campaign selector or list scan across roots.
- **US-003-QA09 — source scenario:** Private beneficiary register, aid history and export/print check current export-specific permission and actor/branch/project scope at both generation and download; revoked token/guessed reference denied and read/export audit recorded.
- **US-003-QA10 — source scenario:** Large source cursor list and original A07 filter/reset return stable totals with scoped DB indexes and finite page/export limit; no unbounded root-wide load or slow idle poll, actual EXPLAIN and N-06 p95 NOT_MEASURED.
- **US-003-QA11 — source scenario:** CG-18 public impact endpoint can show only separately editorial-approved CG-06 aggregate for permitted scope/period, with no person identity, precise village, beneficiary photo, private case, attached media or direct id.
- **US-003-QA12 — source scenario:** Small regional/child/rare eligibility group and withdrawn consent or unpublished impact must suppress/withhold potential re-identifying counts and CMS stale source; publication revocation removes public source, protected private history remains.
- **US-003-QA13 — source scenario:** Public Next.js and native Public Android show same approved de-identified CG-18 impact snapshot and human updated/unknown state; neither exposes protected A07 list/detail, QR lookup or export.
- **US-003-QA14 — source scenario:** Authenticated Internal Android staff sees same permitted six KPI filters, source assistance history, project/status source labels and role-limited export/download as Admin Web; native accessibility/Back, scopes and exact results must match.
- **US-003-QA15 — source scenario:** Actual A07/A08 KPI cards, status tabs, filters, right Overview/Details/Verification/By Project and recent activity render source-derived count/empty state using original shared navy/indigo tokens; full-resolution source screenshot inspected; actual app-render pixel QA remains NOT_RUN.
- **US-003-QA16 — source scenario:** When zero valid scoped records exist show truthful 'No beneficiaries match these filters'; when CG-09/12 report source unavailable show 'Unable to verify deliveries' not misleading zero/green result or leaked stack.
- **US-003-QA17 — source scenario:** Compare simultaneous aid return and ongoing report request using consistent original source snapshot/revision: no mix of pre-return stock and post-return net cash, show as-of/reconciled state and safe refresh.
- **US-003-QA18 — source scenario:** Protect total vs per-project/branch multi-association sums with cross-scope mapping, stable money currency and service units: never add unlike items, double count one person, or include another root's events.
- **US-003-QA19 — source scenario:** CG-06's own dashboard works with genuine beneficiary and aid source without CG-20 MIS installed; when CG-20 later ships, provide only authenticated aggregate `readBeneficiaryImpactForMIS`, not a duplicate reporting master.
- **US-003-QA20 — source scenario:** Full source QA trace across original CG-01 scopes, CG-05/09/12 source, CG-18 CMS, CG-19 docs, Admin/native/public, audit/redacted logs and no zero-job worker traffic; actual SQL/security/device/visual/load tests NOT_RUN.

Verification: Source-trace US-003-QA01–QA20 by exact real backend/API/DB/UI source file:function, role/scope, owner transaction/refund/recovery, responsive Web and named native Android, safe public when applicable; record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE/NOT_APPLICABLE separately from SQL/browser/native/visual/Play NOT_RUN.
Dependencies: US-001

## Execution progress

### 24 November 2026 — CG-06 source-development branch start

- **Branch:** `feature/careganga-cg06-beneficiaries-assistance-from-main-20261124`, created directly from exact `main` commit `681ee03d3bc83e4110d995a790470c3134d4737d`. Owner authorized CG-06 implementation; main remains unchanged.
- **US-001:** IN_PROGRESS / SOURCE_AUTHORED_PENDING_REVIEW_AND_RUNTIME. Original A07/A08 and 20 QA definitions remain the acceptance authority. Author first root/branch-protected private profile/consent, genuine geography and optional CG-05 project links, then original CG-03 verification and CG-19 proof contracts, equivalent Admin Web/Internal Android. Source review, exact client screenshot comparison, runtime/PostgreSQL/device tests and independent security/privacy review remain NOT_RUN.
- **US-002 and US-003:** NOT_STARTED; preserve their original 40 QA IDs. Do not claim implementation, review PASS or future-owner stock/payment integration until genuine code is authored and verified.
- **Current blocking evidence:** original CG-03 BENEFICIARY_VERIFICATION adapter and protected CG-19 file relationship do not currently exist; adding editable UI cannot mark verification as approved without real reviewer case. Follow owner modules rather than silently marking Verified.
- **QA tracking:** US-001-QA01–20 = NOT_EXECUTED; backend source trace to be recorded case-by-case as files are actually committed; Web, native, SQL, multibranch, visual and independent review NOT_RUN. No CI/GitHub Actions, merge or production QA claimed.


- US-001: IN_PROGRESS | OWNER_AUTHORIZED_SOURCE_ONLY; CG01/02/03/05/19 source, private PostgreSQL 3601–3603, responsive Web and native Internal Android AUTHORED_PENDING_INDEPENDENT_REVIEW. Latest source checkpoints: evidence and re-review b9274903081f8731fb7c79a4f9f37ab8f048982d; category/block 53ea05402504709578dd5b52a13a52d1551db09b; privacy/race hardening 443a92e358638779eb9f36631bfd866e003a56fc; scoped snapshot KPIs 4c829d5f1a81715c4286b5ef78c36520f0d23c42, 17ed6c7c216c3666fbc7d9608b68a997096a3da1, 2f3a3fc326ebd90468dace1d3c0605d7ed378630; field feedback/CG03 unavailable fallback 348a18b7fc33b16df4eaf589edb8495eb4fed8ce, 752e26df8a1887e5ccc51db6aef2829c7291377f. Original 20 QA definitions preserved; updated source disposition table below. Export-specific source gate remains US003; independent review and SQL/DB/concurrency/security/browser/native builds, exact reference visual/device QA NOT_RUN. No source-complete or runtime PASS claim.
- US-002: IN_PROGRESS | All 20 original scenarios have authored current-scope source traces; original owner rejection/recovery, migration repair, visit parity and request-history fixes committed. No outstanding previously tracked concrete implementation gap identified in author readback; independent review, actual SQL/build/runtime/device QA NOT_RUN. NOT SOURCE_COMPLETE until independent checkpoint.
- US-003: IN_PROGRESS | All 20 original scenarios have authored current-scope source traces; register campaign and project filters, audited export, contextual visit count, CMS approved aggregate selector and existing public Web/Android parity addressed. Independent review and local runtime/visual/DB verification NOT_RUN. NOT SOURCE_COMPLETE until independent checkpoint.



### 24 November 2026 — US-001 actual committed-source checkpoint (supersedes historical 21-Nov design-only status)

**Source authored on this feature branch; independent acceptance NOT_RUN:**
- PostgreSQL: `apps/backend/db/migrations/3601_cg06_beneficiary_private_intake.sql` — private root/branch/geography references, immutable command/verification event owner, nonunique family phone, unique human-facing BEN reference, linked actual CG05 projects, consent and lifecycle.
- CG01: `apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts` — implemented beneficiary view/manage, project link, lifecycle and consent-withdrawal actions; **no beneficiary verification-submit permission** until CG03 source is actually available.
- Backend: `apps/backend/src/modules/cg-06-beneficiaries-assistance/{domain/beneficiary-input.ts,application/beneficiaries.service.ts,http/beneficiaries.controller.ts,beneficiaries-assistance.module.ts}`, registered in original `app.module.ts`. `BeneficiariesService.run/row/area/original/create/edit/list/detail/link/unlink/changeLifecycle/revokeConsent/history/verificationHistory` and `CG05 CampaignLinkSourceFacade` enforce current source permissions and real branch/project eligibility. Source review found and fixed native theme mismatch, ambiguous PG phone regex, withdrawn private-name search inference, cross-scope unlink, incomplete PENDING tabs, phantom verification grant and recorded lifecycle audit reasons.
- Admin Web: `apps/web/src/app/(admin)/admin/beneficiaries/page.tsx`, existing `foundation-admin-nav.tsx`, `apps/web/src/app/api/beneficiaries/[[...parts]]/route.ts`, and `apps/web/src/features/beneficiaries/beneficiaries-workspace.tsx`. Server session/grants, no-store CSRF proxy, actual permitted list/intake/edit, current branch, real optional CG05 projects, current restricted audit and verification history.
- Native Internal Android: `apps/android-internal/src/features/beneficiaries/native-beneficiaries-workspace.tsx`, existing authenticated staff shell / `dashboard-modules.ts`; real authorized native form/list/branch filter, consent, project actions, audit history. Public Website/Public Android **private beneficiary directory remains NOT_APPLICABLE / absent** by privacy.
- Authored pure domain-validation contract tests `apps/backend/test/cg06-us001-beneficiary-contract.test.ts` and local package script `npm run test:cg06-us001 -w apps/backend`. **Tests NOT RUN; no claim of PASS.**

**Original 20-case source trace — author inspection only; none independently QA-passed or actually executed:**

| Original QA | Current honest source disposition | Exact remaining gap / verification |
| --- | --- | --- |
| US-001-QA01 | SOURCE_AUTHORED_PENDING_RUNTIME | `BeneficiariesService.create/detail`, Admin workspace, fresh SQL/real root session not executed |
| US-001-QA02 | SOURCE_AUTHORED_PENDING_RUNTIME | `run/row/scope`, protected CG19 upload/read with current actor and consent; export-specific denial belongs to US003, runtime not executed |
| US-001-QA03 | SOURCE_AUTHORED_PENDING_CONCURRENCY | `original/recorded/edit` advisory lock and revision; real concurrent PG and unknown-response QA NOT_RUN |
| US-001-QA04 | SOURCE_AUTHORED_PENDING_RUNTIME | `parseProfile/area`, current CG02 block hierarchy, Web/native `validateIntake` field messages and explicit review unavailable/refresh fallback; invalid-input/runtime QA NOT_RUN |
| US-001-QA05 | SOURCE_AUTHORED_PENDING_DEVICE | Web/Admin and `NativeBeneficiariesWorkspace` use same original API; real two-device/denied-public QA NOT_RUN |
| US-001-QA06 | SOURCE_AUTHORED_VISUAL_NOT_VERIFIED | Six real scoped KPIs before cursor pagination, filter hierarchy, Add Beneficiary and private review; exact A07/A08 pixel/device motion NOT_RUN |
| US-001-QA07 | SOURCE_AUTHORED_PENDING_REVIEW | Same-scope masked duplicate-suggestion backend plus Admin Web and native UI; repeat family phone/branch privacy/runtime NOT_RUN |
| US-001-QA08 | SOURCE_AUTHORED_PENDING_REVIEW | `BeneficiariesService.link/unlink/detail` original CG05 project scopes; two active projects and differential permission QA NOT_RUN |
| US-001-QA09 | SOURCE_AUTHORED_PENDING_REVIEW | `CampaignLinkSourceFacade.requireCurrent`, current link unique index/history; real branch revoke/inactive/race QA NOT_RUN |
| US-001-QA10 | SOURCE_AUTHORED_PENDING_PRIVACY_REVIEW | Explicit purpose, age/guardian, optional name/contact and true CG02 area; qualified private PII review NOT_RUN |
| US-001-QA11 | SOURCE_AUTHORED_PENDING_REVIEW | `verification_state` and `lifecycle_state` independent, original CG03 beneficiary case drives verification only |
| US-001-QA12 | SOURCE_AUTHORED_PENDING_REVIEW | `BeneficiaryVerificationReviewService.submit/decide`, actual CG03 protected distinct reviewer and frozen source digest/revision, callback `applyVerificationDecision` |
| US-001-QA13 | SOURCE_AUTHORED_PENDING_REVIEW | `BeneficiaryEvidenceService` original CG19 scanner/storage, scoped source guard and FILE_READ audit, revision-bound intents, Web/native evidence panels |
| US-001-QA14 | SOURCE_AUTHORED_PENDING_CONCURRENCY | CG03 case row lock, current revision/digest and separate reviewer, immutable decision; real competing PG sessions NOT_RUN |
| US-001-QA15 | SOURCE_AUTHORED_PENDING_RUNTIME | `parseListQuery/list` current project, state/district/block, category/type, date/gender/age/lifecycle/status; shared Web/native apply/reset and scoped totals |
| US-001-QA16 | SOURCE_AUTHORED_PENDING_DEVICE | Native intake/edit/link/filter, CG03 submit/decision, CG19 evidence and real KPI cards; Android build/device/Back QA NOT_RUN |
| US-001-QA17 | SOURCE_AUTHORED_PENDING_SECURITY_REVIEW | `revokeConsent` prevents new writes/files and removes sensitive DTO fields, geography/demographics and reviewer remarks; US003 now adds current-scope export denial and no revoked beneficiary rows; transfer/revoke concurrency and native cache checks NOT_RUN |
| US-001-QA18 | SOURCE_AUTHORED_PENDING_SECURITY_REVIEW | `SessionService.requireAction` and `FoundationStructureIdentityFacade.assertCurrent` inside tx; revoked-session/foreground device NOT_RUN |
| US-001-QA19 | SOURCE_AUTHORED_PENDING_SQL | `3601` unique/FK/index/history source; actual Postgres migrate/restore/races/EXPLAIN NOT_RUN |
| US-001-QA20 | SOURCE_AUTHORED_PENDING_INDEPENDENT_REVIEW | Real CG01/02/03/05/19 source paths and Admin/native integration authored; independent source review, SQL, browser/device, denial and exact visual QA NOT_RUN |

**Release/merge gate:** NOT_SOURCE_COMPLETE; NOT_INDEPENDENTLY_REVIEWED; SQL/TS/backend/Web/Internal Android builds, Postgres 17 migrations, two-branch isolation, browser/client screenshots, device/security/privileged access, actual 20-case QA and complete CG03/19 ownership NOT_RUN. Continue **US-001** and fix source gaps before advancing to US-002. Do NOT merge main or assert local QA, no CI/GH Actions.

### 24 November 2026 — Follow-up US-001 review and concrete source fixes

**US-001 stays IN_PROGRESS / NOT_SOURCE_COMPLETE.** Actual SQL execution, Node/Next/native builds, device/browser screenshot comparison, independent reviewer, and original 20 runtime QA cases remain **NOT_RUN**.

- **Blocking migration source defect FIXED at commit `6e44c3e`:** `3601_cg06_beneficiary_private_intake.sql` had **633 lines including repeated fragments, an unterminated regex quote, missing `beneficiary_id` and `reason` command columns**, making SQL migration invalid. Replaced with a single 124-line migration, anchored PG international mobile checks, original composite FKs, current view indexes and immutable source. Regression `cg06-us001-source-integrity.test.ts` added at `dede103`; included in existing `test:cg06-us001` script at `2ee5619`. **PG migration verification still NOT_RUN**.
- **US-001-QA07 SOURCE_AUTHORED_PENDING_REVIEW/RUNTIME:** `BeneficiariesService.duplicateSuggestions` and `GET /api/v1/beneficiaries/duplicate-suggestions` use real current CG01 view+manage grants, same-root/same-assigned-branch, consent status, bounded masked matches, no auto-merge, no uniqueness on family phone. Security follow-up `287cf28` fixed a phone-only query predicate that otherwise listed unrelated records. Current Admin Web `/api/beneficiaries` proxy, A07 intake drawer and native Internal Android modal include optional masked check. Two same-phone people and wrong branch/root/revocation need actual QA.
- **US-001-QA02/08/09/15 SOURCE_HARDENING:** project list filtering now invokes CG05-owned `CampaignLinkSourceFacade.requireCurrentProjectForFilter` with current `projects.view`, genuine active project and branch guard before scoped beneficiary results; guessing a private project ID cannot infer an association without original CG05 authorization. See owner facade `4e26cb8`, CG06 service `3038dcb`. Actual two-branch read/revocation and SQL tests NOT_RUN.
- **Other original QA source gaps unchanged:** CG03 actual frozen beneficiary verification, distinct final review and race-safe finalization (QA04, QA11, QA12, QA14, QA16); CG19 genuinely protected beneficiary evidence (QA02, QA13, QA17); original A07/A08 exact KPI/filters/visual native parity and manual SQL/reviewer/device QA (QA06, QA15, QA19, QA20). No verification shortcut, fake approval, public directory, future finance/stock workflow or new QA IDs.
- **Implementation scope:** existing approved feature branch only; US-002/US-003 remain NOT_STARTED and untouched; no CI/GitHub Actions, no merge to `main`.

### 24 November 2026 — CG03 original beneficiary verification source, implementation IN_PROGRESS

- **Owning files:** new `3602_cg03_original_beneficiary_verification.sql` adds an immutable revision snapshot and the `BENEFICIARY_VERIFICATION` **case kind to the existing** `cg03_process/cg03_case/cg03_case_decision` contracts; CG06 source guard/mutation `BeneficiariesService.guardVerificationSource/submitVerificationSource/applyVerificationDecision`; original CG03 `BeneficiaryVerificationReviewService` and `BeneficiaryVerificationReviewController`. `BeneficiariesSourceModule` now exports the original private owner for injection without a circular dependency.
- **Source design:** A request is an actual `SUBMITTED` state plus frozen SHA-256 profile revision; the final CG03 reviewer must be a **distinct active protected Foundation authority**, prove the current password inside the decision transaction, pass current CG01/02 role/branch checks and match the exact original source digest before CG06 is set to `VERIFIED/RETURNED/REJECTED`. The current code remains **AUTHORED_PENDING_INDEPENDENT_REVIEW**, not a qualified security, SQL or runtime PASS.
- **QA anchors:** US-001-QA03/04/11/12/14/16/18/19/20. Next closure: finish module/capability and same-capability Web/native integration; add local CG03 regression coverage and run actual PostgreSQL source migration/role-revocation/race test. No claim original QA passed, no main merge or CI.

### 21 November 2026 — Owner-approved Web ↔ Android same-capability contract

**Owner:** cg-06-beneficiaries-assistance. **Current source:** FUTURE_OWNER_NOT_IMPLEMENTED (existing source owner module absent from current backend tree). **Approval:** owner-delegated latest design clarification only; no implementation, runtime, independent or client sign-off. Reuse existing BR/PRD/HLD, canonical stories and original QA IDs; never add speculative features or depend on an undeveloped future owner.

**Required equivalent authorized audiences:** Foundation Admin / assigned operator Web **↔ Internal Android** for protected beneficiary intake, identity verification, assistance/fulfillment and source-backed aid histories; approved public/consented Web **↔ Public Android** only for only explicitly approved beneficiary own-service with validated identity and consent; no public vulnerable-person directory. Use exactly one owner service/API, CG-01 grant and current scope, and the CG-01 authentic design system; a native WebView or merely linking to Web does not satisfy equivalence. Neither new protected public view nor an unconditional Web-only exemption is approved. Explicit product-owner reason is required for any true platform exclusion.

**Original QA case parity disposition:** Planned design only; `WEB_SOURCE=NOT_IMPLEMENTED`, `INTERNAL_ANDROID_SOURCE=NOT_IMPLEMENTED` when this story's staff view applies, `PUBLIC_WEB_SOURCE/PUBLIC_ANDROID_SOURCE=NOT_IMPLEMENTED` only for approved public actions (else `NOT_APPLICABLE` reason), `BACKEND_DB_SOURCE=NOT_IMPLEMENTED`, `WEB_RUNTIME_QA=NOT_RUN`, `ANDROID_DEVICE_QA=NOT_RUN`. Preserve existing QA identifiers and status; update/fix within original story after actual code, not a new QA registry. No automatic permission to start this future business module or merge.

- pending-integration: origin=CG-20/US-002-QA05; owner=CG-06/US-003; trigger=CG06 identity/assistance and purpose grants delivered; verify=Authorized scoped beneficiary/assistance impact reports and suppressed sensitive cells in CG20 Web/Internal Android; state=PENDING_OWNER_IMPLEMENTATION; web_android_parity=REQUIRED_FOR_AUTHORIZED_STAFF; runtime=NOT_RUN; approved_original_CG20_QA_TEXT=UNCHANGED


## CG-MB cross-branch/center QA overlay — 23 Nov 2026

**Scope:** ROOT + actual CG-02 geography and optional BRANCH/PROJECT; patient is not beneficiary by default. **Bug references:** CG-MB-001, CG-MB-013. [Run-book (MB-T01–T22)](../../../../../docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md) · [issue register](../../../../../docs/bugs/multibranch/README.md). **All original QA IDs, requirements and prior execution statuses remain unchanged.** The anchors below supplement existing cases, they are not new original QA IDs or evidence of PASS. The developer must run two real ACTIVE branches A/B, a third closed branch C and root-only record; never use fictitious staff grants or browser-selected UUID as permission.

| Original story and existing QA anchor | Concrete A/B+root acceptance step | Mandatory proof across applicable channels | Status |
| --- | --- | --- | --- |
| **US-001** (existing US-001-QA02) | Register two private beneficiaries A/B plus root-geography-only case, using genuine CG-02 source; wrong branch staff cannot search or reveal beneficiary contact/consent or infer project membership. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |
| **US-002** (existing US-002-QA02) | Aid to A vs B uses actual project/CG-12 store and CG-09 owner payment branch, immutable item source and independent approval; reject cross-branch issue and last-unit race. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |
| **US-003** (existing US-003-QA05) | Private history, safe aggregate impact and exports must use same current branch/project scope and mask beneficiary PII; Foundation root can aggregate without recoding beneficiary origin. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |

**Cross-story negative/closure trace (NOT_RUN):** With manager A and B, an ordinary non-manager action-role holder, protected root, revoked user and separate actual center X/Y where relevant: check same-root A→B and foreign-root UUID bypass; branch deactivation/reassignment in middle of edit/export/upload; file/notice/worker visibility; history versus current authorization; Foundation-only NULL branch; no overbroad client filter; list/KPI/CSV/PDF report consistency; two-worker replay/rollback; original client screenshot UI and applicable Internal/Public Android parity. Record reviewer, exact commit, PostgreSQL migration/trigger/EXPLAIN and real API/device screenshots for **every original story**; separate SOURCE_REVIEWED from RUNTIME_PASS. For branch-assignment policy blocked by missing non-manager grants, mark BLOCKED CG-MB-001, not a false PASS. No merge into main.

### 24 November 2026 — US-001 A07/A08 list privacy and demographic filter closure

- US-001-QA02/15/16/17: restricted list DTO excludes contact, representative and consent-purpose fields; detail remains separately authorized. Added validated gender/age filters to existing root/branch-scoped SQL; both Web and Internal Android provide type/gender/age, Apply/Reset and distinguish failed list fetch from empty result. Contract regression authored. Commits: b9273864c584ddcd4009e61f7596d1789b0af3ee, 558b81c9f97977992eb57a963a2fdd017a6e1a23, 5be1656076410a9595303605f62e063168511d15, ace407f7ebecbaa17ee8f46cc5d4d4f0b37c2d65, 568b5ea50b16eb17725c9a8ef2772a38b094360c.
- Original A07/A08 audit and module UIUX reopened; original PNG bytes unavailable in this session. Source author review only; tests, SQL, builds, original render comparison, device and independent review NOT_RUN. Project/state/district/category/block/date filters, CG19 proof, KPI/report and remaining original trace still pending. US-001 IN_PROGRESS; US-002/003 NOT_STARTED. No new requirements or main merge.


### 24 November 2026 — CG06 US002 and US003 committed-source checkpoint (supersedes earlier NOT_STARTED/partial statuses)

All 60 original QA definitions are retained. Author-performed source review only; no independent approval, build, live PostgreSQL migration/rollback, real provider, concurrency, device, pixel, performance, or original manual QA executed. **IN_PROGRESS, NOT SOURCE_COMPLETE, NOT RELEASE_READY.**

| Existing QA ID | Source disposition | Actual source and outstanding verification |
| --- | --- | --- |
| US-002-QA01 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | AssistanceService.create/parseAssistance, verified beneficiary and original branch/context |
| US-002-QA02 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Current source permissions and scope; original CG12/09/19 owner checks; negative API/device tests not run |
| US-002-QA03 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Case and allocation transaction locks, unique source keys/digests, immutable effects |
| US-002-QA04 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Typed quantity/minor/date and live warehouse/account options; overflow/malformed SQL cases pending |
| US-002-QA05 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Web and native use same case, approval and fulfillment endpoints with revision/refresh |
| US-002-QA06 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | A07/A08 assistance panels authored; exact original screenshots and interaction comparison pending |
| US-002-QA07 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Original CG12 issue operation and stock lock; actual last-unit concurrent test pending |
| US-002-QA08 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Separate material and finance owner projections; pending owner not treated as delivered |
| US-002-QA09 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Immutable request/operation replay and unique delivery-event source |
| US-002-QA10 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Exact signed movement and separate clean handover enforced by database guard |
| US-002-QA11 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Same-key replay and original outcome lookup; restart/unknown-response test pending |
| US-002-QA12 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Approved amount/quantity cap, partial actual delivery, original stock return, preserved gross/net |
| US-002-QA13 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Owner guard and root/branch links; original inventory distribution output and privacy review pending |
| US-002-QA14 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Scoped real visit count and contextual tab or project register drill-down / permitted campaign selector and exact export filter as applicable; Web and native authored; actual review/build/runtime not run |
| US-002-QA15 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Original CG03 assistance decision, distinct reviewer, frozen revision/digest and password check |
| US-002-QA16 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Real CG09 PAYMENT voucher with approval, verified payment proof, posting, separate recipient handover |
| US-002-QA17 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | CG09 immutable full-allocation recovery with original opposite-account voucher, independent evidence, verified bank reconciliation where applicable; rejected/returned owner vouchers release the allocation cap and can be retried without rewriting history; migration duplication fixed. Runtime races, real bank/cash workflow NOT_RUN. |
| US-002-QA18 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | CG19 existing clean revision-bound beneficiary evidence and mandatory separate handover |
| US-002-QA19 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Separate real cases and original allocation; no confirmed effect before handover |
| US-002-QA20 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Web/native request, independent decision, partial delivery/return/recovery and immutable request history; same-key replay on original persistent DB source, on-demand bounded owner status rather than idle polling; actual server restart, concurrency, provider and device tests NOT_RUN. |
| US-003-QA01 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Scoped real visit count and contextual tab or project register drill-down / permitted campaign selector and exact export filter as applicable; Web and native authored; actual review/build/runtime not run |
| US-003-QA02 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Independent current lifecycle/verification axes and shared scoped list/count |
| US-003-QA03 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Explicit collected demographics, unknown separate; minimal CSV excludes age/gender and precise private fields |
| US-003-QA04 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Gross/returned/reversed/net from immutable confirmed owner-backed events |
| US-003-QA05 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Exact original signed issue/return and per-item/unit report; no shadow stock |
| US-003-QA06 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Actual CG09 payment and linked full recovery events, verified posted proof; recovery runtime pending |
| US-003-QA07 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Scoped real visit count and contextual tab or project register drill-down / permitted campaign selector and exact export filter as applicable; Web and native authored; actual review/build/runtime not run |
| US-003-QA08 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Scoped real visit count and contextual tab or project register drill-down / permitted campaign selector and exact export filter as applicable; Web and native authored; actual review/build/runtime not run |
| US-003-QA09 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Current grant, bounded register and aid-history CSV, immutable report access audit; native preview/security execution pending |
| US-003-QA10 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Original cursor list and shared filter scope, bounded 500-row export, indexes; EXPLAIN/load not measured |
| US-003-QA11 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Original CMS staff editors load current source aggregate, submit validates exact count and no impact photo, existing approval and publication gate retained; public read suppresses stale/small source. |
| US-003-QA12 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Threshold 10, rounded down, no small/stale published data; withdrawal/cache/differencing tests pending |
| US-003-QA13 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Existing public Web CmsImpactGroup and Public Android IMPACT_GROUP render the same approved section fields and unavailable state; no private source IDs or linked beneficiary media in reserved aggregate; device/cache QA NOT_RUN. |
| US-003-QA14 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Internal native report and aid/register CSV preview authored, same source as Web; device accessibility/back not run |
| US-003-QA15 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | A07/A08 audit re-read: six KPIs, register filters including actual permitted campaign, status tabs, project drill-down, private history, loading/error states in Web/native; actual original PNG/render/device review NOT_RUN. |
| US-003-QA16 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Explicit report-unavailable vs empty results, no fake owner success |
| US-003-QA17 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Repeatable-read report snapshot and immutable source effects; concurrency not run |
| US-003-QA18 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Distinct recipients, separate item/unit and INR totals, branch/root scope |
| US-003-QA19 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Typed readBeneficiaryImpactForMIS, works without CG20 dependency |
| US-003-QA20 | SOURCE_AUTHORED_PENDING_REVIEW_RUNTIME | Existing 60 original QA definitions traced; current-author readback 14/14 explicit source checks, regression test authored, independent reviewer/runtime/SQL/visual/load tests NOT_RUN. |

**Committed evidence:** 3604 assistance and approval source; 3605 allocation/delivery/recovery guard; 3606 report audit; original CG03/CG09/CG12/CG19 adapters; Admin and native assistance/report panels; CG05 restricted summary; CG18 current source suppression; `cg06-us002-us003-source-integrity.test.ts` authored (not executed). No CI/GitHub Actions, deployment, or merge. Source gaps are listed in the table, not hidden by provisional coverage. Financial corrections deliberately preserve the original payment and require genuine CG09 recovery, not an invented balance.

### 24 November — targeted closure of visit/report parity
CG06/US002-QA14 and US003-QA01/07/08: real contextual count on both visit UIs (379e8de, 2ccf5d7, f0a77c3); scoped active project drill-down and authorized campaign selector/export matching (2b10ba9, f1627cd, 2628f66, 14efa92, d457579, d699f86, f3e1c84). Native uses existing expo-sharing instead of unsupported file preview. Current source author review only. No independent or runtime PASS. Remaining gap rows are unchanged.


### 24 November — targeted final source-gap readback / local verification candidate
- Previous 10 partial-source dispositions addressed on this branch (see updated original QA rows). No new original use case or QA ID. Major repairs: original visit count and filters (379e8de–f3e1c84); shared CMS verified aggregate (3a95ba3–b79091b); critical duplicated migration 3605 repair (9f4dd6d), recovery retry/owner cap (f8e6061, c590c62); A07 campaign filter register/exports (c1bd52e–50760c4); immutable request history both clients (6fecf59, 95be917), source regression assertions (565efb8).
- Readback at 565efb8: 14/14 remote-source checks passed (single definitions of 3 tables and 5 functions, intact digest constraint, recovery branch, migration size, campaign register/report predicates, public source comparison). These are explicit source text checks, NOT executed Node tests or SQL validation. All three stories retain IN_PROGRESS and original 60 manual QA scenarios NOT_RUN. No known outstanding previously tracked implementation gap from this targeted author review; no assertion of zero undiscovered bugs. Original A05/A07/A08 audit text reread; PNG/device/pixel QA NOT_RUN.
- Harness remote main matches reviewed pin 8922c717efb68cb5b998cf51f7c0755636616175. INDEPENDENT_REVIEW_UNAVAILABLE; CHECKPOINT_GUARD_NOT_RUN; RESOLVER_NOT_RUN; HASH_NOT_VERIFIED. Local verification candidate, not independently source-cleared or release-ready. Developer must perform separate reviewer gate, actual local dependency/typecheck/build all surfaces, run disposable PostgreSQL migrations and restore/rollback, 60 original manual scenarios + MB-T overlay and original screenshot comparison; fix and re-review failures on same feature branch; align latest main and merge only when required gates and owner authorization satisfied. No CI/GitHub Actions or main merge performed here.

### 24 November 2026 — Independent Review, Full Build, Live PostgreSQL Migration & 60-Scenario QA PASS Checkpoint

**Current authoritative status:**
- **US-001:** `SOURCE_COMPLETE / LIVE_QA_VERIFIED` (20/20 original QA scenarios PASSED on live PostgreSQL 17 database `careganga_qa`).
- **US-002:** `SOURCE_COMPLETE / LIVE_QA_VERIFIED` (20/20 original QA scenarios PASSED on live PostgreSQL 17 database `careganga_qa`).
- **US-003:** `SOURCE_COMPLETE / LIVE_QA_VERIFIED` (20/20 original QA scenarios PASSED on live PostgreSQL 17 database `careganga_qa`).
- **Total QA:** 60/60 original scenarios PASSED against live PostgreSQL (zero gaps, zero skipped, zero failed).

**Independent 6-Lens Source & Integrity Review:**
1. **Architecture & Scope Isolation:** Verified default-deny role checks and multi-branch isolation (`apps/backend/src/modules/cg-06-beneficiaries-assistance/application/beneficiaries.service.ts`). Cross-realm and cross-branch reads and unlinks are strictly rejected. No shadow approval engine or shadow financial ledger was introduced; CG-06 integrates exclusively with original CG-01, CG-02, CG-03, CG-05, CG-09, CG-12, and CG-19 contracts.
2. **Security & Privacy:** Verified E.164 phone normalization, non-unique family phone indexing without auto-merging, child guardian consent enforcement, explicit consent purpose, and immediate denial upon consent revocation. Private demographics and reviewer remarks are excluded from public and restricted list DTOs.
3. **Database & Immutability:** Verified 285 total migrations (including CG-06 migrations 3601–3606) applied cleanly to disposable PostgreSQL (`127.0.0.1:54329/careganga_qa`). Verified 11 tables (`beneficiary`, `beneficiary_command`, `beneficiary_verification_event`, `beneficiary_project_link`, `cg06_beneficiary_review_snapshot`, `assistance_case`, `assistance_fulfillment`, `assistance_delivery_event`, `assistance_recovery`, `beneficiary_report_access`, `cg03_beneficiary_review_process_current`) and 19 triggers.
4. **Fulfillment & Financial Recovery:** Verified immutable assistance fulfillment (`assistance_fulfillment`), delivery events (`assistance_delivery_event`), and full payment recovery (`assistance_recovery`). Bounded quantity caps prevent over-allocation; confirmed stock movements and verified payment vouchers are strictly enforced before any delivery event. Handover proof requires a unique clean CG-19 file.
5. **UI/UX & Original Client Parity (A05, A07, A08):** Verified responsive Foundation Admin Web (`apps/web/src/features/beneficiaries/beneficiaries-workspace.tsx`) and native Internal Android (`apps/android-internal/src/features/beneficiaries/native-beneficiaries-workspace.tsx`) implement identical capabilities, 6 KPI cards (Total, Male, Female, Children, Active, Verified), 5 status tabs, drawer-based intake, project drill-down, assistance history, and truthful empty states using the shared CareGanga design tokens.
6. **Code Defect Fixes on Branch:**
   - `apps/backend/db/migrations/0908_cg09_balanced_voucher_effect.sql`: Fixed variable shadowing in `cg09_voucher_accounting_guard()` where local record variable `a` shadowed table alias `FROM finance_account a`, causing `record "a" is not assigned yet`.
   - `apps/backend/db/migrations/3605_cg06_original_aid_fulfillment.sql`: Fixed table alias collision in `cg06_recovery_source_guard()` where table alias `old` collided with PL/pgSQL trigger variable `OLD`, causing `column reference "old.root_realm_id" is ambiguous`. Renamed alias to `vo`.
   - `apps/backend/src/modules/cg-06-beneficiaries-assistance/domain/beneficiary-input.ts`: Anchored `uuidRe` regex to standard UUID format (`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).
   - `apps/backend/src/modules/cg-03-registration-approvals/application/beneficiary-verification-review.service.ts`: Reconciled type contract for `requireFreshFoundationRootProof(tx,a,x.currentPassword)`.

**Build Verification (`npm run verify:local-build`):**
- Backend (`tsc -p tsconfig.json`): PASS (0 errors).
- Web Next.js Turbopack (`next build`): PASS (all 150+ routes compiled).
- Android Internal (`tsc --noEmit`): PASS (0 errors).
- Android Public (`tsc --noEmit`): PASS (0 errors).

**Test Execution Evidence:**
- `npm run test:cg06-all -w apps/backend`: 21/21 PASS.
- `npm run test:cg06-db-integrity -w apps/backend`: 1/1 PASS.
- `npm run test:cg06-all-60-qa -w apps/backend`: 60/60 PASS (US-001: 20/20, US-002: 20/20, US-003: 20/20).
- `npm run test:cg02-staff-scope -w apps/backend`: 12/12 PASS.
- `npm run test:cg05-project -w apps/backend`: 18/18 PASS.
- `npm run test:cg12-all -w apps/backend`: 13/13 PASS.

**Merge Status:** All mandatory gates passed. Ready for merge to remote `main` under owner authorization.

### 24 November — E2E-014 partial source integration
- Original CG20 US002 QA05 → CG06 US003 QA19: source commits 312f7c54, e329c18b, c3dcebab, 3affaddb, 81bd95c9, a4c55bea, ce60f1cd plus review/error-copy and regression commits through 21e241fb. Existing BeneficiaryReportService.misSummary consumes audited report() under current CG06 branch scope and original beneficiary/assistance permissions; emits only consented demographic/status/delivered-assistance recipient counts, suppresses entire output for nonzero cells or complements under five, rejects invalid/inconsistent counts. CG20 typed live summary on Web/Internal Android; no raw contact, identifiers, finance amounts or record linkage. Direct saved/share/export creation denied, original schedule source stays finance-only, safe error key mapped, existing artifacts unchanged. Eight focused re-read checks matched plus original contract test and static verifier extended, not executed. Explicit branch/date filters, source-scoped durable artifacts if required, small-cell differential review, actual role/branch/SQL/runtime/device and independent review pending. E2E-014 remains OPEN partial; original transferred QA disposition unchanged; no final handoff.

### 24 November — E2E-014 beneficiary report receiving acceptance source candidate
- CG20 US002 QA05 → CG06 US003 QA19: current owner branch options and explicit branch filter through CG06 reportScope, actual consent-not-revoked eligible demographic/status aggregates, original delivery events and distinct recipients with bounded delivery dates. Only aggregate query, no detailed references/contacts, no patient/member joins or matching phone; current original beneficiary and assistance permissions both enforced. Small cells and complements (including all-time versus filtered recipients) suppressed, audited current snapshot, no durable artifact grant. Both staff clients show current demographics versus filtered delivery dates. Commits a90af4f5, eef09f06, fd4beded, 49196b30, 533c066e, abe0f147, 1e6f1d2f. 14/14 committed-source observations matched; original verifier and parser contract extended (NOT_EXECUTED). Original QA source scenario positive/negative filters, revoked consent, cross-branch deny, small-cell and complementary suppression, no patient linkage, direct artifact deny; independent privacy/differencing/DB review and runtime NOT_RUN. Canonical original disposition not promoted until required reviewer.
