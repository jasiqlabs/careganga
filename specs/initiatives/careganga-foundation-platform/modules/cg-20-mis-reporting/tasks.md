# CG-20 — Cross-stack User Stories & Manual Source QA

**Developer order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md), root AGENTS.md and current Harness. **BR:** CG-20-BR01–07; **PRD:** FR-073–074 and NFRs; [Module](module.md) · [DLD](dld.md) · [UI/UX](uiux.md) · [HLD](../../hld.md).
**Source images directly reviewed:** original-derived U01 and C44–C49 reference pack; C48 is an inaccessible export placeholder, not an implemented module. Exact pixel/motion/browser/Android execution NOT_RUN.
**Stage:** SOURCE_DESIGN_REVIEWED / owner-delegated SHA-bound decision recorded in initiative approvals.json; local authenticated Harness resolver, qualified independent CRITICAL DB/privacy/security review, actual source implementation, migrations, runtime, visual, Android/Play and cost measurements remain NOT_RUN.
**Workflow:** One real US at a time, authorized backend+PostgreSQL → responsive Admin/Center Web where applicable → Internal Android, public-channel access negatives → manual expert source review/fix/re-review → trace **each** QA ID with actual source file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE → update only the Execution progress below. No CI/GH Actions, source review does not constitute live QA.

## Approved task definitions — OWNER-DELEGATED SOURCE DESIGN ONLY
### US-001 — Read source-authoritative Foundation, branch and center dashboards

Outcome: A permitted Foundation operator can open real cross-module KPI charts and owner drilldowns at current authorized scope without duplicate business data or fake unavailable-source totals.

Requirements: FR-073; CG-20-BR01–03; CG-NFR-SEC01–03, PERF, DB, REL06, OPS, N-13.

Scope: Existing NestJS CG-20 scoped registry/owner facades and typed API; read-only dashboard queries with true CG-01/02/14 current scope, selected real owner data and business formulas; U01/C47 responsive Foundation Admin Web, equivalent native Internal Android; optional own-center Portal summary where real CG-14/15/17 exist. Public Website/Android: NO private MIS screen, CG-18 retains independently approved public impact.

Acceptance: With one genuinely implemented owner, display its exact currently authorized metrics/as-of, real zero/empty/unavailable/error distinctions, safe chart labels and owner-only drilldowns. No future owner, shadow ledger, patient list or sample KPI. Each applicable client follows original CareGanga tokens, current permission and clear error handling.

**Per-story source QA (planned, NOT executed):**
- **US-001-QA01 —** Real active Foundation root and CG-09 posted balances → read Admin U01 KPI/financial cards; each displayed amount reconciles to one source-authorized CG-09 current journal/period and approved permission; pending/rejected entries do not inflate posted cash or expense.
- **US-001-QA02 —** User limited to CG-02 Branch A opens dashboard, filters Branch B or bypasses direct /dashboard query → API denies/is restrictively scoped before aggregate, Web/Internal Android never display Branch B counts, charts, exports or drilldown.
- **US-001-QA03 —** Foundation Admin with genuine CG-05 project/task/visit/activity source opens real C47 operational tiles; counts/status/date match CG-05 US-005 read facade, while CG-05's original independent A01/A02/A09/A10 source dashboard remains unchanged.
- **US-001-QA04 —** Provider center manager with only current verified CG-14 Center A scope views optional Center Portal stats → only own eligible CG-14/15/17 aggregate; Center B, Foundation account bank values and other patient medical data absent even with guessed URL.
- **US-001-QA05 —** Open dashboard when CG-04 or CG-11 or an optional ERP owner is not installed/global OFF → module tile NOT_AVAILABLE or absent, not artificial 0, no disabled ERP worker/route or example number; other genuine metrics still work.
- **US-001-QA06 —** Source exists and authorized but has zero matching rows → clear Confirmed no data/zero with source, date and current scope; distinguish missing source, failed API, loading, permission denial, partial results and stale-as-of instead of one generic zero.
- **US-001-QA07 —** CG-09 projection reports POSTED ₹ amount while CG-07 campaign payment remains pending → dashboard labels pending separately, excludes it from finance posted amount, no donor/contact detail or duplicated income.
- **US-001-QA08 —** Current operator has CG-20 aggregate permission but not CG-11 salary/patient clinical fields → server excludes restricted dimension/cell before aggregation, no salary/bank/medical fields, small-cell identification or membership inference from chart tooltip.
- **US-001-QA09 —** Actual CG-15 appointments/care outcomes present → count safe state and current center/period only; unauthorized Foundation finance role cannot pivot to private patient diagnosis/file or care purpose; privacy negative test through API and chart drill.
- **US-001-QA10 —** Current role revoked or location assignment transferred while dashboard displayed → next API/drill request backend denies old scope, Web/Internal Android clear stale protected cache without client poll dependence; no old response reused as authorized.
- **US-001-QA11 —** Set actual supported date/financial-year/timezone/status filters → safe source contract and owner as-of labels stay consistent, no mixed-currency arithmetic or time-window double counting; invalid date and unsupported filter show field guidance.
- **US-001-QA12 —** Two owner facades respond at different source watermarks, one times out → display PARTIAL with per-owner unavailable state, not one globally consistent as-of or misleading full total; recovery produces a fresh authorized read.
- **US-001-QA13 —** Given U01 and C47 source images, compare sidebar blue active state, CareGanga brand/header, KPI row, line/donut/column charts, filters, labels, quick actions, loading/empty/error badges in responsive Web; exact original palette/motion pixel runtime NOT_RUN.
- **US-001-QA14 —** Internal Android current authorized staff opens equivalent KPI and drilldown → native cards, accessible chart alternative/table, touch/Back/keyboard/current role/scope and permitted nav match Web capability; public Android deep link has no private dashboard.
- **US-001-QA15 —** Zero pending scheduled reports and many idle contexts/instances → dashboard query executes only on user read, bounded source fanout/page/memoization, no repeated tenant scans, per-device rapid polling or expensive background refresh; DB queries/HTTP egress measurement still NOT_MEASURED.
- **US-001-QA16 —** Authenticated user visits permitted U01 Quick Action → destination must be actually delivered original module route/permission; CG-03 owns approval case and CG-18 owns public visibility switches, neither is duplicated or marked complete by CG-20.

Verification: On implementation trace each exact QA ID from Web/native UI → typed API → current actor+original source scope → actual owner query and CG-20 mutation where relevant → DB/CG-19 effect and client state. Record independent SOURCE_GAP remediation and never call an unrun migration/device/visual query PASS.

Dependencies: Current CG-01 core and at least one actually delivered source read facade; CG-02/CG-14 only when real branch/center scope used; no future owner required.

### US-002 — Run standard MIS and bounded owner-permitted filtered reports

Outcome: Authorized staff can select genuinely delivered source report packages, dates, geography and allowed detail/summary/chart/pivot views with correct original-owner formulas and safe query limits.

Requirements: FR-074, FR-073; CG-20-BR02–04/07; CG-NFR-SEC/DB/PERF/UX/OPS, N-13.

Scope: Typed report-source registry + server-only allowlisted standard package definitions and bounded ad-hoc query previews; Foundation Admin C44/C45/C46/C47 responsive Web, equivalent eligible Internal Android report selection and filter; own-center restricted report when source allows. Does not own business source rows or persist arbitrary SQL.

Acceptance: At least one delivered owner source can run a genuine standard report, current authorized columns and period, source-as-of and reconciled totals. Unavailable owner packages cannot show fake or nonfunctional controls; no cross-owner join without explicit approved key or source owner permission.

**Per-story source QA (planned, NOT executed):**
- **US-002-QA01 —** Foundation Admin selects C44/C45 financial and general report package → show only actually delivered source types, correct POSTED CG-09 financial rows and original CG-21 protected audit projection if separately authorized; do not create new CG-20 audit table.
- **US-002-QA02 —** Open standard Donations & Tax Receipt Ledger and donor lacks receipt/CG-09 posted status → distinguish verified CG-07 donation, issued CG-19 receipt and actual posted amount; do not label pending gateway or editable sample as received.
- **US-002-QA03 —** Run project budget/burn for genuine CG-05 project and CG-09 journal → correct project revision/source, approved vs committed vs utilized POSTED states, no fabricated cost derived from planning estimates; project transferred/closed source visibility rechecked.
- **US-002-QA04 —** Authorized member/volunteer roster report → consume real CG-04 current scope/consent; CG-20-only reporter without contact detail grant sees safe totals but not private address, phone or identification fields.
- **US-002-QA05 —** Authorized beneficiary demographic/assistance report → use current CG-06 source eligibility and purpose, suppress identifying small cells where source privacy rule requires, never cross-link patient/member by matching phone.
- **US-002-QA06 —** Authorized CSR partner contribution report → CG-08 source allocations vs verified original CG-09 money kept distinct; pending approved pledge not presented as bank received.
- **US-002-QA07 —** Healthcare center/doctor/appointment report → only real CG-14/15 center and permitted service/status, no patient documents/clinical notes; CG-17 approved liability and center patient revenue not added as Foundation income.
- **US-002-QA08 —** Staff payroll report → original CG-10/11 allowed employee/payroll status, salary/bank fields rejected if user lacks source-grant even when generic reports.view is true; no unrestricted export/row selector.
- **US-002-QA09 —** C46 daily/weekly/monthly/annual period + real district/block/branch date filters → server independently restricts to verified CG-02 geography and allowable source time grain; dropdown only shows source and actor entitled values.
- **US-002-QA10 —** C47 chart/table/summary/bounded pivot view switch on genuine source → compare same permitted base rows/cutoff across representations; unavailable pivot/grouping renders not supported rather than invented data.
- **US-002-QA11 —** Attempt arbitrary SQL fragments, unknown filter operator, unbounded date range, huge group/pivot/high-cardinality query or nested join target → typed API rejects with safe validation, no unbounded DB full scan, no source internal table name revealed.
- **US-002-QA12 —** Across source results with different status/time/currency, reject unsupported currency sum/time-mismatch and report per-owner source cutoff; partial outage yields PARTIAL/FAILED rather than a false complete report.
- **US-002-QA13 —** Authenticated Web C44/C46 uses exact original report package card, source status chip, period/area filters, run/preview action, compact table/chart, print/export entry only when implemented; no screenshot sample counts copied.
- **US-002-QA14 —** Native Internal Android authorized to run same standard report sees usable source picker, filter, run, list/table/chart summary, loading/Back/keyboard/empty/error states; no private reports route exists in Public Android/Public Web.
- **US-002-QA15 —** Run same owner report twice with identical filter but current role revoked between calls → second access denied at original owner, historical saved source cannot widen access; compare `options`, list and direct run semantics.
- **US-002-QA16 —** Representative large but legitimate report with capped page, cursor, date predicate, index and source query budget → bounded latency/rows/response bytes, no N+1 per account or payroll employee; EXPLAIN and actual perf NOT_RUN/NOT_MEASURED.

Verification: On implementation trace each exact QA ID from Web/native UI → typed API → current actor+original source scope → actual owner query and CG-20 mutation where relevant → DB/CG-19 effect and client state. Record independent SOURCE_GAP remediation and never call an unrun migration/device/visual query PASS.

Dependencies: US-001 source registry and one genuine owner read facade; other owner packs introduced only after delivered source.

### US-003 — Build, save, revise, copy and retire custom reports and filters

Outcome: Authorized staff can create a purpose-limited C49 custom tabular/chart/summary/pivot report from only current allowlisted source fields, save/reload revisions, safely copy and retire without inheriting another person's rights.

Requirements: FR-074; CG-20-BR04–06; N-01/N-04/N-05/N-09/N-11/N-12/N-13; CG-NFR privacy/DB/UX.

Scope: Original CG-20 report_definition and saved_report only; versioned validated DTOs, safe field catalog and source query reuse from US-002, protected save/copy/retire API; Admin C49 three-step builder/saved filters and native Internal Android equivalent, current role/service scope.

Acceptance: Start with source → select permitted columns/filters/groups/sort/output → preview and save one named revision; edit/copy/retire with concurrency and truthful state. No arbitrary SQL/formula, private field leak, unrestricted saved recipient, source-owner data copy or mandatory future module.

**Per-story source QA (planned, NOT executed):**
- **US-003-QA01 —** Authorized Foundation Admin opens C49 three-step Select Source → Apply Filters → Format & Run, selects genuinely delivered CG-05 project status fields and saves real PRIVATE named custom report; same query reopens without raw SQL.
- **US-003-QA02 —** Current user selects public-safe fields but attempts add CG-11 salary, CG-15 patient, protected donor or other source column by crafted DTO → backend validates owner allowed columns and current purpose, saves none and exposes no field metadata.
- **US-003-QA03 —** Custom date/range/branch/status filters contain invalid timezone, foreign branch, unsupported join, operator injection or oversized JSON → reject before DB query, preserve last valid version and clear business-safe field guidance.
- **US-003-QA04 —** Choose group by source status and bounded chart → resulting aggregates and tabular totals use same original owner/source-as-of; prohibited pivot/unsupported chart type never silently returns different rows.
- **US-003-QA05 —** Saved filter is reopened from C49 list by same authorized account after screen refresh and Internal Android login → current allowed source options and effective filters restored; source later missing yields NOT_AVAILABLE, not cloned default data.
- **US-003-QA06 —** Two administrators edit same shared saved report revision → one compare-and-swap winner, loser sees conflict/reload; no overwritten group/source/recipient scope or duplicate revision audit.
- **US-003-QA07 —** Duplicate save/retry after ambiguous connection loss uses exact idempotency digest → one immutable definition revision and one active saved pointer; changed payload with reused key conflicts, no duplicate report name.
- **US-003-QA08 —** Copy report owned by another permitted creator → copied allowlisted definition only after real read permission, PRIVATE to copier and no inherited access to original owner's sensitive source fields, recipients or schedule.
- **US-003-QA09 —** Retire saved report while another user viewing it → future run is denied/retired, original historical report metadata remains auditable but no stale report contents or credentials exposed.
- **US-003-QA10 —** Admin with report.create but not report.share attempts public/role-wide visibility or URL share → backend denies and hides Share; private saved view still works without a separate approval engine.
- **US-003-QA11 —** CG-01 role revocation or original source branch transfer after report save → even owner cannot preview/run unauthorized field and prior mobile cache clears; hiding card is never the only enforcement.
- **US-003-QA12 —** Cross-root account tries guessed saved report name or opaque ref → server NOT_FOUND_OR_HIDDEN and no timing/name/source leaks, no write or copied definition.
- **US-003-QA13 —** Original C49 saved filters, builder cards, chart distribution, Custom Reports table and schedule panel read against original Web source; only implemented options shown, no sample 'Live Database' or 'Running Query' badge until true state.
- **US-003-QA14 —** Internal Android same authorized staff creates/edits/saves/copies/retire report with native source stepper, touch controls, Back unsaved confirmation and accessible labels, no WebView, consistent backend options and permission failures.
- **US-003-QA15 —** Restore/migration and row-level audit inspection of report_definition, saved_report unique current name, same-root FK, immutable revision, modified actor/time, valid JSON limit; SQL/performance/device evidence NOT_RUN.

Verification: On implementation trace each exact QA ID from Web/native UI → typed API → current actor+original source scope → actual owner query and CG-20 mutation where relevant → DB/CG-19 effect and client state. Record independent SOURCE_GAP remediation and never call an unrun migration/device/visual query PASS.

Dependencies: US-002 registered source and actual bounded query; CG-01 real actor; no US-004 export or US-005 schedule required.

## Execution progress

- US-001–005: DESIGN_REVIEWED / IMPLEMENTATION_NOT_STARTED on planning branch. Active real code progress must be verified separately; do not inherit older stale task status.
- LOCAL_HARNESS_RESOLVER: NOT_RUN; independent CRITICAL DB/privacy review, migrations/restore, source code QA, Web/native runtime/pixel/motion, NFR load/egress: NOT_RUN/NOT_MEASURED.
