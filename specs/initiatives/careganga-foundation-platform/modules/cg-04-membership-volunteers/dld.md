# CG-04 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-04-BR01–CG-04-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B09, B10, U14, U15, U16, U17 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Member tiers/terms, fees, renewals, volunteer applications and skills** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Member tiers/terms:** source attributes/status from CG-04-BR01–CG-04-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **fees:** source attributes/status from CG-04-BR01–CG-04-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **renewals:** source attributes/status from CG-04-BR01–CG-04-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **volunteer applications and skills:** source attributes/status from CG-04-BR01–CG-04-BR11; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Draft/submitted/approved/rejected/active/expired/renewed; Approved fee and case precede member ID; rejected paid membership requires authorized refund**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete membership and volunteer implementation

`membership_tier(id,name,fee,validity,benefits,order,publish_state,version)` exposes only active published choices to public applicants; prices and term lengths are captured in the application snapshot. `membership_application(id,account_ref,tier_ref,source_payment_ref,approval_ref,status)` stores application reference, document requirements and personal/area information without duplicate login record. Approved `member(id,member_no,person_ref,term_start/end,status)` has unique generated number only after CG-03 final approval plus CG-09 actual verified fee, not mere payment initiated state.

`membership_term(member_id,tier_version,starts,expires,renewed_from)` preserves renewal/expiry and prior benefits; rejected paid applications require an authorized full joining-fee refund tracked back through CG-09; one gateway replay cannot create two memberships/cards. CG-19 card/certificate/letter renders from approved source state.

`volunteer(id,account_or_applicant_ref,skills,availability,preferred_department,status)` retains configurable choices and relevant identity proof under restricted access. Approval and CG-05 field assignments are separate; verified volunteer does not automatically get CG-01 operational role.

**QA:** expired tier, two simultaneous applications/renewals, denied member card before payment/approval, rejected-paid refund, volunteer without staff role, private identity upload, public status by verified applicant and membership/volunteer name option scope.

## Specific owner contracts and source-QA

- **Membership:** `membership_tier(id,fee,duration,benefits,publish_state,version)`, `member_application(id,account_ref,tier_version,approval_ref,fee_state)`, `membership(id,member_code,approved_at,valid_until,status)` and immutable term/renewal history. Unique approved membership ID is *not* application reference. Snapshot tier/fee accepted on application; later price changes do not rewrite submitted fees.
- **Volunteers:** `volunteer_application` holds verified personal/geographic profile, skills, availability, preferred real CG-02 department, source referral and attachments; approved volunteer relationship is not an employee or automatic staff account. Final CG-03 approval and CG-09 verified member fee are required before CG-19 prints active card/certificate. Rejected paid application requires authorized refund, not disappearing money.
- **QA:** same applicant retries, failed/pending payment, tier renewal after expiry, approved volunteer vs unapproved staff access, refund, inactive tier not public, cross-area volunteer directory.

## Typed API and coordination

An authenticated `/api/membership-volunteers` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-009** — Person applies as member: Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-010** — Admin manages membership: Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-011** — Person volunteers: Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B09, B10, U14, U15, U16, U17. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, CG-09, CG-19, real CG-02. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.