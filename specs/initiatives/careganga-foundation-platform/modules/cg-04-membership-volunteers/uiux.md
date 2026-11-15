# CG-04 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-04-BR01–CG-04-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B09, B10, U14, U15, U16, U17 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B09, B10, U14, U15, U16, U17. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-009:** Person applies as member — Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-010:** Admin manages membership — Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-011:** Person volunteers — Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-04 original ownership of member/volunteer branch affiliation — channel interaction

CG-04 membership/volunteer Web and applicable Android screens offer minimum-field CG-02-approved branch/department options only where the current CG-04 workflow permits them. Validate disabled/closed/foreign branch and revoked operator in the actual CG-04 form, show existing member or volunteer's current affiliation/history and safe correction. Do not place a membership/volunteer editor in CG-02 or imply assignment grants staff account privileges. No fabricated future owner data or new CareGanga theme.

## Reference-faithful screen hierarchy and interaction tests

Tier setup follows the original membership table/form density with plan name, amount, validity, benefit and publication state. Public join shows clear tier comparison, one coherent application path, verification, actual payment pending/verified and application tracking; volunteer form shows skill/geography and actual review result, never staff payroll fields.

**Original identity is mandatory on every relevant state:** reuse the exact extracted CareGanga sidebar/header, navigation selection, semantic color/typography/spacing/icons, cards, tables, drawers, modal shapes, badges and source-supported transitions. Screen opening, permission denial, pending confirmation, validation, conflict, successful commit and unknown network response must have designed states. Compare original screenshot/video against rendered reference-sized desktop, narrow Web and applicable native Android during independent QA; video-unknown animation timing remains NOT_VERIFIED, not invented. Keep motion reduced for accessibility.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.