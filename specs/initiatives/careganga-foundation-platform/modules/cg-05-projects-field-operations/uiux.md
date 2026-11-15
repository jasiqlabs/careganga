# CG-05 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-05-BR01–CG-05-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-012:** Project owner sets up work — Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-013:** Coordinator assigns work — Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-014:** Field worker visits project — Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## Reference-faithful screen hierarchy and interaction tests

Preserve reference A01-A06 project/field-visit KPI+filter+tabular layout, visit details with Overview, Route/Map, Report, Photos/Videos, Documents, Team, Beneficiaries, Approval and Log tabs where real data exists. The Add Field Visit dialog keeps captured geography/clock state and file-progress indicators; mobile operators get task-first check-in and evidence controls, not a miniature admin table.

**Original identity is mandatory on every relevant state:** reuse the exact extracted CareGanga sidebar/header, navigation selection, semantic color/typography/spacing/icons, cards, tables, drawers, modal shapes, badges and source-supported transitions. Screen opening, permission denial, pending confirmation, validation, conflict, successful commit and unknown network response must have designed states. Compare original screenshot/video against rendered reference-sized desktop, narrow Web and applicable native Android during independent QA; video-unknown animation timing remains NOT_VERIFIED, not invented. Keep motion reduced for accessibility.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.