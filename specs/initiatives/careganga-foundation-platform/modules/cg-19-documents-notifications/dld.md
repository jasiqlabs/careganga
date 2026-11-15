# CG-19 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Source-linked files/templates/PDF/QR, notices/messaging and support tickets** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Source-linked files/templates/PDF/QR:** source attributes/status from CG-19-BR01–CG-19-BR09; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **notices/messaging and support tickets:** source attributes/status from CG-19-BR01–CG-19-BR09; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **File pending/validated; message queued/delivered/failed; case open/closed; No sensitive public document, fake delivery, duplicate receipt source or idle tenant worker**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete file, template, delivery and support design

`stored_file(owner_type,owner_ref,classification,object_key,checksum,mime,size,scan_status)` requires proper file type/size and malware scan where applicable, verified authorized owner and short-lived signed downloads. Patient clinical, employee bank/payroll and private proofs never go onto public media paths. QR lookup returns minimal validity, not whole document.

`document_template(type,version,allowed_fields,approved_by)` and `generated_document(source_owner,source_ref,template_version,checksum,status)` project real CG-04/09/10/15 sources. Front/back IDs, official letters and receipts preserve issue/reissue/revocation and original source amounts; no independently edited receipt total.

`notification(source_event,recipient_or_audience,channel,template_version,status)` and `delivery_attempt(provider,provider_reference,retry_count,next_retry,status)` have unique source+recipient+channel dedupe. Persist business status/outbox atomically and send after commit with finite backoff; **zero eligible jobs must not trigger repeated all-tenant DB scans or network requests**, avoiding previously observed bandwidth amplification.

`support_case(source_channel,requester,assigned_center_or_foundation,status)` is shared by public contact and center support; private contact fields and attachments remain scoped. **QA:** signed-file expiry, wrong-patient report, duplicate PDF/link, repeated send, provider timeout-after-success, dormant worker/idle egress, service restart and cross-center helpdesk visibility.

## Specific owner contracts and verification

- **Private source-linked files:** `stored_file(owner_type,owner_ref,acl_class,checksum,mime,size,scan_state,object_key)`; short-lived signed download rechecks real owner/actor/clinical purpose. `document_template(type,version,allowed_fields)` and `generated_document(source_owner,source_ref,template_version,checksum,status)` hold immutable issued versions, not independently edited receipts/IDs. Support source-backed front/back cards, QR safe lookup and letter/memo reissue.
- **Notifications & support:** `notification(source_event,recipient,channel,status)`, `delivery_attempt(provider,event_ref,attempt,next_retry_at,status)` unique per recipient/source/channel, and one scoped `support_case` for public and center requests. Provider failure is pending/failed rather than fake delivered; finite retries and bounded due-job queries avoid idle tenant-wide polling/bandwidth drain.
- **QA:** forged private signed report, duplicate message on retry, recipient loses role, job restart/idle traffic, wrong-center support, current PDF versus previous version, no public medical/salary documents.

## Typed API and coordination

An authenticated `/api/documents-notifications` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-070** — Business completes authorized document action: Generate versioned, permissioned membership/employee IDs, letters, donation/financial receipts, appointment slips and PDFs with source-linked status, print/share and safe QR verification. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-071** — Business event requires communication: Provide configured email/SMS/WhatsApp/push, broadcast notice, audience/priority/expiry/template control and observable delivery/failure history without duplicating module records. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-072** — Visitor or center requests assistance: Track public contact/helpdesk and center support tickets/FAQs, owner, replies/status and restricted identity; share support workflow across channels. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01 and actual owner source/approved providers. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.