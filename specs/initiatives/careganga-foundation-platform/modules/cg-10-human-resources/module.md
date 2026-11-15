# CG-10 — Human Resources

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-10-BR01–CG-10-BR15, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Employment/ID, attendance/leave, transfers/exits, performance, letters state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Employment/ID, attendance/leave, transfers/exits, performance, letters. **Delivery-critical, already-delivered owners:** CG-01 staff login and scoped roles, CG-02 real branches/departments, CG-03 applicable HR approvals, CG-19 protected issued letters/files. **Later owned integrations, never required to fake this module's first working path:** CG-11 adds real salary calculation/payout, CG-09 handles authorized reimbursements; CG-05 projects and CG-20 reporting consume real staff data. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

**State and invariant:** New/review/active/probation/hold/exit; leave pending/approved/rejected. Employment not login; payroll/salary and bank data remain private/owned. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-029/A-10:** HR enrolls employee — Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access
- **FR-030/A-10:** Employee reports work — Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history
- **FR-031/A-10:** HR manages employment — Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit
- **FR-032/A-10:** HR issues official record — Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates
- **FR-033/A-10:** Employee requests allowance — Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment

Detailed authoritative clauses:
- **CG-10-BR01:** Create/verify employees with personal/employment information, branch, department, designation, line manager, joining data and permitted documents.
- **CG-10-BR02:** Generate employee ID after applicable authorization; link access roles in CG-01 without duplicating an employee account manager.
- **CG-10-BR03:** Provide HR dashboard, employee directory, status (active, probation, hold, resigned/inactive) and authorized profile changes.
- **CG-10-BR04:** Record daily attendance, present/absent/late/leave/weekly-off status, monthly calendar, summaries and correction approval.
- **CG-10-BR05:** Configure working times, break, grace period and weekly-off rules where required.
- **CG-10-BR06:** Enable staff leave application, leave history, supervisor/HR review and approval.
- **CG-10-BR07:** Maintain defined staff performance assessments and role-scoped reporting; details to be completed against approved reference screens.
- **CG-10-BR08:** Process transfer/promotion requests, posting/designation changes, resignation and approved exits, retaining history.
- **CG-10-BR09:** Generate employee appointment/relieving and other permitted letters, memos and ID cards via shared document templates.
- **CG-10-BR10:** Track employee/volunteer allowance requests but hand approved financial liability and payment to CG-09.
- **CG-10-BR11:** Make role-scoped attendance, leave, tasks and employee self-service accessible from Internal Android.
- **CG-10-BR12:** Employee registration/activation supports stage-appropriate application and document reviews, for example initial submission, state verification, zonal review, HR verification and final authorized approval. Registration stores personal, employment/branch, reporting manager, secure identity/bank, compensation proposal and documents as separately permissioned information; employee ID and user access arise only from the applicable approved lifecycle.
- **CG-10-BR13:** Employee letter/memo records support draft, edit, preview, authorized approval, issuance/dispatch, acknowledgment or received-copy upload where applicable, reissue/history and PDF/print. Supported templates include appointment, offer, joining, experience, relieving and other approved official letters; the generator is shared under CG-19.
- **CG-10-BR14:** Transfer, promotion and exit workflows preserve current/proposed role, branch, reporting manager, salary and effective dates. Exit review can track handover, HR/finance/assets clearance and final dues/settlement without silently marking salary or reimbursements as paid.
- **CG-10-BR15:** Employee ID-card issuance, reissue, deactivation, print/download and authorized QR verification use shared document templates; authorized display fields and history derive from approved person/employment data, not a separate manual identity store.

## Independently deliverable vertical flow

**Concrete acceptance:** Create real staff, record attendance/leave and transfer with versioned changes; maintain old/new branch scope correctly, deny unauthorized bank/salary access and issue real document proof without claiming a payout. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.