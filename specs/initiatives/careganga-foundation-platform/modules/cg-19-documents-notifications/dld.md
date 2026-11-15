# CG-19 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-19-BR01–CG-19-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-19 owns only protected object file reference, approved document template, issued source-derived document, bounded delivery queue and support ticket. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete file, template, delivery and support design

`stored_file(owner_type,owner_ref,classification,object_key,checksum,mime,size,scan_status)` requires proper file type/size and malware scan where applicable, verified authorized owner and short-lived signed downloads. Patient clinical, employee bank/payroll and private proofs never go onto public media paths. QR lookup returns minimal validity, not whole document.

`document_template(type,version,allowed_fields,approved_by)` and `generated_document(source_owner,source_ref,template_version,checksum,status)` project real CG-04/09/10/15 sources. Front/back IDs, official letters and receipts preserve issue/reissue/revocation and original source amounts; no independently edited receipt total.

`notification(source_event,recipient_or_audience,channel,template_version,status)` and `delivery_attempt(provider,provider_reference,retry_count,next_retry,status)` have unique source+recipient+channel dedupe. Persist business status/outbox atomically and send after commit with finite backoff; **zero eligible jobs must not trigger repeated all-tenant DB scans or network requests**, avoiding previously observed bandwidth amplification.

`support_case(source_channel,requester,assigned_center_or_foundation,status)` is shared by public contact and center support; private contact fields and attachments remain scoped. **QA:** signed-file expiry, wrong-patient report, duplicate PDF/link, repeated send, provider timeout-after-success, dormant worker/idle egress, service restart and cross-center helpdesk visibility.

## Real source integration and module-specific QA

**Critical acceptance:** Generate an authorized CG-01 or CG-03 source document, verify its source state, sign restricted download and prevent wrong-patient/staff access; future receipts/appointment slips join only when owners exist. Persist one notification event/outbox, survive send timeout/restart with finite retries and no duplicate recipient. Verify 0 eligible jobs across many idle tenants causes 0 polling/provider requests and bounded bandwidth.

**Contract availability:** CG-01/03 are initial real sources; later CG-04/09/10/15/16 introduce their own document/notification integration and QA. No placeholder receipt/medical record, no always-on import worker.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/documents-notifications` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-070** — Business completes authorized document action: Generate versioned, permissioned membership/employee IDs, letters, donation/financial receipts, appointment slips and PDFs with source-linked status, print/share and safe QR verification. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-071** — Business event requires communication: Provide configured email/SMS/WhatsApp/push, broadcast notice, audience/priority/expiry/template control and observable delivery/failure history without duplicating module records. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-072** — Visitor or center requests assistance: Track public contact/helpdesk and center support tickets/FAQs, owner, replies/status and restricted identity; share support workflow across channels. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01 and actual owner source/approved providers. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.