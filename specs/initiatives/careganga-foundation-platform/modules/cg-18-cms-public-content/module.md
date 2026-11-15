# CG-18 — Cms Public Content

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-066, FR-067, FR-068, FR-069, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/03-CMS-CHANNELS-BR.md) CG-18-BR01–CG-18-BR28, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38.  
**Stage:** Harness Planning / GREENFIELD · **State:** OWNER_SCOPE_TRANSFER_RECORDED / DRAFT_NOT_APPROVED (15 Nov 2026). Public Login/Member Join/Volunteer Join publication controls are explicitly CG-18-owned and excluded from CG-21. CG-18's full independent design review, latest-hash delegated approval, local Harness resolver and Web/Public Android QA remain NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Hero/content, public pages, impact, 80G, navigation, safe publication state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: CG-18 has no native Admin editor, but **Public Android is an actual consumer** of approved public Login/Join/Volunteer navigation/visibility from the same protected publication API as responsive public Web. Changes to native navigation must follow the current approved Android dependency/store policy and independent device QA; no new Android CMS administrator page.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Hero/content, public pages, impact, 80G, **one approved and revisioned public Login/Profile, Membership Join and Volunteer Join visibility/route publication policy**, navigation and safe publication. **Delivery-critical, already-delivered owners:** CG-01 editor roles, CG-03 configured review, CG-19 genuine media asset. **Later integration owners, not blockers for the first self-contained feature:** CG-05 projects, CG-07 campaigns, CG-14 doctors/centers and CG-17 support feed approved public projections only when those real records exist. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Editorial draft/reviewed/published/hidden/scheduled. CMS may not edit actual project/doctor/clinical/financial business source or claim statutory certification. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-066/A-18:** Admin edits Foundation site — Manage homepage, About/Our Work, projects, team, hero images/typography, CTAs, website navigation and public Login/Join visibility with authorized preview/publish controls
- **FR-067/A-18:** Admin edits NGO impact/transparency — Publish editable Impact groups, geography/charts/stories with appropriate provenance; maintain 80G/PAN/registration, annual and financial disclosure pages/documents
- **FR-068/A-18:** Admin publishes reusable content — Manage galleries, videos, publications, media, articles, updates, events, notices and public enquiries with controlled fields, review, ordering, preview and status
- **FR-069/A-18:** Healthcare content is published — Show approved directory/category cards, provider profiles, doctors, current price/facility/benefit messaging; don't allow CMS to overwrite provider verification, scheduling or contribution ownership

Detailed authoritative clauses:
- **CG-18-BR01:** Provide a web-based authorized content dashboard with supported pages/sections, their status, preview and publication controls.
- **CG-18-BR02:** Create, edit, preview and publish homepage hero banners, text, CTA labels/links, images, display order and applicable page visibility.
- **CG-18-BR03:** Manage publicly authorized team member profiles (name, designation, photograph, description, order and published/unpublished status), **referencing HR/employee records where appropriate**, without exposing full employee files.
- **CG-18-BR04:** Publish selected upcoming/current projects with media and descriptions derived from CG-05; a website teaser is not a second project master.
- **CG-18-BR05:** Maintain reusable website gallery and media library, including uploaded image/document metadata and permissions.
- **CG-18-BR06:** Create/manage blogs, articles, public news and updates with editorial publication controls.
- **CG-18-BR07:** CG-18 publishes/embeds a public contact **page/form UI only** using real CG-19 public contact API and secure status receipt. CG-19 owns all contact/support records, responder assignment, private sender details, replies/history. No CG-18 contact-message master or extra helpdesk.
- **CG-18-BR08:** Enable content preview, submit-for-review, approve/reject, authorized publishing/unpublishing and **scheduled publication** where supported, with author/reviewer/publisher rights from CG-01/03, public visibility/status and an audit trail.
- **CG-18-BR09:** Own and implement the three versioned CMS publication choices **Login/Profile**, **Membership registration/join**, **Volunteer registration/join** (C50 visual reference), with draft/preview/review/publish/unpublish and genuine public Web/Public Android effective visibility. A toggle never creates authentication capability or a membership/volunteer registration source; only publish a link when its real owner route exists and is permitted.
- **CG-18-BR10:** Maintain editable public menu, heading, CTA, images, SEO metadata and page publication where supported; public channels reflect saved state, not UI hardcodes.
- **CG-18-BR11:** Publish Foundation profile, mission/work, team information and other selected NGO information with correct editorial visibility.
- **CG-18-BR12:** Provide the 80G information page editor for section enablement, ordering, title/subtitle/badge/description, hero/organization imagery, legal/approval numbers, PAN, dates/validity, issuing authority, attached approval documents, donation CTA and preview/publish.
- **CG-18-BR13:** Maintain published PAN, registration documents, annual reports, financial reports and transparency/compliance content via authorized uploads and review.
- **CG-18-BR14:** Do not treat editable public certificates/reports as proof of continuing statutory validity: document authenticity and current validity remain client-controlled obligations.
- **CG-18-BR15:** Admin can edit, preview and publish each required Impact section.
- **CG-18-BR16:** Where possible, draw counts from verified project/beneficiary/donation/center reporting. Where the business specifically requires editorial figures, preserve clearly identified source/date and authorized updates rather than implying automatically audited numbers.
- **CG-18-BR17:** A story about a beneficiary, donor, patient or volunteer is *not* permission to disclose their private operational records. Public photo/name/testimonial requires a legitimate approved publication basis.
- **CG-18-BR18:** Public Healthcare Assistance landing page shows approved hero, service categories, search entry, featured providers/doctors, centers and Foundation-benefit information under authorized CMS control.
- **CG-18-BR19:** Directory/search cards use **verified CG-14 center and doctor records**, status, current published services/facilities and prices. CMS configures headings and placement; does not manually maintain medical registration or scheduling.
- **CG-18-BR20:** Benefit banners use **applicable CG-17 policies** or clearly identified general promotional text. The admin controls whether the displayed percentage is eligible/current and how it is described (e.g., "up to").
- **CG-18-BR21:** Center staff may submit center-specific descriptive web content/photos through Center Portal where supported; publication remains subject to Foundation publishing authorization.
- **CG-18-BR22:** Public booking CTA availability is controlled by **actual service transaction scope**, provider eligibility and booking configuration, not merely by appearance of a prototype button.
- **CG-18-BR23:** Public health content cannot expose patient files, clinical consultations or detailed doctor/center internal financial information.
- **CG-18-BR24:** Support authorized publication of Foundation events and event updates from CG-05; the public site and public app can display approved upcoming events without duplicating event records or implying paid/event-seat booking.
- **CG-18-BR25:** Homepage hero/banner administration includes draft/active/publication state, order, desktop and optional mobile images, heading/tagline/description, accessible typography/visual treatment, optional overlay, primary/secondary CTA labels and targets, and a realistic desktop/mobile preview. These are editorial presentation controls; configuration is stored once and reflected in applicable public channels.
- **CG-18-BR26:** Public team cards and upcoming-project teasers can be configured by authorized editors with display order, image, title/role/category/location/summary, published status and approved additional public biography/recognition fields. Where linked to a member, employee or project, the owning module remains authoritative.
- **CG-18-BR27:** CG-18 owns public content/gallery and **approved CMS notice publication/ordering only**; actual media bytes, CG-19 operational notice/audience/notification delivery and all contact/helpdesk source remain CG-19. An approved CG-19 bulletin is not automatically a publicly published CG-18 page.
- **CG-18-BR28:** Central Foundation CMS controls publication of approved healthcare services, centers, doctors and healthcare benefit messaging through existing public content tools, while verification, pricing, availability and contribution rules remain owned by CG-14–17.

## CG-18-owned public navigation controls moved out of CG-21

**Business owner contract (FR-066 / CG-18-BR09):** An authorized content publisher sees three distinguishable Login/Profile, Member Join/Apply and Volunteer Join/Apply publication controls in the **CG-18 CMS/Admin content navigation** using the CareGanga C50 toggle visual vocabulary. Draft edits are not publicly effective. Preview reflects the saved candidate, and only an approved publish action updates one actual effective navigation revision for both the public website and **Public Android** via the same safe versioned public projection. Unpublish/disable hides the CTA on both surfaces and invalidates stale cache; hidden links do **not** weaken real CG-01 auth or authorized route guards.

**Independently testable before later owners:** CG-01 already provides real public authentication, so the Login/Profile toggle can be fully tested with the real CG-01 entry point. Membership and Volunteer CTAs have explicit desired publish flags but must not show an actionable link until a genuine supported CG-04 registration route exists; without CG-04, both show truthful **NOT_AVAILABLE_FOR_PUBLICATION** rather than fabricating joining or treating that absence as a failure of CG-18 CMS core. CG-04 later adds the valid target and end-to-end CTA QA. CG-21 is neither the public-toggle owner nor a future prerequisite; no duplicate system settings or fake forms.

## First usable vertical contract and regression

**Concrete acceptance:** Draft/preview/approve/publish a real editorial page and remove public exposure on unpublish; safe content works before any future healthcare or campaign owner exists. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.