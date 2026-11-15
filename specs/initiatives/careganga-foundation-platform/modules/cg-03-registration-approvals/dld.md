# CG-03 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-006, FR-007, FR-008, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-03-BR01–CG-03-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U11, U12, U13, B29 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Data ownership and independent initial workflow

CG-03 owns its approval process configuration, cases, decisions, and immutable history. It never owns branch/member/provider/financial source data. The first fully functional owner integration is CG-01: an authorized sensitive access-change request supplies a real source record and CG-03 returns a final decision; other module finalizers join only when those owners actually exist. CG-19 evidence verification is added when real protected file storage is available; a no-attachment initial access case must work without CG-19.

## Canonical approval model and typed transitions

- approval_process(id, process_type, owner_kind, scope_policy, version, enabled): unique active process type+version and validated current roles. approval_step(process_id, ordinal, reviewer_capability, area_scope_policy) requires unique ordinal and existing CG-01 capabilities. Once submitted, a case pins the exact process version and steps.
- application_case(id, owner_kind, owner_ref, source_submission_key, process_version, status, current_step, revision, submitted_at): unique source owner+source submission key; a verified CG-01 change request is the first real source. Never create a case for a nonexistent future member/employee/provider.
- case_decision(id, case_id, step_ordinal, actor_account_ref, action, remarks, expected_revision, idempotency_key, at): append-only and unique accepted decision key, actor must hold both current action permission and case-specific step/geography scope. Record RETURN/REJECT/APPROVE/FORWARD as immutable events.
- document_verification(id, case_id, actual_file_ref, decision, reviewer, at): optional for the first case; only enabled against a real CG-19 protected file and current preview authorization. Never copy sensitive files into approval tables. Introduce its CG-19-backed relation/migration only after CG-19 ships, or use a strictly validated existing file facade at that time; do not make CG-03 startup migrations refer to a nonexistent future CG-19 table.
- application_finalization(id, case_id, final_decision_ref, owner_outcome_key, state, attempt_count): one unique final owner effect, with PENDING_OWNER/COMPLETED/FAILED_RETRYABLE and bounded retry. CG-03 final decision does NOT itself fabricate activated source state.

States: DRAFT -> SUBMITTED -> IN_REVIEW -> RETURNED -> RESUBMITTED or REJECTED / FINAL_APPROVED. Only the current step accepts a decision. An approval transition and append-only decision are committed in the same transaction under row revision/lock; competing reviewers produce one winner and one CONFLICT. The source owner idempotently applies its actual business change after final approval, and the case displays PENDING_OWNER until verified. Revised approval routes never rewrite cases already in flight.

API contracts: POST approval/process-version (super-admin protected); POST cases (real source owner adapter + source key); GET scoped cases/steps/options; POST case/{case}/decision (action, remark, expected_revision, idempotency_key); GET case/{case}/history; GET source outcome. Provider unavailable, stale actor, repeat decision, missing real source, unauthorized document access and last-root escalation all fail safely without a fake APPROVED+ACTIVE state.

## Genuine early acceptance and later integrations

Initial source tests: CG-01 protected grant request -> submitted case -> authorized reviewer -> final decision -> exactly one CG-01 grant change; rejected/returned must leave grants unchanged. Test reviewer-scope denial, concurrent reviewer actions, lost finalizer response/retry and process-version pinning. When CG-19 is delivered, attach/verify actual access evidence; when CG-02/04/10/14 are delivered, their respective owner workflows register real source cases and test finalization. The later owner—not CG-03 placeholders—owns that cross-module QA.

## Typed API and coordination

An authenticated `/api/registration-approvals` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-006** — Member/volunteer/employee/CSR/branch/provider submits: Give application number and tracking; support application-specific documents, verifications, notes, evidence and configurable stepwise routing. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-007** — Authorized reviewer decides: Approve, reject, return for correction or forward; show pending and prior steps, reviewer, remarks and time; prevent action by unrelated or revoked reviewer. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-008** — Final authorized approval occurs: Produce exactly one owner-domain effect (member/employee/provider/branch activation, entitlement or authorized financial outcome), never from a pending stage. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U11, U12, U13, B29. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.