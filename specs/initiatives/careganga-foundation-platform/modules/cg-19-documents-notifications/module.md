# CG-19 — Documents Notifications

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43.  
**Stage:** Harness Planning / GREENFIELD · **Review status (15 Nov 2026):** OWNER_SCOPE_REVIEW_FIX_IN_PROGRESS. CG-19 is being audited to the same CG-01/02/03 standard against current PRD/HLD, Harness ec7c0b81, original B38/B41/B42/C15–C18/C35–C43 and CRITICAL DB/worker security. Latest-hash delegated CG-19 approval NOT_RECORDED; authenticated Harness resolver, independent CRITICAL DB and runtime/visual/mobile QA NOT_RUN. Stories remain BLOCKED.

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

## Business owner and independent delivery

**CG-19 owns one source of truth for** protected `stored_file` upload/scan/revoke/restricted download, versioned `document_template` and `generated_document` issue/revoke history, notification + notice authoring/scheduling/outbox/attempts/provider delivery history, and one Foundation public-contact/helpdesk `support_case` + reply/assignment/history. **CG-21 owns provider credential reference/readiness only**, not sending, notification recipient/status, support messages or provider attempts. **CG-18 owns editorial public website presentation/publication only**, never CG-19 contact enquiry/ticket, message dispatch, operational notice or media asset bytes. CG-03 retains real approval decisions and optional document-level reviewer approval; CG-19 stores case-file evidence and protected preview, never creates another approval case/decision.

**Real first predecessors:** delivered CG-01 authenticated Foundation-root accounts, permissions and source audit; delivered CG-03 frozen real access-change case/decision only for source-linked proof, file association and event-driven notice. **CG-21 is an earlier scheduled platform operational source, but a configured provider is optional**: CG-19 notification creation/status must work even if no external channel is configured, recording PROVIDER_UNAVAILABLE without pretending it was sent. CG-19 US-001 uses real secured object store and only CG-01/03 source, **US-002 uses actual CG-03 decision/CG-01 recipient and its own outbox, not US-001 document issuance**, and US-003 needs only the CG-01 Foundation responder plus its CG-19 public contact API; file attachments may reuse delivered US-001. None waits for CG-02/04/05/09/10/14/15/16/18 business records, center, donor, employee, patient, member, route or external provider credentials.

**Later introducing owners:** CG-02 attaches real branch application files; CG-04/10/09/15/16 introduce actual membership/staff IDs, financial receipts, appointment/clinical proofs through CG-19's template/file facade with owner-specific QA. **CG-14** supplies actual center identity and center-staff scope and later integrates the **existing CG-19 support ticket** for own-center helpdesk (no duplicate center-ticket master, no initial CG-19 center selector). **CG-18** later embeds a real CG-19 contact form and publishes only explicitly approved CG-19 notices and approved CG-19 media through CG-18 publication revisions; it has no contact-message table. Every later owner tests its own real UI/permission/source integration on delivery.

**State / invariants:** Private file initiated → upload reported → server-verified object+safe scan VALIDATED or rejected/revoked; never assume upload success from a signed URL alone. Issued source-backed private PDF has unique issue key, immutable template/source revision and revoke history; public QR never reveals private CG-01/03 account or approved role data. Outbound message has QUEUED → provider-unavailable/retry-due/sent-to-provider/confirmed-delivered/failed/expired, with separate provider response and confirmed recipient delivery. Support uses NEW/OPEN/ASSIGNED/REPLIED/CLOSED with append-only responses, reopen history and private sender data. Repeated network responses or concurrent reviewers never create a second canonical source item. Every option, list, private file, signed link, export, audience and account is protected by **server-side current CG-01+real source scope**. All media, notice, support and file statuses use actual original CareGanga UI references and human language; no technical IDs in UI.

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

**Independently verifiable deliverables:**
- **US-001 real CG-01/03 files and issuance:** Authorized Foundation Admin uploads/validates a genuine CG-03-case attachment, only sees a short-lived permitted download after actual safe scan, issues one **private CG-03 approved-access confirmation letter/PDF** from a real final approved case using versioned template, stores issuance/reissue/revocation history, and never exposes private identity/role from a public QR. No member/staff/financial/appointment record, public card or future owner UI.
- **US-002 real event/recipient/outbox:** A genuine original CG-03 decision to a permitted CG-01 recipient yields one typed CG-19 notification and bounded durable provider attempts; without configured provider it stays **PROVIDER_UNAVAILABLE/QUEUED** until a real permitted channel is configured. With a real provider, status distinguishes submitted-to-provider vs independently confirmed delivery; no mocked send success, no CG-21 message rows and **no US-001 document dependency**.
- **US-003 genuine Foundation contact/support:** An unauthenticated requester sends a validated/rate-limited Foundation contact request to a minimal CG-19 API and gets one opaque safe receipt. A current CG-01 Foundation support agent can list/respond/assign/close/reopen with redacted contact history. No CG-18 page, CG-14 center, external mail provider, or file required for initial success; actual attachments reuse CG-19 US-001 if permitted. Center A/B tickets are only tested when **CG-14** introduces real centers.
- **Cross-cutting worker gate:** With **zero due work × many Foundation sessions × multiple instances**, no per-tenant or per-case polling loop/remote calls; bounded recovery/claims/retries when actual jobs exist, recorded as design acceptance NOT_MEASURED until runtime. Original UI assets B38/B41/B42/C15–C18/C35–C43 guide component look; image-only evidence does not establish animation timing.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.