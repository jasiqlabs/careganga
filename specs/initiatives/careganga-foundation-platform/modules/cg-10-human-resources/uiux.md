# CG-10 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-029, FR-030, FR-031, FR-032, FR-033, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-10-BR01–CG-10-BR15, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B19, B20, B21, B22, B23, B24, B25, B26, B27, B28, B30, B31, B32, B33, B34, B35, B36, B37, B38, B39, B40, B41, B42, B43, B44, B45, B46, B47, B48, B49, B50, B51. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

**Screen ownership:** B49–B51 show allowance/reimbursement despite the B49 filename suggesting leave. CG-10 owns employee request context; CG-09 owns approval-linked expense/liability/payment and the correct finance outcomes.

## Screen/flow map

- **FR-029:** HR enrolls employee — Capture employment, branch/department, reporting line, needed personal/identity/bank/qualification documents; follow configured verification until approved ID/access. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-030:** Employee reports work — Capture attendance/shift/grace/weekly-off/late/leave, corrections and leave applications with authorized approvals and protected history. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-031:** HR manages employment — Record performance assessments, assignments, transfer/promotion, effective-dated role/salary/branch, resignation, clearances, final dues and approved exit. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-032:** HR issues official record — Prepare, review, sign/issue, dispatch, receive/reissue employee letters/memos and ID cards, using source-linked shared document templates. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-033:** Employee requests allowance — Submit and track allowance/claim from applicable Internal Android or Admin workflow; only CG-09 records actual liability/payment. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-10-owned employee branch selectors

Enrollment and transfer in existing CareGanga HR Web/Internal Android views use genuine permitted CG-02 branch+department options, with active/current and effective-dated previous affiliation. Closed or foreign destination yields safe form error, stale assignment a clear conflict; no separate CG-02 employee editor or fabricated staff option, and an account-role grant cannot be inferred from HR branch selection. Follow original HR visual tokens, drawer and native focus/error treatment; visual/device QA remains NOT_RUN.

## Original-theme and task-specific interaction blueprint

Preserve staff directory, employee right-drawer onboarding, attendance/leave calendar/statuses, transfer review, performance and letter/memo preview. Group employment and permissions separately from payroll; an employee never sees another staff member's bank fields. Native Internal Android prioritizes own attendance/leave/claim workflows with clear date selector, keyboard/back and offline error.

**Mandatory cross-state visual acceptance:** Match the original indexed reference's verified colors, type rhythm, iconography, sidebar/header where applicable, controls, drawers, status labels, card/table density and observed motion using one shared bootstrap token source. For each relevant desktop, phone, tablet and native flow inspect primary action, filters, long text, loading, true empty, forbidden, invalid, stale/conflict, network-unknown, saved and final-confirmed state. Only original video or approved asset can prove motion duration/easing; reduced-motion must remain accessible. Source-level review cannot claim rendered fidelity: VISUAL_NOT_RUN until independent source-image/video-to-real-screen comparison.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.