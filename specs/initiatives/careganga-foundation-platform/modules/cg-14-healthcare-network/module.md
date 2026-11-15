# CG-14 — Healthcare Network

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-14-BR01–CG-14-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Provider/center and doctor professional profiles, many-center affiliation, fee/service catalog state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Provider/center and doctor professional profiles, many-center affiliation, fee/service catalog. **Delivery-critical, already-delivered owners:** CG-01 center account/permission, CG-02 real geography, CG-03 verified provider/doctor approvals and CG-19 protected evidence files. **Later owned integrations, never required to fake this module's first working path:** CG-15 adds genuine schedules and booking; CG-16 diagnostics adds actual tests; CG-17 subsidies and CG-18 public directory must bind approved source projections only. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

**State and invariant:** Provider/doctor pending/approved/returned/suspended, publication separate. One doctor identity across centers; no fake verified badge or public private bank info. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-042/A-14:** Foundation or center submits provider — Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details
- **FR-043/A-14:** Foundation verifies provider — Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history
- **FR-044/A-14:** Foundation or center registers doctor — Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees
- **FR-045/A-14:** Patient searches healthcare — Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits
- **FR-046/A-14:** Center maintains permitted presentation — Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication

Detailed authoritative clauses:
- **CG-14-BR01:** Foundation administrators can register and manage healthcare provider organizations and applicable branches/locations, including clinics, hospitals, nursing homes, diagnostic centers and labs.
- **CG-14-BR02:** Center profile includes name/code/type, operating address with geography and PIN, phone/email, map coordinates, photographs/logo, description, services, facilities, working hours, relevant licensing/registration documents and contact/settlement information.
- **CG-14-BR03:** Center representatives can submit or update their own permitted profile and center documents using center login, subject to provider verification/publication rules.
- **CG-14-BR04:** Foundation verifies center authenticity, submitted documents/facilities and decides approve/reject/return-for-correction with remarks/history through CG-03.
- **CG-14-BR05:** Foundation can activate, suspend, deactivate or block center login and public discoverability according to approved policy; suspended providers must not receive new public bookings.
- **CG-14-BR06:** A parent center can have multiple registered operating locations/branches; center staff permissions must be restricted to their authorized locations.
- **CG-14-BR07:** Center services/facilities are configurable, including consultation, lab/diagnostics, health checkups and applicable published center services. A provider's category is not itself a booked procedure.
- **CG-14-BR08:** Provider administration stores bank and settlement details under restricted finance permissions and does not disclose them publicly.
- **CG-14-BR09:** Foundation and permitted center staff can register one doctor with name, contacts, qualifications, specialties, experience, registration number/verification documents, biography, photographs and relevant public profile details.
- **CG-14-BR10:** Foundation verifies professional registration/identity/qualifications and manages doctor approved/pending/suspended/inactive states with decision history.
- **CG-14-BR11:** A verified doctor can be associated with multiple verified centers; associated center services, fee schedules, consultation modes, working location and availability are maintained without duplicating identity.
- **CG-14-BR12:** Manage center-specific consultation fees, follow-up charges and any approved fee categories, with change history and validity where required.
- **CG-14-BR13:** Center and Foundation operators can manage permitted professional profile updates, assigned-center changes and authorized status, not other centers' restricted records.
- **CG-14-BR14:** Public website/app offers published healthcare center categories, doctor search, center search and geographic filters including state/district/block/PIN where available.
- **CG-14-BR15:** Search doctors by name, specialty, qualification, experience, consultation fee and availability; support apply/reset filters, list/grid results, sorting and pagination, and display published professional profile, verified state where valid, associated centers and relevant prices/benefits.
- **CG-14-BR16:** Search/list centers by name, state/district/block/PIN, category/type, services, facility and supported benefit; support list/grid and map/directions views, published contact, working/OPD hours, galleries, doctors and facilities. Mockups illustrate filterable *published capability flags* including online booking, home sample collection, medicine delivery, 24×7 service and cashless/insurance; displaying a flag does not authorize an end-to-end delivery or insurance-claims workflow.
- **CG-14-BR17:** Display approved verification/partner status, applicable CareGanga support eligibility and reviews/ratings **only where grounded in a permitted, validated source**. Mockup review counts and badges are examples, not production facts.
- **CG-14-BR18:** Only approved/published center and doctor records are searchable by the public; internal account status and public listing status remain controlled independently.
- **CG-14-BR19:** Center staff can submit permitted center website content, service descriptions, images, FAQs, support requests and operating preferences, subject to Foundation review/publication and shared CG-18/19 ownership. The Center Portal cannot publish unverified clinical credentials or independently change Foundation assistance.
- **CG-14-BR20:** Publish an understandable healthcare service directory covering the nine illustrated provider categories, while separately identifying each center's actual bookable consultation services, diagnostic/lab offerings and published enquiry-only services. Approved center profiles include service/facility tags, contact/map location, professionals, current price and applicable benefits where configured.

## Real center helpdesk integration owned by CG-14 (CG-19 source retained)

**CG-14 US-005** introduces the center's own-context support portal only once genuine CG-14 center accounts, active affiliations and locations exist. CG-19 already owns the **only** `support_case`, `support_reply`, status, message, contact and response history. CG-14 adds center-scope eligibility/selector and typed authenticated facade integration, **not** a CG-14 support-ticket table, reply ledger or alternate support API. A verified center staff member can create/view/reply to only its own existing CG-19 cases; suspended/foreign center A/B access is denied on every list/detail/export/write. Foundation can administer only permitted cases via CG-19 original support screen. All CG-14 first center registration/verification/doctor/profile flows remain independent of a center support ticket; no CG-19 duplicate helpdesk and no fake center pre-seed in CG-19 initial release.

## CG-14 introducing ownership for verified provider directory and center content (transferred CG-18 BR19/21/28)

CG-14 US-004 owns the actual public verified center/doctor directory, search, status, service/facility and current eligible fee cards for public Web/Public Android. The prior CG-18 US-004 works as **generic editorial healthcare landing without CG-14**. Once real CG-14 source is delivered, CG-14 US-004 introduces a typed permissioned/public-safe source projection into existing CG-18 approved editorial headings/card slots; it builds and tests that live directory/search UI. A suspended/unapproved doctor/center, outdated fee version, guessed provider ID or missing public consent never appears. CG-18 owns page placement/theme/publication only; neither module creates the other's provider or CMS page master.

CG-14 US-005 owns the Center Portal submit/edit of real center-specific description/photos/services/FAQ and center identity, with genuine CG-01 center-scoped permissions, CG-19 protected file and CG-03/CG-14 review. It **introduces** a source-safe public center presentation proposal/updated status into CG-18's approved content/placement process; CG-18 must not invent a center data source or publish before Foundation authorization. A center can edit its own source, not another center or live fee under CMS guise. CG-14 owned US-004/005 QA must cover public Web/Android and provider revocation/fee freshness. These are receiving-owner changes, **not a delegated approval of all CG-14 artifacts**.

## Independently deliverable vertical flow

**Concrete acceptance:** Verify/register center and doctor with real licenses and one-to-many center affiliation, publish only eligible practitioner details, suspend center access and deny unrelated medical/bank data; no future booking required to deliver directory. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.