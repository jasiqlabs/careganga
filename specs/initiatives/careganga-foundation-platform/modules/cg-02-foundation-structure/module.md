# CG-02 — Foundation Structure

**Authority:** [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-02-BR01–CG-02-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U18, U19, U20, U21, U22.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Foundation profile, region hierarchy, branches, departments/committees state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: NONE
mobile_store_reason: No owned native Android UI for this module; other consumers use the same backend.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Foundation profile, region hierarchy, branches, departments/committees. **Real prerequisite owners:** CG-01; CG-03 active branch approval. CG-01 owns identity and access; CG-03 owns approval cases; CG-09 authoritative money, CG-19 shared document/message, CG-18 publication and CG-21 platform audit. Do not create shadow domain records or write directly to other owners' tables. Future modules must complete their own real integration and selectors when data exists; no fake master rows or false completed feature.

**State and invariant:** Draft/submitted/returned/rejected/approved/active/closed. Only finally approved branches activate or receive code; geography never invented. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-004/A-02:** Admin configures Foundation — Maintain organization details, geography, branches, departments/committees, managers and linked staff/projects/budgets with distinct approved publication
- **FR-005/A-02:** Branch manager starts branch setup — Complete seven-stage draft/review/submit registration with contacts, location, documents, manager and linked resources; after required approval issue unique branch code

Detailed authoritative clauses:
- **CG-02-BR01:** Maintain Foundation identity, official contact/address, registrations and appropriately authorized organization settings.
- **CG-02-BR02:** Maintain Foundation branch names/types/codes, status (active/inactive/closed), geographic location, contact, photos, opening date, registration and agreements.
- **CG-02-BR03:** Support the specified seven-stage branch registration: (1) basic information with name/type/opening date/geography/address/PIN/GPS/photo; (2) additional location and contact; (3) official photo and registration records; (4) agreement and supporting documents; (5) manager/in-charge appointment; (6) link staff, volunteers, departments and projects; (7) review/submit with required-document validation.
- **CG-02-BR04:** Save incomplete branch drafts; show setup completeness, missing documents, verification and approval status.
- **CG-02-BR05:** Generate branch code after applicable final approval; preserve change history.
- **CG-02-BR06:** Associate branches with employees, coordinators, volunteers, departments, members, projects and budget allocations without duplicating their owner profiles.
- **CG-02-BR07:** Maintain departments and their functions, branch associations and member assignments; maintain committees and committee/personnel associations.
- **CG-02-BR08:** Provide branch directory, search/filter, authorized status changes and exports.
- **CG-02-BR09:** Internal Foundation branches must **not be automatically published**; only expressly approved organization information appears publicly.
- **CG-02-BR10:** Department and committee setup supports name, type, parent department where applicable, branch/location, assigned head/manager, opening date, description and active status. Reporting and staff assignment reuse the same department/committee record.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U18, U19, U20, U21, U22. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.