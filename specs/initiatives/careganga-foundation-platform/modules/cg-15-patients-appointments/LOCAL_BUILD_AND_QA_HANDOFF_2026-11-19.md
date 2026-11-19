# CareGanga CG-15 — Local build, integration and QA handoff (19 Nov 2026)

**Branch:** `feature/careganga-cg14-healthcare-network-dev-20261118` in `jasiqlabs/careganga`  
**Scope:** CG-15 US-001–US-008, CG-01 verified patient signup, CG-14 verified healthcare source and CG-19 private appointment slips.  
**Handoff state:** SOURCE WORK IN PROGRESS / READY FOR INITIAL LOCAL COMPILE AND TEST; **NOT** independently compiled, PostgreSQL-migrated, browser-tested, Android-tested, clinical-reviewed, source-approved or production/merge-approved.

Keep fixes on **this same feature branch**. No CI/GitHub Actions. Never merge based solely on static test names, handoff or scripts. Preserve prior database migration files as immutable once deployed. Feature is still behind four commits on `main` involving auth/db/bootstrap and UI; review compatibility before merge.

## Material source changes since prior independent review

- Protected original patient identity verification by a current assigned center; patient-generated one-time CGI code and immutable event. Center-provisional intake has separate CGC code issuance/claim with in-person identity attestation, person-specific patient account link and patient-care consent. No phone-based automatic merge or implied shared mobile person identity.
- Patient-approved **one-time** CGB center-specific receptionist booking authorization; source table and composite original patient/hold/center FKs in migration `1430`. Original CG-15 global doctor reservation, current CG-14 price/slot and verified patient/consent are checked by the same hold/confirm core for self-booked and authorized staff-assisted bookings. Staff request recovery preserves exact request keys; public patient and staff cookies/routes remain separate.
- Center Portal and H15 intake-only workspace surface the real receptionist booking form; duplicate old provisional registration form removed. Foundation H15 real center-name filtering no longer blanks the location picker solely after 200 centers; results remain bounded.
- Private CG-19 consultation PDF status, issue and download available to currently authorized **own-center** staff using the original consented appointment source. Strict staff-only BFF; queue renders on-demand action per booking, without preloading 100 PDFs. Revoked slips are not shown as downloadable, and pending/unknown source issues are not retried as new documents.
- Web + public Android real patient appointment history now supports precise-cursor older pages; original appointment remains owner scoped.
- **Internal Android parity:** the signed-in receptionist has a separate menu option only with `health.patients.intake`; current assigned center (including original IANA time zone), doctor, day, one-time patient code and the original hold/confirm/request-key recovery are reused. The separate `health.visits.manage` queue has **one lazily mounted** CG-19 private PDF action for the selected booked patient, using authenticated `expo/fetch`, validated PDF bytes and an ephemeral OS cache deleted on app return/unmount/record switch. No hardcoded center time zone or sample patient records.
- CG-01 pre-registration external SMS verification and password hashing are outside the SQL transaction. Current own-account and staff appointment-slip reads are separately checked; critical security and concurrency tests below must still be executed.

**Migration preflight:** Ten files 1420–1429 and new 1430; a fresh remote source-only lexical scan found 11/11 structurally readable. That is **not** PostgreSQL execution, an integrity proof or SQL acceptance.

## Execute in a local development IDE and isolated database

From repository root, with Node >=22.13.0 and a newly provisioned **non-production** PostgreSQL database. Never put client production secrets or clinical patients into test screenshots/logs.

```bash
git checkout feature/careganga-cg14-healthcare-network-dev-20261118
git fetch origin
git status --short
npm ci
npm run verify:cg15-migrations-source
npm run verify:cg15-us001-source
npm run verify:cg15-us002-source
npm run verify:cg15-us003-source
npm run verify:cg15-us004-us008-source
npm run build -w apps/backend
npx tsc -p apps/android-public/tsconfig.json --noEmit
npx tsc -p apps/android-internal/tsconfig.json --noEmit
npm run build -w apps/web
```

Inspect every failure. A source-marker check is not an acceptance test. **Do not run `npm run db:migrate` against the client's production DB**. On a clean temporary PostgreSQL database with real extensions and an explicit local `apps/backend/.env` containing `DATABASE_MIGRATION_URL`, run:

```bash
npm run db:migrate -w apps/backend
```

Check all migration names/hashes, **including 1428/1429/1430**, PostgreSQL extension `btree_gist`, FK/unique/exclusion constraints, immutable event triggers, query plans and a second clean replay. Create an isolated database backup and demonstrate restore/rollback of the *environment*, not destructive down-migrations. Do not modify migration 1430 after applying it without a new forward-only migration.

Configure approved local non-production `CG15_PATIENT_CONSENT_VERSION`, `CG15_PATIENT_CONSENT_TEXT`, `CG15_HOLD_MINUTES` (5–10), `CG15_CHANGE_CUTOFF_MINUTES`, a secure `CG19_APPOINTMENT_QR_KEY` and the existing required CG-01/CG-14/CG-19 database, account, identity provider, object-storage, private-file scanner and backend URL variables. Real Twilio verification must be isolated to approved test phone numbers. A missing provider must fail closed, not be bypassed to fabricate a successful patient.

Run the backend, Web and both Expo applications on test devices using the existing documented workspace commands. Validate the *exact current branch* without deploying, CI or GitHub Actions.

## Manual trace sequence — follow the original 128 cases in tasks.md

1. **CG-01 + CG-14 prerequisites**: standard mobile/password sign-in, verified contact, active center/provider/doctor affiliation, current approved consultation fee, published schedule and assigned own-center receptionist permissions. Check suspended, wrong-root and unassigned-role negatives.
2. **US-001/002**: save schedule in the right center zone; leave and exceptions; multi-center doctor slot preview and real fee/timezone; DST ambiguous/nonexistent times, stale version, absent effective approval.
3. **US-003 personal account**: sign up with real test SMS proof then register one provisional profile; consent and CAS edit; issue CGI patient code, staff in-person proof, patient state VERIFIED, immutability and replay. For center-created provisional intake, staff gives CGC claim code, correct verified account claims original patient once with fresh consent; guessed, expired, revoked, wrong-center, suspended-staff and duplicate-account claims must fail. Shared family mobile **must not** merge patient records.
4. **US-004**: patient self hold/confirm; separate verified patient issues CGB code for one center; assigned receptionist books exact current center/doctor/time using same CG15 global hold and confirmation. Test duplicate keys, fee revision drift, 5–10 minute expiry, patient consent withdrawal, role revocation, provider suspension, cross-center misuse, simultaneous two-center doctor booking and exclusion/deadlocks. A staff-created booking must appear in the patient account's original history.
5. **US-005/006**: patient and currently authorized own-center staff may request/download the *same original CG19 private consultation PDF* and QR. Verify current center, consent, stale/revoked/superseded/unknown states, SHA/PDF bytes, status-only public QR, and cross-center denial. Check in at actual center; queue local day, daily sequence, state transitions, 100-record cursor pages, token/IDOR negatives.
6. **US-007**: patient cancel/reschedule exactly one original appointment using version + request key; verify no ghost reservations, one doctor-wide slot overlap and new CG19 slip version; uncertain reschedule retry cannot accidentally create another booking.
7. **US-008/H15**: real Foundation root patient KPIs, virtual ID/booking/name search and date/status/state/district/type/center filters, including >200 centers; Web/patient Android older-history cursor, role-based menus, responsive H07/H15 screenshot content and accessibility/back navigation. Unsupported CG16 clinical reports, CG17 receipts, video/ERP and future conditional flows are **not** acceptance-passed merely because hidden.
8. **Regression**: CG-01 login/session security, CG-02 Foundation root, CG-03 doctor leave workflow, CG-14 healthcare provider/center original ownership, CG-19 donation/finance/CMS private document functionality, and public website references; enforce no hardcoded sample patients, prices, credentials or technical UUID labels in UI.

For each actual **US-NNN-QA##** case, log tested commit SHA, command/device, real inputs redacted, expected vs observed, SQL/API trace, evidence and status. After fixing any finding: **review → fix → re-review → rerun affected scenarios**. Do not label an unexecuted scenario PASS.

## Explicit open gates

- **Local TypeScript, Next/Web, Android-public/internal builds and real PostgreSQL migration/restore**: NOT_RUN in GitHub-source-only session.
- **Browser and physical Android testing**: NOT_RUN; CG-19 PDF camera scanner/status, mobile screenshots, accessibility and 16 KB Android package alignment NOT_RUN.
- **Actual two-session DB exclusion/deadlock, wrong-center IDOR, approved consent life-cycle, rate-limits, clinical/privacy and CG19 private storage security tests**: NOT_RUN.
- **Client-owned H07/H15 screenshots and original public website pixel/content parity**: not independently visually approved here.
- **CG-16 patient-owned released private reports, CG-17 genuinely verified center receipts and full CG-19 outbound notifications**: still require owning-module integration and independent requirements decisions; do not fabricate data or silently waive acceptance.
- **`main` synchronization**: feature currently behind four upstream commits; verify real change conflicts in auth, migration runner, DB and Web before requesting merge.

**Disposition:** Local developer can start the build and QA with these steps. The module is **not** independently SOURCE_COMPLETE, QA_PASS, production-ready or merge-approved.


## Same-branch follow-up: patient booking isolation and sensitive-state recovery (19 Nov)

After the Android receptionist implementation, a further independent static read found a cross-audience access edge: an account that is both a patient and receptionist could request the patient-only hold-status route for **another patient's** staff-created hold. The current `ConsultationBookingService.holdStatus` now checks the **actual linked patient's ID equals the hold patient** and otherwise returns not found. Staff original request recovery remains explicitly current-center and permission scoped. **This is a source fix, not a proven penetration-test pass.**

Public Web now distinguishes explicit rejected HTTP 4xx booking requests from genuinely unknown server/network outcomes, uses exact original key checks (not truncated recent history), scopes one-time patient receptionist code visibility to its originating center, and remounts booking action whenever doctor, center, time or accepted fee changes. Staff Web and Internal Android clear prior patient ID and one-time code when switching the center, doctor or booking day. Six additional source-preflight assertions were added in the existing CG15 verifier; **not executed remotely**.

**Add to actual original US-003-QA16 and US-004-QA04/11/12/14 local QA:** test one same-account dual-role receptionist/patient holding for a different patient and reading the patient-only hold endpoint (must deny), own hold (must permit), cross-center read (must deny), 400/403/409 rejection vs network-lost response with same-key exact recovery, and code/old-held appointment not visible under a newly selected doctor, center, date or price in Web and Android. Also run `npm run verify:cg15-us004-us008-source` on the exact checkout and independently review all output. Neither source assertions nor their eventual passing replace real device, DB, multi-session, rendered UI or qualified security/clinical QA.

Original 128-case source classifications remain **historical conservative counts** pending full current-commit retracing; no runtime-case PASS or source-complete signoff is asserted. No `main` merge, PR, CI or deployment is authorized by this handoff.


## Further source remediation: staff cancellation, cross-doctor change and H07 copy

The active feature branch has **additional source commits** after the initial handoff; use its exact current HEAD, not the earlier reviewed commit. This section supersedes the initial source-gap counts, but does not remove the earlier local build instructions. Latest canonical classification at this checkpoint: **72 SOURCE_VERIFIED / 46 SOURCE_GAP / 3 NOT_VERIFIABLE / 7 NOT_APPLICABLE** across 128 original QA cases, **0/128 executed PASS and 0/8 formally SOURCE_COMPLETE**. Retest and reclassify only with real evidence; the remaining gaps are still source-review work, not cleared by this handoff.

1. **US-007 staff cancellation:** CG01 now has separately assignable `health.appointments.cancel`. Backend staff cancellation checks current CG14 own-center affiliation and this action *inside* the same original appointment transaction, locks the actual doctor, validates booking revision/cutoff and idempotent request key, releases the reservation and records the immutable original cancellation event. Web and Internal Android queues show a two-step action only if permitted. Exercise forbidden role, Center A actor targeting Center B, wrong root, revoked grant, cancelled/check-in booking, two-staff same-key replay and lost response. Ensure patient self-cancel remains independent and existing queue/CG19 documents do not regress.
2. **US-007 cross-doctor reschedule:** Same original patient booking now supports a different approved CG14 doctor with accepted real fee and center. Both doctor locks are acquired in deterministic order. A failed new reservation, stale version, wrong fee, consent revocation or exclusion must roll back the *entire* change, leaving old appointment and slot valid. The same doctor/center/time remains a no-op, but changing doctor at that exact time is allowed. Web patient history and Public Android offer current verified different-doctor selection; both use one original booking and immutable keyed `RESCHEDULED` event. New exact `reschedule/by-request` lookup must resolve a lost response without guessing from a similar appointment. Test two opposite simultaneous doctor swaps for deadlocks, provider suspension, private slip source revision, history and old/new center access.
3. **US-001 H07 copy:** Foundation Web editor can prepare a reviewed, unsaved copy of one doctor's current saved weekly hours for another currently verified same-time-zone center. It reuses `DoctorScheduleService.save` with current target revision and original center-hours + global-doctor overlap validation. Test different center zone (reject copy), overlapping sessions (server deny, preserve original), incompatible center opening hours, stale target revision, source later suspended, discarded drafts and successful non-overlap after manual session adjustment. This is **not** bulk multi-center execution, complete H07 screenshot equivalence, or a second schedule master.
4. **Queue and privacy:** Backend rejects `NO_SHOW` before original consultation scheduled end. Web and Internal Android remove previous patient QR code when switching consultation day. Public Android booking distinguishes 4xx rejection from unknown network outcomes, binds CGB staff authorization to the selected center and remounts per doctor/time/fee selection. Test rapid center/date/doctor changes, Back, session expiration, network loss, old QR/PDF cache and original patient ownership.
5. **Source scripts:** Existing `verify:cg15-us001-source` and `verify:cg15-us004-us008-source` were expanded with new path assertions. **Those scripts are not a substitute for compiling or executing test scenarios, and have not been run in the remote GitHub editing session.**

**Remaining true source defects / owner contracts:** independently reviewed shared-family identity, CG19 patient clinical document upload/scan and outbound notices, clinician-specific permissions, full H07 bulk/action and full original H15 UI, automatic original CG19 post-confirmation slip handling, camera QR scan, native safe share/print, clinically authorized reports and other original QA SOURCE_GAP cases. Do not invent CG16 diagnostics or CG17 payment sources or relax privacy merely to classify them as passed. Original visual screenshot pack, real migrated PostgreSQL, Nest/Web/native builds, object storage and qualified human security/clinical/DB review remain separate **NOT_RUN** gates.

**Current disposition remains DEVELOPMENT_IN_PROGRESS.** This document permits an initial nonproduction local checkout and debugging, **not** certification that all source gaps are fixed, source merge approval or production release.


## Post-handoff source revisions — queue privacy, leave conflicts, claim throttling

**Use the current feature branch HEAD and this appendix (not a previous 19 November commit).** Canonical source QA tracker now records **74 SOURCE_VERIFIED / 45 SOURCE_GAP / 2 NOT_VERIFIABLE / 7 NOT_APPLICABLE = 128**; **0 runtime PASS and 0/8 formally SOURCE_COMPLETE**. This appendix supersedes older descriptions of no-show and migration coverage.

- **No-show is a separate never-arrived booking mutation.** New `POST /api/v1/appointments/queue/my-centers/:centerRef/no-show` requires current `health.visits.manage` and assigned CG14 center, checks real `CONFIRMED` booking, scheduled consultation end and that there is **no existing queue/check-in**, serializes on doctor+booking, updates the original appointment to `NO_SHOW`, releases expired reservation and appends the original immutable event. No fake queue token; `ARRIVED/WAITING→NO_SHOW` is removed. Existing Web/Android use the same guarded source route. Negative test before/after end, already-arrived or cancelled bookings, wrong center and concurrent staff/idempotent replay. Note: no-show records do not create clinical charges.
- **Consent and privacy:** Center QR verifier now rechecks the latest immutable patient-care consent; authorized queue reads mask patient names at SQL projection when consent withdrawn; check-in locks actual patient and tests latest consent inside its transaction. Staff Web and Internal Android hide new check-in/private PDF actions after withdrawal. Existing lawful appointment history and already-started operational visit are not automatically deleted; clinical access owner still needs separate consent and purpose checks. Execute two-session consent versus check-in race, revoked QR, cached private PDF and Center A/B IDOR.
- **Doctor leave overlap:** Protected Foundation H07 receives exact count and bounded booking display references of overlapping genuine `CONFIRMED` appointments prior to activation; H07 requires explicit acknowledgement. Apply recomputes affected records under actual doctor lock and reports up to 25 real booking IDs; all original appointments stay confirmed for individual follow-up. It neither sends notices nor silently cancels. Exercise approved leave with booked patients, concurrent appointment confirmation and lost status response. Root scheduler permission is required; no center employee can use this protected publisher surface.
- **Schedule V1 enforcement:** API now rejects unsupported `VIDEO` schedule writes; only `IN_PERSON` can be authored. User interface never promises remote consultation or unsupported capacities.
- **H15 center-search:** Protected Web BFF, Nest `PatientAdminOverviewController`, actual `PatientAdminOverviewService` and the H15 selector now consistently carry `centerSearch` and enforce 60-character maximum. Search across greater-than-100 real centers and ensure only matching true source centers are shown; wrong-root/role returns no protected data.
- **New SQL migration 1431:** `1431_cg15_patient_claim_attempt_throttle.sql` adds a single (root realm, account) row for 15-minute fixed-window attempted clinic-patient-claim budgets, maximum 20 attempts per window across servers. Original `PatientProfileService.claimCenterIntake` records a throttle attempt in an independent autocommit statement **before** any failed/rolled-back claim lookup. It retains no raw codes or target patient IDs. Web protected 429 code and safe error are wired; Public Android uses same backend. Check clean migration order `1420…1431`, upgrade from 1430, 20 accepted quota attempts/21st 429, reset after window, concurrent multi-instance increments, wrong proof and duplicate original patient/account claims. Ensure migration rollback/restore and schema constraints work physically; no migration was executed remotely.

**New manual commands / acceptance:** run the existing repository local preflights `verify:cg15-migrations-source`, `verify:cg15-us001-source`, `verify:cg15-us003-source` and `verify:cg15-us004-us008-source` before independent Nest/Next/Expo builds; these are source-only. Run PostgreSQL clean migration and upgrade with 1431, concurrent negative and permission tests, screen/device accessibility, original H07/H15 screenshot comparisons, CG19 private document verification, and clinical/security specialist review. No CI/GitHub Actions. Do **not** sign off or merge yet: 45 SOURCE_GAP cases and other source and runtime gates remain open.

## Final V1 source-closure handoff correction — 19 November 2026

**The earlier checkpoint numbers throughout this handoff are historical and MUST NOT be used as the current source gate.** Current canonical source classification from the original 128 rows is **87 SOURCE_VERIFIED / 32 SOURCE_GAP / 2 NOT_VERIFIABLE / 7 NOT_APPLICABLE**. **0/128 actual executed runtime QA PASS; 0/8 formally SOURCE_COMPLETE.** The authoritative remaining gap-by-gap ownership/evidence is now [V1_SOURCE_CLOSURE_LEDGER_2026-11-19.md](V1_SOURCE_CLOSURE_LEDGER_2026-11-19.md). Current branch is still `feature/careganga-cg14-healthcare-network-dev-20261118`; use its latest SHA, not a hard-coded previous commit.

**New source changes since the prior handoff:**

- Internal Android receptionist-assisted confirmation and by-request recovery now attempts the actual authenticated CG19 private status/issue flow, with the same issue key and no fabricated issued/sent state. All four confirmed booking clients have real post-confirmation CG19 issue attempts. A disconnected client cannot guarantee unattended delivery.
- H15 Foundation patient/booking panel has an actual selected-booking-only print style and action gated by matching loaded immutable history; no unapproved medical certificate, payment receipt or national health ID.
- CG15 booking confirm commits invalidated HELD→CANCELLED and globally reserved HELD→RELEASED when the original verified doctor/center/schedule/fee is deterministically rejected, under doctor lock. Transient service/storage failure does not silently cancel a hold. Test no-show/consent/fee/revocation/race and ensure no ghost reservation.
- Public CG19 status-only QR now rejects a patient with withdrawn current PATIENT_CARE consent, invalid linked CG01 owner or missing original verified identity proof; no PHI is returned. Test revoked old-issued QR on public and assigned-center routes.
- Foundation H07 roster now exposes actual PG booking count, center-local-day weekly working-session count and current approved-leave doctor count. Three formerly fake '—' KPIs are replaced by correctly labelled source counts; verify SQL query performance, current role and H07 UI/screenshots.
- Sensitive `health.visits.clinical.manage` current CG01 grant is required in addition to `health.visits.manage` for WAITING→IN_CONSULTATION and IN_CONSULTATION→COMPLETED; backend rechecks current real CG14 assigned center inside transaction and Web/Internal Android hide clinical controls without grant. This does **not** prove a logged-in actor is the verified treating doctor. A source link from CG14 doctor identity to CG01 account, matched to actual center/appointment, is **still required** for US-006-QA05 and US-008-QA04.

**Actual execution evidence:** In this GitHub source-editing session, `scripts/verify-cg15-us002-source.mjs` was evaluated with its unmodified assertion logic against 12 current GitHub file contents in isolated JavaScript. Two preflight checks expecting obsolete advisory-only UX were updated; rerun produced **25/25 SOURCE_PRESENT, 0 SOURCE_GAP**. This does **not** mean that `npm run verify:cg15-us002-source` was run inside an installed repo or that TypeScript, PostgreSQL, PDF, Android or screenshot QA ran. All other static preflight scripts remain to be executed locally and corrected if necessary. Do not count the static assertion as any of the 128 runtime PASS.

**Execute on local developer checkout before signoff:** `npm ci`; all package scripts named `verify:cg15-migrations-source`, `verify:cg15-us001-source`, `verify:cg15-us002-source`, `verify:cg15-us003-source`, `verify:cg15-us004-us008-source` (check actual root `package.json` entries); full Nest and Next builds; Web and both native TS checks; actual staged PostgreSQL migration 1420–1432 (including 1431 claim throttle and 1432 local-day index), backup/restore and EXPLAIN; two simultaneous staff/client hold and doctor swaps; authenticated doctor-role misuse; invalidated hold replay; consent withdrawal versus QR/check-in; current-center IDOR; private CG19 storage + original PDF/QR on real Android; browser H15 print; screenshot and accessibility comparison against H07/H15 client references. Record SHA/command/device/runtime outcome/evidence for each test.

**Disposition: still DEVELOPMENT_IN_PROGRESS.** Do not merge, deploy or claim final independent qualified security/clinical/DB signoff. Source gaps and cross-owner requirements in the new closure ledger are mandatory to resolve or obtain explicit owner policy, not automatically waived. The purpose of this handoff is initial nonproduction checkout, local build investigation and eventual qualified QA only.


## 19 November 2026 — CG19 postcommit appointment notification source/consent security

Canonical original-case tracker now reads **90 SOURCE_VERIFIED / 29 SOURCE_GAP / 2 NOT_VERIFIABLE / 7 NOT_APPLICABLE = 128** (0/128 executed runtime QA PASS and 0/8 formally SOURCE_COMPLETE). This overrides all earlier numeric snapshots in this handoff.

Migration **1433_cg19_appointment_event_notification_source.sql** adds a transactional original immutable appointment-event outbox, root-qualified event FK and bounded PENDING source claim. It extends the existing CG19 IN_APP/EMAIL/SMS notification model and `CommunicationWorker`/provider receipts. The event is enqueued in the SAME source transaction as its immutable CG15 appointment event; worker recovery handles missed LISTEN and restarts. The write path never waits for SendGrid/Twilio or declares false delivery. Existing CG03 notices remain unchanged.

**Independent privacy fix:** CG19's `NotificationService.inbox` and `read` now re-evaluate the original appointment's verified patient, active current linked account and latest PATIENT_CARE consent, not merely the recipient account status; revoked/retired patient access cannot continue to list or read stale in-app appointment notifications. External sends already revalidate current consent and ownership immediately before provider attempts. This is source-level, not executed concurrency proof.

**Re-run before approval**: `npm run verify:cg15-communications-source` plus all existing `verify:cg15-*` checks, Nest/Next/Expo compilation, fresh DB migration and 1432→1433 upgrade, event inserted but original TX rolled back (must be absent), duplicate/late concurrent event, 25-row source claim and restart recovery, no due rows/egress, opted-out channels, consent withdrawn before capture, consent revoked after capture but before inbox and before send, owner unlink, concurrent account reassignment, unknown provider status and later delivered/bounced callbacks. Test an actual verified SendGrid/Twilio provider only after the client's credentials and consent are configured. Source-only `verify:cg15-communications-source` was evaluated against six current GitHub files with **12/12 static checks present**; not run as local npm, PostgreSQL, provider, browser or native QA.

**The original US-005-QA12 remains SOURCE_GAP:** IN_APP/EMAIL/SMS are implemented, but neither WhatsApp/push nor per-booking user-facing delivery status has been verified. Original US-006-QA14 and US-007-QA01/QA12 now have connected source-level CG19 event-to-outbox paths. Actual two-doctor booking races, clinician authorization, patient uploads and provider/device QA remain open. No main merge or production release approval.
