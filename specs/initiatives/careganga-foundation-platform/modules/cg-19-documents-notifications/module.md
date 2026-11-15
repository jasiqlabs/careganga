# CG-19 — Documents Notifications

**Authority:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Source-linked files/templates/PDF/QR, notices/messaging and support tickets state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Source-linked files/templates/PDF/QR, notices/messaging and support tickets. **Delivery-critical, already-delivered owners:** CG-01 authenticated source records and CG-03 real approval cases for initial issued proofs; configured real object storage/provider is verified before delivery. **Later integration owners, not blockers for the first self-contained feature:** CG-04/09/10/14/15/16 add actual IDs, receipts, letters, appointments and reports later, and must QA their end-to-end integrated artifacts. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** File pending/validated; message queued/delivered/failed; case open/closed. No sensitive public document, fake delivery, duplicate receipt source or idle tenant worker. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

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

**Concrete acceptance:** Upload authorized real case evidence, issue source-linked document, generate valid short-lived protected download, enqueue one actual notification and recover bounded retry; no idle tenant fan-out or fake delivered state. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.