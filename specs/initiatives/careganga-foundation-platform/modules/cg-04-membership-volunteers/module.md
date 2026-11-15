# CG-04 — Membership Volunteers

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-04-BR01–CG-04-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B09, B10, U14, U15, U16, U17.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Member tiers/terms, fees, renewals, volunteer applications and skills state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Member tiers/terms, fees, renewals, volunteer applications and skills. **Delivery-critical, already-delivered owners:** CG-01 roles, CG-02 actual geography, CG-03 final approval, CG-09 verified fees, CG-19 issued member file/card. **Later owned integrations, not prerequisites for this module's core path:** CG-18 publishes only configured safe tier fields, CG-13 credits referrals after eligible membership becomes active. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** Draft/submitted/approved/rejected/active/expired/renewed. Approved fee and case precede member ID; rejected paid membership requires authorized refund. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Volunteer reimbursement: introducing owner, not a new money master

An existing genuinely approved CG-04 volunteer with real CG-01 account/CG-02 ACTIVE branch may request a policy-eligible allowance or reimbursement using **CG-04's own volunteer-specific Web/Public Android eligibility and presentation added during US-003**. The immutable request is submitted to the delivered **CG-09-owned original expense_claim API**, not stored as a CG-04 claim/payable/payment/journal duplicate. CG-09 owns actual finance approval-linked voucher/payout and status, CG-19 owns protected proof, and no volunteer expense can be considered PAID from a submitted request or fake provider reply. The initial CG-09 claim works without this future CG-04 volunteer integration.

## CG-04 original ownership of member/volunteer branch affiliation — transferred CG-02-BR06 scope

CG-04-BR04 and CG-02-BR06 are fulfilled **here**, not in CG-02: each member and volunteer application/assignment may select only a genuinely authorized existing ACTIVE CG-02 branch/department and store the owner-linked effective-dated relation in CG-04. A missing branch is represented according to the genuine organization rule; never fabricate a CG-02 branch, person or personnel employment row. CG-04 US-002 owns membership association; US-003 owns volunteer branch/dept availability/assignment. Review and test both in CG-04 before calling their outcomes complete.

## Complete PRD and BR mapping

- **FR-009/A-04:** Person applies as member — Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**
- **FR-010/A-04:** Admin manages membership — Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes
- **FR-011/A-04:** Person volunteers — Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments

Detailed authoritative clauses:
- **CG-04-BR01:** Public member registration captures contact, address, membership tier, referral attribution, document submissions and fee details; issue application reference and track status.
- **CG-04-BR02:** Admin configures active tiers, fees, validity/duration, benefits, descriptions and display order/appearance; public selection uses only active published tiers.
- **CG-04-BR03:** Verify required records and applicable fees, route approval through CG-03, then issue a unique approved member ID; do not confuse application number and member ID.
- **CG-04-BR04:** Maintain member roster, tier, join/expiry dates, renewal history, branch association, referrals, payments, documents, communications and status.
- **CG-04-BR05:** Generate approved member ID card, certificate and applicable welcome letter through common document templates; allow authorized download.
- **CG-04-BR06:** Support authorized member information changes and approval before protected changes are applied where configured; membership expiry/renewal records remain clear.
- **CG-04-BR07:** Public volunteer application captures personal/contact/geography, date of birth, gender, optional blood-group data as a profile field where requested, skills, experience, availability, preferred department, referral and identity-document details.
- **CG-04-BR08:** Volunteer departments and availability choices are configurable by authorized administrators; illustrative departments include healthcare, education, child welfare/nutrition, disaster relief, environment/plantation, women empowerment, community development and general support. Available schedule choices from the written source: full-time, part-time, weekends-only and flexible/on-call.
- **CG-04-BR09:** Verify/approve volunteer applications, maintain volunteer roster/status/assignments and link actual work to CG-05.
- **CG-04-BR10:** Enable permitted volunteer access according to CG-01 roles; not all volunteers automatically become internal operational staff.
- **CG-04-BR11:** Provide authorized search, status filtering, activity summaries, exports and communication.

## CG-04 introduces actual public Join destinations into prior CG-18 publication (transferred CG-18 BR09)

CG-18 US-001 alone owns independent versioned *desired* Login/Profile, Member Join and Volunteer Join public publication flags; the initial real CG-01 Login operates without CG-04. **CG-04 US-002 owns the real member registration/public eligibility/tier/fee/approval route** and, when its first real eligible registration is delivered, introduces an actual member_join route availability+permission+current status projection into CG-18's already versioned publication/navigation facade. CG-04 US-003 analogously introduces *only* genuine volunteer registration/public-eligibility route. CG-18 controls whether to publish that existing CTA and its one effective Web/Public Android revision; CG-04 owns form, authentication/consent/privacy, registration source and real route. Desired enabled flags alone cannot expose a missing form, deep link or unauthorized data. Activation, deactivation, changed route permission and invalid/outdated public cache must behave identically in public Web and native Public Android; route guards still enforce CG-01 and CG-04. No CG-04 copy of CG-18 settings, no CG-18 member/volunteer table. These are later-introducing owner integration/QA changes, not original CG-18 requirements or full CG-04 design approval.


## CG-04 receiving-owner genuine volunteer assignment into existing CG-05 tasks/visits (narrow)

**Not a full CG-04 expert approval.** CG-04 US-003 owns the one authentic verified volunteer identity, application status, consent/skills/current availability and CG-02 branch association, not CG-05 employee or task record. After true CG-04 volunteer approved and associated with a CG-01 authorized account where native action is needed, **CG-04 US-003 introduces** a minimal typed active/current eligible volunteer projection into **CG-05 US-002 project-task and US-004 field-visit assignee options**. Use genuine same-root/branch/current assignment and eligible skills/availability policy; no fake volunteer list in CG-05 original A04 while CG-04 absent. Any CG-05 volunteer task/status/check-in belongs to CG-05 original API/DB and native Internal Android current login; CG-04 retains volunteer credential/profile and public member/volunteer join route. A volunteer approval is not task-completed or field visit approved. Revoke/deactivate/transfer volunteer removes actionable CG-05 assignment, preserves audit; Public Android never exposes private A05 GPS. Original U14–U17 applicant/volunteer list remains its distinct source, CG-05 A09/A04 remain assignment/visit owners. CG-04 first registration and approvals must function with no CG-05 project at all. Real Web/native/DB QA NOT_RUN.


## Independent vertical delivery and acceptance

This module must complete actual create/read/update/review and permissioned Web/Android routes using the above delivered contracts before any source QA may be marked complete. **Concrete acceptance:** Publish one tier then process a real verified application through final review; preserve fee validity/version and revoke permissions for foreign member/volunteer records. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B09, B10, U14, U15, U16, U17. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.