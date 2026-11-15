# CG-08 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-08-BR01–CG-08-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B02 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B02. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen-to-story and exact public/private channel boundary

**US-001:** Source-indexed B02 CSR organization/partner application and B03–B08 related agreement/reviewer surfaces: original navy-blue sidebar, blue selected menu, compact KPIs/status filters/paged partner list, details drawer with Foundation-verified legal name, primary contact, protected evidence/status tabs, Submit/Return/Approve/Reject reviewer remarks and current CG-03 history. Foundation Admin actor sees only allowed private data; approved partner may submit/revise own contact; unauthenticated public only gets separately authorized application fields, not internal partner roster.

**US-002:** Original CSR funding proposal and agreement area separates Requested, Committed, Actually Received (CG-09), Approved Allocation (CG-09), Utilized/Released (CG-09), each source-labelled and currency-consistent. Form supports genuine optional actual CG-05 project selector and **General Foundation purpose** without a project; signed split percentage, proposed Foundation cofunding, current reviewer/doc proof, revisions/returned/approved timeline. A positive pledge is not receipt. Show independent pending bank verification and finance effect with exact source refs; paid/source-finance unknown never green success. No placeholder future project in a dropdown.

**US-003:** Real scope-filtered CSR partner/project/purpose/date/source-status dashboard and approved/private exports, versioned agreement and finance timeline, 2 sponsor/project comparison without duplicate spend. Public partner logos and impact text appear only after actual CG-18 independent editorial publication; public Android may consume existing editorial safe source with no new CSR native screen. Report with unknown/outdated finance status displays `Finance verification pending`; no imaginary CSR contribution figures.

**Original UI parity:** Reuse actual CG-01 design tokens/shell, accessible focused form/field error, confidential contact masking, responsive status chip/table/drawer/progress, keyboard/contrast/reduced motion, no technical DB IDs or raw errors. Each B02/B03–B08 screenshot source is static design evidence; exact PNG/video animation and rendered Web/native comparison NOT_RUN. Backend denies hidden restricted routes, including attachments/exports, with current root/branch/role.

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