# CG-08 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-08-BR01–CG-08-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B02 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B02. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-020:** CSR partner submits application — Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-021:** Foundation funds a project — Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-022:** Finance or partner manager examines funding — Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** No newly owned Android page (NOT_APPLICABLE).  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

**CSR B03–B08 original UI with CG-05 project source:** In Funding Proposal and Fund Allocation source steps, show current permitted actual CG-05 project selector with genuine status/category/branch and no invented future project or person. Original CSR source labels Requested/Committed/Received/Allocated/Utilized/Released must reflect CG-08 original proposal plus CG-09 verified events, never CG-05 planned estimate as bank cash. B07 reports read real current project label/finance source; CG-05 project Admin A01 stays separate and Public Android only approved partner/project/editorial fields, not private agreements/bank source.


## Reference-faithful screen hierarchy and interaction tests

Preserve CSR partner directory, proposal/commitment detail, approved amount and document-preview workflow. Break the screen into partner identity, agreement, approved allocation and actual payment history; financial status chips cannot equate pledged with bank-received. Responsive tables preserve amount/date labels and stage actions.

**Original identity is mandatory on every relevant state:** reuse the exact extracted CareGanga sidebar/header, navigation selection, semantic color/typography/spacing/icons, cards, tables, drawers, modal shapes, badges and source-supported transitions. Screen opening, permission denial, pending confirmation, validation, conflict, successful commit and unknown network response must have designed states. Compare original screenshot/video against rendered reference-sized desktop, narrow Web and applicable native Android during independent QA; video-unknown animation timing remains NOT_VERIFIED, not invented. Keep motion reduced for accessibility.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.