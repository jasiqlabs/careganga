# CG-15 — Separate independent static source-review checkpoint

**Review date:** 2026-11-19 (IST)  
**Repository:** `jasiqlabs/careganga`  
**Feature branch:** `feature/careganga-cg14-healthcare-network-dev-20261118`  
**Source baseline independently fetched:** `a0bef181f68bd9c54e50d564f201be2ea2896388`  
**Reviewer:** Fresh AI source-audit pass; **not** a human external/qualified clinical, security, database, mobile or accessibility reviewer.  
**Disposition:** **REVIEWED_WITH_BLOCKERS — NOT SOURCE_COMPLETE, NOT PRODUCTION_APPROVED, NOT MERGE_APPROVED**.

## Review method and truthful evidence

- Re-fetched GitHub source files from the live feature branch; did **not** rely on an earlier author's statements.
- Inspected CG-15 doctor schedule and eligibility, center provisional intake, own-patient identity/consent, booking hold/confirm/cancel/reschedule, center queue and check-in, root H15 admin queries, CG-01 public signup, CG-19 private slip and token authorization, Web patient booking/reschedule and BFFs, native Android public actions/route wiring and internal queue/route wiring.
- Independently counted **128 unique original US-001–US-008 QA definitions and 128 unique status-table entries**: **52 SOURCE_VERIFIED / 68 SOURCE_GAP / 4 NOT_VERIFIABLE / 4 NOT_APPLICABLE**. These are source classifications, **not executed test passes**.
- Independently performed a **limited lexical scan of all eight SQL files 1420–1427**, checking quote/comment/dollar block closure, balanced parentheses, PL/pgSQL END delimiters and statement terminations; **0 lexical errors** found. This is **not** SQL compilation/execution, FK validation against the live schema, migration replay, a DB rollback, or a PostgreSQL query plan.
- GitHub comparison: this feature branch is **819 commits ahead and 4 commits behind `main`** at source baseline. The `main`-only changes touch shared identity/authentication, backend database migrator/bootstrap, backend package, Android entry/auth, public website navigation/CSS and other files. Merge compatibility was **not tested**.

## Confirmed strengths in source only

- Original per-root patient ownership/account links and contact-verification/consent checks; no automatic shared-phone patient merge or invented verified clinical identity.
- Center receptionist routes use current CG-14 center-affiliation and action scope, not caller-supplied center ownership.
- Booking reservation protects doctor concurrency through a locked doctor record and PostgreSQL exclusion over nonoverlapping active reservations; confirmation and change events are transactional and use request keys.
- Original center-local-day queue SQL applies the exact-day predicate before its 201-row cap; daily queue token serialized by center/day advisory lock.
- CG-19 consultation slip issuance/download sources the signed-in patient's owned appointment and private object validation; public QR verifier returns a status boolean only.
- Foundation H15 admin booking read is gated by nonassignable protected CG-01 action and staff-cookie BFF; name/Virtual Patient ID/booking display ID search is parameterized.

## Open findings requiring source fixes or owner decisions

### BLOCKER-1 — US-003 and US-004: independently verified patient identity and consent

`PatientProfileService.register` creates a `PROVISIONAL` profile from CG-01 verified account contact, not clinical identity proof; receptionist intake creates an *unlinked* provisional patient with `PATIENT_CARE=false`. `ConsultationBookingService.ownPatient` currently permits **both PROVISIONAL and VERIFIED** profiles when account contact and patient-care consent exist. These source paths do not implement a separate verified clinical identity claim, protected merge/reconciliation or an assisted booking path for the provisional center record. Do not describe the public contact proof as clinical identity verification, or mark original US-003/004 as complete.

### BLOCKER-2 — Original cross-module journeys remain incomplete

Original CG19 patient private clinical file access/report records and truthful appointment notifications/reconciliation are not proven complete; the existence of a generated **appointment slip** does not establish that other healthcare reports or notifications work. Original H07/H15 screenshot, responsive, accessibility and native parity are not demonstrated by source or a device run.

### HIGH-1 — Patient Web unknown-outcome recovery needs an exact-source path

`apps/web/src/features/appointments/patient-booking-action.tsx` checks only the **20 most recent appointments**, matching an approximate doctor/center/start/fee tuple, if the confirm response is uncertain. It does not use the existing exact own-patient hold-status endpoint for an unresolved hold; a valid older booking could be missed. A failed/expired hold with the retained original request key may keep the UI in an uncertain/retry state rather than allowing a genuinely new reservation. Verify and fix explicit idempotency recovery without guessing that a booking is absent.

### HIGH-2 — H15 and queue scale hard caps

`PatientAdminOverviewService.overview` returns an empty geography picker once **more than 200** distinct booked centers exist; the service explicitly reports `geographyComplete=false`, so there is no silent false exhaustive list, but the original full H15 filter UX becomes unusable at scale. The center queue returns `CG15_QUEUE_LIMIT` for more than **200 consultations on one center-local date** and has no pagination. Both are user-visible source limits, not benchmark results.

### HIGH-3 — Public signup database connection held during outside verification

`PublicPatientSignupService.register` starts `BEGIN` and locks/creates an idempotency command before awaiting the external Twilio VerificationCheck (up to 12 seconds), then hashes the password and inserts account rows on the same connection. This can consume connection-pool capacity or extend row-lock waits under load. Move network verification outside the transaction with rechecking/idempotency safeguards; test race behavior.

### HIGH-4 — Feature branch has unresolved integration delta from main

The branch is **four commits behind main**. Changes to login/session flows, migration runner, database module, public frontend, and Android shell need a bounded merge-conflict and compatibility review. Do **not** merge merely because direct CG-15 files are present.

### MEDIUM — Unmeasured query-plan and UI claims

The H15 substring search has no established index/EXPLAIN evidence. Current-source migrations were not executed on clean/upgrade DBs. Document output/client screenshot parity is not pixel reviewed in a live browser/Android runtime.

## Required gates before formal approval

1. Close original **68 SOURCE_GAP** cases with specific source changes/trace; retain truthful NOT_APPLICABLE and NOT_VERIFIABLE reasoning.
2. Run Node 22+ manual scripts including `npm run verify:cg15-migrations-source`, all original source verifier commands, and real backend/web/native type-checks. **None was run by this GitHub-only source reviewer.**
3. On isolated PostgreSQL: clean and upgrade migrations, FK/trigger checks, dual-session overlapping booking race, replay, cancel/reschedule/queue token, EXPLAIN, backup/restore. **NOT_RUN**.
4. Run Web public/center/Foundation routes and Android public/internal journeys with real account roles and original H07/H15 screenshot references; include negative cross-center, privacy, OTP/identity, accessibility and unstable-network retries. **NOT_RUN**.
5. Reconcile the 4 `main`-only commits safely; rerun source and local QA, then obtain qualified specialist/manual verification before any production or merge sign-off.

## Canonical tracker integrity

The existing `tasks.md` remains the status source of truth; this report **does not alter its original QA cases or claim any PASS**. As of this review: **0/8 formally source-complete, 0/128 executed runtime PASS**, all eight stories have some authored source. Keep the same development feature branch; no CI/GitHub Actions, no production DB operations, and no merge performed.
