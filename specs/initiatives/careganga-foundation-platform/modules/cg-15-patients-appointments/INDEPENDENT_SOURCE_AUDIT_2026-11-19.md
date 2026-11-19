# CG-15 — Independent second-pass source verification (19 November 2026)

**Review scope:** Targeted independent static reinspection by AI of actual connected GitHub source. This is not the earlier author self-attestation and is **not an independent qualified human DBA, clinical, security, UX or release review**. Branch: `feature/careganga-cg14-healthcare-network-dev-20261118`; source head observed before writing: `a0bef181f68bd9c54e50d564f201be2ea2896388`. No code build, SQL execution, migration/rollback, physical device, web browser, screenshot pixel, runtime penetration or concurrency tests were run. No GitHub Actions.

## Directly inspected source

- CG15 Nest services for own patient profile/consent, assisted center intake, doctor availability and schedule, consultation hold/confirm/change, center visit queue and H15 protected Foundation overview; their Nest HTTP controllers and module wiring.
- CG01 public signup/password/phone-proof source and CG01 capabilities; CG14 owner-scope use; CG19 private appointment slip issuing and current original-source authorization.
- CG15/CG01/CG03/CG19 migrations `1420` through `1427`, protected CG19 QR lookup and QR-generated slip lifecycle.
- Foundation Web H15 state/district/center/status/date and actual protected search, staff BFF; native Public Android booking and native Internal Android center queue; backend AppModule registration.
- Canonical 8 × 16 = 128 QA case tracker. Repository comparison: current branch against `main` and reverse.

## Checks confirmed by independent source reading (NOT a runtime QA PASS)

1. Nest root AppModule imports PatientsAppointmentsModule; its controllers/services are registered.
2. Patient-owned booking uses real account link, root and account proof; Center Queue uses current CG14 own-center affiliation and a separate `health.visits.manage` capability; Foundation overview requires nonassignable `health.patients.admin.view`.
3. Booking hold/confirm/cancel/reschedule uses explicit PostgreSQL transactions, real source pricing, doctor-row serialization and a GIST exclusion on occupied doctor time; event history uses append-only source tables. Actual concurrency and slot overlap behavior NOT tested.
4. CG19 slip issuance/lookup/download maintains a private original booking source and digest; source code does not substitute a public clinical record. Real storage, scanner and PDF output NOT tested.
5. Separate independent in-memory lexical scanner inspected all eight migration file bytes for balanced ordinary SQL parentheses, quotes, dollar-body bounds and statement terminators; **8/8 had no issues in this narrow scan**, with respectively `23,17,14,4,13,6,5,10` top-level semicolon-terminated statements. It does NOT parse PL/pgSQL grammar, validate table/column names or execute PostgreSQL. The committed Node CLI checker itself was NOT run.
6. Canonical tracker lists exactly 128 distinct original `US-001-QA01`–`US-008-QA16` case identifiers. Its conservative aggregation is 52 SOURCE_VERIFIED / 68 SOURCE_GAP / 4 NOT_VERIFIABLE / 4 NOT_APPLICABLE, and 0 original executable runtime cases PASS.

## Blocking source findings — do not mark SOURCE_COMPLETE

**P0 — Independently verified patient identity gate is missing.** `PatientProfileService.register` creates `profile_status='PROVISIONAL'`; `ConsultationBookingService.ownPatient` explicitly accepts both `PROVISIONAL` and `VERIFIED` when contact verified and current care consent exists. A verified phone/account is not independent patient-specific identity proof. Thus US003/US004's independently verified clinical identity gate is NOT fulfilled. Do not 'fix' by silently reclassifying records or merging patient identities. Implement the approved proof/review/claim transition and secure family/shared-phone behavior, then ensure booking enforces its actual intended gate.

**P0 — Reception-assisted booking remains missing.** Real `CenterPatientIntakeService` creates an intentionally unclaimed/limited provisional patient; `ConsultationBookingService` finds only a self-linked CG01 patient, so the center cannot complete a genuine authorized assisted booking for that provisional patient. Add an explicit current-center, patient-specific consent and independently reviewed proof workflow; no cross-center clinical history access.

**P0 — Current clinical consent, private patient files and downstream owner integrations incomplete.** Existing own-consent write does not prove cross-center staff reads, report revocation or CG19 patient file access/restriction; clinician-granted permissions, CG19 notice delivery, cancel/reschedule notices and optional CG17 owner-dependent payments remain case gaps. Do not fabricate financial or clinical sources.

**P1 — Recent main divergence/integration risk.** Direct compare shows the feature branch **819 commits ahead / 4 behind** main; reverse comparison shows main changes affecting 39 paths, including the migration runner, CG01 authentication, database module, both Android entry/auth screens and shared Foundation navigation. These are overlapping integration seams. No merge simulation was run, so conflicts are a **risk, not an observed merge failure**. A local integration review is required before any merge.

**P1 — H15 and H07 UX not visually qualified.** Real source-backed H15 bookings/search and center queue exist; exact supplied screenshots, interactions, full original filters, mobile parity, accessibility, pixel/motion and actual backend responses have not been independently rendered or measured.

**P1 — Production performance and migration correctness not established.** Source query limits/indexes, parameterization and transactions are present, but actual EXPLAIN plans, patient search scalability, selected center-day queue performance, historic migration of live data, PostgreSQL constraints/DDL execution, backup/restore and multi-client races are NOT_RUN. A lexical preflight cannot close these gates.

## Gate and next evidence

**Decision: HOLD — not approved for source-complete, production, or merge.** Keep development on this feature branch. Do not alter any of the 128 acceptance dispositions based on lexical/static reading alone. Require a real local developer build of NestJS/Next and both Android type checks; execute migrations 1420–1427 on restored and clean PostgreSQL; run center staff permissions, IDOR, shared-phone/claim proof, two-session last-slot and invalid/expired holds, QR/private PDF, UI screenshot reference and original 128 scenario traces. Qualifying human security/DB/clinical specialist review remains separate. No CI/GitHub Actions.
