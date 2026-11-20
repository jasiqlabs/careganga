# CG-16 US-002 — original clinical laboratory QA source trace

20 November 2026, branch feature/careganga-cg16-cg17-healthcare-dev-20261120, source readback SHA b6b9757a917e283b49d455a1821375459bd7a2ca.

**Source-only, not a release gate:** Original 16 cases: 8 SOURCE_TRACED, 2 SOURCE_PENDING, 6 SOURCE_GAP. All 16 actual manual SQL/clinical/browser/Android/independent runtime QA cases **NOT_RUN**; no medical reviewer identity, clinical approval, legal release, privacy leakage or performance test has been executed. Source evidence must be re-reviewed after each code change.

## Approved QA case source-by-source dispositions

| ID | Source status | Evidence and missing work |
|---|---|---|
| US-002-QA01 | SOURCE_TRACED | clinical-lab-admission.service.ts requireCurrent/patientCare; clinical-lab-order.service.ts quote/create; CG14 actual LAB_ERP + CG15 latest consent and real same-center care; Web and native H10 use same service |
| US-002-QA02 | SOURCE_TRACED | global OFF/current clinical readiness and CG14 original CG03+CG19 licensed center per current role denies new clinical mutations; runtime OFF/expiry test NOT_RUN |
| US-002-QA03 | SOURCE_TRACED | Controller protected /api/v1/diagnostics/clinical and Web staff-session BFF; native direct bearer CG01, no Public Android/Website writes |
| US-002-QA04 | SOURCE_TRACED | CG15 patient verification, latest consent, SAME-center original intake/consultation; native patientRef+careSourceRef pair fixed at current SHA; unauthorized staff denied by CG01+CG14 |
| US-002-QA05 | SOURCE_TRACED | original approved CG03 tariff and source test/package revisions frozen in lab_order_line, original same-center price/version, immutable accepted total and package allocation; no CG17/paid record |
| US-002-QA06 | SOURCE_TRACED | distinct lab_sample material-specific labels with original sample_line and order FK; H10 Web/Internal Android source screens show original labels |
| US-002-QA07 | SOURCE_TRACED | native and Web original idempotent custody command; 1604/1605 deferred custody transition/event DB guards, DB execution/concurrency NOT_RUN |
| US-002-QA08 | SOURCE_PENDING | reject/recollect source and 1605 custody gate block skipping rejected specimen, scanner requires real PROCESSING; qualified report approval/release source not yet implemented |
| US-002-QA09 | SOURCE_TRACED | original cg19_lab_result_intent+file and scan event, 1607 immutable file FK/verified adapter; clinical-lab-result-evidence.service.ts confirm sets RESULT_READY only; original Web H10 and Internal Android native-lab-result-upload perform actual reserved PDF flow; no professional release |
| US-002-QA10 | SOURCE_PENDING | HealthLabProfessionalReviewSourceFacade.assertCurrent now independently links current licensed CG14 professional, center affiliation, CG03, CG19 proof; no final report review action invokes it yet, no clinician sign-off |
| US-002-QA11 | SOURCE_GAP | Operator versus independent professional reviewer signing and password proof not in result-finalization workflow |
| US-002-QA12 | SOURCE_GAP | No approved protected clinical release with original digest/source CAS and current professional licence re-evaluation |
| US-002-QA13 | SOURCE_GAP | No original released CG19 PDF read ACL for exact CG15 owning patient/treating clinician on public Web/Public Android/Internal Android |
| US-002-QA14 | SOURCE_GAP | No corrected version and re-review/re-issue preserving prior immutable clinical release |
| US-002-QA15 | SOURCE_GAP | No separate real professionally released and notification delivered/outbox evidence states, despite scanner READY source |
| US-002-QA16 | SOURCE_GAP | No restricted historical legally released report reader after Lab ERP OFF; new clinical writes correctly denied |

## Same-audience Web/Android parity (not a blanket test PASS)

- **Web staff/center H10:** `apps/web/src/features/diagnostics/clinical-lab-order-workspace.tsx` and `clinical-lab-result-upload.tsx`; source-backed authenticated `app/api/lab-clinical/[...parts]/route.ts`. Has patient care-source option, 1–20 quantity, current approved prices, actual order/line details, custody with replay and CG19 PDF upload/status. Runtime, responsive layout, screenshot and source error state QA NOT_RUN.
- **Internal Android staff H10:** `apps/android-internal/src/features/diagnostics/native-clinical-lab-screen.tsx`, `native-lab-result-upload.tsx`, permission-filtered navigation from `dashboard-modules.ts` and `staff-authentication-screen.tsx`. Exact patientRef + original careSourceRef selection was corrected; genuine CG01 token and same backend enforcement, quantity changes, custody, scanner verified report. No WebView workaround. Actual Android build/device/permissions/restart QA NOT_RUN.
- **Public Web and Public Android clinical write operations:** NOT_APPLICABLE (required-denied surface). Public may browse commercial test offers under CG16 US003; no public internal order, specimen or report upload action is authorized. Do not create fake parity.
- **Actual patient released report viewer (Public Web + Public Android) / treating clinician read (Internal Android):** SOURCE_GAP until a real independently issued CG19 protected report exists. No report URL, patient access or delivery may be inferred from scanner result.
- **Foundation H09 and center pricing parity:** Separate CG16 US001 **SOURCE_GAP**: H09 catalog/price admin and independent tariff approval still lack full Internal Android implementation. This must be addressed under US001 and checked against the same source contract, not hidden in H10 completion.

## Next development gates

Implement source-pinned licensed **different** professional reviewer, current role+centre and expiry checks, report decision and release with 1604/1607 immutable source, corrections and original CG19 issued PDF; CG15 owning patient/treating clinician ACL after OFF; CG19 notification/outbox evidenced delivery. Trace all original QA cases after each stage. Do not mark US002 SOURCE_COMPLETE until both appropriate native/public/Web journeys and independent security+DB+clinical reviews pass. No merge to main until CG16 and CG17 all 12 US are completed and owner approves.
