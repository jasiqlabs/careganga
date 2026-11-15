# CG-16 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-16-BR01–CG-16-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Original H08–H10 partner catalog and optional lab operations

**Core with global Lab ERP OFF:** H08 genuine Diagnostic & Lab Management partner verified center list, mapped approved tests and real prices; H09 Lab Test Master & Pricing list, right `Test Information / Pricing & Discount / Lab Mapping / Report & Settings` with original navy sidebar/blue selected item, test/category/sample type/search/filter/approval/price history, responsive Foundation Admin and permitted Center Portal. H09 public safe catalog/enquiry works before any patient registration/CG-15 lab order/CG-17 subsidy. It never displays lab sample booking or report as an available action when disabled.

**US-002 with verified Lab ERP ON:** H10 Sample Collection & Report Management, state/district/center/date/status filters, real lab booking/sample list, patient protected record, `Test Details / Sample Collection / Report & Delivery / History & Logs` tabs, original buttons View Report/Download/Resend only when source permitted. Distinct Created, Pending Collection, Collected, Processing, Result Ready, Awaiting Professional Review, Released, Rejected/Recollection and delayed states. Invalid patient consent, old sample, unlicensed reviewer or backend status error show correct unavailable/pending—not issued or delivered. Center portal does actual operations, public Android only owner-authorized report access, no private lab admin app.

**US-005 with verified ERP ON:** Original left `Equipment & Inventory` and `Quality & Compliance` menu items are **lab equipment readiness and regulated evidence** only, not a procurement/stock ERP or CG-12 Foundation store; center-scoped real equipment/evidence update, scan/review status, due/expired maintenance, protected file. Original CareGanga typography, cards, compact tables/right panel, responsive tablet/mobile, screenreader/Back/reduced motion; no invented color HEX or clinical status counts. Disabled flag removes advanced menus and backend commands, preserves lawful historical patient report access. Current source QA 60; original rendered screenshot/video/device QA NOT_RUN.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-055:** Center/central Admin configures lab — Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-056:** Center books lab service internally — Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-057:** Patient/provider views service — View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-058:** Additional service CTA appears publicly — Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## Task-first source screenshot and UX acceptance

The healthcare center dashboard uses the existing CareGanga brand controls but appropriate clinical order hierarchy: patient verification -> available test/price -> order -> sample state -> validation -> authorized release -> protected download. Clear draft, awaiting sample, processing, approved, corrected and unavailable states; no sample/patient data in toast or public search. Admin tabs and forms retain the source brand/status treatment; patient Android displays only verified own reports.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.