# CareGanga — Partner-first healthcare scope: source implementation and QA trace

**Branch:** `feature/careganga-partner-first-healthcare-benefits-20261121`
**Base:** `feature/careganga-cg16-cg17-healthcare-dev-20261120` at `b3db697be9cbe39abde767ab3c13d229debea840`.
**Owner rule:** existing website Partnerships `/collaboration`, not another generic CTA; Join Now Member/Volunteer remain CG04; healthcare partner verification CG14, CSR CG08 future; CG17 original approved assistance/monthly money; CG19 original protected documents; CG09 actual bank. **All optional CG22/23/24 ERP OFF**.
**Truthful execution state:** code authored/committed via GitHub connector; actual Node/TS build, PostgreSQL migration, unit/integration/browser/native-device/runtime/screenshot, qualified security/finance/clinical independent QA **NOT_RUN**. No CI/GitHub Actions. Nothing merged to `main`. No known runtime PASS.

## Gate A — CG14 actual public partner application source (committed; runtime pending)

- **Original CGI/CG14 owner:** new forward-only `1446_cg14_public_partner_application_intake.sql` persists anonymous PENDING application, opaque private tracking receipt **digest only**, short public reference, applicant category, contact and address, consent; links (optionally) to already genuine CG14 provider OR doctor. It never inserts an approved CG14 master, login account, ERP entitlement, charge, allowance, Foundation liability or cash journal.
- **Backend:** `HealthPartnerApplicationsService` + dedicated public and staff controllers under current `HealthNetworkModule`; bounded field/type/consent validation, 256-bit HMAC private receipt, matching replay requestKey/digest, current status source projection, existing authenticated `health.providers.view/manage` and current original root/role checks, short-row-lock review/link and strict same-root genuine CG14 original matching. Different original source types cannot auto-verify each other. Distinct real CG03 verification remains mandatory.
- **Public Web:** `/collaboration` uses the original CareGanga visual chrome and public Partnerships menu, `/collaboration/healthcare-partner` selects original healthcare partner type then submits or checks private receipt; Next same-origin allowlisted origin-checked proxy, no staff session forwarding, no invented discount/verified status. Corporate/CSR goes to clearly labelled CG19 enquiry while CG08 source not delivered. Join Now remains exactly original two CG04 unavailable routes.
- **Foundation Admin Web:** `/admin/health-network/partner-applications` is separate page linked from existing healthcare network admin, original CG01 permissions, pending/readback/review/return/decline, source-matched original provider/doctor association; never direct approval by intake.
- **Native Public Android:** Partnerships native choice and same seven applicant types/form/private status, original backend, same requestKey on unknown-result retry. **Native Internal Android:** protected review queue inside original provider-management module with same original review/link actions. Public and internal screens require actual device/back/keyboard/accessibility runtime.
- **Static source gate:** `npm run verify:cg14-partner-first-source`, included in `verify:all-source`. Asserts SQL authority, public entry boundaries, auth, idempotence, links, Web/native parity and parses all touched TypeScript/TSX, **NOT EXECUTED in connector environment**.
- **Original owner case trace:** CG14 US001 intake, US002 original independent verification, US004 directory, US005 center content; CG18 US001/004 public menus/landing; CG19 protected receipt is the original source only if future proof integration needed. Source-only presence, not 94/76 QA case PASS.

## Gate B — Still required: real CG17 at-partner discount and monthly reimbursement

**Not source implemented in this branch.** Existing consultation CG17 flow is protected and cannot simply accept a medicine invoice as a completed CG15 consultation:
- `healthcare_policy_revision` currently has DB CHECK `ACTIVE ⇒ CONSULTATION` despite enum service kinds PHARMACY/NURSING/OT; CG17 policy activation further enforces consultation-only.
- `patient_charge`/ `foundation_liability` require original CG15 appointment/visit-event FK and original completion guards. Monthly `provider_settlement` requires only genuine CG09-posted CG15 liability effects, verified bank destination and independent approval.
- Correct next owner source work: original CG17 approved effective and capped pharmacy/nursing/OT benefit policy under existing CG03 verification; a **minimal ERP-OFF original partner invoice/performed-service evidence** source with actual CG14 verified center/service, CG19 verified bill/clinical attestation, real customer consent and independent Foundation reviewer, immutable per-event idempotency/refund recovery. Extend original CG17 liability/CG09 verified accrual and monthly settlement eligibility via **only forward-reviewed migration and strict source guards**, preserving original CG15 consultation exact-once protections. Customer pays verified partner net; CG09 never receives patient collection; Foundation pays only verified provider outstanding monthly. Same-role Web↔Internal Android and customer Web↔Public Android. No fake auto-transfer, default discount rate or duplicate partner ERP finance ledger.
- Source cannot be marked complete or merged until real CG17 link and original 68 QA scope source trace + independent finance/clinical/DB and actual payment/bank checks run.

## Gate C — Optional published medicines/procedures information

CG22 **US001** light approved medicine/price catalogue and CG24 **US001** CG14-source procedure detail may follow independently; neither must be required for **CG14 partner admission**. Public CG14 Nursing enquiry exists independently of CG23 ERP. CG22 US002–005/CG23 US001–005/CG24 US002–005 retain FUTURE/NOT_IMPLEMENTED and all native/backend ERP flags OFF.

## Local developer execution gates (do not claim run)

1. Fetch **this new feature branch** and `npm ci`; inspect lockfile and forward-only SQL migration. Verify unchanged historical checksums.
2. `npm run verify:all-source`, `npm run verify:local-build` (backend, Web, both Android TS). Fix reported findings on this new branch; rerun.
3. Disposable current `main` upgraded DB and fresh DB migration through `1446`; no edits to past migrations. Verify authenticated staff/public role, rate-limit, replay-with-same-key, different payload key conflict, duplicate application, original provider and doctor linking, incorrect center/root denied, original applicant secret never exposed in status/list, case review no auto approval.
4. Public /collaboration → healthcare partner selection → pending receipt → status/retry, Foundation Web review and Internal Android same actions; test Web+Android all categories, offline/timeout/retry, Back/hardware Back, safe-area, locale keyboard, data minimization and dashboard permissions. Preserve original Join Now 2 links and CSR enquiry truth.
5. Qualified independent appsec and DB review of anonymous PII/throttle and original CG14 source links, actual CG19 proof and CG03 decisions. Recheck same-owner original CG18/cms readback and all existing CG14/15/16/17/18/19/09 regressions.
6. **No merge to main** until all selected source tasks, CG17 financed services and runtime/SQL/device gates are complete and approved. No CI/GH Actions.

**Do not report source complete yet:** Gate A committed but untested; Gate B not implemented; Gate C optional not implemented.

## Follow-up source-review corrections (21 November 2026; active branch)

- **Public Android import:** corrected the newly added partner form design-token import from four to five parent directory levels (809d07d), with actual file-existence check in the existing source verifier (3a6c14f). Before fix: source import bug. Current real Expo/TypeScript build remains NOT_RUN.
- **Native Back:** hardware Back now returns form -> Partnerships choice -> home, preserving in-component original request key (eed9fa6). App-process death recovery requires physical-device testing, not guaranteed by this UI.
- **Matching original partner:** Web and Internal Android selectors now use the actual source-supported q search before matching (7773bef, efa5afb), and the CG14 server independently checks root, name, type and phone or original medical license. This link does not approve or activate partner.
- **QA truth:** committed source only. Developer must run local source checks, backend and both Android builds, disposable DB migration and real Web/native scenarios. CG17 pharmacy/nursing/OT invoice evidence, approved discount and genuine monthly Foundation reimbursement remain NOT_IMPLEMENTED, so overall partner-first release is not merge-ready.

### Additional public/internal Android UI source corrections (same day)

Public Android now validates the same minimum required name/location and optional email as the original CG14 backend, supplies an email keyboard without auto-capitalization, and declares selected state on Apply/Check Status (e86a294). Internal Android now closes selected review details on hardware Back and then returns to existing Healthcare Providers (bd481d0). The existing original partner-first source verifier has matching source checks (4c30e3f). All updates are committed, but real TS/Expo and phone keyboard/hardware Back/accessibility QA remain NOT_RUN. CG17 monthly reimbursement source remains blocked; no fabricated eligibility or disbursement.

### Applicant status UX source closure

Original CG14 public status endpoint now returns safe statusLabel + applicant next-step message; status codes remain API-only. Public Web and Public Android show the same source text; RETURNED explains Foundation follow-up, while ORIGINAL_VERIFIED never promises a discount. No internal review note, payment, PII or approval is leaked through anonymous status. Backend e81e479; Web 701fb4f; Android d82d771; original source guard 024446f. This is source-only and still needs actual role/browser/device verification.

### Integration ancestry readback — concurrent main change (21 November 2026)

Latest connected-GitHub ancestry comparison: main now contains the entire feature/careganga-cg16-cg17-healthcare-dev-20261120 tree and is one merge-history commit ahead of that parent (compare reports **zero changed files**). This partner-first branch is 51 commits ahead of its parent and one merge-only commit behind main, with no source difference caused by that additional main commit. Do **not** force-push, rewrite main history or equate the main integration commit with any verified runtime QA. Keep this partner-first work separate and merge only following original CG17 complete finance source, qualified reviews and developer-executed release gates.

## 21 Nov 2026 — Main alignment and original safe-message integration status

Main was merged INTO this feature branch via PR #15, commit 2441732d, with zero file conflicts; initial comparison was 53 ahead and zero behind. Main is unchanged and feature not merged to main. This supersedes the earlier historical note stating branch was one behind main.

Original CG01 SafeErrorsFilter and SAFE_MESSAGE_CATALOG used; no second framework. Partner registration Web/admin/Public Android/Internal Android fields, retries and status now map original safe message codes and business names, not internal UUIDs. Public Web proxy forwards reviewed allowlisted errors only. Original doctor name search no longer relies on first 50 records.

Manual connected-GitHub source audit inspected changed 76 CG09/CG14–19 backend files and found 296 previously unmapped literal exception codes, now represented in original server-safe catalog. Source-text readback found 633 distinct catalog codes, no duplicate code keys and no message length/markup violations in static inspection. Existing all-source runner now includes verify:healthcare-safe-errors-source; original CG14 partner-first checker expanded. Static reviewer readback only, scripts NOT_EXECUTED; not whole repository runtime proof.

Remaining actual financial source gap: CG17 ERP-OFF verified pharmacy/nursing/OT services, approved discount, real consented patient payment, immutable proof-backed Foundation liability and monthly verified provider settlement. Original consultation-only SQL safeguards preserved. Not source-complete, not runtime-tested, and not authorized for main merge or client release. Developer build and real QA separate after all source is ready.
