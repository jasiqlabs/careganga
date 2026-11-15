# CG-04 — Membership Volunteers

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

## Independent vertical delivery and acceptance

This module must complete actual create/read/update/review and permissioned Web/Android routes using the above delivered contracts before any source QA may be marked complete. **Concrete acceptance:** Publish one tier then process a real verified application through final review; preserve fee validity/version and revoke permissions for foreign member/volunteer records. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B09, B10, U14, U15, U16, U17. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.