# CG-02 — Foundation Structure

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-004, FR-005, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-02-BR01–CG-02-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U18, U19, U20, U21, U22.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Foundation profile, region hierarchy, branches, departments/committees state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Internal Android allows a scoped branch manager to resume the real seven-stage registration, attach evidence and view/submit status using the shared backend; Foundation-wide geography and committee administration remains Web-first. No public Android branch-admin screen.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Foundation profile, region hierarchy, branches, departments/committees. **Delivery-critical, already-delivered owners:** CG-01 identity + CG-03 genuine approval decisions + CG-19 protected evidence for seven-step branch submission. **Later owned integrations, not prerequisites for this module's core path:** CG-10 employee heads, CG-05 projects, CG-04 members, CG-09 budgets and CG-18 public listing link only from their delivered source owners. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** Foundation identity/area/department/committee is usable before any branch; a branch-scoped department requires an actually active branch. Registration is draft/submitted/returned/rejected/final-approved/active/closed. Only CG-03 may authorize final approval and CG-19 owns genuine document evidence. Only finally approved branches activate or receive code; geography never invented. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

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

## Business-first delivery slices and developer boundaries

1. **US-001 — Foundation identity, real geography and Foundation-level departments/committees:** The Super Admin may configure verified legal/contact/registration details, real state/district/subdivision/block hierarchy, organization-wide departments/committees and permitted CG-01 account head, and search permitted actual records. A department/committee can belong to the Foundation as a whole **without a branch**; only an explicitly branch-scoped department requires an existing active CG-02 branch. Do not require an application/approval/document service merely to maintain Foundation settings. Existing CG-21 system/provider configuration must not duplicate the CG-02 legal organization profile.
2. **US-002 — Seven-stage branch application and after-approval directory:** The manager can save/resume the actual seven-stage Web/Android application; CG-19 supplies genuine uploaded photo/registration/agreement evidence; CG-03 supplies a true branch review case, return/reject or final decision; one idempotent CG-02 finalizer creates one active branch and one visible unique business code only on approval. Stage 5 may select a **real eligible CG-01 account** as manager. Stage 6 may link real CG-02 departments; actual CG-04 volunteer, CG-05 project, CG-10 employee and CG-09 budget associations are **not fabricated** and are implemented/tested by those introducing owners.
3. **Channel ownership:** Admin Web is the full organization/geography/directory/department editor using U18–U22. Internal Android offers the branch-manager's current draft, step completion, safe local evidence capture/upload, submission and tracked status using the same API and CareGanga theme. There is no separate Android region/department administration or public branch-management capability.
4. **NFR gates:** CRITICAL path for branch approval/activation, scoped relational migrations/rollback and unique branch code; foreign-area, wrong-branch department and circular parent denial; safe staff options, reference-based evidence uploads, bounded queries/pagination and no idle per-branch approval poll; redacted structured diagnostics, auditable business change, actionable human messages and original screenshot-derived UI states.

## Independent vertical delivery and acceptance

This module must complete actual create/read/update/review and permissioned responsive Admin Web/role-scoped Internal Android routes using CG-01, CG-03 and CG-19 real delivered contracts before source QA can be marked complete. **Concrete acceptance:** Register a branch in seven resumable stages, reject a missing agreement, obtain a real CG-03 final approval, then issue one unique branch code and activate once; prevent foreign-area/department links. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U18, U19, U20, U21, U22. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.