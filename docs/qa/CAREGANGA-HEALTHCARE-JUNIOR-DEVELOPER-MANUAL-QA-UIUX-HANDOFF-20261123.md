# CareGanga Healthcare — Junior Developer Manual QA, UI/UX and Bug-Fix Handoff

**Date:** 23 November 2026  
**Starting baseline:** jasiqlabs/careganga, branch **main**, inspected at commit **e7c0ebf92f8ccff12e6b04b400362a2ad56897bb**. Re-check HEAD before starting.  
**Assignment:** Test and improve **existing healthcare code on main**; fix real frontend, backend, database and mobile defects; independently review; run real manual QA; then open a PR for reviewed merge. **This document is instructions, not evidence that any test passed.**  
**Audience:** A junior developer new to CareGanga. Read from top to bottom before changing code.

> **The rule:** First make the REAL existing healthcare journey work, then improve the experience. Do not invent new modules, patient records, permissions, payment outcomes, test counts or features. Preserve the original approved story/QA IDs in each module's tasks.md. Never mark a source inspection as a successful live test.

## 1. What CareGanga is, in simple words

CareGanga is a Foundation platform with an integrated healthcare-partner network. The Foundation approves legitimate hospitals, clinics, diagnostic centers and other healthcare partners. A patient can discover approved services, book a supported doctor consultation, see an honest fee and applicable Foundation support, attend a visit, and obtain their own approved documents. The partner center collects **the patient's money**. Separately, the Foundation can owe and later pay an **approved benefit** to a provider through its own accounting workflow.

There are **two different organizational concepts**:

- **Foundation branch (CG-02):** an internal Foundation office/branch, with branch managers and staff. Branch A access is **not** access to Branch B or to an unrelated healthcare center.
- **Healthcare center (CG-14):** an external provider's approved location, such as Clinic X or Clinic Y. Center access requires current center affiliation, real action permission and patient-care purpose where relevant. Even a Foundation branch manager does not automatically gain clinical/center access.

A **patient identity** is not a second center-specific patient database. Care access follows the original patient, consent, appointment and clinical-purpose rules. Do not expose medical files because someone knows a record URL or UUID.

## 2. Architecture: where to look when something breaks

| Piece | Technology and responsibility | Start here |
|---|---|---|
| Backend/API | NestJS + PostgreSQL; guards, business rules, transactions, audit | [Backend modules](../../apps/backend/src/modules/) · [DB migrations](../../apps/backend/db/migrations/) |
| Web | Next.js: public website, patient area, Foundation Admin, authorized own-center portal | [Web app routes](../../apps/web/src/app/) · [Healthcare Web features](../../apps/web/src/features/) |
| Internal Android | Expo/React Native: authorized staff, center, doctor and diagnostic work | [Internal Android](../../apps/android-internal/src/features/) |
| Public Android | Expo/React Native: anonymous approved directory and signed-in patient's own actions | [Public Android](../../apps/android-public/src/features/) |
| Shared APIs/visuals | Common contracts, design tokens and native packages | [API contracts](../../packages/api-contracts/) · [Design tokens](../../packages/design-tokens/) |
| Private evidence | Original CG-19 storage, verified files, PDFs, notices, delivery state | [CG-19 backend](../../apps/backend/src/modules/cg-19-documents-notifications/) |
| Source checks | Scripted source contract checks are helpful but **not** live QA | [Source verifier scripts](../../scripts/) · [Root package scripts](../../package.json) |

**Request flow:** user presses a real Web/Android action → authenticated API request → CG-01 permission and current scope → the one owning CG module → PostgreSQL transaction / CG-19 verified file / CG-09 ledger if required → safe human-readable response → UI updates from saved state. A menu that is visible without working APIs does **not** count as implemented.

**Read first:** [root developer rules](../../AGENTS.md), [project README](../../README.md), [business requirements](../business-requirements/02-INTEGRATED-HEALTHCARE-BR.md), [development dependency rules](../../specs/initiatives/careganga-foundation-platform/DEVELOPMENT_ORDER.md), [recent whole-journey source audit](CAREGANGA-HEALTHCARE-E2E-GAP-AUDIT-20261121.md) and [multi-branch/center QA](CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Older audit statements such as "feature branch only" are historical: **confirm current main tree/code** before declaring something absent.

## 3. What is actually in main, and what you must NOT build

| Module | What it owns / the beginner should test | Current instruction and links |
|---|---|---|
| **CG-01 — Identity/RBAC** | Staff and patient login, roles, account restrictions, password/recovery, safe errors | **Prerequisite.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-01-identity-access/tasks.md) · [Backend](../../apps/backend/src/modules/cg-01-identity-access/) |
| **CG-21 — Settings/audit** | Foundation configuration, auditable protected actions | **Prerequisite as used.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-21-platform-configuration-audit/tasks.md) |
| **CG-02 — Foundation branches** | Current Foundation root, branches A/B, staff scope | **Prerequisite for branch-scope tests; NOT a substitute for a center.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-02-foundation-structure/tasks.md) |
| **CG-03 — Approvals** | Separate legitimate provider/doctor/policy reviewer decisions and finalization | **Prerequisite.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-03-registration-approvals/tasks.md) |
| **CG-19 — Documents** | Upload/scanner/private reports/receipt/slip/notification status | **Prerequisite for file flows.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-19-documents-notifications/tasks.md) |
| **CG-09 — Finance** | One Foundation ledger and verified journal/payout accounting | **Prerequisite for settlement.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-09-finance-accounting/tasks.md) |
| **CG-14 — Healthcare network** | Partner registration, verification, approved centers, doctors, affiliations, fees, directory, own-center content, partner service information | **Start the healthcare walkthrough here.** [5 stories / QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/tasks.md) · [Backend](../../apps/backend/src/modules/cg-14-healthcare-network/) · [UI/UX spec](../../specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/uiux.md) |
| **CG-15 — Patients/appointments** | Consent and patient record, doctor schedule, patient/assisted booking, documents, queue, visit, cancel/reschedule, own history | **Second core module.** [8 stories / QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md) · [Backend](../../apps/backend/src/modules/cg-15-patients-appointments/) · [UI/UX spec](../../specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/uiux.md) |
| **CG-17 — Healthcare assistance/settlements** | Approved subsidy, quote, center-own collection, Foundation liability, verified monthly claim and paid status | **Work alongside booking, then after a completed visit.** [7 stories / QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-17-healthcare-assistance-settlements/tasks.md) · [Backend](../../apps/backend/src/modules/cg-17-healthcare-assistance-settlements/) · [UI/UX spec](../../specs/initiatives/careganga-foundation-platform/modules/cg-17-healthcare-assistance-settlements/uiux.md) |
| **CG-16 — Diagnostics** | Approved lab tests and per-center pricing/public offers; optional, gated lab orders, custody and qualified report release | **Public catalogue can work with Lab ERP OFF.** [5 stories / QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-16-healthcare-diagnostics/tasks.md) · [Backend](../../apps/backend/src/modules/cg-16-healthcare-diagnostics/) · [UI/UX spec](../../specs/initiatives/careganga-foundation-platform/modules/cg-16-healthcare-diagnostics/uiux.md) |
| **CG-18 — CMS/public content** | Approved public placement and publishing, not a new healthcare master | **Integration regression only.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-18-cms-public-content/tasks.md) |
| **CG-20 — MIS** | Read-only reporting from verified owner sources | **Test only actual present and authorized report screens.** [Stories/QA](../../specs/initiatives/careganga-foundation-platform/modules/cg-20-mis-reporting/tasks.md) |
| **CG-22/23/24 — Pharmacy/Nursing/OT ERP** | Stock/dispensing; nursing roster/visits; operating theatre rooms/cases | **NOT IN THIS IMPLEMENTATION ASSIGNMENT.** Designs exist, but there are no CG-22/23/24 backend owner directories on inspected main. Do NOT create private ERP screens or APIs. [Pharmacy plan](../../specs/initiatives/careganga-foundation-platform/modules/cg-22-pharmacy-operations/tasks.md) · [Nursing plan](../../specs/initiatives/careganga-foundation-platform/modules/cg-23-nursing-operations/tasks.md) · [OT plan](../../specs/initiatives/careganga-foundation-platform/modules/cg-24-ot-procedures/tasks.md) |

**Important exception:** CG-14 already has approved public partner information/enquiry for pharmacy, nursing and surgery/procedure services. Test that **existing ERP-OFF partner information** if it is on main. It is **not** permission to build pharmacy stock, nursing scheduling or OT booking. CG-17 also has source for evidence-backed **ERP-OFF partner invoice/claim verification**; test only the actual approved flow and its required proof, without inventing CG-22/23/24 operations or assuming a patient self-checkout exists.

## 4. Exact order for the developer (do not start at a random screen)

| Order | Task and exit condition | Why now |
|---|---|---|
| **0. Prepare** | Get clean current main, read AGENTS/Harness, install dependencies, configure disposable database, reviewer/test accounts and storage sandbox; record build and migration outcome | Without this, later "PASS" is meaningless |
| **1. Foundations** | Verify CG-01 roles/login, CG-02 branch scope, CG-03 two-person review, CG-19 protected files and CG-09 ledger read access; fix a blocker in its **own** module | All healthcare actions depend on these safeguards |
| **2. CG-14 partner + center** | Register provider, approve center X and Y separately, link representative, doctor, license, affiliation and center fee; verify public directory + own-center portal | Everything downstream requires real approved centers |
| **3. CG-15 schedule + patient** | Doctor availability, patient verification, center intake/consent and patient-owned identity; test public doctor-to-center and center-to-doctor paths | Booking must use real capacity and verified patient |
| **4. CG-17 price before booking** | Approve actual eligible policy, show gross fee, support and patient payable; test no/expired policy with **zero** unsupported subsidy | No invented automatic 50% saving |
| **5. CG-15 book → attend** | Book, read slip, reschedule/cancel where allowed, arrive/check in, queue, complete actual consultation, see own history | Main end-to-end patient journey |
| **6. CG-17 collect → settle** | Center collects verified patient amount; separate patient due from Foundation liability; produce actual month claim/review/CG-09 verified payout and correction | Money must follow completed service and verified proof |
| **7. CG-16 public lab** | Approved test/category/package/center prices, published lab directory, enquiries, ERP **OFF** behavior | The public catalogue should not require clinical ERP |
| **8. CG-16 optional clinical lab** | Only in a **disposable QA environment** with globally enabled Lab ERP AND genuine current center grant: consented lab order, sample chain, entered result or uploaded scanned report, independent professional review, release, patient-only read/correction | Not part of default operational journey; unsafe to simulate clinical approval |
| **9. Full regression** | Run Web/Internal Android/Public Android parity, two-center and branch negative tests, real PostgreSQL concurrency, file/provider failures, accessibility, original screenshots, and reviewer sign-off | Only then consider code merge |

If a step cannot run due to missing external credentials, real approval or clinical authority, write **BLOCKED — exact reason**. Do not replace it with fabricated data. You can continue independent applicable tests. If something belongs exclusively to a not-yet-built future module, label the existing owner QA line **FUTURE_OWNER** and stop: do **not** create the module here.

## 5. Test fixtures: create safe, REAL test data

Use a **nonproduction** database and synthetic names/no actual patient records.

- One Foundation root **R**, active branches **A** and **B** with different managers, and an inactive **C**. Create through actual supported onboarding/approval, not manual permission bypass.
- Two independently verified CG-14 locations: **Clinic X** and **Clinic Y**; distinct center representatives and center fee versions. Add **Lab X** if different from Clinic X, and one approved pharmacy/nursing/procedure partner offer for ERP-OFF display checks.
- Staff: root Super Admin; distinct independent approval reviewer; branch A manager; branch B manager; center X representative/receptionist; center Y representative; affiliated doctor (and dual-affiliated doctor if accepted by current rules); explicitly authorized lab processor/reviewer; ordinary unauthorized staff; revoked account.
- Patients: P1 with verified own identity and consent for Clinic X; P2 without required consent; P3 with prior booked slot; optional P1 request at Y **without Y-specific care authorization**.
- Use different current center fees, a valid/expired/absent assistance policy, a genuine last-available slot, a valid test and a verified CG-19 private file only after storage/scanner is configured.
- Use payment **sandbox/testing instruments**, not genuine patient collection. Actual paid/settled status needs the original authorized verification; otherwise keep status DUE, PENDING, UNKNOWN or BLOCKED.

**Environment:** See [environment example](../../.env.example). All four optional ERP flags default **false**: LAB, PHARMACY, NURSING and OT. Do not switch the latter three ON for this assignment. A private lab flow needs global Lab flag ON **and** current allowed center/role/consent; use separate disposable environment/config. Never commit secrets, credentials, private patient files or test database backups.

## 6. Manual scenario checklist — do on real screens and APIs

**How to use this list:** These are beginner-friendly **walkthrough prompts**, **not new canonical QA IDs**. Locate each applicable original US-xxx-QAxx in the linked module **tasks.md**, record the result **there**, and add screenshot/network/API/SQL evidence. For each applicable step compare **Web ↔ Internal Android** for the same staff actor and **Public Web ↔ Public Android** for public/patient actions. An unavailable screen is **FAIL or BLOCKED**, not N/A, when the original requirement says that actor must have that capability.

### A. Foundation and permission safety (CG-01/02/03/19/09)

| Walkthrough | Steps | Expected |
|---|---|---|
| A01 | Sign in root, A manager, X receptionist, patient; inspect menus and direct URLs | Only authorized menus/actions; direct API also enforces rights |
| A02 | A manager changes current branch to B, guesses B URL, selector, export and record ID | No B data or write; root can view only genuinely permitted scope |
| A03 | A manager tries X private patient/doctor file using branch access alone | Denied; branch does not grant center clinical access |
| A04 | Revoke role/center affiliation during an open edit; try Save, Back, cached list and Android resume | Current backend permissions apply; no cached private leak |
| A05 | Original provider/policy requires approval: submit, approve with **different authorized** actor, reject/return/stale revision | No self-approval or double effect; clean audit and user feedback |
| A06 | Open protected CG-19 file with authorized patient/clinician; then guessed link/expired URL | Authorized purpose succeeds, unauthorized/expired denied |
| A07 | Simulate timeout/duplicate submit during a protected write | Verify original status by same request key; no duplicate center, payment or document |
| A08 | Check CG-09 posted Foundation statement and separate center cash | No partner patient cash represented as Foundation donation/bank income |

### B. Healthcare network and center onboarding (CG-14)

| Walkthrough | Steps | Expected |
|---|---|---|
| B01 | Create provider/center draft with required business details; test blank/invalid/duplicate fields | Helpful English field errors; no half-created approved center |
| B02 | Upload legal/medical proof and submit for review; inspect pending/returned/rejected | Private files remain restricted; truthful approval status |
| B03 | Reviewer approves X; do not approve Y; search public directory | Only eligible currently published center/service appears |
| B04 | Suspend/unpublish X, refresh public Web/Public Android or open direct provider detail | Stale center/service disappears; no public private details |
| B05 | Link doctor to X and Y with independent verified affiliations/fees | Right center, fee, license, effective date and actor scope |
| B06 | X receptionist tries to edit Y fee, representative, content or license | Web/native action hidden; direct API denies |
| B07 | X content edit/photo → independent review/publish/withdrawal | Preview and public content are current, legitimate and safe |
| B08 | Approved pharmacy/nursing/procedure partner offer with all ERPs OFF | Public Web/Android show only approved offer/contact/enquiry; no fake stock, appointments, operation or paid benefit |

### C. Patient and appointment journey (CG-15 + CG-17 quote)

| Walkthrough | Steps | Expected |
|---|---|---|
| C01 | Register/login verified P1; claim/intake from existing patient source, check required consent | One patient identity and own record; no silent duplicate or medical exposure |
| C02 | Search by doctor → center; then center → doctor, same date | Both use the same real schedule, center fee and actual availability |
| C03 | Configure doctor day/leave or suspend doctor/center; try booking affected slot | No stale or unavailable slot can be confirmed |
| C04 | Compare an eligible current policy vs no/expired/invalid policy at review | Show **gross fee − actually approved support = patient due**; unsupported support is zero |
| C05 | Try booking same final slot simultaneously on two sessions/devices | At most one accepted booking; loser gets recoverable message |
| C06 | Book pay-at-center, reload patient Web/Public Android, view slip/QR | Appointment confirmed if successful; **payment still due** until verified collection |
| C07 | Lose network after booking request; refresh/submit original request again | No duplicate booking/slip; original saved status retrievable |
| C08 | Center receptionist scans/verifies arrival; progresses own queue and genuine visit | Only X's patient/visit; timestamps and states reflect real events |
| C09 | Y receptionist or unrelated clinician guesses X appointment or patient file | Denied for lists, direct detail, scan, clinical files and download |
| C10 | P1 reschedules/cancels where rule permits, including last-minute and already completed visit | Correct permission/availability/charge consequences; no retroactive fake completion |
| C11 | Clinician assigned to X sees permitted own day/activity/history, changes doctor/center mid-view | Only current authorized cases; no stale prior-center response |
| C12 | P1 sees own appointment/receipt/released report history; P2 tries P1 direct link | P2 denied; patient-only resources never become public |

### D. Money and Foundation support (CG-17 + CG-09)

| Walkthrough | Steps | Expected |
|---|---|---|
| D01 | Create valid approved, absent, expired and fully exceptional policy | Correct effective policy; exceptional full support requires separate real approval |
| D02 | Center X shows initial charge, patient paid/due, support and center gross | Values mathematically reconcile; no generic automatic 50% or invented lab discount |
| D03 | Center X accepts authorized real/sandbox cash/verified merchant payment, including partial payment | Verified amount decreases patient due once; receipt from original source |
| D04 | Enter unverified manual UPI/card/bank reference or gateway pending/failed callback | **Not PAID**, not a permanent hold, not Foundation bank receipt |
| D05 | Duplicate payment callback/retry/refund/correction and inspect history | No double collection; original verified state, refund and immutable history preserved |
| D06 | Booking exists but consultation not completed; inspect Foundation liability | No completed-service liability or payable solely from booking/payment |
| D07 | Complete authorized consultation with approved support; recalculate eligible liability | Exactly one Foundation payable to actual X, separate from X patient cash |
| D08 | X and Y monthly claim, independent reviewer, same payable account and real bank reconciliation | Only legitimately verified Foundation payout is SETTLED; no cross-center or duplicate disbursement |
| D09 | Replay journal/correction after timeout; simulate duplicate source, late correction and reversal | CG-09 balanced once, original audit retained; no phantom money |
| D10 | Test existing ERP-OFF service partner claim with real CG-19 invoice+delivery proof, reviewer and policy | No false CG-15 consultation, no benefit without independently verified service/invoice and eligibility |

### E. Lab/public diagnostics and optional clinical ERP (CG-16)

| Walkthrough | Steps | Expected |
|---|---|---|
| E01 | Add original test/category/package and X/Y distinct approved current rate; edit stale version | Real active test/price history; X cannot edit Y |
| E02 | LAB ERP OFF: visit public lab offers/prices and center enquiry on Web/Public Android | Published approved catalog/enquiry still works; no private lab order |
| E03 | All ERP flags OFF: try direct hidden lab operational API or patient-only private report from another account | New private operations denied; already lawfully released own historical report remains protected/readable |
| E04 | QA-only Lab ERP ON + actual X grant; create lab order for P1 with valid consent and current tariff | Accepted only with full authorization; no invented payment verification |
| E05 | Record sample receipt/custody/recollection and test duplicate barcode/concurrent update | Valid state transitions once; no wrong sample or cross-center edit |
| E06 | Enter real test values or upload report using original scan/CG-19 approval path | Unverified/unsafe file never becomes released report |
| E07 | Qualified professional reviews and releases; patient reads on own Web/Public Android | Independent licensed release; patient-only authorized document |
| E08 | Correct released result with reason and version; access prior record and test retries | Original retained; separately approved corrected version; no overwritten medical evidence |
| E09 | Disable Lab ERP after release; staff tries new order, patient reopens own lawful released report | New operation blocked, historically authorized read controlled |
| E10 | Try X→Y, unauthorized reviewer, wrong patient, expired license, scanner unavailable | Deny/hold safely without leaked health data or fake approval |

### F. Common usability, recovery and cross-channel regression

| Walkthrough | Steps | Expected |
|---|---|---|
| F01 | On every used page test empty, loading, success, validation error, API 400/401/403/409/500, offline, slow network and retry | Useful plain-English message; no technical ID/SQL/stack trace; no misleading success |
| F02 | Open each journey at desktop 1440/1024/768 and mobile 390/320 widths | No horizontal overflow; responsive form, list, details, drawer, modal and actions |
| F03 | Android physical Back, screen rotation, app background/resume, stale selected X/Y, font scaling | Correct navigation and current patient/center scope; no mixed results |
| F04 | Test keyboard-only, visible focus, input labels, touch targets, readable contrast and screen-reader labels | Core actions accessible on relevant Web/native channel |
| F05 | Compare original client screenshots and latest CG-01 components to rendered screens | Similar real client brand/navigation/hierarchy; improvements do not change business meaning |
| F06 | Confirm every visible button, filter, search, date selector, export, preview, download and status chip | Action works against original source, or absent if out of agreed scope |
| F07 | Compare same user/action between Web and appropriate Android app | Same saved result/permissions/fields/status; native operation, not WebView |
| F08 | Inspect page logs, API, DB, private files and event callbacks for PII leakage or unbounded work | Redacted logs, scoped data, bounded queries/workers and real audit |
| F09 | Run two simultaneous center sessions, last-slot request, same payment callback, concurrent review and two clinical updates | No double-slot, double-payment, double-release, invalid state or cross-center data |
| F10 | Run fresh/upgrade migration, backup/restore, then repeat an end-to-end scenario | No broken schema/constraints, old evidence loss, or partial transactions |

**Do not treat the tables alone as the whole approved test plan.** Run **every relevant original US QA case**, plus existing [two-branch/two-center MB-T01–MB-T22](CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md); record mapped outcomes in the original module progress rather than creating a parallel QA truth source.

## 7. UI/UX enhancement guide — what "client aligned" means

The client's original Foundation Admin is the **design reference**, not a license to show all the old menu items. Preserve the original CareGanga branding, logo, content, hierarchy and consistent CG-01 shell while reducing clutter and making all actually allowed actions obvious.

**Mandatory references:** [167-screen Admin visual audit](../research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md), [healthcare Hxx/reference mapping](../research/CAREGANGA-HEALTHCARE-SEPARATE-UI-SCREENSHOT-REFERENCE-MAP.md), [original website replication baseline](../research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-REPLICATION-BASELINE.md), [current CG-01 Web/Android UI audit](CAREGANGA-MAIN-INTEGRATED-CG01-WEB-ANDROID-UIUX-20261120.md), and each **CG-14/15/16/17 uiux.md** above. Original raw screenshot ZIP/healthcare images may live in private project Library, **not** the source repository. Obtain the actual images before marking exact pixel/motion similarity PASS. References **H07–H17** and **UI-06–UI-24** provide original clinical intent; do not invent invisible controls from a title.

Before changing a screen, take a **BEFORE** screenshot and record actor, route, width and reference screenshot ID. Then:

1. **Navigation:** Keep separate Public Site, signed-in patient, Foundation Admin, and authorized own-Center entry paths. Hide unavailable actions rather than showing dead buttons or future ERP placeholders.
2. **Clear tasks:** One primary action per screen; sensible order (provider → center → doctor → fee; patient → slot → actual quote → confirm → slip). Use short section headings, clear required/optional labels and names instead of UUIDs.
3. **Forms:** Inline English validation, useful examples, required fields only, correct date/amount constraints, save progress/confirmation and safe return path.
4. **Status:** Visually separate **draft/under review/approved/published**, **booked/waiting/completed/canceled**, **patient due/verified payment**, and **Foundation owed/settled**. No success toast before the source confirms a successful write.
5. **Protection:** Never display medical notes, license files, payment proof or patient identifiers on public cards; use permitted purpose-specific views. Role changes and center changes must clear stale data.
6. **Responsive design:** Proper drawer/tab/table/card hierarchy for Web; original native UI patterns for Android; safe areas/keyboard/screen-reader/font scaling; no WebView substitute for required native action.
7. **Consistent voice:** Simple understandable English; user-facing errors explain what happened and how to recover. No raw status enum, technical DB keys, internal IDs, placeholder counts or sample healthcare claims.
8. **Evidence:** Take **AFTER** screenshot/video at same viewport and compare text, spacing, visual hierarchy, interactions, responsive and motion states against the actual reference; attach before/after and reviewer notes.

Do **not** redesign the entire app or introduce new styles where shared design tokens and existing components work. When the original screenshot has a **future** module screen, record FUTURE_OWNER and do not clone it now.

## 8. How to run, trace, fix and re-test

**A. Local preflight** (use the repository's actual Node version and [environment example](../../.env.example); configure credentials in local secret files only):

~~~bash
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
node --version
npm ci
npm run verify:all-source
npm run verify:local-build
# In a disposable configured backend environment:
npm run db:migrate
# Start backend/Web in separate terminals:
npm run dev:backend
npm run dev:web
# Run both native apps on actual test devices/emulators:
npm run start:android-internal
npm run start:android-public
~~~

Also run the applicable registered root source checks, for example **verify:cg14-source**, **verify:cg15-final-source-gaps**, **verify:cg16-us002-source**, **verify:cg17-us003-source**, **verify:healthcare-journeys-source**, **verify:healthcare-safe-errors-source**. A verifier being present in package.json is **not** proof it ran. Use actual configured storage/scanner/payment test mode; tests depending on absent providers are **BLOCKED**, not passed. Run backend contract/database tests and actual SQL migrations, multi-session races, and backup/restore separately. Avoid production mutation or real patient money.

**B. Code changes go to ONE authorized QA/fix branch from updated main**, not directly into main. This handout itself is a documentation-only main commit by owner request. Suggested branch name: **feature/careganga-healthcare-existing-modules-manual-qa-uiux-20261123** (create only if it does not exist). Never merge in an unmerged peer feature branch. Rebase/merge fresh main safely before final PR; migration numbers and shared files need review.

**C. Work one original story and one confirmed bug at a time.** Follow **Implement → manual independent source review → Fix → Re-review → actual manual QA trace → regression → commit**. First reproduce the defect with role, center, route, data, expected vs actual, timestamp and screenshot/API response; identify the **one true owning module** (CG-01/02/03/09/14/15/16/17/19/21 etc.). Fix its UI **and** backend/DB where actually required. Do not only hide a backend failure with frontend text. Run same success and negative scenarios again.

**D. For each original US QA entry in tasks.md record:**

- **QA ID / original story**, scope (ROOT, BRANCH A/B, CENTER X/Y, PATIENT_OWN), actor, prerequisites, Web/Internal Android/Public Android applicability or explicit reason N/A.
- **Observed** PASS / FAIL / BLOCKED / NOT_RUN, actual command/HTTP/DB evidence, before/after screenshots, date, environment and commit. Source inspection may be SOURCE_TRACED separately; **not** live PASS.
- **Defect** owning file/API/database migration, severity, fix commit, independent reviewer and re-test proof. If a user-facing enhancement changes behavior, cite the **existing requirement**. Do not add speculative story or acceptance ID.
- Track a future-only need as **FUTURE_OWNER(CG-22/23/24)** with owning original QA reference. Do not treat future implementation as an existing-code source gap. Close a genuine existing-owner gap only after reviewing the actual resulting source and test evidence.

**E. Severity and blocking:** Critical = clinical/privacy exposure, cross-root/center breach, false paid/settled status, data corruption, duplicate committed financial/appointment effect. High = broken core booking, center registration, reports/review or lost authorized action. Medium = UI friction/validation/accessibility. Do not merge with Critical/High open, failed migrations/builds, failed core patient journey, mismatched authorized Web/native actions, or unresolved independent clinical/financial/security review for the changed critical paths.

## 9. Important routes and exact source directories

| User | Web route to navigate | Code entry |
|---|---|---|
| Foundation Admin sign-in | **/admin/login** | [Admin app routes](../../apps/web/src/app/%28admin%29/admin/) |
| Healthcare Admin | **/admin/health-network**; **/admin/health-network/doctors**; **/admin/health-network/reviews** | [CG-14 Web features](../../apps/web/src/features/health-network/) |
| Center owner | **/center** | [Center portal route](../../apps/web/src/app/%28admin%29/center/page.tsx) |
| Foundation patients | **/admin/health-network/patients**; **/patient-intake**; **/queue**; **/schedules** | [CG-15 Web features](../../apps/web/src/features/appointments/) |
| Public approved centers | **/health-network**; **/healthcare**; **/healthcare/centers/[slug]** | [Healthcare directory route](../../apps/web/src/app/healthcare/) |
| Public doctor availability | **/health-network/doctors/[doctorRef]/schedule** | [Doctor schedule route](../../apps/web/src/app/health-network/doctors/) |
| Patient own area | **/patients/me** and own appointment details | [Patient app routes](../../apps/web/src/app/patients/) |
| Lab catalogue/center pricing | **/health-network/lab-tests**, **/admin/health-network/diagnostics**, **/lab-pricing**, **/lab-orders** | [CG-16 Web features](../../apps/web/src/features/diagnostics/) |
| Assistance/settlement | **/admin/health-network/assistance-policies**, **/liabilities**, **/settlements** | [CG-17 Web features](../../apps/web/src/features/healthcare-assistance/) |
| Staff Android implementation | Corresponding authenticated screens (not a website link) | [CG-14 native](../../apps/android-internal/src/features/health-network/) · [CG-15 native](../../apps/android-internal/src/features/appointments/) · [CG-16 native](../../apps/android-internal/src/features/diagnostics/) · [CG-17 native](../../apps/android-internal/src/features/healthcare-assistance/) |
| Patient Android implementation | Corresponding public/own-patient screens | [Public healthcare](../../apps/android-public/src/features/health-network/) · [Public appointments](../../apps/android-public/src/features/appointments/) · [Public patient files](../../apps/android-public/src/features/patients/) |

These are **source routes**, not a claim of current deployed availability or permission. Verify they work after actually running the environment. For public website/client visual comparison also follow the separate [original navigation contract](../research/CAREGANGA-ORIGINAL-PUBLIC-NAVIGATION-CONTRACT-20261118.md).

## 10. Definition of DONE — before requesting merge

The developer must provide **one short handoff report** containing:

1. **Baseline and branch:** exact main baseline SHA, feature branch, final SHA, files changed and no accidental unrelated module work.
2. **Story coverage:** CG-14 / CG-15 / CG-16 / CG-17 originals, dependencies and all applicable original QA IDs with real PASS/FAIL/BLOCKED/NOT_RUN; do not silently drop blocked clinical/provider tests.
3. **E2E evidence:** one actual full supported consultation journey, one ERP-OFF lab/partner journey, both center X/Y privacy-negative journeys, Web + both applicable native apps, screenshots and logs with redacted PII.
4. **UI/UX improvements:** link each changed route to reference H/UI/Admin screenshot, before/after comparison, useful English safe errors, responsive/device and accessibility checks.
5. **Backend integrity:** evidence for real PostgreSQL fresh + upgrade + restore, current role/center/patient guards, transaction/idempotency/concurrency, CG-19 scan/report and **actual verified** CG-09/17 finance where tests are legitimately possible.
6. **Independent reviews:** architecture/source, security/privacy, DB/concurrency, finance and qualified clinical review where required; list names/dates, findings, fix commits and re-review. **Never claim independent review without another reviewer actually doing it.**
7. **Open items:** list *only* real unresolved existing-owner bugs and external test blockers; separately list future CG-22/23/24 scope. Zero open critical/high accepted defects.
8. **Merge:** open PR targeting **main**, show diff against updated main, request independent review, resolve conflicts, rerun actual checks/regression and obtain the authorized merge approval. **Do not bypass a failing test or claim release-ready from a successful source script alone.** After approval and merge, record real merged SHA and handoff.

### Copyable short update template

~~~text
CareGanga Healthcare QA / UIUX — developer update
Baseline main SHA:
Feature branch / current SHA:
Stories checked: CG14 __ / CG15 __ / CG16 __ / CG17 __ (original QA IDs linked in tasks.md)
Manual runtime: PASS __ | FAIL __ | BLOCKED __ | NOT_RUN __
Patient consultation E2E:
Public Lab ERP-OFF / optional Lab ON:
Two-center privacy + branch isolation:
Web / Internal Android / Public Android:
Backend + PostgreSQL + providers + concurrency:
UI reference comparison:
Critical __ | High __ | Medium __ remaining:
Fix commits + independent reviewer:
PR to main / merge decision:
~~~

**Last reminder:** User-facing improvement, reliable real healthcare functionality, safe finance and privacy are the objective. A future module or a static mockup is never a substitute for a completed, tested existing flow.
