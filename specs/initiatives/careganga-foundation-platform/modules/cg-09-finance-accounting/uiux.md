# CG-09 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-09-BR01–CG-09-BR17, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A19, B01, B02, U33, U34, U35, U36, U37, U38, U39, U40, U41, U42. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

**Screen ownership correction:** A17/A18 are CG-07 donation intake/records linked to this finance owner, not independent CG-09 finance UI screens. Preserve A19 voucher, B01–B02 budget and U33–U42 financial references.

## Screen/flow map

- **FR-023:** Finance Admin opens accounts — Configure chart of accounts/groups, financial year, branch/project allocation, cash/bank accounts, opening balances and controlled statuses. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-024:** Finance user posts a transaction — Enter authorized balanced journal, payment/expense/contra voucher with item/rate/tax/charges, payee, source, attachments and applicable approval/paid state. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-025:** Employee/volunteer requests reimbursement — Submit claim with purpose/amount/date/project and bill; route approval then single linked payable, voucher, payment and posting, not multiple expenses. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-026:** Authorized user invoices or receipts — Use staged invoice/receipt preparation, items, dates/amounts, attachments, verifier and payment terms; save, approve, print/share securely and link actual money states. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-027:** Finance allocates budget — Create/approve budgets and reveal committed, allocated, utilized, released, available/over-budget amounts with funding/project/branch drill-down. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-028:** Reviewer checks statements — See scoped general ledger, cash/bank/day books, trial balance, vendor/CSR/project views, payables, corrections and reconciled reports with audit. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-09 owner — genuine CG-02 branch budget selection

Budget screens use **real CG-02 ACTIVE branch** minimum-field selectors and source-backed CG-09 allocation/utilization history. A real branch-only budget succeeds with zero CG-05 projects; project linkage is offered only after a genuine CG-05 project owner delivers it. Wrong/closed branch denies on client and backend, without CG-02 budget editor or invented finance data. Maintain original CareGanga finance form/table patterns.

## Original-theme and task-specific interaction blueprint

Keep the original finance view (reference A19/B01-B02/U33-U42) with proper voucher/claim/invoice wizard, account/business-name selectors, dated debit/credit lines, explicit subtotal/tax/charges/total, review status and separate PAID versus APPROVED. Cash/Bank/Day/Trial Balance views remain source-ledger backed. On narrow screens preserve column meaning through stacked line items and sticky totals; never expose UUID or raw SQL error.

**Mandatory cross-state visual acceptance:** Match the original indexed reference's verified colors, type rhythm, iconography, sidebar/header where applicable, controls, drawers, status labels, card/table density and observed motion using one shared bootstrap token source. For each relevant desktop, phone, tablet and native flow inspect primary action, filters, long text, loading, true empty, forbidden, invalid, stale/conflict, network-unknown, saved and final-confirmed state. Only original video or approved asset can prove motion duration/easing; reduced-motion must remain accessible. Source-level review cannot claim rendered fidelity: VISUAL_NOT_RUN until independent source-image/video-to-real-screen comparison.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.