# CG-20 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-20-BR01–CG-20-BR07, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01, C44, C45, C46, C47, C49 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U01, C44, C45, C46, C47, C49. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

**Audit caution:** C48 Data Export is an inaccessible/Super Admin placeholder, not a working export example. FR-074 requires actual authorized export; implement from requirements and verify independently.

## Screen/flow map

- **FR-073:** Manager examines business — Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-074:** Authorized user produces reports — Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

**Real CG-05 project reporting receives C44–C49 original report UI:** Actual Projects & Field Operations report filter includes genuine allowed CG-05 project/category/status/CG-02 branch/period, source-backed task overdue/visit approval and activity status. Finance columns come only from original CG-09, while internal A01/A02/A09/A10 reports remain in CG-05 without CG-20. Responsive CareGanga filter/export status and honest no-source/permission/unknown states; Public Android/Website never gets private MIS. Screenshots are indexed audit; original PNG/native/device/pixel/motion source comparison NOT_RUN.


## Task-first source screenshot and UX acceptance

Preserve original Admin KPI row, dated filter/search panels, chart/table grouping and export actions. Card drilldown must reconcile to a real authorized owner source and show accurate no-data vs permission-denied vs load-failed states. Scheduled report form names real recipients, current scope, safe selected fields and due cadence, with confirmation only after actual job created.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.