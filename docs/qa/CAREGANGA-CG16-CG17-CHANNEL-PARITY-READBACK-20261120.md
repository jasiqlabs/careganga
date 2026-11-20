# CareGanga — CG-16/CG-17 cross-channel source readback
Date: 20 November 2026. Authoritative branch: feature/careganga-cg16-cg17-healthcare-dev-20261120; HEAD before this record: 45281e900e177886d431f66095e01c87fa89f138.
No merge to main. This is an **audit evidence snapshot**, not a new canonical task tracker, approved design change, runtime test or new user story. Update original module tasks.md execution-progress/QA cases as each actual missing native journey is implemented.

## Owner-approved channel rule
- Staff/admin and center-operational Web features must have functionally equivalent **Internal Android** journeys, with the same current CG-01 role/CG-14 center scope, backend API, business actions and unknown-result/Back behavior; presentation is touch-appropriate.
- Public website and consented patient Web features must have equivalent **Public Android** journeys. Avoid copying private staff/clinical controls into Public Android.
- A single backend owns each record; no second native business database, shadow patients/pricing or convenience API bypassing CG-01/03/14/15/19.
- An Android WebView/deep link to a staff Web page is NOT native feature parity.
- Existing approved story definitions and QA IDs remain unchanged. Actual Web/Android device QA and original screenshot visual fidelity require independent executable tests; **all are NOT_RUN** here.

## Source inspection (current, not runtime PASS)
| Module / story | Existing Web source | Required Android channel | Verified source today | Gap |
|---|---|---|---|---|
| CG-16 US-001 H09 Test/category/package master, Foundation current pricing and independent CG03 price review | `apps/web/src/features/diagnostics/lab-test-master-workspace.tsx` | Internal Android (authorized Foundation staff) | Web backend/protected API source exists; **no native H09 equivalent** | SOURCE_GAP: category/test/package/center map, prices, approve/reject, history, expiry inputs/validation and notifications |
| CG-16 US-001 own-center pricing | `apps/web/src/features/diagnostics/my-lab-pricing-workspace.tsx`; `center-lab-pricing-panel.tsx` | Internal Android (assigned-center staff) | Web source, backend scoped endpoint | SOURCE_GAP: native current assigned-center proposal and tariff list |
| CG-16 US-002 H10 genuine order/consent/quote/specimen custody | `apps/web/src/features/diagnostics/clinical-lab-order-workspace.tsx` | Internal Android (scoped clinical staff) | Backend source and Web order/custody screens; **no native H10** | SOURCE_GAP: patient source selector, accepted order, specimen custody/recollection, current status and safe retry |
| CG-16 US-002 H10 private scanned staff report | `apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-result-evidence.service.ts` and protected Web route | Internal Android (assigned result operator) | Backend upload/intents/CG19 scanner path exists; Web H10 upload widget currently incomplete in checked source | SOURCE_GAP: Web/native secure upload, status, prepared PDF scan, clinical review/release separate |
| CG-16 US-002 released patient/treating-clinician report | Planned patient/Web scope (no release source yet) | Public Android for consented patient; Internal Android for treating professional | NOT_IMPLEMENTED | SOURCE_GAP: no fabricated PDF downloads, professional decisions or patient notifications |
| CG-16 US-003 current published commercial lab offers | `apps/web/src/app/health-network/lab-tests/page.tsx` | Public Android | `apps/android-public/src/features/health-network/public-lab-offer-directory.tsx` and original directory route | SOURCE_PRESENT_REVIEW_NEEDED: source filters/current prices exist, Android device/visual QA NOT_RUN |
| CG-16 US-004 verified center lab contact and price enquiry | `apps/web/src/app/healthcare/centers/[slug]/page.tsx` | Public Android | `apps/android-public/src/features/health-network/public-healthcare-directory.tsx` original center profile | SOURCE_PRESENT_REVIEW_NEEDED: live original CG14 center phone and offers; device/visual QA NOT_RUN |
| CG-16 US-005 lab equipment/quality | NOT_STARTED | Internal Android for approved technician/staff workflows | NONE | SOURCE_GAP until development |
| CG-17 US-001—007 approved healthcare assistance/settlements | NOT_STARTED | Internal Android for authorized case/finance staff; Public Android for actual applicant/patient self-service stories | NONE | All 7 awaiting owned source; never publicize private settlement screens |

## Current hard defects / development order
1. Implement CG-16 H10 report-evidence Web widget and **Internal Android H10** safe order/custody/report workflow, gated by CG01, existing CG14 LAB_ERP authorization, CG15 consent and original CG19 private storage.
2. Implement native Internal Android H09 Foundation and assigned-center functions, original CG03 protected reviewer plus own-center scope; no read-only placeholder labelled complete.
3. Clinician review/release, protected patient report reader, correction and notification remain CG-16 US-002 source gaps; then update all 16 original QA cases.
4. Implement CG-16 US-005 and its Web/Internal Android parity, then CG-17 all seven stories across their applicable channels. Re-review latest merged CG19 client email/template changes for existing module-specific parity through their original QA and owner-specific release tracks; do not silently mark already-merged modules as retroactively complete.
5. Run authenticated JASIQ Harness resolver and `npm run verify:design-approvals`/CG16 source checks, TypeScript workspace builds, PostgreSQL migration/rollback, emulator and device, original visual/accessibility and independent clinical/security/database QA on a real local checkout. None was executed by this GitHub-only authoring step.

## Main sync and approvals
Latest baseline `main` ee29c52c0cc8334aa5e2d675244051c485636970, integrated into feature via genuine two-parent merge `45281e900e177886d431f66095e01c87fa89f138`. Comparison after merge: `behind=0`. Existing 107 approval ledger records report `DELEGATED_APPROVED`, including CG16/17 planning, DLD, UIUX and task definitions. **These are design approvals only**, not runtime QA, clinical signoff or permission to merge to main. Hash verifier was not executed.
