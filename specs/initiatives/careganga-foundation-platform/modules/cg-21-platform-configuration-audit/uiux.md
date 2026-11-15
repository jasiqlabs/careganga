# CG-21 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

**Reference evidence boundary:** C54 API/Integrations and C55 Backup/Restore are disabled placeholder captures, not evidence of working services. PRD/BR still require real secure configuration and recovery, with separate executed operations proof.

## Screen/flow map

- **FR-075:** Super Admin manages platform — Configure Foundation/system settings, approved payment/messaging/map integrations and public visibility through the owning modules; sensitive credentials restricted. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-076:** Administrator audits or recovers — Show protected logs for login, approvals, money, provider verification, sensitive accesses and publishing; restrict backup/restore to approved operations and support privileged MFA/session controls. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** No newly owned Android page (NOT_APPLICABLE).  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## Task-first source screenshot and UX acceptance

Preserve original Settings/Audit Admin sidebar, section tabs, form/drawer controls and status badges while separating configured from verified integration. Show redacted history, actor/time/resource names and one purposeful privileged confirmation rather than secret/token display. Backup/restore screens must distinguish requested, approved, running, failed and independently verified successful recovery.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.