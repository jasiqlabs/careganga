# CG-16 — Healthcare Diagnostics

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-16-BR01–CG-16-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Test/package catalog, center prices, internal order, sample and released report state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Confirmed partner catalog versus globally OFF Lab ERP (FR-081/082, H08–H10)

**Lab ERP is included in the build but disabled on every new deployment by default** (`CAREGANGA_ERP_LAB_ENABLED=false`). CG-16 US-001 actual verified lab test/pricing master, US-003 public approved menu/pricing and US-004 public partner enquiry run independently with ERP OFF. **US-003 depends on US-001 only**, not on operational lab US-002. CG-16 US-002 lab order, sample custody/processing, expert review/release and supplementary US-005 equipment and quality/compliance operations are gated by global ON, actual fully integrated/migrated code and QA, current approved CG-14 LAB_ERP center grant and CG-01 exact center/actor and patient consent where necessary. No public lab checkout/clinical inference, no new lab revenue ledger. Existing release path and CG-14 verified lab directory unaffected.

**US-005 equipment and quality:** Actual approved center may log applicable lab equipment/maintenance readiness and controlled quality/compliance evidence without creating CG-12 Foundation inventory, CG-19 file bytes or regulated clinical diagnostic analyzer integration. This is separately developable with CG-14+CG-19 and real current policies, without patient/order/reports or future CG-20. H08/H09/H10 provide original UX hierarchy. With ERP OFF, technical/private equipment and sample menus/API/exports/workers are unavailable while approved catalog, center and price enquiry remain; historical patient reports remain available only via original lawful purpose-bound access. All 5 stories have explicit QA with total **60** planned (12/story).

## Business owner and isolation

**Owns:** Test/package catalog, center prices, internal order, sample and released report. **Delivery-critical, already-delivered owners:** CG-14 genuine center/test provider, CG-15 verified patient/visit and CG-19 private released report. **Later integration owners, not blockers for the first self-contained feature:** CG-17 may later attach actual supported price/settlement; no future lab booking or pharmacy commerce is assumed. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Order created/collected/processing/report ready/released. No public lab checkout or release of private patient report to strangers. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-055/A-16:** Center/central Admin configures lab — Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history
- **FR-056/A-16:** Center books lab service internally — Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state
- **FR-057/A-16:** Patient/provider views service — View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician
- **FR-058/A-16:** Additional service CTA appears publicly — Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch

Detailed authoritative clauses:
- **CG-16-BR01:** Define a diagnostic test master with unique code, name, category, sample type, investigation details/parameters, description and active status.
- **CG-16-BR02:** Permit authorized center-specific test prices and relevant support/discount policy references, including validity/history.
- **CG-16-BR03:** Create lab and health checkup packages by selecting included tests, code/name/category, base price, discount, active status and validity.
- **CG-16-BR04:** Authorized center staff can register internal tests/packages for a patient, retain source of request, test details and initial payment/billing references.
- **CG-16-BR05:** Track lab workflow: order → sample collection/processing → result/report upload → authorized release/completion with relevant times/status history.
- **CG-16-BR06:** Make reports available to appropriate patient and clinical users with permission; do not publish diagnostic reports through the public center directory.
- **CG-16-BR07:** Center portal and Foundation Admin can inspect internal lab orders, processing, utilization, test collection and authorized reports by scoped location and date.
- **CG-16-BR08:** Public center profiles may display verified test/service menus, genuine prices and configured benefits. Public medicine, nursing/OT and lab checkout are not enabled in the initial release; internal center-managed lab orders remain supported.
- **CG-16-BR09:** Service catalogs may cover categories illustrated by the mockups: polyclinic, diagnostic center, dental clinic, medical laboratory, hospital/nursing home, pharmacy, orthopedic, homeopathy and Ayurvedic centers. Listing a category does not automatically imply a dedicated pharmacy stock/sales or hospital-OT operating system.
- **CG-16-BR10:** Non-bookable health camps/checkups and other applicable support offerings may be displayed as information with clear contact/enquiry actions as approved.

## First usable vertical contract and regression

**Concrete acceptance:** Register a real internal test order, receive labeled sample and approved result, release one versioned private report; drafts and unrelated center patients remain inaccessible and corrections retain audit. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.