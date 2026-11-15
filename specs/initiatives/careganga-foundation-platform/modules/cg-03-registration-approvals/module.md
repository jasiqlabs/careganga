# CG-03 — Registration Approvals

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-006, FR-007, FR-008, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-03-BR01–CG-03-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U11, U12, U13, B29.  
**Stage:** Harness Planning / GREENFIELD · **Review status (15 Nov 2026):** SOURCE_REVIEWED_AND_REVISED (self-review disclosed), current module/UIUX/DLD/tasks reconciled with PRD/HLD v1.1 and real CG-01 protected-change integration; 25 inline QA cases retained. **JASIQ AI Design Review Agent** is delegated design reviewer, but current-hash PRD/HLD/Planning/UIUX/DLD approvals NOT_RECORDED; authenticated pinned Harness resolver NOT_RUN. Implementation/independent DB/visual/runtime QA NOT_RUN; stories stay BLOCKED.

uiux_decision: REQUIRED
uiux_reason: Source-backed U11–U13/B29 approval queue, applicant detail, decision/history and role-scoped Internal Android reviewer actions require accessible CareGanga visual/motion parity without a public Android approval admin.
dld_decision: REQUIRED
dld_reason: Versioned immutable submission/case and reviewer route, secure authorization, CG-01 final grant application, concurrent decisions and bounded owner retry require exact DB/typed API design.
database_impact: CRITICAL
database_reason: New source-owned Approval process/step, case intake, document check, review history, finalization reference state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Only appropriately authorized Internal Android reviewers use native scoped pending-case, decision and result history; Public Android does not gain administrative approval capabilities.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Approval process/step, case intake, document check, review history, finalization reference. Its first real case requests a protected grant change to an *existing* CG-01 account/role; CG-01 applies the verified approved outcome once. No prior CG-01 pending-request table or incomplete workflow is needed. **Implementation prerequisites (scheduled earlier, not yet actually delivered):** real CG-01 verified account/role, privileges and eligible reviewers; CG-03 introduces protected change applications only after CG-01 is complete. **Later owned integrations, not prerequisites for this module's core path:** CG-19 actual file evidence; CG-02 branch, CG-04 member, CG-10 employee and CG-14 provider owner finalizers join later when sources exist. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** Draft → frozen submitted revision → in-review → returned/resubmitted (new immutable source revision and case) or rejected/final approved. Each case pins one genuine source-owner revision/digest, process version and reviewer steps; an old case cannot approve edited content. Final CG-03 decision is separate from source-owner effect (PENDING_OWNER until verified); only the real CG-01 guarded grant finalizer may apply the initial protected account/role change, at most once. Reviewer authority must be evaluated at decision time (no revoked reviewer or self-approval privilege escalation). Initial scope uses real CG-01 Foundation-root only; do not fabricate future branch, healthcare center, patient or payment scope. Authorize all list/detail/options/exports/writes server-side, redact protected data and show truthful states.

## Complete PRD and BR mapping

- **FR-006/A-03:** Member/volunteer/employee/CSR/branch/provider submits — Give application number and tracking; support application-specific documents, verifications, notes, evidence and configurable stepwise routing
- **FR-007/A-03:** Authorized reviewer decides — Approve, reject, return for correction or forward; show pending and prior steps, reviewer, remarks and time; prevent action by unrelated or revoked reviewer
- **FR-008/A-03:** Final authorized approval occurs — Produce exactly one owner-domain effect (member/employee/provider/branch activation, entitlement or authorized financial outcome), never from a pending stage

Detailed authoritative clauses:
- **CG-03-BR01:** Support application intake for members, volunteers, CSR partners, Foundation branches, employees and healthcare providers/doctors where approval is required.
- **CG-03-BR02:** Assign an application/reference number at submission and expose permitted status tracking.
- **CG-03-BR03:** Provide filtered approval queues (applicant/contact, registration type, membership plan, payment/status/date), applicant detail, submission source, uploaded documents, payment references, notes, communications and decision history; registration dashboard includes pending/approved/rejected counts, type breakdown, recent submissions and average approval time.
- **CG-03-BR04:** Permit document preview and authorized download, verify/reject-by-document status and documented remarks.
- **CG-03-BR05:** Permit approve, reject, return for correction and appropriate forwarding/intermediate decisions. Bulk actions must only cover records for which the actor is authorized and where the business status permits.
- **CG-03-BR06:** Configure process-specific approval steps, reviewer roles and organization/area scopes. Illustrative membership chain: submission → district → state → HR/membership → Super Admin → finalization; the actual chain is a client-approved configuration.
- **CG-03-BR07:** Preserve reviewer, date/time, remarks, previous states and completed/pending approvals; show graphical queues/workflows and open pending records directly.
- **CG-03-BR08:** Make rejected/returned requests actionable to eligible submitters without converting an unapproved record to active status.
- **CG-03-BR09:** Create the final owner-module outcome only after final authorized approval, including IDs, accounts, budgets or authorized postings as applicable.

## Independent vertical delivery and acceptance

This module must complete real protected case creation, scoped reviewer decision/history and CG-01 source-effect verification on responsive Admin Web and permitted Internal Android before source QA may be marked complete. **Concrete acceptance:** Freeze a proposed existing-account/role grant change, pin the current authorized reviewer sequence and source revision, return/reject/resubmit without reusing old approval, and apply at most one guarded CG-01 grant after the actual final decision. Approval status remains PENDING_OWNER until the CG-01 effect is confirmed. No CG-19 attachment, future business case, provider or fake owner record is needed for this initial journey; CG-02/04/09/10/14/19 later own their real integrations and QA. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U11, U12, U13, B29. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.