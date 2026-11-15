# CG-19 — Documents Notifications

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43.  
**Stage:** Harness Planning / GREENFIELD · **Review status (15 Nov 2026):** OWNER_BOUNDARY_TRANSFER_APPLIED / REVIEW_IN_PROGRESS / NOT_APPROVED. Actual email/SMS/WhatsApp/push sending, retries and receipts live in CG-19 only; CG-21 owns provider credential references/readiness, not messages. Module and DLD were partially corrected; complete independent review, delegated decision, authenticated resolver and runtime/visual QA NOT_RUN; implementation BLOCKED.

uiux_decision: REQUIRED
uiux_reason: Real protected file/upload/download, issued document, notice delivery statuses and support ticket Web/authorized Android journeys require source-faithful CareGanga B38/B41/B42/C15–C18/C35–C43 brand/UX and privacy-aware accessible adaptations.
dld_decision: REQUIRED
dld_reason: Genuine source-linked secure object storage, issuing/revoking documents, conditional notifications/outbox, idempotent retries and privacy-scoped support need exact typed source contracts, DB constraints, bounded worker and failure recovery.
database_impact: CRITICAL
database_reason: New source-owned Source-linked files/templates/PDF/QR, notices/messaging and support tickets state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Existing Public Android can show permitted personal notifications/support state and Internal Android can capture/attach authorized source evidence or view scoped notices, only as real owner routes become available; no copied Admin WebView or fictitious center/clinical viewer.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Actual protected file metadata/upload and signed retrieval, **protected CG-03-case evidence upload and read association when CG-19 is delivered, while CG-03 alone owns reviewer decisions**, source-linked issued documents/templates, **message transmission** (email/SMS/WhatsApp/push), notification templates/audience, bounded outbox/retry/provider attempts, verified delivery outcomes and history, notices and Foundation support requests. CG-21 supplies permitted configuration/readiness references only; it never sends or owns delivery results. **Implementation prerequisites (scheduled earlier, not yet delivered):** CG-01 authenticated users/source accounts and CG-03 genuine protected access-change cases/decisions; CG-21 verified platform provider configurations are available when provider transmission is enabled. **First self-contained success:** source-linked CG-01/03 protected evidence and optionally permitted issued approval proof; one real outbox record may honestly remain QUEUED/UNAVAILABLE if no provider credential is configured. A real secured object store is required before claiming file-upload success, never replaced with a fake file ref. **Later owner integrations:** CG-02 attaches branch registration evidence; CG-04/09/10/14/15/16 supply actual member/employee/financial/center/patient/clinical sources. CG-14 or later center-facing owner exposes real scoped center helpdesk, CG-18 renders public contact UI if appropriate. Neither future center, donor, member, staff, patient, finance nor CMS records are dependencies of CG-19 initial core.

**State and invariant:** File UPLOADING/UPLOADED_PENDING_SCAN/VALIDATED/REJECTED/REVOKED, generated document DRAFT/ISSUED/REVOKED, message QUEUED/RETRY_DUE/SENT_TO_PROVIDER/DELIVERED_IF_CONFIRMED/FAILED/EXPIRED, support OPEN/ASSIGNED/REPLIED/CLOSED (reopen auditable). No guessed file success, public private-doc link, duplicate source-derived receipt, fake provider delivery, perpetual scans or unsafe URL. Authorize actual CG-01 Foundation-root and real CG-03 case scopes now; center/patient/employee/financial scopes only when source owners deliver. All file, list, search, recipient picker, downloaded PDF, QR, export and write paths must be server-authorized, not by client-passed IDs.

## Complete PRD and BR mapping

- **FR-070/A-19:** Business completes authorized document action — Generate versioned, permissioned membership/employee IDs, letters, donation/financial receipts, appointment slips and PDFs with source-linked status, print/share and safe QR verification
- **FR-071/A-19:** Business event requires communication — Provide configured email/SMS/WhatsApp/push, broadcast notice, audience/priority/expiry/template control and observable delivery/failure history without duplicating module records
- **FR-072/A-19:** Visitor or center requests assistance — Track public contact/helpdesk and center support tickets/FAQs, owner, replies/status and restricted identity; share support workflow across channels

Detailed authoritative clauses:
- **CG-19-BR01:** Provide templates and authorized generation of membership documents, staff letters/ID cards, invoices, vouchers, donation receipts, appointment slips and other required PDFs.
- **CG-19-BR02:** Store user-submitted and business-submitted photographs, document scans, medical reports and proof with owner association and restricted access.
- **CG-19-BR03:** Support common SMS/email/mobile-push communications and WhatsApp where configured, with business-triggered templates, audience, delivery history and error states.
- **CG-19-BR04:** Admin notices/bulletins with content/publication status and authorized notification sending.
- **CG-19-BR05:** Expose appropriate records to correct audience (donor receipt to donor, appointment slip to patient/center, salary slip to employee).
- **CG-19-BR06:** Offer communication logs and template controls without adding independent message histories to every module.
- **CG-19-BR07:** Maintain one scoped service-request/helpdesk capability for Foundation public contact requests and healthcare-center support tickets, service requests and FAQs where required. Center operators see only their authorized cases; ownership, status, responses and permissions are shared, not duplicated per portal.
- **CG-19-BR08:** Shared document templates support front/back ID cards for authorized members, volunteers and employees, optional visible fields, issue/expiry, preview, barcode/QR verification, print/PDF/reissue history, and official letters/memos with signature/seal and received-copy tracking where applicable. Document generation must reference approved source records.
- **CG-19-BR09:** Notifications distinguish direct transaction events, role/group broadcasts, individual messages and public notices. Authorized senders can configure recipient audience, category, priority, title, message, optional link, schedule/expiry and delivery status, without revealing contacts outside their permission scope.

## First usable vertical contract and regression

**Concrete acceptance:** Validate and persist genuine CG-01/03 source-linked protected photo/document evidence in real storage with restricted download, issue one approved CG-01/03 source-derived proof using a template and safe QR/status, create one deduped CG-03 decision notification outbox item and deliver or display honest provider-unavailable/queued state. Zero eligible work causes no per-case/tenant idle worker calls. Foundation-origin public contact/helpdesk case is independently functional; center-specific tickets only when an actual CG-14 center exists. Later owners add and QA membership IDs, financial receipts, appointment slips, clinical reports and center support without fabricated sources or second document stores.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.