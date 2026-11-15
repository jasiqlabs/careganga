# CG-13 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-039, FR-040, FR-041, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-13-BR01–CG-13-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B11, B12, B13, B14, B15, B16 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-13 owns only verified referral attribution, one points ledger and controlled reward redemption. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete referral/points/rewards contracts

`referral(id,referrer_member_or_volunteer,applicant_source_ref,channel,status,qualified_at)` is unique per qualifying registration/source event and does not award on mere click or unverified contact. `points_event(id,owner_ref,source_owner,source_event,delta,state)` has unique qualified event and is append-only: accepted point balance derives from earned − redeemed + reversed events.

`rank_policy(id,effective_from,thresholds,benefits,version)` requires monotonic threshold validation; the illustrated seven ranks remain configurable. `reward_product(id,type,points_cost,category,availability,physical_item_ref)` links genuine CG-12 stock only for physical items, not a duplicate warehouse.

`redemption(id,owner_ref,reward_ref,points_snapshot,status,fulfilment_source)` uses one transaction/unique source for point hold/debit and authorized physical-stock reservation; cancel/failed fulfillment produces compensating points/stock events and audit, not a second independent balance.

**QA:** referral cycle/self-referral, duplicated applicant attribution, qualification reversal, no-balance redemption, last-unit parallel redemptions, invalid rank thresholds, refund/cancel points and public leaderboard privacy.

## CG-13 receiving-owner physical reward from real CG-12 stock

**Narrow implementation integration, NOT full CG-13 approval.** Original Admin screenshot B11–B16 reward ranks/points/product cards and redemption are **CG-13's** owner UI, not CG-12 B19 stock. **US-001** links physical reward product to actual permitted ACTIVE CG-12 item and true safe available/held quantity; CG-13 owns product/points price/category/image and cannot create another warehouse balance. Digital reward has no physical inventory requirement. **US-003** qualifies actual CG-04 member/volunteer, holds correct CG-13 points and original CG-12 stock using source-linked replay-safe reservation; after actual authorized approval/physical issue confirmation, it completes one CG-12 physical stock event and one accepted CG-13 redemption/points effect. **A hold is not delivery, and a displayed reward is not an issued item.** On cancellation, failure, rejected decision and reversal, release real CG-12 reservation and compensate CG-13 points with original linked immutable effects, no double issue or double refund.

**Required channels:** Original B14–B16 Add Product grid/points/stock cards and secure redemption review in Foundation Admin; true member/volunteer public client/Android display when original CG-13 delivered, verified CG-01/04 eligibility, actual CG-03 case if required, CG-12 source-safe selector/hold/issue/return typed facade, scoped PostgreSQL unique source event and auditable PENDING/ISSUED/REVERSED statuses. B19 stock Distribution Log shows actual warehouse issue, not member private point history. CG-13 US-002 original referral points credit works without physical reward product. Full receiving story QA remains pending its own CG-13 expert review.

**Receiving DLD/transaction:** `reward_product.physical_item_ref` is verified CG-12 same-root actual item only for PHYSICAL; `redemption.stock_hold_ref` and `redemption.confirmed_stock_event_ref` reference **one original CG-12** reservation/confirmed issue, never CG-13 inventory_qty. Use original CG-13 approved points ledger + CG-12 typed source-keyed hold and issue in one verified local transaction when possible, otherwise durable PENDING_RESERVATION/RECONCILIATION with unique(root,redemption_source_key) and compensating events, and no premature Redeemed/Fulfilled. Original CG-12 return/cancel must release hold and CG-13 independently recredit only once. Race 2 members last item and 2 duplicate webhook callbacks; never negative original points or available stock and never expose protected supplier/recipient data.


## Real source integration and module-specific QA

**Critical acceptance:** A verified real member refers one eligible new member; issue referral credit once after CG-04 confirms actual eligible outcome. Block self-referral, circular credits, replayed signup and expired/refunded conversion. Two redemptions racing against the same point balance result in one valid claim, not negative points; physical reward fulfillment moves one real CG-12 stock source and value transfer uses CG-09.

**Contract availability:** A member and approval are genuine CG-04/03 sources; inventory only for applicable physical rewards. Show pending rather than fake points before evidence.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/referrals-rewards` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-039** — Eligible member/volunteer refers new applicant: Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-040** — Admin configures loyalty program: Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-041** — Member/volunteer redeems: Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B11, B12, B13, B14, B15, B16. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-04, CG-12 for stock and CG-09 when value moves. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.