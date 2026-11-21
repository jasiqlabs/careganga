# CareGanga — Whole healthcare patient/provider journey audit
**21 November 2026 · canonical CG-14/15/16/17/22/23/24 + prior owners CG-01/03/09/19 · existing authorized CG-16/17 feature branch**

## Gate and evidence
This is a current **source-only integrated review** of the existing healthcare module trackers, app directories, original business requirements and the newly committed CG16/17 source. It is not an independently executed medical/finance/security QA, does not represent a build, device test or deployed availability, and is not a reason to merge to `main`. All changes remain on `feature/careganga-cg16-cg17-healthcare-dev-20261120`; no new module, simulated provider payment, diagnosis, fabricated ranges, signing service or future dependency was introduced. Follow JASIQ-dev Implement → Review → Fix → Re-review → original QA trace. CG01 layout and the client's H07–H17 references remain the UI baseline.

## What is built vs pending — source truth, not marketing completeness

| Owner | Defined stories / planned QA | Source found on this branch | Real completion |
|---|---:|---|---|
| CG-14 Provider/doctor/center network | 5 / 94 | Provider, doctor, center, verification, associations, directory and Center Portal source present. Canonical source QA last: 79 verified / 2 gaps / 13 not-verifiable. | 0 original executed runtime QA pass; optional ERP cross-owner integration and independent visual/security gates open |
| CG-15 Patient/appointment/visit | 8 / 128 | Patient identity/consent, both booking paths, schedule/availability, own documents, check-in/queue/cancellation and visit source present; canonical 119 source-verified / 0 source-gap / 2 not-verifiable / 7 N/A | 0 actual runtime QA pass; browser/device/concurrency/security/visual gates open |
| CG-16 Lab catalog/diagnostics | 5 / 80 | Test prices/public catalog, private order/specimen custody/clinical review/approved report release and equipment source. **21 Nov:** staff-entered results, CG19-rendered PDF and Web/Internal Android forms now source-added. | Generated-report flow newly authored; clinical rendering/PG/storage/runtime NOT_RUN. Corrections and actual delivery evidence remain source gaps |
| CG-17 Benefits/collections/settlements | 7 / original US-defined QA | Contribution policy/accepted charges, verified center-own merchant, manual center receipts, one genuine completed-service liability, original CG09 posting and monthly reviewed settlement/verified payout source. | No actual sandbox/bank, PG concurrency, Web/native, independent financial QA run; actual journal reversals and original late corrections remain open |
| CG-22 Pharmacy | 5 / 90 | **Design/tasks only**. No `cg-22` backend module and no matching branch found. | All implementation and QA pending |
| CG-23 Nursing | 5 / 90 | **Design/tasks only**. No `cg-23` backend module and no matching branch found. | All implementation and QA pending |
| CG-24 OT/Procedures | 5 / 90 | **Design/tasks only**. No `cg-24` backend module and no matching branch found. | All implementation and QA pending |

**Caution:** Prior source-verified QA counts do not mean a single successful SQL migration, browser, native device, private file, bank transfer or independent clinical check has been executed.


## Registration, patient eligibility, and partner settlement source confirmation (21 November 2026)

**Partner registration:** CG14's actual existing provider and center registration handles Foundation-led onboarding of hospital, clinic, diagnostic laboratory, pharmacy, nursing, and OTHER types (an approved SURGERY capability is a service, not a new provider identity). An Admin creates/authorizes the center representative's existing CG01 account and CG14 center affiliation; that account can edit the permitted center draft and submit protected licence documents. Original CG03 independently approves/returns/rejects provider and center registration. Center activation and publication are separate guarded actions. Public unrestricted healthcare-partner self-registration is NOT implemented or authorized at launch.

**Doctor registration:** CG14 creates a single professional identity, checks licence and qualifications using the original CG03/CG19 proof, verifies approved center affiliations and center-specific fees, and requires the real clinician-account link/acceptance. CG15 now uses the current CG14 link to provide a restricted own-clinician daily activity summary in Web and Internal Android. No patient diagnosis, unrelated doctor or Foundation money is exposed there. Original CG14/CG15 task trackers updated; live QA NOT_RUN.

**Patient:** CG15 reuses verified CG01 identity, purpose-bound patient claim/consent and actual center intake. The patient uses public directory → original doctor+center availability/slot → gross fee, approved current policy support and patient due before final booking → real booking and protected CG19 slip → own appointments, receipts and approved reports (Web and Public Android). Only public doctor consultations have confirmed transactional online booking; lab, pharmacy, nursing and OT information does not imply unsupported checkout.

**How benefit is applied:** CG17 ConsultationPatientChargeService reads the actual active approved healthcare_policy_revision for selected CONSULTATION, center and doctor, with validity, cap and fixed/percentage mode. Gross fee minus strictly eligible policy-supported Foundation assistance is the patient payable. Standard *eligible* approved consultation may be 50%; no real approved policy = zero assistance, not universal 50%. Full support requires separately approved exception. Screenshot percentages for lab, medicine, nursing and OT are examples, NOT payable entitlements without their own policies and actually implemented service source.

**Where the money goes:** Partner center collects the patient contribution via its verified own merchant or at its own reception. Unverified manual UPI/card/bank references are not paid, not a hold and not Foundation bank income. CG17 recognizes a Foundation liability only after the actually completed eligible CG15 consultation, with CG09 posting. Monthly claims derive from that posted liability and real CG14 protected verified payee evidence, require independent Foundation approval, and record paid only against actual independently reconciled CG09 bank disbursement. No automated bank transfer or contractual exact day-of-month SLA is implemented or implied.

**Dashboards:** Existing Foundation Admin Web and relevant Internal Android contain source-backed CG14 provider review/verification, CG15 patients/visits, CG17 policy/obligations/settlement/payout views. The approved partner's own /center Web Portal and Internal Android now contain read-only CG17 source-backed completed gross, verified patient collection, Foundation assistance accrued/claim approval, verified paid and outstanding amounts for the assigned center only. The doctor-only Web and Internal Android dashboard now shows permitted own doctor-and-center daily confirmed/waiting/in-consultation/completed/cancelled/no-show visits. CG15 patient portal and Public Android provide own appointment, payment receipt and released report access. A single comprehensive CG20 cross-owner KPI/trend dashboard is still unverified and must not be claimed live.

**Unbuilt conditional modules:** CG22 pharmacy five stories, CG23 nursing five stories, CG24 OT five stories have canonically approved design and original QA cases but NO implemented backend modules or operational source; global ERP stays OFF, and their optional operational/discount/settlement workflows are not yet delivered.

**Cross-owner source QA:** Registered npm run verify:healthcare-journeys-source using original CG14→CG15 clinician identity and CG17→CG14 center finance source. Original CG14, CG15, CG17 task trackers updated. Authored source checks have NOT been executed in a local checkout; no PostgreSQL/browser/Android/independent clinical or finance PASS is asserted.

## Plain-language user journeys and concrete gates

| Real user journey | Owner and integration (no duplicate master) | Source verdict | Exact remaining gate |
|---|---|---|---|
| Find approved doctor/clinic and current center fee | CG14 → public Web/Public Android; CG01 status | Code present | Actual public parity, screen references, suspend/unpublish race, source QA |
| Find public lab tests and approved prices | CG16 US001/003 → CG14 published center | Code present, independent of Lab ERP | Browser/mobile content and 0-ERP tests |
| Register as patient, claim own account and consent | CG15 → CG01 verification and CG19 protected files | Code present | Real OTP, duplicate patient/history and negative account tests |
| Find doctor date/slot via both paths | CG15 → original CG14 professional and same slot inventory | Code present | Two-path last-slot concurrency, out-of-date fee, mixed center/device QA |
| See actual price/support/payable **before** booking | CG15 booking → CG17 policy/quote | Code present | Same original accepted charge on both channels, expired policy and final review live QA |
| Book and receive own booking slip | CG15 → CG19 original source-rendered PDF/QR; CG19 notification | Code present | Verified storage, notification proof, PDF preview, source recovery runtime |
| Arrive, check in, wait, complete consultation | CG15 current center queue and visit state | Code present | Reception/clinician cross-center permissions and simultaneous check-in live QA |
| Cash/UPI at center or optional verified center-own checkout | CG17 US003/004 → one CG15 accepted due, CG14 own merchant | Code present; **21 Nov re-review**: only verified money counts toward due; unverified manual external references are evidence, not permanent payment holds | Independent gateway credentials/webhook, real cash reversal, duplicate pending capture, UI recovery tests |
| Foundation recognizes contribution **only after completed real service** | CG17 US005 → CG15 completed original event + approved charge/policy | Code present | Verified PG trigger, concurrent source, center finance and audit tests |
| Foundation pays provider monthly | CG17 US006 → original CG09 posted source, CG14 bank proof | Claim/review/verified bank match source present | Actual verified bank reconciliation and reversal/adjustment + independent financial QA |
| Lab staff capture specimens and enter values once | CG16 order/lines + same CG15 consent/CG14 center | **21 Nov FIX** entered values + CG19 generated PDF source | Execute SQL 1613, actual CG19 scanner/storage, reports of many tests, partial/late rerun, Web/native QA |
| Qualified clinician approves and releases same private lab PDF | CG16 independent review + CG14 license → CG19 verified bytes → CG15 own patient | Source present | Real licensed review/release, wrong-doctor/wrong-patient/ERP OFF and patient download tests; **no digital signature** |
| Correct a reported result and preserve old report | CG16 original immutable version/re-review/release | **SOURCE GAP** | Implement original correction flow, no mutation of prior result or fabricated scan |
| Notify patient only when report actually released | CG19 original template/delivery outbox, initiated by CG16 release | **SOURCE GAP** | Original event and delivery proof separate from reviewed/uploaded/released statuses; do not claim sent |
| Pharmacy catalogue, medicines, stock and safety | CG22, CG14/01 → optional CG15/17 only in story that needs it | **NOT IMPLEMENTED** | Five original stories / 90 QA; separate approved dependency-ordered development |
| Nursing professional, shifts, care plans and visits | CG23, original CG14/15/03/19 → optional CG17 on delivered service | **NOT IMPLEMENTED** | Five stories / 90 QA; no invented booking/payment |
| Procedure information, OT resource, case and protected care stages | CG24, CG14 → later optional CG15/17 | **NOT IMPLEMENTED** | Five stories / 90 QA; no fake completed procedure |
| Unified healthcare reports/financial dashboard | CG20 reporting owner, source reads from actual CG14–17 + CG09 | **PARTIAL/NOT VERIFIED** | Add projections only after actual owner is delivered; never fabricate dashboards |

## Prioritized blocker/fix register (actual defined work only)

### P0 — Correctness, privacy, money; do before release
- [x] **CG16 original PDF mismatch**: source-authored original per-test entered result rows (`1613`), CG19 existing private PDF renderer, server-side create-only/scanner verified CG19 file, preserved independent CG14 review/release and protected CG15 patient readers; Web and Internal Android entry. **Implementation committed; NOT a runtime PASS.**
- [x] **CG17 patient collection truth**: `CenterPatientCollectionService.record` keeps unverified manual UPI/card/bank notes separate from actual verified cash/provider receipts; only verified money reduces due, while real gateway captures separately recheck remaining due. This avoids falsely blocking later cash after a failed manual transfer. Original US004 verifier updated. **Runtime transaction/race/provider QA NOT_RUN.**
- [ ] **CG16 generated report local proof**: install/run actual migration, type-check/compile, 50 ordered tests and prior-capture recovery, PDF visual/font/file proof, cross-center/consent/actor deny, exact clinician release/patient read, retry after unknown storage outcome; no signature.
- [ ] **CG17 money integrity actual QA**: verified center-owned gateway credentials+provider HMAC, partial cash/refund, pending third-party collections, exact CG09 posted-source match, independent bank proof and partial settlement, 20-way transaction conflicts.
- [ ] **CG14/15 current authorization + booking concurrency live QA**: 0-availability/last-slot scenario, center suspension, patient rights, repeated booking and time-zone/DST applicable data, doctor center switch.
- [ ] **Independent clinician/security/PG expert review**, historical ERP-OFF patient access and protected patient/doctor record checks across channels.

### P1 — Existing unfinished business journeys
- [ ] **CG16 original result correction**: only new immutable version with review/release; no prior PDF rewrite.
- [ ] **CG16/CG19 notification delivery truth**: only actual outbox state; no “delivered” from document generation or release alone.
- [ ] **CG17 original Foundation journal reversal and settlement correction**: use existing CG09 balanced original source; no new payment engine.
- [ ] **CG14 ERP grant ↔ CG22/23/24 real operations**: source gaps remain until respective modules actually exist; do not silently close them.
- [ ] **CG22, CG23, CG24**: design done; implementations genuinely not started. They are 15 stories / 270 distinct planned QA cases and must be authorized in canonical dependency order, not merged from placeholders.

### P2 — User simplicity and nonfunctional release gates
- [ ] All public Web ↔ Public Android and Admin/Center Web ↔ Internal Android journeys use the same source and current effective permissions; no raw UUIDs in UI.
- [ ] Compare actual rendered H07–H17 screens to client references and recent CG01 style; use sensible defaults, one primary task per page and clear next step after save.
- [ ] Execute Web/Android builds, PostgreSQL migration/rollback, provider-service verification, accessibility/narrow-screen/slow-network tests, error/toast navigation and recovery, security and database index/concurrency checks.
- [ ] Verify offline optional ERP flags do not break public information, basic consultation or protected historic records; no idle per-center polling.

## End-to-end acceptance flows for developer QA
1. **Public patient** searches verified doctor → picks own real slot and center → sees gross/benefit/due → verifies patient/consent → books → obtains original CG19 slip → attends → sees own receipt.
2. **Center reception** verifies their own assigned center → registers/identifies patient safely → checks in real booking → records cash or pending UPI without overpay → supplies only source-verified receipt.
3. **Center clinician** views own completed queue → records genuine completion → approved Foundation share is accrued once → separate CG09 journal → independently reviewed monthly claim → provider paid only upon actual verified bank disbursement.
4. **Lab staff** selects real patient/active ordered tests → collects/receives/processes specimen → enters one value per ordered test → CareGanga generates private PDF → licensed independent reviewer approves → authorized release → patient alone downloads; repeat and wrong-center attempts fail.
5. **ERP OFF** still permits public approved partner test/price information and historic securely released patient reports but denies new lab operational writes.
6. **Pharmacy/Nursing/OT** show only genuinely published provider information until their original CG22/23/24 operational modules are built; no fake stock, care completion or surgery booking.

**Source complete is NOT equal to release ready.** No additional clinical signatures, medical diagnosis engine, generic appointment categories, duplicate person/provider/finance masters or new modules are recommended by this audit.

## 21 November source re-review: close confirmed defects; preserve actual blockers

- **Fixed CG16 report correction and historical V1 retry compatibility:** A corrected result is a new original CG16 immutable version with a genuine release parent, reason and actual old values prefilled for staff. Original CG19-generated PDF V1 digest and bytes remain stable on retry. Corrected version needs new qualified clinician review, explicit release, current CG15 patient consent and protected Web/native download. Existing CG19 notification delivery status is not synthesized. Static GitHub source-readback 30/30 literal invariants present; test script authored, NOT_RUN.
- **Fixed CG17 Postgres 1706 FK:** A two/three/four-column unique key is not interchangeable. The original patient_charge had (root,id,center,patient) unique, but award and liability referenced (root,id,center); 1706 now creates exactly matching unique before new tables. Original CG17 US005/US006 source scripts assert it; real PG migration/replay NOT_RUN.
- **Fixed Foundation vs partner finance authorization:** An assigned center representative with view permission cannot list/inspect Foundation-wide center settlement/claim via Admin route, API or original nav. Foundation-wide reads/prepare/review require independent current CG14 finance view permission. Separate read-only partner Web/Android projection checks current center assignment; proposal is never approved or paid before actual verification.
- **Known, not concealed:** Original CG17 US006 QA01/10/11 still need properly authorized CG09-linked reversal/correction with real original evidence. Existing CG09 manual journal reversal is intentionally restricted to manually created GENERAL journals and is NOT a safe substitute for CG17 accrued-source or payout reversal. CG23/CG24 optional patient-service sources and CG22 pharmacy operational source remain design-only until module approval/actual implementation; never synthesize lab/medication/nursing/OT benefit or payment. No fake ledger/payment statuses to close the tracker.
- **No release-quality PASS:** local `npm run verify:cg16-us002-source`, `verify:cg17-us005-source`, `verify:cg17-us006-source`, `verify:healthcare-journeys-source`, TypeScript builds, PostgreSQL migration+rollback/two-session tests, Razorpay/bank sandbox, security/clinical/financial independent review, Web/Admin/Android device screenshots and pixel QA **NOT_RUN**. No merge into main. Original owning trackers updated, original QA IDs preserved.

**21 November 2026 H17 dashboard semantic fix:** Source-backed CG17 contribution panels intentionally sum only completed *eligible* consultation charges with a recorded Foundation liability. They MUST NOT label this restricted gross amount as total center revenue or all consultations. Web Admin, partner Web and Internal Android labels now say eligible completed services; total patient cash/center P&L remain separate original owners, not inferred from this projection. QA only source-reviewed; real dataset/browser/device totals NOT_RUN.
