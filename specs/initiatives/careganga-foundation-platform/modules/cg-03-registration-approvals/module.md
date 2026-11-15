# CG-03 — Registration Approvals

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-006, FR-007, FR-008, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-03-BR01–CG-03-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U11, U12, U13, B29.  
**Stage:** Harness Planning / GREENFIELD · **Review status (15 Nov 2026):** RE_REVIEW_AND_OWNER_FIX_IN_PROGRESS. JASIQ AI Design Review Agent is correcting initial CG-01 source snapshot, process version, CG-01-owner finalizer, CRITICAL DB and no-future-owner UI/QA to current PRD/HLD and Harness ec7c0b81. CG-03 delegated approval NOT_RECORDED; authenticated pinned Harness resolver, independent CRITICAL DB review and runtime/visual/device QA NOT_RUN; all stories remain BLOCKED.

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

**Owns:** Its real approval process version/ordered steps, protected access-change proposal/case, immutable decisions/remarks and owner-finalization request/status. The first real case freezes an existing CG-01 account/role grant-change intent with observed account/role versions; only CG-01 applies the verified decision exactly once. **No actual attachment verification/document store is owned or required in this first CG-03 release**; CG-19 later owns file evidence and introduces/reviews its real approval-case file integration. No prior CG-01 pending-request table or incomplete workflow is needed. **Implementation prerequisites (scheduled earlier, not yet actually delivered):** real CG-01 verified account/role, privileges and eligible reviewers; CG-03 introduces protected change applications only after CG-01 is complete. **Later owned integrations, not prerequisites for this module's core path:** CG-19 actual file evidence; CG-02 branch, CG-04 member, CG-10 employee and CG-14 provider owner finalizers join later when sources exist. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** CG-03-owned protected proposal draft → one frozen proposal revision/canonical digest tied to real CG-01 access + role version → submitted/in-review → returned/new submitted proposal+case or rejected/final approved. Each case pins one genuine source-owner revision/digest, process version and reviewer steps; an old case cannot approve edited content. Final CG-03 decision is separate from source-owner effect (PENDING_OWNER until verified); only the real CG-01 guarded grant finalizer may apply the initial protected account/role change, at most once. Reviewer authority must be evaluated at decision time (no revoked reviewer or self-approval privilege escalation). Initial scope uses real CG-01 Foundation-root only; do not fabricate future branch, healthcare center, patient or payment scope. Authorize all list/detail/options/exports/writes server-side, redact protected data and show truthful states.

## Complete PRD and BR mapping

- **FR-006/A-03:** Initial implemented source is **one real CG-01 access-change proposal** with a readable reference, frozen source snapshot and versioned process route. Later CG-02/04/08/10/14 owners introduce their own branch/member/volunteer/CSR/employee/provider source submissions; CG-19 adds actual file evidence, never CG-03 fake application/document masters.
- **FR-007/A-03:** Authorized reviewer decides — Approve, reject, return for correction or forward; show pending and prior steps, reviewer, remarks and time; prevent action by unrelated or revoked reviewer
- **FR-008/A-03:** CG-03 authorizes final decision and durable PENDING_OWNER effect request only; **CG-01-owned protected finalizer** verifies that exact intent against current account/role versions, applies a single grant and records original CG-01 audit. Later actual business owners implement/test their own member/branch/provider/finance effects when delivered.

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

## First-release independent acceptance and forward owners

- **CG-03 US-001** seeds/configures the genuine **CG-01 protected grant-change** approval route (current CG-01 permissions, final distinct Super Admin reviewer with fresh MFA), records a proposed CG-01 account/role grant/revoke from actual existing versions and freezes one typed intent digest/revision with a readable case reference. There is no preliminary CG-01 pending application, no document provider, no future business owner.
- **CG-03 US-002** acts only on real submitted cases and CG-01-eligible current reviewer roles/FOUNDATION_ROOT scope. Process changes are new versions, accepted step decisions are immutable and time/actor/remarks/status are permissioned. One reviewer cannot approve their own request or bypass the last-root/protected grant safety floor. Bulk decisions are individually guarded and only appear after actual per-case implementation; initial Web/Internal Android may implement a safe bounded batch as part of this story.
- **CG-03 US-003** commits one final CG-03 decision/effect claim, then uses an actual **CG-01-owned guarded grant finalizer introduced with CG-03 integration**, rechecking current target access version, role version, reviewer/proposer authority, process evidence and security rules. Confirmed CG-01 grant+original access audit alone permits OWNER_COMPLETED. Changed source/uncertain owner result stays blocked/pending, never a fabricated privilege grant.
- **Later introducing owners only:** CG-19 supplies actual protected file evidence and introduces its real case/preview/verification integration QA; CG-02/04/08/10/14/09 and others provide their original submission records, owner effects and source-specific queues only after delivered. No CG-19/02/04/09/10/14 FK/table, placeholders, provider credential, center/geography or payment required in first CG-03 migrations or first 3 stories. **CG-21 is an earlier operating schedule choice, not a CG-03 hard business/data prerequisite.**

## Independent vertical delivery and acceptance

**CG-03 itself** must complete real protected-access-case creation/configuration, scoped reviewer decision/history and verified CG-01 effect on responsive Admin Web and authorized Internal Android. The introducing CG-03 delivery adds the smallest guarded **CG-01-owned** finalization facade extension, never direct CG-01 DB writes or a CG-01 pending-case table. **Concrete acceptance:** Freeze a proposed existing-account/role grant change, pin the current authorized reviewer sequence and source revision, return/reject/resubmit without reusing old approval, and apply at most one guarded CG-01 grant after the actual final decision. Approval status remains PENDING_OWNER until the CG-01 effect is confirmed. No CG-19 attachment, future business case, provider or fake owner record is needed for this initial journey; CG-02/04/09/10/14/19 later own their real integrations and QA. **Do not render future application categories, fake documents, empty provider/branch tabs, payment selectors or disabled future-owner actions in initial CG-03 UI.** Each later source owner delivers the permitted option, source status and integration QA with its real data.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U11, U12, U13, B29. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.