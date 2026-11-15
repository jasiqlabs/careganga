# CG-07 — Campaigns Donations

**Authority:** [PRD](../../prd.md) FR-017, FR-018, FR-019, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-07-BR01–CG-07-BR09, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A12, A13, A14, A15, A16, A17, A18.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Campaigns, donor intent, payment verification, refund and receipt sources state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Campaigns, donor intent, payment verification, refund and receipt sources. **Real prerequisite owners:** CG-01, CG-03, CG-09, CG-19 and CG-18. CG-01 owns identity and access; CG-03 owns approval cases; CG-09 authoritative money, CG-19 shared document/message, CG-18 publication and CG-21 platform audit. Do not create shadow domain records or write directly to other owners' tables. Future modules must complete their own real integration and selectors when data exists; no fake master rows or false completed feature.

**State and invariant:** Campaign draft/approved/published; payment initiated/pending/verified/failed/refunded. Pending money never receipt, provider replay never duplicate finance posting. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-017/A-07:** Campaign owner proposes fundraiser — Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication
- **FR-018/A-07:** Donor makes contribution — Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states
- **FR-019/A-07:** Donation completes/reverses — Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress

Detailed authoritative clauses:
- **CG-07-BR01:** Create campaigns with purpose/category, linked cause/project, title/content, images, goal amount, fundraising period, status and public visibility.
- **CG-07-BR02:** Accept general and campaign-linked online donations through configured payment provider, recording donor, amount, transaction reference and payment status.
- **CG-07-BR03:** Allow authorized manual donation entries, payment links, verification and correction/refund actions within configured provider/payment rules.
- **CG-07-BR04:** Produce authorized receipts and donor transaction history and expose donor-facing receipts through appropriate self-service.
- **CG-07-BR05:** Link successful payments to financial accounting records exactly once, with refund/correction linkage; do not equate a pending gateway request to received funds.
- **CG-07-BR06:** Show approved public campaign details, goals/progress and donation CTAs; keep private donor/payment data restricted.
- **CG-07-BR07:** Provide donation lists, filters, dashboards, campaign progress, summaries and exports.
- **CG-07-BR08:** Campaign setup supports an editable draft and review flow across basic information, project/category and geography, team/assignment, budget/targets, documents/media and final review. Campaign launch/publication is separately authorized and may not be inferred from saving a draft.
- **CG-07-BR09:** A manual donation record, generated online payment link, payment request, verified payment, authorized receipt and any subsequent correction/refund have distinct statuses linked to the same donor/campaign transaction.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A12, A13, A14, A15, A16, A17, A18. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.