# CG-21 — Platform Configuration Audit

**Authority:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Platform/integration settings, security audit, privileged backup/restore state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: NONE
mobile_store_reason: No owned native Android UI for this module; other consumers use the same backend.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Platform/integration settings, security audit, privileged backup/restore. **Delivery-critical, already-delivered owners:** CG-01 verified Super Admin sessions, MFA, root audit and safe restricted diagnostic context. **Later integration owners, not blockers for the first self-contained feature:** CG-03/09/14/15/17 append domain audit after delivery; CG-18 owns public publication switches, not copied generic settings rows. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Settings draft/active; integration disabled/verified; recovery requested/approved. No secrets in UI/log, ordinary staff restore or simulated provider success. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-075/A-21:** Super Admin manages platform — Configure Foundation/system settings, approved payment/messaging/map integrations and public visibility through the owning modules; sensitive credentials restricted
- **FR-076/A-21:** Administrator audits or recovers — Show protected logs for login, approvals, money, provider verification, sensitive accesses and publishing; restrict backup/restore to approved operations and support privileged MFA/session controls

Detailed authoritative clauses:
- **CG-21-BR01:** Central configuration for Foundation information, operational settings, supported integrations and credentials via authorized administration.
- **CG-21-BR02:** Auditable actions including logins where applicable, role changes, approvals, financial changes, publishing, provider verification and protected data access as appropriate.
- **CG-21-BR03:** Provide authorized configuration/monitoring for payments, email/SMS/WhatsApp, push, GPS/maps and related external providers where required.
- **CG-21-BR04:** Provide controlled backup/restore access and a recovery operation model; restoration must not be available to routine staff.
- **CG-21-BR05:** Provide human-readable errors, status and operational controls that avoid silently swallowing backend failures.
- **CG-21-BR06:** Support password/session security configuration and two-factor authentication for privileged accounts, with policy and enforcement documented in CG-BR-600, and restrict restore operations to correctly authorized operators.

## First usable vertical contract and regression

**Concrete acceptance:** Change and audit one real versioned setting, reject a competing stale change, verify actual integration readiness and require privileged approval for recovery; don't claim an untested restore completed. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.