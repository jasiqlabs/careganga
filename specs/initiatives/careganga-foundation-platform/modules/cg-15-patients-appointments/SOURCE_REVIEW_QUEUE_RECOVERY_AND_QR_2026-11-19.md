# CG-15 — Same-branch source re-review: committed queue reconciliation and Center Portal QR camera

**Date:** 19 November 2026  
**Repository:** `jasiqlabs/careganga`  
**Branch:** `feature/careganga-cg14-healthcare-network-dev-20261118`  
**Result:** Two original source cases improved; **not full source completion, not executed QA, no merge approval**.

## JASIQ-dev sequence and verified original scope

- **Review:** Prior independent CG15 original 128-case review recorded 68 SOURCE_GAP; subsequent canonical work reduced it to 25 without creating new cases.
- **Defect A / US-006-QA15:** Existing CG19 CommunicationWorker only scanned its first Foundation root in periodic appointment event catch-up, despite original queue state changes posting a transactional CG15→CG19 outbox event for each root. Lost LISTEN hint for another root could leave PENDING rows unread.
- **Fix A:** In the SAME CG19 worker, one global pending-only source lookup `LIMIT 64`, at most eight unique roots, four original `LIMIT 25 FOR UPDATE OF ob SKIP LOCKED` source claim batches each, no other worker, no per-doctor/center polling. New **forward-only 1435** global partial index on (recorded_at,realm_id,event_id) matches the lookup. Existing appointment event FK/trigger from migration 1433, source deduplication and current patient identity/consent/ownership checks remain the authoritative paths. The separate CG03 leave-decision recovery still requires its own cross-root lost-notify/idle tests and is **not** asserted as addressed by this fix.
- **Defect B / US-005-QA07:** Web Center Portal supported manual original CG19 opaque QR entry but no actual browser camera reader.
- **Fix B:** A secure-context, feature-detected local browser QR scanner is loaded on explicit staff action, validates `CGV-` plus 24 hexadecimal characters, closes camera on stop/success/unmount/center-date change and preserves manual entry where built-in detection is unavailable. It calls the unchanged assigned-center CG15 `verify-slip` route, which applies the original CG01 permission, CG14 current center affiliation, 1434 per-account/center attempt throttle, current care consent and original private QR status. No data transfer to a third-party scanner, no new patient identity or result service; no native Android camera scanner is claimed.

## Targeted post-fix source re-review (not a Node build)

The latest GitHub feature-branch contents were independently re-fetched after writing: existing CG19 worker/notification service, original 1433 and new 1435 SQL, new QR component, existing Web queue and protected CG15 queue backend, three existing source-verification scripts, canonical tasks, closure ledger and local handoff (13 files). Twelve targeted in-session readback checks were **12/12 present**: one original worker; bounded all-root catch-up; original transactional event trigger; global partial index; SKIP LOCKED event claim and conflict-deduplication; click-to-open and secure camera checks; exact opaque token and stream teardown; unchanged protected own-center route; three source verifiers extended; original 128 cases unchanged; tracker counts reconciled; no false runtime-pass claim. These are source-text checks and do not prove successful TypeScript compilation, query-plan performance, actual generated PDF QR decoding, device camera behavior or PostgreSQL correctness. The Node source scripts themselves remain NOT_RUN on a checkout.

Original source QA status in canonical `tasks.md` after these changes:

| Classification | Count |
|---|---:|
| SOURCE_VERIFIED (static/source wiring) | 96 |
| SOURCE_GAP | 23 |
| NOT_VERIFIABLE | 2 |
| NOT_APPLICABLE | 7 |
| **Total original cases** | **128** |
| Executed runtime QA PASS | **0** |
| Formally source-complete user stories | **0 of 8** |

### Remaining 23 source gaps by original owner, not newly invented scope

- **CG15 direct (3):** US-001-QA13 (H07 original visual/calendar/tab parity), US-004-QA11 (restricted original symptom/purpose consent snapshot), US-008-QA16 (dated/paged lawful output, original CG19 short-lived report/file grant and retention).
- **CG01/CG03 patient proof and policy (5):** US-002-QA02, US-003-QA03/11/12, US-008-QA10. Do not weaken one-doctor physical-slot exclusion, auto-merge patients with shared numbers or fabricate dependent identity approval.
- **CG19 patient-private files / communications (6):** US-003-QA07/09, US-005-QA05/10/12, US-008-QA08. Need actual stored private patient files, clinician consent, native sharing/printing and delivery status with configured provider receipts; no fake channels or health data.
- **CG14/CG01 clinical role identity (3):** US-003-QA10, US-006-QA05, US-008-QA04. A generic staff-granted action is not evidence that the authenticated account is the real verified doctor for the appointment at that center.
- **UI, device and privacy parity (4):** US-003-QA15/16, US-004-QA14, US-008-QA13. Require actual browser + Android and original client H07/H15 reference visual/accessibility/back/resilience checks.
- **CG17/CG19 actual finance and notice (2):** US-007-QA16, US-008-QA09. Only real, installed owner records may establish receipts/refunds/clinical release and revocation. No synthetic settlement.

## Mandatory local execution before source/merge approval

1. `npm ci`; `npm run verify:cg15-migrations-source` (now 1420–1435); `npm run verify:cg15-communications-source`; `npm run verify:cg15-us004-us008-source`; existing CG15 US001–US003 verifiers; Nest/Next builds; both Android TypeScript checks. All NOT_RUN in this source-only session.
2. Temporary PostgreSQL clean + existing-1434-to-1435 migration, migration hash/replay and explicit query-plan comparison. Test A idle vs B genuine committed visit event after lost NOTIFY, 64+ pending, two workers, consent revoked and no idle provider send. Existing decision/notice/CG19 communications must not regress.
3. Real QR produced from CG19 original appointment slip in a supported HTTPS mobile/desktop Web browser; permission denied, unsupported detector, background/unmount and role/center switch, scan of valid/wrong-center/expired/revoked/consent-invalid token, 24-attempt/15-minute limit; verify original Android manual reader remains guarded and cross-center patient fields never leak.
4. Re-run each original US-001–US-008 case against actual current source SHA, with redacted expected/observed SQL/API/device evidence. Human security/database/clinical and client UI specialist signoff are separate and still pending.

**Disposition:** DEVELOPMENT_IN_PROGRESS. No new user stories or out-of-scope features, no CI/GitHub Actions, no production data operations, no qualified human review, no merge/release authorization.
