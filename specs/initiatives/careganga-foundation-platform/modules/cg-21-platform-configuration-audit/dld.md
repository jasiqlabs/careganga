# CG-21 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-21 owns only effective system configuration, integration verification status, append-only redacted security audit and privileged recovery request. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete security settings, audit and recovery contracts

`platform_setting(id,key,value_class,effective_version,updated_by,status)` validates typed values and logs revision. Public Login/Join/Volunteer visibility toggles belong to CG-18 publication, not a second independent settings control table.

`integration_connection(id,provider,purpose,scope,secret_reference,status,verified_at)` stores encrypted credential **references** via approved secret management, never raw provider key in database/UI/log. Configured != verified online; per-center merchant is not automatically Foundation merchant. Bounded connectivity verification cannot turn into continuous network polling.

`audit_event(id,actor,resource_type,resource_ref,action,result,correlation,time,redacted_diff)` is append-only, indexed by authorized actor/scope/time, no OTP, password, bank token, medical document payload or unrestricted PII. CG-01 owns role audit facts but contributes to a unified protected audit view.

`recovery_operation(id,operation_type,backup_reference,requested_by,approved_by,status,proof)` requires authorized privileged identity/MFA; restore is not available to routine staff. Actual backup/restore recovery drill, RPO/RTO and production credentials remain independent QA/operations proof, not screenshot-UI success.

**QA:** unauthorized restore, two concurrent setting writes, secret appearing in API/log, false integration-ready state, foreign-scope audit export, failed backup/restore, dormant worker bandwidth and still-pending verification behavior.

## Real source integration and module-specific QA

**Critical acceptance:** CG-01 protected admin changes a permitted setting with version conflict protection, verifies real provider readiness and sees accurate verification failure. Audit records CG-01 access/permission changes with no OTP/token/medical/bank payload. Unauthorized restore, two concurrent setting writes, foreign-scope audit export and false backup PASS are blocked; restore is evidenced only after actual privileged recovery drill.

**Contract availability:** CG-21 has real CG-01 audit as its first provider, without waiting for approval, finance, healthcare or CMS. Later modules append audit events through the same protected contract, not an independent log.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/platform-configuration-audit` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-075** — Super Admin manages platform: Configure Foundation/system settings, approved payment/messaging/map integrations and public visibility through the owning modules; sensitive credentials restricted. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-076** — Administrator audits or recovers: Show protected logs for login, approvals, money, provider verification, sensitive accesses and publishing; restrict backup/restore to approved operations and support privileged MFA/session controls. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01 protected root. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.