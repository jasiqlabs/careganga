# CG-19 — CareGanga UI/UX Design

**Authority:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; screenshot pixel and original video transitions unverified.

## Exact existing design and animation contract

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Preserve original CareGanga Admin shell: blue selected navigation within branded searchable sidebar, current title/utility toolbar, KPI/status cards, filters/tabs/table, right-drawer form or source-evidenced wizard, icons, typography, semantic badges and feedback. Use **one** bootstrap theme/component/motion token source in product code. Public/center/Android use matching brand and semantic styling with platform-specific navigation and accessibility, not a new palette or a squeezed desktop copy. An original PNG can establish visible controls but not easing/timing; mark `MOTION_REFERENCE_UNVERIFIED` until original walkthrough is inspected.

## Screen/flow map

- **FR-070:** Business completes authorized document action — Generate versioned, permissioned membership/employee IDs, letters, donation/financial receipts, appointment slips and PDFs with source-linked status, print/share and safe QR verification. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-071:** Business event requires communication — Provide configured email/SMS/WhatsApp/push, broadcast notice, audience/priority/expiry/template control and observable delivery/failure history without duplicating module records. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.
- **FR-072:** Visitor or center requests assistance — Track public contact/helpdesk and center support tickets/FAQs, owner, replies/status and restricted identity; share support workflow across channels. Provide real permission-limited named selectors and current source status, valid create/view/edit/review actions and legible error guidance.

**Responsive:** original desktop hierarchy remains recognisable; tablet/phone adapt the sidebar, search/filter and long tables; drawers use full width on narrow Web when required.  
**Native:** Native Android keeps matching theme, back/keyboard/touch/accessibility and never uses a WebView as a substitute.  
**Feedback:** distinct confirmed success, submission pending, validation, verified empty, denied/expired, duplicate/race, provider outage, unknown-write state and retry. Never raw UUID/API/error.message, invented money or sensitive files in unsafe picker.

## CG-19-owned communication and delivery status (FR-071)

CG-19 alone renders the **message authoring, permitted recipient/audience selector, send confirmation, outbox, retry/error and delivery-history** controls. The existing CareGanga communication/notice screenshots (C15–C18, C35–C43 and source-verified applicable references) are visual authority, not proof any provider works. CG-21 provides only credential configuration and last-tested provider readiness; its screen never sends to users or edits CG-19 message history.

A permitted sender chooses an actual CG-01/03 recipient/source event and supported channel, sees required template/priority/expiry and exact permissioned counts, confirms **Queue/Send**, then views honest QUEUED, PROVIDER_UNAVAILABLE, SENT_TO_PROVIDER, DELIVERED_IF_CONFIRMED, FAILED or EXPIRED status. Missing optional provider configuration must not falsely show delivered or remove queued evidence. Show bounded retry and recipient revocation outcomes without private contacts, provider keys, fabricated audience counts or raw IDs. Apply the existing CareGanga tokens, responsive Admin Web and eligible native permitted notification readers; source/rendered visual QA remains NOT_RUN.

## Task-first source screenshot and UX acceptance

Use original Admin document/media right-drawer/modal, upload progress, preview, version/status and real Download/Share states. For genuine CG-03 cases, **CG-19 owns only protected evidence upload/scan/authorized preview**, including case-source revisions, missing evidence, permissioned view, failed/unknown upload, revocation and expiring signed link. CG-03 owns reviewer decisions/remarks; no CG-19 approval editor or fabricated file route. Recipient and privacy visibility are part of the form, not hidden in technical IDs. A notice queue must show queued, sent, failed and retry-exhausted separately; support ticket uses actual requester and protected attachment with human-readable status and next action.

**Mandatory visual contract:** Same original CareGanga brand tokens, typography, icon family, density, cards/tables, menus, drawer/modal styling, status colors and verified animation/feedback. The Admin shell applies to Admin pages; patient/public and center Android adapt structure for their tasks without adopting a new theme or squeezing a desktop sidebar onto phone. Review real loading, verified empty, forbidden, validation, timeout/unknown write, successful save and pending/approved states at applicable phone/tablet/desktop widths. Original still images cannot establish exact motion duration; independent visual/motion QA remains NOT_RUN until source PNG/video and rendered screen are compared. Support accessible reduced motion.

## Visual QA

In [tasks.md](tasks.md) every user story must trace source token/component reuse and valid screen-to-real-API state. Compare actual original PNG/video with rendered Web/Android in separately authorized QA before claiming exact palette, animation or look-and-feel PASS. Current `VISUAL_NOT_RUN`, `REFERENCE_ASSETS_NOT_VERIFIED`.