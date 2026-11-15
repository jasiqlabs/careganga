# CG-16 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-16-BR01–CG-16-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

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