# CG-05 — Projects Field Operations

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-012, FR-013, FR-014, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-05-BR01–CG-05-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Projects, tasks, events/activity, GPS visit and private evidence state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Projects, tasks, events/activity, GPS visit and private evidence. **Delivery-critical, already-delivered owners:** CG-01 scoped operators, CG-02 real branches/geography, CG-19 protected photos/files. **Later owned integrations, not prerequisites for this module's core path:** CG-10 adds real employee assignees, CG-06 impact/beneficiary ownership, CG-09 budget authority, CG-20 scoped reporting. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** Planned/active/hold/completed/cancelled. No fake GPS, duplicate CMS project or shadow financial/beneficiary source. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## CG-05 original ownership of project branch links — transferred CG-02-BR06 scope

CG-02-BR06 project/branch affiliation is delivered **by CG-05 US-001**: one actual project references an authorized existing ACTIVE CG-02 branch (and real CG-02 geography), with scope-safe project list/detail/task options and effective history on movement. The branch is not an editable project master in CG-02. Project-related financial allocation uses CG-09 verified finance projection when available, never a second project budget ledger or a future beneficiary record.

## Complete PRD and BR mapping

- **FR-012/A-05:** Project owner sets up work — Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards
- **FR-013/A-05:** Coordinator assigns work — Create, assign and monitor tasks, events and activities with owners, priorities, deadlines, progress, evidence and only approved public display
- **FR-014/A-05:** Field worker visits project — Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests

Detailed authoritative clauses:
- **CG-05-BR01:** Create projects with code, category, descriptions, status, priority, location, funding source, planned budget, dates and project leadership.
- **CG-05-BR02:** Maintain project stages including planning, active, on-hold, completed and cancelled; track progress, responsible teams, allocated/utilized budgets and activity history.
- **CG-05-BR03:** Search projects by code, area, category, director, funding source, status, priority and dates; export where permitted.
- **CG-05-BR04:** Create/assign tasks with owner, due date, project link, priority, type, current status, overdue tracking and completion history.
- **CG-05-BR05:** Record project and organizational activities with responsible personnel and supporting evidence.
- **CG-05-BR06:** Field personnel record visits with date, location, GPS/geotagged evidence, descriptions, assigned employee and photos/documents; link to applicable project/task.
- **CG-05-BR07:** Authorized coordinators review and monitor field visits, activity and task completion within scope; evidence stays attached to source records.
- **CG-05-BR08:** Provide project performance summaries and operational reporting without manually recreating public project pages.
- **CG-05-BR09:** Make only expressly published projects, achievements and stories visible publicly via CG-18.
- **CG-05-BR10:** Allow authorized creation and management of Foundation events linked to programs/projects or campaigns where relevant, including event information and public publication through CG-18. The exact event registration/ticketing workflow, if any, requires a separate supported client requirement and must not be assumed from a menu label.
- **CG-05-BR11:** A field visit has one detailed record with contextual views for visit report, check-in/check-out, location/route/GPS, photographs/videos, documents, assigned team, beneficiary assistance, approval records, comments and activity history. These views reference their owning records; they are not independent visit modules.

## Independent vertical delivery and acceptance

This module must complete actual create/read/update/review and permissioned Web/Android routes using the above delivered contracts before any source QA may be marked complete. **Concrete acceptance:** Create a real project/field task, capture actual authorized visit evidence and check-in/out; failed upload and wrong-branch report do not mutate source and no made-up map trace is shown. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A01, A02, A03, A04, A05, A06, A09, A10, A11, U31, U32. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.