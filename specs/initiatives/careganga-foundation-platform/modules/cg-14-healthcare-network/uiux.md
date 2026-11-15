# CG-14 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-14-BR01–CG-14-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-042:** Foundation or center submits provider — Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-043:** Foundation verifies provider — Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-044:** Foundation or center registers doctor — Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-045:** Patient searches healthcare — Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-046:** Center maintains permitted presentation — Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-14 center-context helpdesk integration

CG-14 US-005 may show an **own-center Support** entry in the legitimate Center Portal (responsive Web, eligible native center app only when real platform route exists) once current CG-14 center identity/CG-01 permission is verified. The ticket/reply/status is rendered from **CG-19's** existing protected source, not a center-specific standalone message store or unapproved mock chat. Center staff sees only its actual Center A support cases; no Center B search/guessed ticket/export. Wrong/closed center, revoked account, unavailable CG-19 support API and stale reply have honest error/empty states. Follow CareGanga original center/Admin token system, touch/focus, mobile/back and privacy; device/pixel QA NOT_RUN.

## CG-14 introducing public directory and center-content UI

After actual CG-14 verified provider source exists, US-004 implements genuine public Web and Public Android center/doctor search/filter/category/results/detail/real published fee, badge, status and map/contact; the existing CG-18 page supplies approved headings/theme/cards placement but **not** doctor master or fee. Without a real center, CG-18 remains a neutral editorial page and CG-14 search shows genuine empty (not mock card). A suspended center disappears from all public cached card/deep-link options and no private clinical/bank/license data is exposed. US-005 Center Portal account may submit only its own real services/photos/FAQ with actual CG-19 validated original files, and sees return/approved/published separately. CG-14 introduces publication projection into CG-18 via proper CG-01/03 reviewed permission, not center self-publish or secondary CMS master. Match original CareGanga brand tokens; actual screenshot/Android QA NOT_RUN.

## Original-theme and task-specific interaction blueprint

Use the original CareGanga header, color, card/table, filters and approval-drawer style for healthcare network Admin and center portal. Provider onboarding groups credentials, service categories, evidence, location, admin decisions and publish state; doctor form shows one professional profile with independently approved center fees/affiliations. Public provider directory shows only approved/published contact/fee details, no raw license or bank files.

**Mandatory cross-state visual acceptance:** Match the original indexed reference's verified colors, type rhythm, iconography, sidebar/header where applicable, controls, drawers, status labels, card/table density and observed motion using one shared bootstrap token source. For each relevant desktop, phone, tablet and native flow inspect primary action, filters, long text, loading, true empty, forbidden, invalid, stale/conflict, network-unknown, saved and final-confirmed state. Only original video or approved asset can prove motion duration/easing; reduced-motion must remain accessible. Source-level review cannot claim rendered fidelity: VISUAL_NOT_RUN until independent source-image/video-to-real-screen comparison.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.