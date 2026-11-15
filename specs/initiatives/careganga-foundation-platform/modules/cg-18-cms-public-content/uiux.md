# CG-18 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-066, FR-067, FR-068, FR-069, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/03-CMS-CHANNELS-BR.md) CG-18-BR01–CG-18-BR28, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-066:** Admin edits Foundation site — Manage homepage, About/Our Work, projects, team, hero images/typography, CTAs, website navigation and public Login/Join visibility with authorized preview/publish controls. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-067:** Admin edits NGO impact/transparency — Publish editable Impact groups, geography/charts/stories with appropriate provenance; maintain 80G/PAN/registration, annual and financial disclosure pages/documents. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-068:** Admin publishes reusable content — Manage galleries, videos, publications, media, articles, updates, events, notices and public enquiries with controlled fields, review, ordering, preview and status. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-069:** Healthcare content is published — Show approved directory/category cards, provider profiles, doctors, current price/facility/benefit messaging; don't allow CMS to overwrite provider verification, scheduling or contribution ownership. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** No newly owned Android page (NOT_APPLICABLE).  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-18-owned public navigation controls (C50 evidence transferred from CG-21)

The original **C50 General Settings** captures the visual treatment of three separate toggle controls: Frontend Login/Profile, Membership Join/Apply, and Volunteer Join/Apply. **The functioning controls belong under CG-18 CMS content/publication**, not CG-21 platform operational settings. Reuse original CareGanga blue active navigation, typography, semantic switches, form density, save/preview/publish feedback and mobile-appropriate accessible variants; do not claim the screenshot proves a backend action.

Authorized Admin Web publisher views each desired flag with its current **Draft / Awaiting approval / Published / Hidden / Target not available** state, can stage and preview a revision, and uses genuine CG-03 publication review when configured. The published revision controls the real public Web **and Public Android** navigation through one CG-18 public-safe projection; switching a control off removes it on both after truthful cache invalidation. A displayed toggle is not a security bypass: actual CG-01 account/login still enforces authorization, and joining CTAs never link to nonexisting CG-04 membership/volunteer routes. Until CG-04 provides those actual routes, show **Target not available** in Admin and **no actionable CTA** publicly, without inventing a join form.

This module owns **responsive Admin CMS editor + public Web + public Android navigation consumer**. No new CG-18 native Admin editor; Internal Android is not a CMS publication editor. Cover loading, saved draft, stale edit CONFLICT, denied publisher, pending review, link unavailable, publish confirmed, cache stale/unknown and reduced-motion semantics. Pixel/device/motion QA remains NOT_RUN.

## CG-18 public contact and CG-19 notice presentation boundary

CG-18 may show a genuinely published Contact page with the **actual CG-19 contact form**, validated submit, safe opaque receipt/unknown-result feedback and appropriate privacy notice. Do not show a CG-18 private contact inbox, duplicate responder controls, contact table or unsupported chat component: the original C39–C43 Foundation contact/helpdesk UI belongs to CG-19. Site cannot falsely promise a delivered email if CG-19 only confirmed DB intake.

A CG-19 operational Notice is only eligible for CMS public display after genuine source permission and a **separate CG-18 publication**. Show original CareGanga headline/status hierarchy, preview, publish/unpublish, expired/withdrawn state and real public visibility revision, not a notification-send button or recipient list. CG-19 safely validated media asset can be placed/published by CMS with original preview; private/scan-pending file must not enter public gallery. Runtime/pixel QA not run.

## Task-first source screenshot and UX acceptance

Follow original public CMS screens for page/hero/menu/media editing, right-drawer forms, tabbed draft/scheduled/published states, preview and public View Site action. Keep edit vs publish distinct; when source-backed campaign/doctor/impact is unavailable, hide the corresponding source selector rather than inventing a linked card. Render actual responsive site with the same CareGanga palette/type/icon language and purposeful transition treatment.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.