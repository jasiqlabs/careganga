# CareGanga Healthcare — START HERE (junior developer)

**Read this first.** This is a practical QA and UI/UX improvement assignment for the healthcare functionality **already merged into main**. We are **not** starting new business modules.

**Full manual with architecture, module code links, detailed walkthroughs, UI guidelines, test evidence, and merge checklist:**  
[Open the Healthcare Junior Developer QA / UIUX Handoff](docs/qa/CAREGANGA-HEALTHCARE-JUNIOR-DEVELOPER-MANUAL-QA-UIUX-HANDOFF-20261123.md)

## Your mission in one sentence

Run the existing healthcare experience **as real users would**, fix genuine bugs in the owning backend/Web/Android/database code, make the screens consistent with the client's original CareGanga screenshots, and request review before merging the fixes into **main**.

## Do these steps IN THIS ORDER

1. **Learn the project and verify your local setup.** Read [AGENTS.md](AGENTS.md), the [full healthcare handout](docs/qa/CAREGANGA-HEALTHCARE-JUNIOR-DEVELOPER-MANUAL-QA-UIUX-HANDOFF-20261123.md), and [business requirements](docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md). Start with updated main; create a **separate healthcare QA/fix feature branch** for app changes. Use a **disposable test database** and no real patient records. Run npm ci, source checks, backend/Web build, two Android typechecks, and database migrations; capture actual results.
2. **Check the foundations before healthcare.** CG-01 (login/roles), CG-02 (Foundation branches), CG-03 (approval), CG-19 (documents), CG-09 (finance), CG-21 (settings). Check actual access and documents. **A Foundation branch and a partner healthcare center are different**, so never grant one from the other.
3. **Start healthcare with [CG-14 Healthcare Network](specs/initiatives/careganga-foundation-platform/modules/cg-14-healthcare-network/tasks.md).** Register an example provider and **Clinic X / Clinic Y**, verify center/doctor evidence, approve correctly, link an authorized center representative, set different genuine doctor-center fees and test the public directory plus center portal. Fix defects before moving on.
4. **Continue [CG-15 Patients & Appointments](specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md).** Verify patient identity/consent, doctor schedule, last slot, booking from both search paths, appointment slip, reception queue, actual completed visit, cancellation and patient-owned history. Deny wrong-center and wrong-patient reads.
5. **Test [CG-17 Healthcare Assistance](specs/initiatives/careganga-foundation-platform/modules/cg-17-healthcare-assistance-settlements/tasks.md) with the same patient journey.** Before confirmation show **gross fee, approved Foundation support, patient due**. The **center collects patient money**, the Foundation maintains a **separate liability** after an eligible completed service, and Foundation settlement is confirmed only from verified finance evidence. Do not mark a pending payment as paid or advertise a universal 50% discount.
6. **Test [CG-16 Diagnostics](specs/initiatives/careganga-foundation-platform/modules/cg-16-healthcare-diagnostics/tasks.md).** First prove approved public lab tests/prices/enquiry work with Lab ERP **OFF**. Then, only in a specifically configured test environment with real center grant and consent, test optional lab order → sample → independent clinical report review → secure patient-only released report. Keep Pharmacy, Nursing and OT ERP **OFF**.
7. **Run full end-to-end regression and finish.** Try two centers, Foundation A/B branches, revoked staff, duplicate submissions, 2-device booking conflicts, slow/offline requests, false money callbacks, wrong patient files, Web ↔ Internal Android and public Web ↔ Public Android. Compare rendered screens with the **actual** [client admin screenshot audit](docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) and [healthcare reference map](docs/research/CAREGANGA-HEALTHCARE-SEPARATE-UI-SCREENSHOT-REFERENCE-MAP.md). Record results in the **original module tasks.md QA cases**; fix/re-review/re-test; open a reviewed PR targeting main.

## Keep these rules in front of you

- **Fix one actual issue at a time**: reproduce → implement → independent code/security/DB review → fix → re-review → run manual original QA → commit.
- **Do not implement** future CG-22 Pharmacy stock/dispensing, CG-23 Nursing ERP or CG-24 OT/Procedure ERP. The existing **CG-14 partner public offers** and eligible **CG-17 verified partner-service assistance** are separate existing journeys and can be tested while ERP is OFF.
- **Never call unexecuted testing PASS.** Write PASS / FAIL / BLOCKED / NOT_RUN and attach date, role, channel, screenshots, API/SQL proof and commit.
- **Quality:** Simple English labels/errors, no raw UUIDs, no dead buttons, genuine responsive UI/native screens, current access restrictions, privacy, no duplicate booking or money, no fabricated clinical reports.
- **No CI/GitHub Actions.** Local manual testing and existing source scripts only. No direct app-code commits to main; no merge before independent review and mandatory runtime/security/finance/clinical checks.

## What to send the lead when finished

Report: **branch/SHAs, modules and original QA IDs tested, actual pass/fail/blocked counts, the full consultation journey result, lab ERP-OFF result, Web/Android results, X/Y access proof, UI screenshot comparisons, backend/DB/provider test proof, bug-fix commits, independent review, and exact unresolved blockers.** Ask for merge authorization; do not call source-only verification a release pass.

**For every test step and exact source-code link, use the [full handout](docs/qa/CAREGANGA-HEALTHCARE-JUNIOR-DEVELOPER-MANUAL-QA-UIUX-HANDOFF-20261123.md).**
