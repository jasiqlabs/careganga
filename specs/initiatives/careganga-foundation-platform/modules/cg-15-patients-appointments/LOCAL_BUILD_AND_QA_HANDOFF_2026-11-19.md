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
