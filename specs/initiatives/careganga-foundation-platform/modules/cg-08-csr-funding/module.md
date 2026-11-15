# CG-08 — Csr Funding

**Authority:** [PRD](../../prd.md) FR-020, FR-021, FR-022, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-08-BR01–CG-08-BR08, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B02.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned CSR partners, funding proposals/agreements, commitments and allocations state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: NONE
mobile_store_reason: No owned native Android UI for this module; other consumers use the same backend.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** CSR partners, funding proposals/agreements, commitments and allocations. **Real prerequisite owners:** CG-01, CG-03, CG-05 and CG-09. CG-01 owns identity and access; CG-03 owns approval cases; CG-09 authoritative money, CG-19 shared document/message, CG-18 publication and CG-21 platform audit. Do not create shadow domain records or write directly to other owners' tables. Future modules must complete their own real integration and selectors when data exists; no fake master rows or false completed feature.

**State and invariant:** Partner requested/approved/returned; amount proposed/committed/received/allocated. Pledge not money; funding allocation not utilization; no shadow ledger. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-020/A-08:** CSR partner submits application — Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process
- **FR-021/A-08:** Foundation funds a project — Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance
- **FR-022/A-08:** Finance or partner manager examines funding — Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval

Detailed authoritative clauses:
- **CG-08-BR01:** Receive CSR partner applications and records of organization name, contacts, documents and verification status.
- **CG-08-BR02:** Verify CSR partners through common approval workflow and maintain approved partner directory.
- **CG-08-BR03:** Create funding proposals associated with projects/partners, requested amount, purpose, attachments and responsible personnel.
- **CG-08-BR04:** Support shared funding showing CSR partner contribution, Foundation contribution and percentage allocations, with agreements and budget categories.
- **CG-08-BR05:** Route funding approvals and preserve approved/rejected/pending statuses and reviewer history.
- **CG-08-BR06:** Link approved funds to project allocations, utilization and reporting through CG-09; public partner publication is independent of partner verification.
- **CG-08-BR07:** Funding work distinguishes proposed/requested funding, documented commitments, received funds, approved allocations to projects/categories and actual utilization or release. Funder agreements and source references remain attached; no individual project or CSR screen creates a competing fund balance.
- **CG-08-BR08:** CSR partner reviews can result in approval, rejection or request for correction with reviewer remarks, partner-contact details and linked proposal/contribution history.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: B02. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.