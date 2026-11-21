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
| Cash/UPI at center or optional verified center-own checkout | CG17 US003/004 → one CG15 accepted due, CG14 own merchant | Code present; **21 Nov FIX** count verified+pending against total due | Independent gateway credentials/webhook, real cash reversal, duplicate pending capture, UI recovery tests |
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
- [x] **CG17 patient over-collection**: `CenterPatientCollectionService.record` now reserves pending external amounts as well as confirmed collected amounts. Existing original US004 static verifier updated. **Runtime transaction/race QA NOT_RUN.**
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
