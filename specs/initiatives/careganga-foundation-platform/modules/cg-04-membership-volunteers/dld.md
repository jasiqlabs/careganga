# CG-04 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-04-BR01–CG-04-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B09, B10, U14, U15, U16, U17 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical owner and record boundaries

CG-04 owns only member tier versions, applications, issued membership and volunteer profile. The following concrete record contracts are the **single canonical implementation model** for this module; legacy draft aliases are not extra tables. Real owner FKs, tenant/branch/center/patient scope, normalized uniqueness, valid states and creation/update revisions are enforced by migrations and guarded commands. No owner creates a future module's master record or copies another owner's sensitive data. Platform and integration errors use safe explicit categories, not a success-shaped default.

## Concrete membership and volunteer implementation

`membership_tier(id,name,fee,validity,benefits,order,publish_state,version)` exposes only active published choices to public applicants; prices and term lengths are captured in the application snapshot. `membership_application(id,account_ref,tier_ref,source_payment_ref,approval_ref,status)` stores application reference, document requirements and personal/area information without duplicate login record. Approved `member(id,member_no,person_ref,term_start/end,status)` has unique generated number only after CG-03 final approval plus CG-09 actual verified fee, not mere payment initiated state.

`membership_term(member_id,tier_version,starts,expires,renewed_from)` preserves renewal/expiry and prior benefits; rejected paid applications require an authorized full joining-fee refund tracked back through CG-09; one gateway replay cannot create two memberships/cards. CG-19 card/certificate/letter renders from approved source state.

`volunteer(id,account_or_applicant_ref,skills,availability,preferred_department,status)` retains configurable choices and relevant identity proof under restricted access. Approval and CG-05 field assignments are separate; verified volunteer does not automatically get CG-01 operational role.

**QA:** expired tier, two simultaneous applications/renewals, denied member card before payment/approval, rejected-paid refund, volunteer without staff role, private identity upload, public status by verified applicant and membership/volunteer name option scope.

## Original volunteer expense request extension — finance source stays CG-09

CG-04 US-003 introduces an authorized volunteer eligibility projection (real approved volunteer, current account/branch/allowed expense policy and actor capability) and its own request/track UI into the existing CG-09 `submitOrGetExpenseClaim` finance facade. CG-09 alone stores the original expense_claim/case-linked payable/voucher/actual verified payout/journal; CG-19 owns bill file bytes. CG-04 does **not** create a second volunteer claim, approval case, payment, supplier or ledger table. Deduplicate Web/Public Android retried request by stable source key and resolve unknown response from CG-09. Wrong/revoked/foreign volunteer is denied; original CG-09 Foundation-only reimbursement remains independently functional.

## CG-04 original ownership of member/volunteer branch affiliation — source data and authorization

The CG-04 member and volunteer owner records reference existing CG-02 ACTIVE branch and eligible CG-02 department via typed scoped owner projections, never CG-02's member/volunteer master. Member-branch association and volunteer branch/department preference or assignment are CG-04-owned historical/revisioned relations with one current permitted association by genuine business rule. Validate CG-01 actor/member/volunteer permission, CG-02 scope and current branch status before saving; preserve history on branch change or closure, revoke old visibility without giving an account a new CG-01 grant. CG-04 US-002/003 source QA traces these relations with **no CG-05/13/18 records**.

## CG-04 source-owned member card and certificate integration (CG-19 original file owner)

**CG-04 US-002** owns actual member identity/tier, active approval status, verified CG-09 paid/refunded state, eligible CG-02 branch, approved picture/expiry and which fields are permitted on a member ID card/certificate. Only after the real conditions hold, submit typed source revision/status/allow-listed display fields to **CG-19's shared versioned template and issued file owner**; CG-04 never stores a second PDF/object master. The original signed PDF, issuance key, checksum, revocation and safe QR verification belong to CG-19. Pending/rejected/refunded/inactive CG-04 members cannot trigger real issue; stale name/photo/expiry yields a new audited version, never mutate historical issued bytes. Source QA US-002-QA10 verifies independently with actual preceding CG-01/02/03/09/19 modules; no future unrelated owner.

## Cross-owner contracts and story-specific QA

**Core tests:** Configure a live tier with valid price/validity and receive one real paid or pending application. Only approved real CG-03 member outcomes issue active membership. For a different branch/member role deny private roster or file access; idempotent payment confirmation never issues two memberships. Volunteer skill applications remain separate from employed staff.

**Current versus later sources:** CG-09 records real fee receipts; CG-18 publishes only approved tiers; CG-19 renders an issued card after the source becomes active. No fabricated sample member is necessary to configure tier or volunteer intake.

**API/source acceptance:** Every create/change command takes permitted actor context, actual source business key, validated inputs, expected revision and scoped idempotency token when it has an irreversible effect; returns actual status/reference or VALIDATION, FORBIDDEN, CONFLICT, UNAVAILABLE or UNKNOWN_WRITE_STATUS. The options/search projection exposes readable permitted labels without granting unrestricted master lists. Follow real Web/native event -> typed route -> policy -> transaction/owner -> user feedback and other authorized consumer for each story QA ID.

## Typed API and coordination

An authenticated `/api/membership-volunteers` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-009** — Person applies as member: Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-010** — Admin manages membership: Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-011** — Person volunteers: Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B09, B10, U14, U15, U16, U17. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, CG-09, CG-19, real CG-02. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.