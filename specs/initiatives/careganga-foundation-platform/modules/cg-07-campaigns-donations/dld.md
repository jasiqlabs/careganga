# CG-07 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-017, FR-018, FR-019, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-07-BR01–CG-07-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A12, A13, A14, A15, A16, A17, A18 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-07 owns only campaign version, donation intent, verified provider event and donor entitlement reference. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete fundraising and payment verification

`campaign(id,owner,source_project_ref,category,goal,period,draft_step,status,approval_ref,publish_state)` persists all six source-required draft steps; review and actual public publication are separate. Live fundraising progress derives from net verified donation events, not pledged/pending requests.

`donation(id,campaign_ref,donor_verified_ref,amount,currency,method,payment_request_ref,status)` supports general/campaign, real manual, link and provider payments. `payment_event(provider,merchant_ref,event_id,donation_id,verified_status)` unique authenticated source (provider, merchant, event ID) prevents webhook replay/amount spoofing; manual money requires real authorized verification.

Only confirmed received money creates one CG-09 posting keyed by source event and one CG-19 receipt. `donation_refund(parent_donation,amount,approval,provider_status)` must not cumulatively exceed verified received amount; pending refund is not completed. Provider succeeded but response lost is reconciled rather than charged again.

**QA:** six-step draft recovery, unauthorized publication, missing merchant, two webhook deliveries, pending payment falsely shown received, refund race, campaign closed before late receipt, donor privacy in reports and receipt amount versus CG-09 balance.

## CG-07 receiving-owner real CG-05 project/event association (narrow)

**This is a receiving-owner addition, not a full CG-07 expert review.** Original CG-07 US-001 six-step campaign from Admin A12–A15 may be a genuine general Foundation campaign without any project/event. When choosing Project & Category / Team, **CG-07** introduces current permitted actual CG-05 project option and optional CG-05 US-003 operational event source, each same-root/real CG-02 branch and current status validated through a typed CG-05 facade, not duplicated campaign/project/event master. A project campaign source is an association only; original CG-07 owns campaign, donation/public fundraising/eligibility and approval; CG-05 owns project/event and CG-09 owns verified money. A05 field visit, private person/route and beneficiary data cannot become public campaign content. CG-18 owns separate CMS publication and CG-19 owns media. A canceled/closed CG-05 source cannot be presented as an open real project/event campaign CTA without current authorized policy; original general campaign works without CG-05. Neither operational event nor campaign launch implies event tickets/donation PAID. Public Web/Public Android see only originally approved safe campaign/project/editorial sources. Exact back-end/UI/QA in CG-07 US-001, not merely a CG-05 dependency.

**Concrete CG-07 source association:** `campaign.project_source_ref_nullable` and `campaign.event_source_ref_nullable` use typed CG-05 current same-root approved project/event owner checks at submission and public launch; if actual schema supports direct composite same-root FKs, add only in CG-07 introducing migration after CG-05 delivered. No CG-05 campaign table, no CG-07 project/event master and no inherited private field-visit photos/GPS. `GET /api/v1/campaigns/source-options/projects/events` requires current CG-01 grants and returns safe names/area/status, not private project task/visitor data. A real CG-07 donation posts through original CG-09 paid verification, never source-project activity completion.


## Cross-owner contracts and story-specific QA

**Core tests:** Create a draft multi-step campaign, publish only after applicable approval, accept real donor intent and show pending until verified provider confirmation. Gateway retries, duplicate webhooks, wrong merchant, mismatched amount, failed refunds and a private donor export cannot create extra CG-09 cash entries or misleading receipts.

**Current versus later sources:** Donation collection relies on already-delivered CG-09 ledger and CG-19 receipt; CG-18 publishes only the approved campaign and safe impact fields. No placeholder donor totals or gateway success.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/campaigns-donations` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-017** — Campaign owner proposes fundraiser: Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-018** — Donor makes contribution: Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-019** — Donation completes/reverses: Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A12, A13, A14, A15, A16, A17, A18. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, CG-09, CG-19 and CG-18. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.