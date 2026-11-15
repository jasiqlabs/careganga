# CG-13 — Referrals Rewards

**Authority:** [PRD](../../prd.md) FR-039, FR-040, FR-041, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-13-BR01–CG-13-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B11, B12, B13, B14, B15, B16, B17, B18.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Verified referral attribution, point/rank ledger, reward catalog/redemption state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Verified referral attribution, point/rank ledger, reward catalog/redemption. **Real prerequisite owners:** CG-04, CG-12 for stock and CG-09 when value moves. CG-01 owns identity and access; CG-03 owns approval cases; CG-09 authoritative money, CG-19 shared document/message, CG-18 publication and CG-21 platform audit. Do not create shadow domain records or write directly to other owners' tables. Future modules must complete their own real integration and selectors when data exists; no fake master rows or false completed feature.

**State and invariant:** Referral pending/qualified; redemption requested/approved/fulfilled/reversed. No unearned points or repeated redemption/stock issue. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-039/A-13:** Eligible member/volunteer refers new applicant — Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank
- **FR-040/A-13:** Admin configures loyalty program — Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage
- **FR-041/A-13:** Member/volunteer redeems — Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue

Detailed authoritative clauses:
- **CG-13-BR01:** Generate/referral-code and shareable-link association for eligible member and volunteer accounts.
- **CG-13-BR02:** Count an eligible referral only after the defined registration and qualification events; preserve source/qualification history.
- **CG-13-BR03:** Configure qualification, earned points, conversion/redemption rules and points transaction balances; display balances to eligible users.
- **CG-13-BR04:** Configure rank names, point/referral thresholds, benefits and progression history. Illustrative ranks: Bronze, Silver, Gold, Platinum, Diamond, Royal, Legend. Eligible configurable benefits can include recognition badges, certificates, digital gifts, reward points and rank-specific privileges.
- **CG-13-BR05:** Maintain reward product catalog (physical/digital), image, category, quantity/stock where applicable, points cost and availability.
- **CG-13-BR06:** Let eligible users submit point-redemption requests, view status/history and have fulfillment processed by authorized staff.
- **CG-13-BR07:** Points deducted and rewards issued must match completed qualifying/redemption transactions; fulfillment and stock movement must be traceable, including reversal/correction under defined rules.
- **CG-13-BR08:** Provide referral/leaderboard/rank/points and redemption reports with privacy-aware visibility.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B11, B12, B13, B14, B15, B16, B17, B18. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.