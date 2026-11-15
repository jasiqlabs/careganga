# CG-08 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-08-BR01–CG-08-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B02 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-08 owns only CSR partner, vetted proposal, commitment and allocation authority. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete CSR partnership and fund states

`csr_partner(id,legal_name,contact,verification_state,approval_ref)` is the approved partner source; publication is separate from business verification. `funding_proposal(id,partner_ref,project_ref,purpose,requested_amount,status)` requires real CG-05 project and actual CG-03 approval; evidence includes agreements and reviewer history without copying documents out of CG-19.

`funding_commitment(id,proposal_ref,source_type,committed_amount,due_by,status)`, `fund_receipt(id,commitment_ref,finance_posting_ref,verified_amount)` and `fund_allocation(id,project_ref,source_fund_ref,category,approved_amount,utilized_amount)` preserve **requested ≠ committed ≠ received ≠ allocated ≠ utilized**. CG-09 alone recognizes cash/bank and project budget balances.

A Foundation/CSR split is versioned, sums must reconcile to approved amounts, and unreceived commitments cannot be represented as spendable cash. Corrections are linked reversals/adjustments, not silent replacement.

**QA:** incomplete agreement, foreign CSR proposal, returned application, 70/30 split total, two sponsors for one project, pledge versus cash, duplicate bank receipt and public partner marketing without approval.

## CG-08 receiving-owner actual CG-05 project and original CG-09 financial allocation (narrow)

**Receiving-owner correction, NOT full CG-08 approval.** Original CG-08 partner/proposal/commitment and agreement remain CG-08; original CG-09 alone owns verified received cash, approved finance allocation, utilization/release and posted journal. When real CG-05 US-001 project exists, **CG-08 US-002** links only eligible same-root/branch project for funding proposal/allocation; project cannot be created by CSR form and CG-05 planned estimate is not an approved financial allocation. CG-08 saved proposal/pledge is not cash. Upon actual CG-03 reviewed agreement and CG-09 verified effect, CG-08 reflects source status with original refs. Multiple sponsors and 70/30 split over same project must respect original CG-09 total-budget constraints, replay-safe one event key. Inactive/closed/transferred CG-05 project or wrong CG-01 grant denies new allocation; previously approved historical donation/source stays audit-accurate. **CG-08 US-003** source-derived project partner funding summary reads current CG-05 safe label and original CG-09 money, no shadow project budget. Original Admin B03–B08 is CSR, CG-05 A01/U31 is project owner; don't clone operational screen.

**Typed same-root relation:** CG-08 funding_proposal.project_ref is actual current CG-05 project typed source with permission and immutable version; original CG-09 budget_event/journal is the only financial effect. CG-08 original fund_allocation is source association/proposed evidence, **not** another independently maintained utilized_amount total; allocated/utilized in CSR reports are derived only from accepted CG-09 finance events. Source association requires CG-05 current project allowed at proposal/finance effect; external CG-08 agreement CG-19 proof remains protected and case decision original CG-03. No duplicate project or finance-ledger FK required on first partner application without project.


## Cross-owner contracts and story-specific QA

**Core tests:** Create a verified CSR organization and proposal; compare promised, approved, received, allocated and utilized as distinct statuses. A pledge cannot raise cash balance, over-allocation is rejected under lock, revoking branch scope removes access, and an amount correction creates auditable adjustment without lost previous agreement.

**Current versus later sources:** CG-05 supplies real project allocation targets; CG-09 supplies actual received funds and accounting; CG-19 supplies protected agreements. Public CSR attribution requires explicitly approved CG-18 projection.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/csr-funding` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-020** — CSR partner submits application: Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-021** — Foundation funds a project: Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-022** — Finance or partner manager examines funding: Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B02. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, CG-05 and CG-09. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.