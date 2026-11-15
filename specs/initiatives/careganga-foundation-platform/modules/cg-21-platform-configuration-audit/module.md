# CG-21 — Platform Configuration Audit

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55.  
**Stage:** Harness Planning / GREENFIELD · **CG-01 benchmark re-review (15 Nov 2026):** IN_REVIEW → findings fixed and source re-review recorded for CG-21 against PRD/HLD v1.1 and currently reviewed Harness main `ec7c0b81`; 16 existing QA cases retained. **JASIQ AI Design Review Agent** is authorized for design approval; CG-21 itself is NOT yet owner-confirmed or delegated-approved. PRD/HLD v1.1 status REVIEW_REQUIRED, authenticated local Harness resolver and independent CRITICAL DB/runtime/visual QA NOT_RUN; stories remain BLOCKED. No next module review until the owner's confirmation.

uiux_decision: REQUIRED
uiux_reason: Privileged Foundation Admin Web settings, provider-readiness, central audit and backup/recovery views must preserve the CareGanga C09/C10/C50–C55 theme, motion, density, statuses and accessible responsive patterns. No separately owned Android screen.
dld_decision: REQUIRED
dld_reason: Versioned platform settings, provider secret-reference/readiness, read-only cross-owner audit, MFA-protected recovery and concurrency demand precise DB/typed API/security design; do not create duplicate CG-01 audit or CG-03 approval authority.
database_impact: CRITICAL
database_reason: CRITICAL Foundation-root configuration and protected provider secret references require real uniqueness, immutable version history and account-scope guards; recovery requests can lead to irreversible destructive restore, so explicit authorization/verified external proof, concurrency-safe migration and independently reviewed recovery design are mandatory. CG-01 retains original access audit; CG-21 owns only its settings/recovery audit and permissioned source-federated presentation.
mobile_store_impact: NONE
mobile_store_reason: No owned native Android UI for this module; other consumers use the same backend.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** One versioned platform/system settings source, integration credential **references** and verified-readiness states, restricted audit **presentation** over genuine earlier owner events, own setting/recovery audit events, and privileged backup/recovery request/proof records. **Required real predecessor:** CG-01 completed account/session/MFA/permission and authoritative access audit, not merely a design. CG-01 still owns password/session mechanics, grants, last-root protection and access audit; CG-21 may present policy options and call CG-01's protected policy facade, never a second account/auth service. **Future owners:** CG-03/09/14/15/17/18 add genuine domain events/integrations when delivered; CG-18 controls actual public Login/Join/Volunteer visibility; no CG-03 approval case, CG-02 branch, future merchant/provider, CMS record or fake log may be needed to complete CG-21 initial work. Later owner supplies its cross-module QA. Unavailable external integration stays DISABLED/NOT_VERIFIED rather than falsely ready.

**State and invariant:** Configuration has one effective typed value per allow-listed key and real Foundation root; every accepted expected-version update writes an append-only source revision and redacted audit atomically. Integration status DISABLED/CONFIGURED_NOT_VERIFIED/VERIFIED/FAILED/UNAVAILABLE is bound to the current credential revision and actual check time; no check means NOT_VERIFIED, not payment/notification readiness. CG-21 central audit is a bounded permissioned read projection of actual CG-01 and CG-21 owner events, with unavailable feeds clearly disclosed; future owners contribute only when delivered. Recovery REQUESTED → PRIVILEGED_AUTHORIZED → RUNNING → VERIFIED_SUCCEEDED/FAILED/UNKNOWN requires a real secured backup/procedure and independently verifiable proof; no real facility yields NOT_AVAILABLE and no fictitious operation. CG-01 enforces root authority, fresh MFA and any supported session/password policy changes through its own facade, not duplicate settings authority; no CG-03 approval dependency. All query/export/options/write calls are server scope-checked, redacted, conflict-guarded and fail closed.

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

**Concrete acceptance:** A permitted CG-01 Foundation Super Admin changes an allow-listed nonsecret setting at an expected revision, sees one persisted effective version plus immutable history/audit, and a conflicting write safely fails. Optional provider credentials use secret references only, invalidating old VERIFICATION when rotated; explicit check returns a real observed status or honest unavailability. Root-authorized audit pages/exports merge **original** CG-01 events with CG-21's own source events without copying sensitive audit; source feed outages are partial, not empty-success. A fresh-MFA-protected recovery request/authorization may be recorded only with real policy/backup status; verified restoration requires separately authorized operational proof. CG-01 owns password/session/MFA enforcement even if CG-21 shows permitted policy options. No later module data or runtime-PASS claims are needed for this design.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.