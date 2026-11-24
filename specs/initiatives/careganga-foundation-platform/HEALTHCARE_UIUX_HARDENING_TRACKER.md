# CareGanga — Healthcare UI/UX Hardening Tracker

**Date:** 24 November 2026. **Branch:** `feature/careganga-healthcare-uiux-hardening-20261124`. **Parent:** `feature/careganga-cg11-payroll-compensation-from-main-20261124` at `473728cc0d842ad64ba34f3bc14f5b555c835581`. Initial review baseline; subsequent application source commits are logged below. Build, browser/device tests and merge have not been performed. The separate healthcare QA branch is not the parent; reconcile its legitimate changes after mandatory V1 merges into main. Do not interrupt the existing handoff.

## Evidence and rules

This user-requested cross-module subtracker supplements (does not replace) original owner tasks.md and QA definitions. Source-confirmed UI gaps describe inspected markup, not a proven runtime failure. CHECK rows are explicit reproduction/acceptance candidates, not confirmed defects. EVIDENCE rows track missing reference assets. Do not implement optional/future ERP, new patient record capabilities, unsupported checkout, or mock data. No CI/GitHub Actions. Follow root AGENTS.md and pinned JASIQ Harness; reproduce → implement smallest fix → independent review → fix → re-review → trace original QA → actual manual QA → update both trackers. If a candidate already works, attach evidence and close VERIFIED_EXISTING, not redevelop. Preserve role/branch/center/patient isolation, audit, real data, payment correctness and CMS publication rules. No live patient data. Do not touch mandatory handoff branch. Rebase/merge latest main into this branch after handoff and recheck diffs before source work.

**References:** [Healthcare separate screenshot map](../../../docs/research/CAREGANGA-HEALTHCARE-SEPARATE-UI-SCREENSHOT-REFERENCE-MAP.md), [Admin visual audit](../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md), [Healthcare QA entry](../../HEALTHCARE-QA-START-HERE.md), [Mandatory integration tracker](MANDATORY_V1_INTEGRATION_TRACKER.md). Original H07/H08/H09/H10/H15/H16/H17 are distinct from UI-06–24. UI-22/remaining original image unresolved; no fabricated asset IDs. Original owner QA: [CG14](modules/cg-14-healthcare-network/tasks.md), [CG15](modules/cg-15-patients-appointments/tasks.md), [CG16](modules/cg-16-healthcare-diagnostics/tasks.md), [CG17](modules/cg-17-healthcare-assistance-settlements/tasks.md). Reuse applicable original QA IDs; record exact IDs when executing, do not alter approved definitions.

## Summary

37 subitems: 17 source-confirmed presentation gaps, 19 runtime/reproduction candidates, 1 reference evidence blocker. Initial baseline: all OPEN. Current progress: 35 rows IN_PROGRESS (17 source implementation candidates + 18 source-inspected acceptance items); 1 row EVIDENCE_RECOVERED (final public original image set); 1 row BLOCKED (integrated runtime/visual gate); zero independently cleared or runtime passes. No unreviewed OPEN rows, but IN_PROGRESS and BLOCKED are not closure. P0 = release visual evidence gate; P1 = primary journey or substantial usability; P2 = secondary usability. Source status and runtime status stay separate.

| ID | Priority | Evidence | Owner/surface | Issue | State |
|---|---|---|---|---|---|
| HUX-01.01 | P0 | EVIDENCE | CG14–17 all | Recover separate healthcare reference originals | EVIDENCE_RECOVERED |
| HUX-02.01 | P1 | SOURCE | CG14–17 all | Shared design consistency | IN_PROGRESS |
| HUX-02.02 | P1 | CHECK | CG14–17 admin/center | Role-specific healthcare navigation | IN_PROGRESS |
| HUX-03.01 | P1 | CHECK | CG14/15/17/20 admin/center | Operational dashboard journey | IN_PROGRESS |
| HUX-04.01 | P1 | SOURCE | CG14 US-001 admin | Provider registration form density | IN_PROGRESS |
| HUX-04.02 | P1 | SOURCE | CG14 US-003 admin | Doctor list lacks in-screen search/filter | IN_PROGRESS |
| HUX-04.03 | P1 | SOURCE | CG14 US-003 admin | Doctor registration/detail hierarchy | IN_PROGRESS |
| HUX-04.04 | P1 | CHECK | CG14 US-002/003 admin/center | Verification and evidence clarity | IN_PROGRESS |
| HUX-04.05 | P1 | CHECK | CG14 US-005 center/admin | Center profile and content editing | IN_PROGRESS |
| HUX-05.01 | P1 | CHECK | CG15 US-001 admin/center | Scheduling calendar and availability | IN_PROGRESS |
| HUX-06.01 | P1 | CHECK | CG15 US-003/008 admin | Patient and booking management | IN_PROGRESS |
| HUX-06.02 | P1 | SOURCE | CG15 US-006 center web | Consultation queue action overload | IN_PROGRESS |
| HUX-06.03 | P1 | CHECK | CG15 US-003/006 center | Patient intake and consent | IN_PROGRESS |
| HUX-07.01 | P1 | SOURCE | CG16 US-001 admin | Lab catalogue search limited to loaded records | IN_PROGRESS |
| HUX-07.02 | P2 | SOURCE | CG16 US-001 admin/center | H09 filter coverage | IN_PROGRESS |
| HUX-07.03 | P1 | SOURCE | CG16 US-002 lab web (ERP ON only) | Lab sample/report workflow structure | IN_PROGRESS |
| HUX-07.04 | P1 | CHECK | CG16 US-003/004 public | Public lab test and enquiry | IN_PROGRESS |
| HUX-08.01 | P1 | SOURCE | CG17 US-001 admin | Assistance policy form hierarchy | IN_PROGRESS |
| HUX-08.02 | P1 | SOURCE | CG17 US-005/006 admin/center | Settlement screen is mostly stacked definitions | IN_PROGRESS |
| HUX-08.03 | P1 | CHECK | CG17 US-003/004 center/public | Payment and collection status | IN_PROGRESS |
| HUX-09.01 | P1 | CHECK | CG14/18 public web/app | Healthcare landing and discovery navigation | IN_PROGRESS |
| HUX-10.01 | P1 | SOURCE | CG14 US-004 public web | Doctor result cards omit key discovery information | IN_PROGRESS |
| HUX-10.02 | P1 | SOURCE | CG14 US-004 public web | Center result cards are text-only | IN_PROGRESS |
| HUX-10.03 | P1 | CHECK | CG14 US-004 public web/app | Directory advanced filter and result modes | IN_PROGRESS |
| HUX-10.04 | P1 | CHECK | CG14/15/17 public web/app | Doctor profile and center-specific choice | IN_PROGRESS |
| HUX-11.01 | P1 | SOURCE | CG15 US-004 / CG17 US-002 public web/app | Booking review text/action hierarchy | IN_PROGRESS |
| HUX-11.02 | P1 | CHECK | CG15 US-002/003 public web/app | Appointment calendar and patient verification | IN_PROGRESS |
| HUX-11.03 | P1 | CHECK | CG15 US-005/007/008 public web/app | Booking confirmation and patient history | IN_PROGRESS |
| HUX-12.01 | P1 | SOURCE | CG14 US-003 internal Android | Doctor management long scrolling forms | IN_PROGRESS |
| HUX-12.02 | P1 | SOURCE | CG15 US-006 internal Android | Queue summary and action readability | IN_PROGRESS |
| HUX-12.03 | P1 | CHECK | CG14/16/17 internal Android | Operational parity | IN_PROGRESS |
| HUX-13.01 | P1 | SOURCE | CG14 US-004 public Android | Public result list and filter density | IN_PROGRESS |
| HUX-13.02 | P1 | CHECK | CG15/17 public Android | Patient home and healthcare journey | IN_PROGRESS |
| HUX-14.01 | P1 | CHECK | CG14–17 all | Responsive and accessibility acceptance | IN_PROGRESS |
| HUX-15.01 | P1 | SOURCE | CG14–17 all | Technical copy and excessive explanations | IN_PROGRESS |
| HUX-15.02 | P1 | CHECK | CG14–17 all | Loading, empty, error and uncertain state | IN_PROGRESS |
| HUX-16.01 | P0 | CHECK | CG14–17 all | Integrated real-user and visual acceptance | BLOCKED |

## Development checkpoint — public directory, 24 November 2026

- HUX-10.01 / 10.02 / 13.01: Web and native doctor card credentials/experience/fee, clear profile/schedule discovery, center provider/address and coordinate-validated directions, shared scoped Web card styles. No portrait or approved-service summary in the current list projection; existing approved center detail media is preserved. Do not claim those remaining parts closed. Source commits e0a6ad7e1e1ff07acd27e781534955b5ee95d7e5, c425a9f3c3a46bdf91c56a6c6b46de68b7a4a9d6, 5004e0a74524bfd4b8ff68986dbea42b61d09574, fa4a96150a2968601689c0dc98d877b77d9aa766, 57a8986a8612491b4bee8220228db51c8362cb2c.
- HUX-10.03 / 15.02: discovered native stale-result defect and query/pagination mismatch. Clear rows on failed lookup and non-append refresh; render only READY rows; retry first page using applied filter state; prevent old mode results and hide center tab during rescheduling; validate list fields. Source re-read confirmed intended guards and no obsolete cursor references. No executable test yet. HUX-02.01 / 15.01: directory-only shared presentation and shorter public copy, other screens pending.
- Original CG14 US-004-QA01/03/04/05/06/09/10/11/12/16/17/18: partial source trace, no runtime or independent clearance. Staff interfaces not affected by these public presentation changes. Required QA: search/filters, edited-but-unapplied filters then load more, switching tabs during slow request, failed resume/refresh hides old records, approved vs withdrawn listings, malformed coordinates and fees, profile/schedule path, reschedule context, responsive and TalkBack. Photo projection and full visual reference acceptance remain open.
- Harness pin checked identical to authenticated main 8922c717efb68cb5b998cf51f7c0755636616175 in prior execution; local resolver/build/device/visual QA NOT_RUN; independent review unavailable in current connector execution. Current changes are source candidates, not SOURCE_COMPLETE. Latest main comparison ahead/behind 7/1 before the new fixes; reconcile main after handoff.

## Development checkpoint — professional registration and search

- HUX-04.02 / 04.03 / 12.01: existing authenticated doctor list extended with bounded name, registration number, specialty and status query, original root/permission guard and parameterized SQL preserved. Web and Internal Android use explicit applied filters/pagination, grouped details and safe selection handling. Web uses existing responsive split layout; native form sections, confirmation before discarding and accessible filter buttons. No public/private permission expansion. Source commits cc183162, 647441a1, 39145780, 7a59b73a, 098ac8c6.
- Discovered and corrected selected-doctor race: detail/evidence responses and late upload callbacks guarded by selection generation; Web action keys tied to doctor identity; row selection disabled during pending detail/write. Source readback only; verify rapid doctor selection, paging and filter beyond first 50, invalid status rejection, independent approval, source scope and delayed proof with actual database/devices.
- Original CG14 US-003-QA12/14/15/16/18: partial source trace; original QA dispositions preserved. Remaining visual and actual runtime verification, grouped forms and native screen layout quality review pending. Independent reviewer not available; no formal source closure or runtime pass.

## Development checkpoint — provider and consultation queue

- HUX-04.01: provider registration Web/Internal Android grouped organization/contact and named multiple operating center cards; confirmation for remove/discard; block mutation while write outcome unknown, refresh dependent Web geography options. Commits 18815664, fe0cde40, a2bf3ace. CG14 US-001-QA01/03/07/09/11/13/16/17/18 partial source trace; no changed DTO or permission.
- HUX-06.02 / 12.02: Web and native queue uses compact true daily totals, prominent next-action button and one expanded appointment detail; clinical/file/history components stay under existing role/consent and selected row; slip on native opens in that row. Clear stale history/details on reload, hide queue during checking, clear old Web items on refresh error. Commits 21680199, 5b9ecb3c, 7c1c9df4, 5fc226fa. CG15 US-006-QA01–05/07/08/11/13/16 partially source-traced. Verify simultaneous check-in, failed refresh, revoked consent, invalid QR, multiple pages and proper Back. Native camera parity still a separate verification candidate; no unsupported camera permission added.
- Source re-read only; runtime and independent review NOT_RUN, no source closure. No existing clinical or financial API/state semantics changed.

## Development checkpoint — diagnostics catalogue and clinical orders

- HUX-07.01/07.02: bounded server-side test search and category/sample/status filters with deterministic 100-row paging, same authorized root, and page-scoped export; Foundation Web and Internal Android parity. Original edit identity/revision retained; a failed refresh cannot convert an edit into creation. Commits fdfd2c33, 1b771eb3, a3b63ca0, 57455aea, 45e0c1af. CG16 US-001-QA01/03/05/06/07/09/13/14/15/16 partial source trace. Package/mapping selectors and center-specific tariff journey require actual acceptance.
- HUX-07.03: Web and native clinical orders distinguish accepted tests, specimen custody, result entry and professional review/release; recent-order lookup explicitly limited to loaded orders, guarded detail requests. Web patient selector now uses stable patient+care-source identity rather than array index; both reject unavailable cart choices. Commits 46e543e6, 9ba8786e. CG16 US-002-QA01–16 partial source trace; preserve enabled-lab and patient consent guards, retry identity, independent review and private release.
- Regression scenarios: >100 tests, sample/status filtering, page export, expired selection, edit revision conflict, reorder patient options, rapid order/center switch, rejected specimen and recollection, unknown custody response/replay, ERP OFF. Runtime, independent review and original screenshot acceptance NOT_RUN. No new clinical/payment capability.

## Development checkpoint — assistance, settlements and patient booking

- HUX-08.01: Web and Internal Android policy forms group service/eligibility, contribution/cap and validity dates; distinguish create and revision. Commits 6dcf73c3, e634ae3a. CG17 US-001-QA01–09 partial source trace.
- HUX-08.02: Web and Internal Android monthly claim overview uses real verified patient collections, claim state, verified payout and outstanding approved claim; absent values are unavailable rather than assumed zero; validates returned month, clears loading for invalid period, prevents switching claim context and payout during uncertain original operation. Commits bdaa1a64, 481fde3f. CG17 US-005-QA01–11/US-006-QA01–11 partial source trace. Verify proposed vs approved vs paid, partial payout, correction/recovery, partner own scope, missing totals and slow/failed refresh.
- HUX-11.01: Public Web and Android appointment review emphasizes doctor, center, fee, verified assistance, hold expiry and primary confirmation; reception authorization remains a secondary disclosure before reservation. Commits eb11a8d2, f97bbac5. CG15 US-004-QA01/02/04–12/14 and CG17 US-002-QA01–08 partial source trace. Existing hold/replay, private reason, fee revision, slip issuance and pay-at-center boundary remain. Verify expired hold, unknown response, competing slots, real contribution/no policy, code expiry and Back.
- No independently cleared source closure, executable build or runtime/device/visual pass. Remaining CHECK items require reproduction; approved media/list projections and raw healthcare reference originals remain unresolved. No merge.

- Additional source re-review: CG17 Web/native center doctor lookup now rejects late center responses and hides the policy form while new scope loads (1ec0ed98/c58221de). CG16 Web verifies exact distinct exported test references and blocks old detail actions while refreshing/editing (d81c2d95). Regress rapid X→Y center switch, response reorder, mismatched/duplicate export refs and refresh during edit; runtime NOT_RUN.

## Reference recovery and public presentation checkpoint — 24 November 2026

- HUX-01.01 / HUX-16.01: verified private ChatGPT Library folder `/CareGanga/`, original Admin 167-screen ZIP and Golden Reference Pack manifest (A01–A19, B01–B51, C01–C55, U01–U42), and four public archives (10+12+18+7 = 47). Opened Admin contact sheet and public contact sheet; navy/blue/white staff shell and green/gold/cream public brand confirmed. Golden pack is a preview index, not the separate healthcare UI-06–24 batch. Prior Nov 15 and Nov 18 conversation recovered titles but no original filenames/bytes for that separate batch. Exact healthcare screen comparison remains BLOCKED; no generated replacements used.
- HUX-10.02 / 13.01: center card service capabilities and one currently published, rights-approved, clean verified center photo now projected from original CG14/03/19 sources and rendered on Web/native using existing protected public media endpoint. Commits b6de5d2e, 9c8a1c65, 4204231f, 87840ad5, 1e231f8e. Doctor portrait upload/publication is not supported by existing doctor source (NONE/CONSENT_PENDING only); keep neutral fallback rather than fabricate identity/media. Original CG14 US-004-QA04/05/06/09/10/14/15/17/18 source trace only. Verify SQL bind count, current rights/revocation, no private photo or service claims.
- HUX-02.01 / 13.01 / 13.02: public native healthcare, booking, assistance and root shell now consume one shared public semantic theme derived from existing public Web and CMS colors; internal staff retains original Admin tokens. No business behavior changes; visual/contrast/touch QA still NOT_RUN.

## Center-specific booking navigation and parity

- HUX-10.04/11.02: Web doctor cards/profile pass the chosen public center slug into schedule, resolved only against current verified options after date selection; native retains selected center hint, highlights it without automatic booking, adds direct time-first search, retry and stale-day/center response guards. CG15 US-002-QA01/02/04/05/06/07/09/12/13 and CG14 US-004-QA11/12/17 partial source trace. Verify center A/B distinct fees, withdrawn selected center, both search modes, date change and error retry, no slot/price assumptions. Runtime NOT_RUN; independent review pending.

## Main synchronization and reference index

Main `781276ab68a29ef866ecf927f41b88d68f6753f5` is one commit ahead of the mandatory parent `473728cc0d842ad64ba34f3bc14f5b555c835581` with zero changed files relative to parent. Synchronized main into this feature branch with no content replacement and no merge into main. Archive paths/hashes now recorded in [separate reference map](../../docs/research/CAREGANGA-HEALTHCARE-SEPARATE-UI-SCREENSHOT-REFERENCE-MAP.md). Separate healthcare UI original image and live rendered comparison remain unavailable; source work continues.

## Patient history, payment truth and native theme parity

- HUX-11.03/13.02/08.03/15.02: patient Web/native appointment history clears stale rows and selected protected details on fresh query, guards pagination by list generation, differentiates failed lookup and empty state, and shows actual doctor/center and payment status; removes obsolete unconditional unpaid/receipt wording now that CG17 collection source exists. Native patient profile gives consultations earlier priority and all patient subviews use shared public palette. Time-first comparison no longer duplicates old center actions. CG15 US-007/008 original history, cancellation, slip and reschedule scenarios and CG17 US-003/004 collection scenarios require actual source-backed regression with paid, pending, cancelled, refunded, slow query and expired session. Runtime NOT_RUN.

## Protected review and assigned-center UX

- HUX-04.04/04.05: Web review case and own-center selection now validate returned identity, prevent stale response/form/evidence callbacks, suppress switching during uncertain actions, and require original-source recheck before retry. Both Web/native center registration confirm discard; native centre editor blocks switching during unknown original result and keeps proof tied to selected version. Web apply button respects original owner-management grant. CG14 US-002/005 and applicable US-001 review/own-center scenarios source-traced; verify delayed A/B response, uncertain save, upload completion after changing selection, reviewer-only action and approved publication. Runtime/independent review NOT_RUN.

## Role readiness and schedule re-review

- Re-review: CG01 effective UI actions suppress optional equipment and clinical actions using the same existing server flags as CG16 admission; grant catalog and backend authorization remain unchanged. CG14 reviewer action uses actual verify permission (manage only for reopening), matching original owner workflows. CG15 H07 schedule filter/roster/detail controls guard uncertain writes, stale and failed reads and selected association identity; existing metrics, weekly/leave/holiday/copy rules retained. Source regression required with ERP OFF/ON + readiness, verifier-only/manage-only grants, rapid filter changes, uncertain schedule save, original recheck and multi-center copy. No runtime pass. HUX-02.02/05.01/12.03. CG16 US-002-QA02/16; CG15 US-001 scheduling, conflict and H07 visual scenarios; CG14 independent decision/apply/reopen role scenarios.

### 24 November 2026 — protected patient intake, cancellation, lab and CMS discovery
Commit `676e320a410cf79bb2c5ec54adf40d851d26931c`: HUX-06.01/06.03/07.04/09.01. Web H15 cancellation override is now action-permission gated like Internal Android; both prevent changing filters/selection during an uncertain cancellation and require an original-source recheck. Web provisional registration retains the exact original request and disables edits during uncertainty; clinic identity proof is bound to the selected center, patient ID, code and original request key, and a successful response must identify the original verified patient. Public Web lab listings show published sample/description where available; native pagination deduplicates offer references and clear filters retains the initial center. The native published healthcare CMS page now directly opens the existing directory/patient profile; Web offers matching discovery links. Editorial content remains CMS-owned; operational listings remain CG14/16-owned. These are source changes, not executed QA.

### Final source review checkpoint — all 37 rows triaged
- HUX-03.01: original CG20 MIS dashboard on Foundation Web and Internal Android uses current `mis.dashboard.view`; assigned-center MIS/settlement uses original scoped CG17 totals; existing H07/H15 KPI data read paths confirmed. No duplicate dashboard or invented metrics. Actual dashboard/role/branch and financial reconciliation acceptance remains NOT_RUN.
- HUX-14.01: shared Admin and public theme CSS, responsive grids/records, focus treatments and reduced-motion declarations reviewed. Locally calculated contrast from the exact shared palette: public white on green 10.09:1; muted public text on cream 6.34:1; body on white 15.77:1; Admin white on blue 6.31:1; muted Admin on white 5.02:1. These are color-pair calculations only, not a WCAG conformance audit. Keyboard, TalkBack, touch target, 320/375/768/1440px and 200% zoom actual acceptance NOT_RUN.
- HUX-01.01: Admin and public originals archived and inspected; separate healthcare UI-06–24 originals not recovered. Exact healthcare visual acceptance remains blocked. Do not ask for already stored Admin/public archives again.
- HUX-16.01: repository connector supports source edits/readback, but no local checkout/build/runtime/database, separate independent reviewer or rendered device comparison was executed. No source-complete, runtime PASS or visual-parity certification. The separate existing healthcare QA branch is still divergent from main (1 ahead, 572 behind at inspection); do not blindly merge it or overwrite overlapping code. Developer should inspect its QA-only fixtures/scripts and reconcile only legitimate changes; this branch already contains latest main (0 behind).
- Finite next actions: use existing root `AGENTS.md` and pinned Harness; inspect exact diff from current main; independent review changed code; run `npm ci`, `npm run verify:all-source`, `npm run verify:local-build`; run migration only on disposable QA database, backend/web plus both actual Android builds/devices; use original healthcare QA handoff and existing task scenarios. Run ERP OFF then authorized ON, two branches/centers and same-patient privacy tests. Fix source/build failures immediately, re-review and record actual evidence per row. No new modules or CI. No merge to main without completion and approval.

### Source contract re-review — appointment preview

- HUX-10.04/11.02/13.02: re-review found native preview used a 25-center client cap although the original CG15 API admits 40. Align native cap to 40 and 144 slots; reject a different requested date/time/center rather than rendering a mismatched appointment. Updated existing CG14 US004 and CG15 US002 source verifiers to assert live schedule navigation, correct public semantic theme, and bounded response identity instead of obsolete pre-booking wording/blue theme. Original QA US-002-QA01/02/05/07/12/13/14, CG14 US-004-QA12/17. Test 26–40 verified centers, no schedule, late response/date and changed center, 41 invalid entries, >144 slots; source script execution and real QA NOT_RUN.

## 24 November 2026 — newly supplied original public healthcare references (supersedes earlier evidence-blocked status)

The user supplied the final public healthcare reference set, 13 original JPGs. All original archive entries were checked against their SHA-256 manifests. Both ZIPs are saved in the private ChatGPT Library under /CareGanga/:
- CareGanga-Original-Healthcare-UIUX-Reference-20261124-Batch01.zip — 10 originals; SHA-256 5d544a83e5b5a5f392fb12d45a8055ba3c1f50d9cf88d13c822e5016f078e6bf.
- CareGanga-Original-Healthcare-UIUX-Reference-20261124-Batch02.zip — 3 originals; SHA-256 6f82d5e95e2c3a630ba189d7a0c5e23413a5d380fd978820e3db5a0f617f3a79.

HUX-01.01: EVIDENCE_RECOVERED for the user-confirmed final public set; remove screenshot-access blocker for this implementation. These public references carry UI04–11 numbering distinct from the older recovered internal healthcare title map. Do not conflate the two. The earlier internal raw images remain unverified; use original Admin reference archive and authorized existing internal flows rather than halt source work. HUX-16.01: integrated rendering, actual payment/booking/database/Android execution and independent review remain NOT_RUN. Source-based comparison found material presentation differences; no exact visual match claimed. See docs/research/CAREGANGA-HEALTHCARE-PUBLIC-VISUAL-REFERENCE-REVIEW-20261124.md for 13-image mapping, source evidence and remaining acceptance. No production use of sample names/portraits, rates, QR, contact details or transactions; approved data and current module boundaries remain controlling.


## Original public reference implementation — directory and profiles

HUX-10.02/10.03/10.04/02.01: reference-led green listing banner, real category shortcuts preserving query, desktop filter/result layout, actual page counts, grid/list toggles, responsive stacked layout; center UI04 primary approved photograph, section links, doctor schedule actions, quick actions and compact panels; doctor UI05 two-column credentials/center-specific price and availability actions. No fabricated ratings, global counts, map or unapproved service actions. CG14 US-004-QA03/04/05/11/12/16/17, US-005 public publication/revocation; CG15 US-002 center selection. Source review only; actual screenshots/device comparison NOT_RUN.

## Original UI06 implementation — booking selection

Web: four-stage step navigation, verified doctor sidebar, responsive center cards, morning/afternoon/evening live-slot grouping, selected appointment summary. A chosen slot/center is re-resolved from the current response; Web validates date/center/time and bounded result sizes. Native: adaptive step badges, time groups and one selected booking action rather than mounting an action component for every slot. Original hold, identity, fee version, payment and reschedule contracts retained. CG15 US-002/004/007, CG17 US-002/003 source trace only. Verify stale date/slot, unique/multiple time-first matches, unavailable slots, hold expiry and unknown original result before switching; live QA NOT_RUN.

## Original UI08/UI09/UI11 — payment and document presentation

CG19 appointment slip newly issued bytes use green/gold grouped booking, doctor/center, consultation fee and QR/instructions panels. Removed false blanket no-aid/no-payment assertion: immutable CG15 terms only; current CG17 aid and verified collection remain separate. Center cash receipt uses the same theme and actual verified cash amount. No expansion of private source fields, QR scope, immutable digest or historical stored bytes. The reference online two-copy receipt is not the same as the current separately authorized pay-at-center slip; online copy format and actual provider-verified financial document contract require owner reconciliation, not a fake PAID document. Web selected summary/quote and verified Razorpay checkout adopt public gold/green hierarchy. CG15 US-005/008, CG17 US-002/003/004, CG19 original issue/download/revocation QA source trace; PDF rendering/long Unicode names/address and real provider/receipt QA NOT_RUN.

## Original healthcare landing and mobile parity

HUX-09.01/10.02/10.03/13.01/13.02/11.03/08.03: CMS category titles/descriptions remain published-source content, now include real search and canonical category links. Live approved CG17 policy cards replace screenshot sample percentages; public native adds category quick filters and verified same-center doctor actions (no fake booking). Native payable amount highlight; private Web consultation grouped detail and document actions, response identity guard; Web history earlier in profile. Source-only; no screenshot parity/runtime certification. Existing CMS category image schema is text-only; illustrated tiles/hero assets require CMS media mapping and actual approved content. Patient profile registration remains verified/consent-gated; full booking-linked navigation/preview and real online document copy contract still pending.

## UI07/UI11 continuity and selected-request review

HUX-11.02/11.03/13.02/15.02: Web patient registration offers a safe local return link to the selected doctor schedule, validates route and allowed query fields, always re-fetches current slots on return. UI11 user-initiated authenticated PDF preview uses existing restricted download grant, verified PDF bytes and revocable local blob; no public link/identity lookup. Native selected-time action prevents changing selection during held/pending/unknown booking request, retains original idempotency recovery. Verify sign-in/profile/consent return, revoked/expired slip, preview close/route change and native unknown hold; local build and rendered QA NOT_RUN. Native booking-to-registration continuity and full paid document copy format remain follow-up source/contract gaps.

## Original booking recovery and native registration continuity

UI06/07 re-review: Web/native known held reservations now have an explicit original-status recovery button; consumed hold without verified confirmation remains uncertain; failed recovery stays uncertain. Native selected review survives return from external provider and a patient registration/profile modal, keeps the same selected slot and request keys; visible and hardware Back do not leave a locked original reservation. The source API still rechecks availability, permission, patient identity, fee and consent. Verify hold expiry/release, unknown confirmation/recovery, Android modal/back/resume, login/consent then reserve and merchant callback; runtime NOT_RUN.

## Native published landing parity and document layout re-review

HUX-09.01/13.01/13.02: published native CMS healthcare categories now have working category-specific directory actions with validated existing CG14 category codes and shared public theme. Selected category survives initial native directory load, generic home entry resets it; unknown editorial labels open full directory. HUX-11.03/15.01: consultation slip measures and wraps authorized names/address before drawing, fits at readable 8.5–10pt without truncating, reserves non-overlapping financial/footer space and calculates QR quiet-zone from matrix size. Source checks only; extreme valid source lengths and scanner/printed output must be tested locally. Original approved one-copy pay-at-center slip remains separate from actual collection receipt; no fake payment or sample data.

## Repeatable reference source preflight

Seven grouped contract assertions were executed against remote source at 9e975a6122193be13276de097bc76ed1e9be414f; all seven passed (CMS routing, approved photo scope, availability bounds, original booking recovery, patient registration continuity, private document/receipt semantics, slip layout/QR). Added `npm run verify:healthcare-public-reference-source` to local preflight for TypeScript/TSX parsing and these contract assertions. The Node script, full compilation and rendered/device/database/PDF QA remain NOT_RUN in this connector session. No source disposition promoted to runtime PASS.

## Healthcare CMS default content and illustration placement

HUX-09.01/02.01/13.02: fresh-install CMS draft now contains the reference-led nine editable healthcare categories, green/gold hero editorial copy, and no invented clinical/financial data. Existing FEATURE placement reused for indexed healthcare illustrations; server validates category existence and existing clean rights-approved media controls; Web and internal Android editors can attach image, public Web/native render same approved placement, removal shifts Web index or safely detaches native illustrations after category identity changes. First-install draft content is not automatically approved or published by this commit. Actual original/illustrative image files need approved uploads and publication; no sample screenshot portraits or patient data. Source/runtime acceptance pending.

## Two-copy verified online payment confirmation

HUX-08.03/11.03: read-only two-copy A4 online payment confirmation added for patient-owned bookings, exact CG17 VERIFIED_PROVIDER capture, matching original attempt and VERIFIED_CAPTURE merchant event. Actual accepted gross/support/due, capture refund and net/outstanding rendered; source and patient scope rechecked after render. Not an immutable cash receipt, tax invoice, or Foundation settlement. Cash one-copy stored receipt unchanged. Web and public Android open the private PDF only for verified provider rows. Test pending/manual reference rejection, another patient/center, partial/refund/full collection, changed source during render and printable A4. Runtime and independent acceptance NOT_RUN.

## Healthcare first-install illustration pack and release gate

The 10-image original editorial asset pack is stored in private Library `/CareGanga/CareGanga-Healthcare-CMS-Editorial-Illustrations-20261124.zip`; checksums fixed in healthcare importer, archive SHA-256 `34e350d5ec1adcf32e44a0a6bcfca33e0fb220c5c73c3e9d7e2152adf275cf28`. Nine category pictograms and prior generic hero are illustrative, not provider photographs. First-publication gate now requires published nine categories and ten approved placements. Web title edits detach old illustration and text-only hero toggle controls media; native offers only valid hero placement. See [first publication assets](../../../docs/qa/CAREGANGA-HEALTHCARE-FIRST-PUBLICATION-ASSETS-20261124.md). Actual authorized upload/publication and tests NOT_RUN. No live content overwritten.

## Final targeted re-review — printed online confirmation

Two-copy confirmation now uses authorized patient display name, original booking doctor/center, appointment date/time and verified financial amounts in separate green-header panels with measured fit. No sample portrait, barcode, QR or contact details are copied from the reference; the separately authorized consultation-slip QR remains the status verification source. Existing cash one-copy document and historic immutable bytes remain unchanged. This is a read-only current verified online confirmation, not a stored issued online tax receipt. Actual long-name/Unicode, refunds, provider, print and device acceptance NOT_RUN.

## Subtracker details and expected user scenarios

### HUX-01.01 — Recover separate healthcare reference originals

- **Priority/evidence/owner:** P0 / EVIDENCE / CG14–17 all. EVIDENCE_RECOVERED for final public set; runtime NOT_RUN.
- **Observation:** Final public set of 13 JPGs now available in two verified private Library ZIPs. Historical internal healthcare title map is separate; do not conflate IDs.
- **Expected experience:** Locate originals from authorized project/library/client source; record actual asset name, source, screen ID and owner; keep private; never substitute generated images as evidence.
- **Manual scenario / acceptance:** Compare actual H07/H08/H09/H10/H15/H16/H17 and UI-06–24 against captured screens; missing originals remain BLOCKED, not PASS.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-02.01 — Shared design consistency

- **Priority/evidence/owner:** P1 / SOURCE / CG14–17 all. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Public directory uses inline colors/grid while registration, settlement and diagnostics use different workspace structures.
- **Expected experience:** Reuse existing design tokens and shared components; navy admin shell, active navigation, readable labels, semantic status, consistent focus and buttons; public brand stays distinct.
- **Manual scenario / acceptance:** Open each module and both apps; compare typography, spacing, buttons, feedback and contrast; no new theme or duplicated token system.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-02.02 — Role-specific healthcare navigation

- **Priority/evidence/owner:** P1 / CHECK / CG14–17 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Center portal and Foundation Admin must have different contexts; runtime navigation not inspected.
- **Expected experience:** Group existing healthcare routes by task, show current role/location, hide unauthorized and ERP-off actions; no dead links.
- **Manual scenario / acceptance:** Root, branch manager, receptionist, doctor and revoked user each navigate; switch X/Y only if permitted; deep links remain denied.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-03.01 — Operational dashboard journey

- **Priority/evidence/owner:** P1 / CHECK / CG14/15/17/20 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** UI-06 recovered dashboard reference; actual dashboard composition not verified.
- **Expected experience:** Real authorized current counts, appointment queue and financial summary with date and center context; drilldowns to existing sources only.
- **Manual scenario / acceptance:** With no data and two centers, cards show accurate zero/empty and scoped totals; click each available action; no invented charts.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-04.01 — Provider registration form density

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-001 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** provider-onboarding.tsx:429–444 renders provider and multiple center forms inline.
- **Expected experience:** Group legal/contact/location details and multi-center cards; consistent error placement, save/cancel, avoid excessive scrolling; keep original fields.
- **Manual scenario / acceptance:** Register one provider and two centers; invalid PIN/contact highlights field; remove second draft; cancel dirty form and retry lost response without duplicate.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-04.02 — Doctor list lacks in-screen search/filter

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-003 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** doctor-onboarding.tsx:251–271 four-column table, load more, no search/filter in inspected list.
- **Expected experience:** Search and filter the actual authorized doctor collection, show useful verification and specialty; paginated results; existing owner API reused/extended only if necessary.
- **Manual scenario / acceptance:** Find a doctor beyond first page by name/registration where permitted, filter specialty and status, reset, verify no out-of-scope result.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-04.03 — Doctor registration/detail hierarchy

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-003 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** doctor-onboarding.tsx:188–250 inline form; 273–331 selected profile and review controls stacked below list.
- **Expected experience:** Use responsive table + details/drawer, group qualifications, specialties, credentials, mapped centers and fee history; verified and pending clearly distinct.
- **Manual scenario / acceptance:** Create draft, upload proof, return correction, independent approval, select another doctor, retain list filters; mobile drawer back works.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-04.04 — Verification and evidence clarity

- **Priority/evidence/owner:** P1 / CHECK / CG14 US-002/003 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** health-review-inbox.tsx, doctor-proof-uploader.tsx, center-doctor-fees.tsx require rendered review.
- **Expected experience:** Show document scan, pending/returned/verified, separate activation/publication and center fee history; make next allowed action obvious.
- **Manual scenario / acceptance:** Separate reviewer and publisher; rejected document, returned draft, suspended doctor and two center fees; never imply verified means bookable.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-04.05 — Center profile and content editing

- **Priority/evidence/owner:** P1 / CHECK / CG14 US-005 center/admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** center-draft-portal.tsx:123–205 center selection and form; content/support files exist.
- **Expected experience:** Visible own-center context, logical profile sections, preview and review status; upload progress, retry, unsaved changes, own support.
- **Manual scenario / acceptance:** Center X edits hours and approved photo, previews, submits, returns, publishes; center Y cannot edit; public only reflects approved revision.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-05.01 — Scheduling calendar and availability

- **Priority/evidence/owner:** P1 / CHECK / CG15 US-001 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** doctor-schedule-workspace.tsx:478+ contains six KPIs and roster/filter layout; actual calendar, responsiveness and action ordering unverified.
- **Expected experience:** Preserve H07 weekly grid, availability/leave/holiday/slot tabs; clear local date/time, overlap/conflict and save feedback.
- **Manual scenario / acceptance:** Create split shifts, block time, leave and conflicting X/Y windows; view narrow and desktop, stale save; public never shows conflicting slots.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-06.01 — Patient and booking management

- **Priority/evidence/owner:** P1 / CHECK / CG15 US-003/008 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** foundation-patient-bookings.tsx:253–365 already has H15 heading, six KPIs and filters; detail panel runtime not verified.
- **Expected experience:** Retain H15 table and permitted detail tabs, search by human booking/virtual patient ID; correct status and protected documents; no future EMR controls.
- **Manual scenario / acceptance:** Find booking by patient ID, filter date/center, view history and permitted print, switch records; wrong patient/root and revoked actor denied.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-06.02 — Consultation queue action overload

- **Priority/evidence/owner:** P1 / SOURCE / CG15 US-006 center web. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** center-visit-queue.tsx:329–384 maps each visit to card with inline history, cancellation and multiple actions.
- **Expected experience:** Compact daily queue, visible status tabs/summary and one context-appropriate primary action; secondary actions in details, confirmation for destructive action.
- **Manual scenario / acceptance:** Receptionist checks in, doctor begins/completes, cancel with reason, scan QR and handle no-show; correct states after reload and concurrent update.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-06.03 — Patient intake and consent

- **Priority/evidence/owner:** P1 / CHECK / CG15 US-003/006 center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** center-patient-intake.tsx and center-assisted-consultation-booking.tsx require runtime walkthrough.
- **Expected experience:** Explain patient identity, consent, required vs optional fields and duplicate handling; preserve patient privacy and no repeated unnecessary entry.
- **Manual scenario / acceptance:** Existing and new patient, missing consent, duplicate ID, invalid phone, staff-assisted booking; clear field errors and scoped history.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-07.01 — Lab catalogue search limited to loaded records

- **Priority/evidence/owner:** P1 / SOURCE / CG16 US-001 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** lab-test-master-workspace.tsx:287–293 explicitly searches loaded tests and shows up to 100 source records.
- **Expected experience:** Server-backed scoped search/filter/pagination for existing catalogue if owner contract supports; show result count/scope and export semantics; no hidden records.
- **Manual scenario / acceptance:** Seed >100 legitimate QA test records; find record beyond initial page, reset, export correct scope; no cross-center private tariff.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-07.02 — H09 filter coverage

- **Priority/evidence/owner:** P2 / SOURCE / CG16 US-001 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** lab-test-master-workspace.tsx:284–335 shows loaded search, table, details/tabs; H09 specifies category/subcategory/sample/price/status filters.
- **Expected experience:** Use current source-backed filters and readable effective pricing/status with responsive selected detail; retain existing master/duplicate/deactivate semantics.
- **Manual scenario / acceptance:** Filter categories/sample/status, compare two center tariffs and effective dates; no unsupported bulk import or accreditation.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-07.03 — Lab sample/report workflow structure

- **Priority/evidence/owner:** P1 / SOURCE / CG16 US-002 lab web (ERP ON only). IN_PROGRESS; runtime NOT_RUN.
- **Observation:** clinical-lab-order-workspace.tsx:225–314 inline creation, Latest Clinical Orders table then selected detail; H10 describes status filters and selected tabs.
- **Expected experience:** Use clear specimen lifecycle/status, scoped order search, role-specific next action and selected detail tabs; private report states and reviewer separate.
- **Manual scenario / acceptance:** ERP ON with real grant: create order, collect, process, approve, release; verify rejected scan and wrong patient; ERP OFF no clinical controls.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-07.04 — Public lab test and enquiry

- **Priority/evidence/owner:** P1 / CHECK / CG16 US-003/004 public. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** public-lab-offers.ts and native public-lab-offer-directory.tsx require runtime review.
- **Expected experience:** Discover test, actual center and approved price; clear enquiry vs booking; no public lab checkout when ERP OFF.
- **Manual scenario / acceptance:** Find test by name/category, compare real prices, contact/enquire, no result, withdrawn offer; no patient report leak.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-08.01 — Assistance policy form hierarchy

- **Priority/evidence/owner:** P1 / SOURCE / CG17 US-001 admin. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** healthcare-policy-workspace.tsx:212–313 stacked center, service, estimate, type, cap fields.
- **Expected experience:** Group eligibility, policy amount/cap/effective dates and review; show preview and status; explain fixed vs percentage and exceptional approval.
- **Manual scenario / acceptance:** Create eligible consultation policy, expired/overlap/capped/100% exceptional policy; preview exact amount; independent approval only.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-08.02 — Settlement screen is mostly stacked definitions

- **Priority/evidence/owner:** P1 / SOURCE / CG17 US-005/006 admin/center. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** monthly-provider-settlement-workspace.tsx:137–226 select center/month then dl blocks and actions; H17 specifies structured summary.
- **Expected experience:** Use KPI summary for patient collections, Foundation liability, verified paid and outstanding; organized breakdown and actual permitted claim state/actions; no new ledger.
- **Manual scenario / acceptance:** Select center/month, no claims, prepared, approved, partial, reconciled and correction; values match CG09, center money never Foundation income.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-08.03 — Payment and collection status

- **Priority/evidence/owner:** P1 / CHECK / CG17 US-003/004 center/public. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** center-collection-workspace.tsx, center-merchant-checkout.tsx, native patient collection summary need runtime review.
- **Expected experience:** Separate patient due, pending/failed/verified/partial/refund, receipt and provider payment; show center-owned method only when enabled.
- **Manual scenario / acceptance:** Pay at center, enabled sandbox online, pending callback, failed/retry, part-pay and refund; booking does not imply paid.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-09.01 — Healthcare landing and discovery navigation

- **Priority/evidence/owner:** P1 / CHECK / CG14/18 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Current directory route exists; CMS landing and native owner-route parity must be checked after handoff E2E-002/010.
- **Expected experience:** CMS-published general healthcare intro, prominent Find doctor/center and approved service discovery; operational cards only genuine approved source.
- **Manual scenario / acceptance:** Anonymous fresh deployment, no approved providers, then approved providers; CMS edit/publish reflected; route links functional, no dummy doctors/fees.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-10.01 — Doctor result cards omit key discovery information

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-004 public web. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** health-network/page.tsx:187–205 cards show name/specialty/address/fee but no portrait, qualification, experience or primary book action.
- **Expected experience:** Show approved portrait or neutral fallback, actual qualifications/experience, center and fee; clear View profile and book/check availability only if real booking route permits.
- **Manual scenario / acceptance:** Search doctors with/without consented portrait, fee, mapped schedule; verify no false availability/discount; click both actions.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-10.02 — Center result cards are text-only

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-004 public web. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** health-network/page.tsx:180–187 cards show type/name/provider/address and detail link; no approved photo/service summary/directions.
- **Expected experience:** Use approved photos or neutral fallback, current services/location and directions if valid source; show accessible details and consistent primary action.
- **Manual scenario / acceptance:** Find X/Y, no photo, withdrawn listing, missing coordinates; real source cards and contact/directions link; responsive results.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-10.03 — Directory advanced filter and result modes

- **Priority/evidence/owner:** P1 / CHECK / CG14 US-004 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Web GET filter form and native filter controls exist; sort/list/grid/map and back-state need runtime verification against original scope.
- **Expected experience:** Progressive filters, meaningful selected chips, clear reset/empty, preserve query on back; requested sort/list/grid/map use real approved data or record gap.
- **Manual scenario / acceptance:** Apply PIN/specialty/fee filters, clear, paginate, return from profile, browser/mobile keyboard; map only valid published coordinates.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-10.04 — Doctor profile and center-specific choice

- **Priority/evidence/owner:** P1 / CHECK / CG14/15/17 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Doctor detail and schedule routes exist; multi-center patient navigation not visually tested.
- **Expected experience:** Verified doctor details, actual center-specific fees/hours and available slots; distinguish verified from available, no rating unless real.
- **Manual scenario / acceptance:** One doctor at two centers with differing fee/date, no current slot and suspended center; choose explicit center then book.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-11.01 — Booking review text/action hierarchy

- **Priority/evidence/owner:** P1 / SOURCE / CG15 US-004 / CG17 US-002 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** patient-booking-action.tsx:209–255 and native-consultation-action.tsx:260–322 include optional reason, hold, review, confirm and staff authorization in same surface.
- **Expected experience:** Present clear steps and primary next action, optional reason and staff authorization secondary, visible center/date/time/fee and approved assistance, accurate hold expiry/retry.
- **Manual scenario / acceptance:** Both center-first and doctor-first; hold last slot, expire, back, edit, stale quote, duplicate submit and confirmation; no duplicated charge/booking.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-11.02 — Appointment calendar and patient verification

- **Priority/evidence/owner:** P1 / CHECK / CG15 US-002/003 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** doctor-schedule-preview.tsx and patient routes need actual screen walkthrough.
- **Expected experience:** Readable date/slot selector, no unavailable slots selectable, OTP/account/consent flow preserves valid booking context without leaking patient details.
- **Manual scenario / acceptance:** New/existing patient, wrong/expired OTP, unavailable slot, change center, back from sign-in and keyboard small screen.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-11.03 — Booking confirmation and patient history

- **Priority/evidence/owner:** P1 / CHECK / CG15 US-005/007/008 public web/app. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** native-appointment-documents.tsx, native-consultation-history.tsx and patient appointment detail exist.
- **Expected experience:** Clear appointment ID, status, doctor/date/center, payment/assistance, slip download/share, allowed cancel/reschedule and useful history.
- **Manual scenario / acceptance:** Confirmed, canceled, rescheduled, pending payment, PDF/QR/calendar and unauthorized booking access; patient sees only own documents.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-12.01 — Doctor management long scrolling forms

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-003 internal Android. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** native-doctor-management.tsx:165–229 uses ScrollView with registration/editor and selected doctor sections.
- **Expected experience:** Mobile-native grouping, searchable roster where supported, accessible fields, clear save and proof/approval actions; preserve own-role grants.
- **Manual scenario / acceptance:** Small/large device, keyboard, long names, pending correction, authorized verification, back/dirty form, network retry.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-12.02 — Queue summary and action readability

- **Priority/evidence/owner:** P1 / SOURCE / CG15 US-006 internal Android. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** native-center-visit-queue.tsx:252–324 uses multiline summary, manual QR input, horizontal doctor/status controls.
- **Expected experience:** Compact mobile queue summary, visible date/center and status filter, prominent permitted next action; assess camera scan parity only where approved.
- **Manual scenario / acceptance:** Receptionist/doctor with many visits; filter and act, manually enter valid/invalid QR, verify device usability, slow network and correct center.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-12.03 — Operational parity

- **Priority/evidence/owner:** P1 / CHECK / CG14/16/17 internal Android. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Native healthcare feature directories exist; exact role/action/device coverage not proven.
- **Expected experience:** Compare applicable authorized existing actions with web; do not require full admin scheduling on Android where design marks N/A.
- **Manual scenario / acceptance:** Provider review, approved lab tariff, collection/settlement where authorized; same backend state, denied action hidden, no WebView substitution.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-13.01 — Public result list and filter density

- **Priority/evidence/owner:** P1 / SOURCE / CG14 US-004 public Android. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** public-healthcare-directory.tsx:213–325 uses ScrollView and text-first center/doctor cards, many filter fields.
- **Expected experience:** Compact mobile filter panel, approved doctor/center imagery, actual fee/specialty/experience where available, clearly labeled actions; preserve query/back.
- **Manual scenario / acceptance:** Search on small phone, apply/reset filters, return from details, paginate, missing image and offline/retry; no mock profiles.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-13.02 — Patient home and healthcare journey

- **Priority/evidence/owner:** P1 / CHECK / CG15/17 public Android. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Native history, consultation and collection screens exist; patient navigation and rendered consistency unverified.
- **Expected experience:** Prominent upcoming appointment and existing history/slip actions; accessible native navigation and consistent public branding.
- **Manual scenario / acceptance:** Guest searches, signs in, books, returns to own appointment, downloads slip, reschedules; reboot/reopen state remains truthful.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-14.01 — Responsive and accessibility acceptance

- **Priority/evidence/owner:** P1 / CHECK / CG14–17 all. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Exact rendered dimensions, screen readers and device behavior not run.
- **Expected experience:** Web 390/768/1440 px and Android small/large: no clipping, keyboard-safe, semantic heading/labels/focus, readable contrast, scalable text, reduced motion.
- **Manual scenario / acceptance:** Navigate keyboard-only and TalkBack; zoom/large text, long name, table scroll/drawer and orientation; test primary tasks.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-15.01 — Technical copy and excessive explanations

- **Priority/evidence/owner:** P1 / SOURCE / CG14–17 all. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Examples: public directory 'Only currently approved, published...', settlement 'original posted Foundation obligations in CG-09', repeated source terminology.
- **Expected experience:** Use plain English and short actionable errors; retain necessary privacy, eligibility and money caveats, move detailed internal explanations to appropriate help.
- **Manual scenario / acceptance:** Normal first-time patient/receptionist understands each step; no raw UUIDs/enums/module IDs or secret errors; public booking IDs allowed.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-15.02 — Loading, empty, error and uncertain state

- **Priority/evidence/owner:** P1 / CHECK / CG14–17 all. IN_PROGRESS; runtime NOT_RUN.
- **Observation:** Source includes notices, loading, uncertain-write paths, but actual channel consistency not verified.
- **Expected experience:** Shared accessible feedback with skeleton/progress where useful; distinguish no records, denied, unavailable and unknown outcome; safe refresh/retry.
- **Manual scenario / acceptance:** Throttle, offline, 401/403, 500, expired session, double tap and lost response; no stale private data or false success.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

### HUX-16.01 — Integrated real-user and visual acceptance

- **Priority/evidence/owner:** P0 / CHECK / CG14–17 all. BLOCKED; runtime NOT_RUN.
- **Observation:** No browser/device screenshots or original image-by-image parity evidence in this review.
- **Expected experience:** Run original QA and reference comparison; record before/after screenshots, affected QA IDs, actual API/DB evidence and independent review.
- **Manual scenario / acceptance:** Provider→doctor→schedule→patient→booking→visit→collection→settlement; lab ERP OFF and separately authorized ON; two centers/branches; no runtime PASS without evidence.
- **Execution evidence:** original QA IDs, role, branch/center, viewport/device, before/after, API/DB where applicable, commit, independent review and PASS/FAIL/BLOCKED/NOT_RUN — pending.

## User journey acceptance and execution order

1. Recover reference assets in parallel; verify source/design tokens and foundation role/branch/center context. Do not block independent source fixes just because a raw image is missing; exact parity remains blocked.
2. CG14: Foundation provider and doctor onboarding, center representative, evidence and independent review, published directory and center settings. Original US001–005. Complete patient-facing discovery with actual approved data.
3. CG15: schedule and capacity, intake/consent, booking both paths, queue and patient documents/history, reschedule and cancellation. Original US001–008. CG17 US002 fee quote must be present before confirmation.
4. CG17: current policy, payment at verified center, actual completed visit, liability, claim and reconciliation. Original US001–007. No change to commercial policy or payment owner.
5. CG16: published test catalog, lab enquiry and pricing with ERP OFF; separate configured clinical lab workflow only with real grants and consent. Original US001–005.
6. Native parity, CMS integration, role navigation, responsive/accessibility/error states and full journey visual regression. CG22/23/24 stay deferred. No arbitrary expansion to other modules.

## Cross-cutting manual QA matrix

| Scenario | Expected |
|---|---|
| Foundation admin, branch A/B manager, center X/Y, receptionist, doctor, lab and finance staff, patient, guest, revoked account | Only authorized current scope, no hidden API bypass; relevant tasks reachable. |
| Fresh empty data vs approved seeded QA data | Honest empty, loading and failure states; default general CMS published; no fabricated providers, payments or appointments. |
| Doctor at two centers, one remaining slot, two devices | Explicit center choice, authoritative availability, no double booking or duplicate payment. |
| 50% eligible, cap, no/expired policy and exceptional 100% pending | Correct displayed gross/support/due from actual quote, never promise universal discount. |
| Booking success vs payment pending, failed callback, partial collection and verified payout | Accurate distinct states, one real ledger effect; no live transfers. |
| Lab ERP OFF/ON and wrong patient report | No operational ERP controls when off; independent professional release and privacy when authorized. |
| Slow/offline, retry, keyboard and screen reader, narrow Web/native | Useful feedback, preserve safe context, no false success, no clipping, usable actions. |
| CMS publication/withdrawal and directory data updates | Approved editorial and operational source remain separate, withdrawal reflected, no hardcoded editorial copy. |

## Closure gate

For each subitem log reproduction, original owner QA IDs, before/after screenshot reference, changed files, commit SHA, source review/re-review, actual QA verdict, unresolved dependency. No issue marked fixed merely because described. No visual parity certification without originals and rendered screens; no merge until current main sync, applicable builds, real QA and independent review. User authorization required for merge. Keep changes small and no new business scope.
