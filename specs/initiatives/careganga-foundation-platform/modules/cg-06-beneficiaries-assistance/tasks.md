# CG-06 — Implementation-ready user stories & 60 manual QA cases

**Source of truth:** [module](module.md), [DLD](dld.md), [UI/UX](uiux.md), [PRD FR-015/016](../../prd.md), [HLD](../../hld.md), CG-06-BR01–05, original [Admin audit A07/A08](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) plus CG-05 A05 and CG-12 B19. Current original screenshot previews visually inspected; exact original full-res/pixel/motion and Web/native render comparison NOT_RUN.

**Stage:** Owner-delegated expert **DESIGN** review (approval hash must be present in `../../approvals.json`), not implementation. Three current independently valid vertical stories with 20 unique source/DB/Web/Internal Android manual QA each. `PLANNED` = designed only, not executed. **Implementation NOT_STARTED; authenticated JASIQ Harness resolver, independent qualified CRITICAL DB/security/financial review, real SQL/concurrency/device/Play/perf/visual QA NOT_RUN.** Formal development gate remains NOT_READY until actual predecessor/source, Harness and required code QA evidence exist. No CI/GitHub Actions or second task tracker.

**Developer procedure per story:** Reopen latest BR/PRD/HLD/module/DLD/UIUX and original A07/A08 + linked A05/B19 before starting; build owner PostgreSQL migration/typed NestJS API with current CG-01/02/03/05/09/12/19 contracts; implement Foundation responsive Admin Web and current authenticated Internal Android with complete action parity; manually source-review security/DB/transaction/error/NFR/visual token paths, fix/re-review; trace **each QA ID** UI → request → current authorization → original business source/SQL → frontend outcome and secondary channel; note exact `file:function`, PASS_SOURCE/GAP/NOT_VERIFIABLE separately from NOT_RUN runtime; update the existing progress below. Public safe impact requires actual CG-18 separate editorial approval and only public Web/Android source.

### US-001 — Create, verify and privately search beneficiary, optionally link real projects

**Outcome/acceptance:** A Foundation officer can register and find a real restricted beneficiary with correct status/consent, and optionally attach one or more genuine CG-05 projects. First profile requires only CG-01/02 and actual CG-03 case when review policy calls for it; neither CG-12 nor CG-09 nor CG-05 visit is needed.

**True prior sources:** Current CG-01 Foundation actor, current CG-02 geography/branch; optional real CG-03 review/CG-05 project/CG-19 proof only where actual action uses it.

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
- **US-001-QA10 — source scenario:** Profile captures explicit purpose/consent, protected contact and real area, uses optional gender/age group only when needed; unknown/not-specified is preserved rather than inferred from names or photos.
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

**Acceptance gate:** 20 unique QA IDs US-001-QA01–QA20 must have explicit file:function/source outcome for backend/DB/Admin Web/Internal Android, all authorization and business owner paths; public safe path where applicable. Original A07/A08 and related A05/B19 visual-source comparison required; full image/web/device/live SQL/clinical/finance sandbox not executed.

### US-002 — Request, approve, deliver and correct source-backed aid with immutable history

**Outcome/acceptance:** Staff selects true beneficiary and records assistance case, policy-required approval, quantity/amount and accountable officer; confirmed material issue or verified aid payment yields one or many bounded delivery events with partial/return/reversal history, never shadow stock/cash.

**True prior sources:** US-001 genuine eligible beneficiary; real CG-12 issue owner for material path and real CG-09 payment owner for money path. No CG-20, CG-18 or future source required.

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
- **US-002-QA10 — source scenario:** Approve 6 pieces from true CG-12 on-hand 10; true locked physical issue CONFIRMED and recipient verified → exactly one immutable CG-12 movement and one CG-06 DELIVERED event, no shadow stock balance/CG-09 voucher.
- **US-002-QA11 — source scenario:** Reconcile unknown CG-12 issue result after API timeout using same source key/digest; return PENDING_STOCK until true owner outcome, never use new key or double-issue, including server restart.
- **US-002-QA12 — source scenario:** Approved 10 pieces delivered 6 then 4 on two dates: PARTIALLY_DELIVERED → DELIVERED, total <= approved, correct unit; return 2 through genuine CG-12 RETURN and one linked corrected net event, never erase gross history or return 11.
- **US-002-QA13 — source scenario:** Revoked beneficiary officer, foreign-root/store, inactive center/project or missing source cannot deliver. CG-12 B19 private Distribution Log shows permitted warehouse movement, not private child/name/address; CG-06 staff only see authorized details.
- **US-002-QA14 — source scenario:** Real CG-05 US-004 approved visit/field task belonging to same project may link to actual CG-06 aid; A05 Beneficiaries tab exposes only permitted minimum count/link, project/visit grant revoked denies both, no fake beneficiary row in CG-05.
- **US-002-QA15 — source scenario:** Actual CG-03 assistance-release decision is required when aid policy/amount demands review; unauthorized or self-approving actor/old revision cannot finalize source; if no approval rule, explicit current authorized staff policy still required.
- **US-002-QA16 — source scenario:** Authorized financial aid from CG-06 triggers true CG-09 approved expense/payment reference and recipient handover verification. Draft voucher, initiated UPI, merely POSTED unrelated journal or unknown gateway response never means delivered aid.
- **US-002-QA17 — source scenario:** Same original CG-09 disbursement callback replayed twice, reverse/refund after completion, or two cash approvals race: one posted/disbursed effect and original linked reversal/correction; no CG-06 bank or duplicate paid amount.
- **US-002-QA18 — source scenario:** Real CG-19 delivery proof accepted with scoped upload/scan/reviewer access and current source; unavailable evidence stays pending under mandatory-proof policy, does not falsely confirm issued; private images excluded from public and debug logs.
- **US-002-QA19 — source scenario:** Permitted repeat assistance to one person on two legitimate dates is recorded separately and appears in support history; do not confuse it with replay of same aid request, and no full profile is exposed to unrelated field staff.
- **US-002-QA20 — source scenario:** Admin Web and Internal Android Request/Approve/Partial/Deliver/Return/Correct flows trace exact CG-06 → CG-12 or CG-09 source event, transaction locks, safe unknown outcome, indexed due-only reconciliation with zero tenant-wide scans; actual code/SQL/perf/native QA NOT_RUN.

**Acceptance gate:** 20 unique QA IDs US-002-QA01–QA20 must have explicit file:function/source outcome for backend/DB/Admin Web/Internal Android, all authorization and business owner paths; public safe path where applicable. Original A07/A08 and related A05/B19 visual-source comparison required; full image/web/device/live SQL/clinical/finance sandbox not executed.

### US-003 — Show authorized history, source-consistent impact and safe reports

**Outcome/acceptance:** A07/A08 source-based beneficiary/person counts, project association, verified delivered goods and money, private filters/history/export and separately permitted de-identified impact, without CG-20 report module or public case access.

**True prior sources:** US-001 genuine profile; US-002 real events only for delivery-specific figures, CG-20 not needed. CG-18 required only to actually publish a public aggregate.

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
- **US-003-QA15 — source scenario:** Actual A07/A08 KPI cards, status tabs, filters, right Overview/Details/Verification/By Project and recent activity render source-derived count/empty state using original shared navy/indigo tokens; screenshot preview inspection is not rendered PASS.
- **US-003-QA16 — source scenario:** When zero valid scoped records exist show truthful 'No beneficiaries match these filters'; when CG-09/12 report source unavailable show 'Unable to verify deliveries' not misleading zero/green result or leaked stack.
- **US-003-QA17 — source scenario:** Compare simultaneous aid return and ongoing report request using consistent original source snapshot/revision: no mix of pre-return stock and post-return net cash, show as-of/reconciled state and safe refresh.
- **US-003-QA18 — source scenario:** Protect total vs per-project/branch multi-association sums with cross-scope mapping, stable money currency and service units: never add unlike items, double count one person, or include another root's events.
- **US-003-QA19 — source scenario:** CG-06's own dashboard works with genuine beneficiary and aid source without CG-20 MIS installed; when CG-20 later ships, provide only authenticated aggregate `readBeneficiaryImpactForMIS`, not a duplicate reporting master.
- **US-003-QA20 — source scenario:** Full source QA trace across original CG-01 scopes, CG-05/09/12 source, CG-18 CMS, CG-19 docs, Admin/native/public, audit/redacted logs and no zero-job worker traffic; actual SQL/security/device/visual/load tests NOT_RUN.

**Acceptance gate:** 20 unique QA IDs US-003-QA01–QA20 must have explicit file:function/source outcome for backend/DB/Admin Web/Internal Android, all authorization and business owner paths; public safe path where applicable. Original A07/A08 and related A05/B19 visual-source comparison required; full image/web/device/live SQL/clinical/finance sandbox not executed.

## Execution progress — single authoritative task tracker

| Story | Design | Implementation | Source trace | Actual SQL/browser/Android/native/pixel QA |
| --- | --- | --- | --- | --- |
| US-001 | 20 exact QA cases defined; delegated design review/approval-bound hash to be refreshed | NOT_STARTED | NOT_RUN; file:function evidence absent | NOT_RUN |
| US-002 | 20 exact QA cases defined; delegated design review/approval-bound hash to be refreshed | NOT_STARTED | NOT_RUN; file:function evidence absent | NOT_RUN |
| US-003 | 20 exact QA cases defined; delegated design review/approval-bound hash to be refreshed | NOT_STARTED | NOT_RUN; file:function evidence absent | NOT_RUN |

**No completion inference:** CG-05/09/12 are earlier *planning modules*, not proof of actually installed/running source. These tasks remain implementation BLOCKED until relevant real modules and formal stage gates exist. The design can be delegated-approved without making QA PASS or beginning the next canonical CG module.
