# CareGanga — Foundation multi-branch and healthcare center scope QA plan

**Stage:** Review and scenario authoring on the active CG-07 feature branch, **not executable QA evidence**. **No new original US or QA IDs.** Each module must retain the exact IDs/status in its `tasks.md` and cross-reference its existing stories. Source review must be followed by Web + Internal Android + Public Android when that audience is approved, API, disposable PostgreSQL, notifications/export, and relevant providers. No merge/CI/GH Actions as part of this work.

## 1. Correct source model (do not conflate the two axes)

- **One Foundation root, multiple internal CG-02 branches** (A, B and inactive C) with real branch manager, geography, department, staff/project/budget/donation/warehouse associations. Foundation-level records have a deliberately NULL branch; they do **not** silently become owned by all branches. A branch-specific real entity retains its original source provenance.
- **CG-14 external provider and healthcare center** is a separate authorization axis: partner and location identities, center representatives/clinical permissions, doctor affiliations and consented patient care. A CG-02 branch manager is not automatically a CG-14 center operator and a center representative is not a Foundation-wide administrator. Some domain sources legitimately have *only* root+center, not CG-02 branch.
- **CG-01 authoritative session/action/protected scope** must be rechecked at every protected command/list/detail/search/selector/export/download/worker execution. Never trust a browser selected-branch header or any opaque UUID as authorization; it is only a narrowing filter.
- **Multi-root isolation** (an additional disposable isolated test fixture only if environment supports it) is separate from multi-branch. Do not create another Foundation tenant in production to test it.

## 2. Real local test fixtures and prerequisite checks

Create through supported app/CG-02 activation and approval, not direct mock screenshots: one test Foundation root R, ACTIVE branches **North A** and **South B** with different geography/department/manager, third branch **Closed C** (previously active, now closed), and one **Foundation-wide** record where policy permits. Use one current protected Super Admin; branch manager A; branch manager B; a branch-reassigned manager; ordinary Finance accountant/cashier and stockkeeper with real existing CG-01 roles; an unassigned staff member; an independent approver; a suspended/role-revoked account. Record branch source version/revision/status. If general staff-to-multiple-branches grants are not supported, mark **BLOCKED CG-MB-001** rather than impersonating manager/admin.

Create distinct real CG-14 verified centers **Clinic X** and **Clinic Y** under eligible providers and distinct current representatives, one appropriately affiliated clinician at each, one multi-affiliated clinician if the domain allows it, a verified patient with explicit center-specific consent and another patient with no consent. Both centers can be in the same CG-02 geographic district without becoming branches. Keep healthcare ERP opt-in flags OFF by default; enable only authorized site/feature for specific testing.

Prepare one real campaign+donation and CG-09 posted finance effect per allowed branch, one Foundation campaign/donation, at least one CG-04 member/volunteer, CG-05 project with historical reassignment, CG-10 employee with actual branch transfer, one CG-12 store/item/stock transaction per branch, CG-19 private document/notification, a CG-20 saved report and schedule. **Never seed provider payment-success or a posted journal with fabricated credentials.** Test-money paths require genuine sandbox evidence.

## 3. Mandatory executable scenario matrix (apply to each applicable original user story)

| Trace | Action and negative path | Expected proof | Evidence required |
| --- | --- | --- | --- |
| MB-T01 | Root administrator reads Foundation plus A/B; selects A, B, all and Foundation-only | Correct disjoint list and totals; null branch only in permitted root view | Web/Internal Android/API response and SQL count reconciliation |
| MB-T02 | A manager views A records and tries B by direct GET/PATCH/POST, selector/URL/CSV/file | Deny without B PII or IDs; same-root UUID is not a grant | API 403/404, negative Web/native, query trace |
| MB-T03 | B manager tries A; unrelated staff tries A/B/Foundation | Deny; no silent fallback to Foundation totals | Same as T02 |
| MB-T04 | Change branch manager A→B and revoke previous role/session mid-work | Old manager cannot continue pending write, review, export, download or cached selection | Versioned source transition, API and active device session |
| MB-T05 | Change ACTIVE to INACTIVE/CLOSED, then access historic reports and attempt new writes | Historical authorized readers only, new assignments/allocations blocked; parent/version provenance retained | CG-02 audit, API and DB |
| MB-T06 | Reference an existing B branch ID in A command, or Foundation-null in B-only role | Backend rejects before DB mutations; no cross-branch child FK | PostgreSQL transaction rollback/row count |
| MB-T07 | Concurrent A/B updates, same idempotency key reuse, conflict/retry and lost response | No duplicate effect or cross-scope result; refresh original status | Multi-worker race and durable command ledger |
| MB-T08 | Transfer/return/rollback stock/project/employee/assignment between A and B | Both required scopes/approvals checked; conserved quantities/ledger/history, no reassigned original payment | SQL source and row locks, before/after |
| MB-T09 | Per-branch posted journal, credit/refund, payroll/stock movement, aggregate A+B+Foundation | Exactly once original CG-09/CG-12 effect; totals match only eligible current posted sources | GL lines, report/export, reconciliation |
| MB-T10 | Report list vs pagination vs CSV/PDF vs schedule vs notification at same filters | Identical authorized scope and source cutoff, no cached/file leakage after branch revoke | File bytes+data and recipient audit |
| MB-T11 | Private CG-19 evidence/letter/PDF/receipt from B opened through A token, stale signed URL | No B disclosure; expiration/revoke enforced on reauthorization | 403/404, signed URL/auth proof |
| MB-T12 | Cross-center X/Y operator tries other center appointment, patient record, diagnostic result or charge | CG-14 current affiliation + patient clinical consent enforced; branch privileges alone do not widen center | API, Web/Center UI/native and SQL |
| MB-T13 | Same patient consents to care at X, then Y without Y consent; clinician with both affiliations | No clinical cross-center leak; narrow approved purpose allows only proper access | Consent and audit |
| MB-T14 | Center X own merchant payment and Foundation contribution; X refund, Y invoice | Never conflate center patient cash with Foundation donations or CG-09 journal; exact provider+center receipt and patient due | Merchant test mode, CG-17/09 source proof |
| MB-T15 | ERP global OFF or only X allowed; Y tries CG-16/22/23/24 private ERP | Denied; separately approved public catalog remains accurate | Feature gate + CG-14 grants + native/Web |
| MB-T16 | Approved CG-18 public A campaign/center content then A closes/retracts rights | Public shows only effective approved source, no private branch contact/center file | Web/Public Android snapshot, CMS/CG19 approval |
| MB-T17 | CG-20 / CG-19 queued report/mail under A, then reviewer loses access or source transfers before run/download | Worker rechecks current permissions and scope; suppresses or safely invalidates stale artifact | Delayed job, audit evidence |
| MB-T18 | Open two Android sessions, change branch/filter while one query pending | No mixed A/B result, stale response or private back-navigation cache | Android device trace, network call+UI |
| MB-T19 | Foundation and Center flows with zero branches, then A created, B activated, A closed | Foundation-only workflows remain usable with zero active branches; center grants remain independent | Fresh and upgrade DB + UI |
| MB-T20 | Wrong Foundation root or guessed UUID, SQL mutation of immutable original branch, direct API bypass | No cross-root read/write; DB FK/trigger prevents retarget; rollback no partial effect | Direct SQL negative proof and API |
| MB-T21 | Every source list/detail/selector including empty/revoked states, on narrow mobile screen | Human-readable names and errors, no UUIDs or hardcoded sample values; exact client original UI parity | Original screenshot-to-Web/native comparison |
| MB-T22 | Performance/security with 10k source rows, 3 branches and 2 centers | Branch-filtered indexes/EXPLAIN, bounded pagination/exports, acceptable query plan; no unbounded cross-owner scan | Postgres EXPLAIN ANALYZE and load evidence |

## 4. Story-by-story evidence and closure contract

For **each module's original US and QA row**, identify the concrete scope dimension: `ROOT_ONLY`, `FOUNDATION_OR_BRANCH`, `BRANCH_SCOPED`, `CENTER_SCOPED`, `PATIENT_OWN`, or combinations. Record: authenticated actor and role, branch/center selections, source record and status/version, typed API/controller, current CG-01/CG-02/CG-14 check, exact PostgreSQL root+branch/center constraint, safe Web and native UI, expected negative 403/404, replay/concurrency/expiry, file/report/notification scope, actual observed result, reviewer and proof reference. `SOURCE_AUTHORED`, `SOURCE_REVIEWED`, `RUNTIME_PASS` and `BLOCKED` are not interchangeable.

**Mandatory local developer build/run:** install exact workspace lock; compile NestJS+Web+both Android apps; migrate fresh **and** upgraded PostgreSQL (including CG07 3319), run existing module tests and explicit two-branch inserts/updates, execute A/B current manager revoke/closure, run relevant Razorpay provider sandbox and all owner notification/report queues. Screenshots from the client are UX authority; compare original labels, filters, copy, drawers, empty/error states, mobile touch/Back/accessibility. Before source completion use Implement → independent Review → Fix → Re-review → QA trace. No CI/GitHub Actions; no merge before final review + developer handoff.

## 5. Future module development requirements

- **CG-06, CG-08, CG-11, CG-13:** during first story explicitly decide Foundation-wide versus branch-scoped versus consent/purpose rights for every table/command/list/export, and add same-root+branch composite FK or original owner guard; no phantom branch on records.
- **CG-22, CG-23, CG-24:** provider/center rights are authoritative; **never** use a Foundation CG-02 branch as a replacement for CG-14 center affiliation. Public catalog may remain available with ERP off; center-private operations must use current license/ERP grant, patient consent, and purpose.
- All later owners must cross-reference the genuine current CG-01/02/14 contracts, avoid shadow branch/center/finance masters, and implement their own applicable Web↔Internal Android and Public Web↔Public Android parity with separate access tests.
