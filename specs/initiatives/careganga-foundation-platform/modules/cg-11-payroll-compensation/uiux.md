# CG-11 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-034, FR-035, FR-036, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-11-BR01–CG-11-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C01, C02, C03, C04, C05, C06, C07, C08, C09, C10 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C01, C02, C03, C04, C05, C06, C07, C08, C09, C10. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-034:** Payroll Admin configures compensation — Set approved salary components, allowances/deductions, periods, attendance rules, tax/statutory settings, bank instructions, arrears, holds and effective dates. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-035:** Payroll officer runs period — Produce draft payroll from approved eligible employee/attendance data; calculate, validate, adjust, review and obtain required approvals. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-036:** Authorized payroll payment occurs — Track reserves/batches/payment outcomes, generate private payslips, record history/audit and reconcile exactly one expense/payment outcome in CG-09. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## Original-theme and task-specific interaction blueprint

Match payroll components from the original admin form/modal, period selector, employee row, gross/deduction/arrears/net breakdown, preview and authorized approval. Pay-now is never available before verified approval; receipt/payslip shows authoritative paid/pending result. Keep employee/private salary restricted in selectors, badges, export, Android and notifications.

**Mandatory cross-state visual acceptance:** Match the original indexed reference's verified colors, type rhythm, iconography, sidebar/header where applicable, controls, drawers, status labels, card/table density and observed motion using one shared bootstrap token source. For each relevant desktop, phone, tablet and native flow inspect primary action, filters, long text, loading, true empty, forbidden, invalid, stale/conflict, network-unknown, saved and final-confirmed state. Only original video or approved asset can prove motion duration/easing; reduced-motion must remain accessible. Source-level review cannot claim rendered fidelity: VISUAL_NOT_RUN until independent source-image/video-to-real-screen comparison.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.