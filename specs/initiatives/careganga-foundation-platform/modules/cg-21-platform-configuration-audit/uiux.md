# CG-21 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT aligned to PRD/HLD v1.1 and corrected CG-21 owner boundaries; local Harness gate and current-hash approval NOT_RUN, exact screenshot pixels and source-video motion UNVERIFIED.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

**Reference evidence boundary:** C54 API/Integrations and C55 Backup/Restore are disabled placeholder captures, **not functioning services**. PRD/BR require an accessible real private configuration/request view backed by approved operations; when provider or restore procedure is absent show Configured/Not verified or Recovery unavailable, never successful execution. C50's public Login/Join/Volunteer toggles are the original screen's visual evidence: actual publication control belongs to future CG-18 and cannot be duplicated in CG-21 or falsely shown active; until CG-18 delivers them, display an accurate ownership/unavailable explanation, not an inert enabled switch.

## Screen/flow map

- **FR-075:** Super Admin configures actual versioned *platform/system* settings, safely enters a provider credential into approved secret management without exposing its value, and starts explicit provider-readiness verification. Show current real source/revision; distinguish Disabled / Configured but not verified / Verified at check time / Failed / Unavailable, with appropriate refresh/ retry. Foundation legal profile belongs to future CG-02; public content/visibility switches are not silently duplicated while CG-18 is unimplemented. No fake provider is required for a valid settings save.
- **FR-076:** A CG-01-authorized operator views *genuine* CG-01 role/session/access audit and CG-21 setting/recovery audit with scope filters, detail and redacted export. Future owner feeds appear only after actual delivery; show partial/unavailable rather than an invented complete log. A privileged Super Admin initiates and authorizes a real recovery request with fresh CG-01 MFA, sees request/authorized/running/unknown/failed statuses, and sees verified success only with independent operation evidence. No dependency on future CG-03 approval cases.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** No newly owned Android page (NOT_APPLICABLE).  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## Task-first source screenshot and UX acceptance

Preserve the original Settings/Audit Admin sidebar, section tabs, forms/drawers, compact filter/table density and semantic badges (C09/C10 and C50–C55), while displaying the real distinction between configured and last-verified integration. Show permission-scoped root audit with actor/action/business names, time, safe details, redacted export and explicit partial-source status; do not duplicate CG-01 audit. Recovery views distinguish requested, MFA-authorized, running, unknown, failed and independently verified successful recovery; a missing secured backup provider is explicitly unavailable. Never display fake global statistics, actual provider credentials, or a technical identifier in the user interface.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.