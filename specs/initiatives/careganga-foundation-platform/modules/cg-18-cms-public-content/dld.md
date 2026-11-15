# CG-18 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-066, FR-067, FR-068, FR-069, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/03-CMS-CHANNELS-BR.md) CG-18-BR01–CG-18-BR28, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38 · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Hero/content, public pages, impact, 80G, navigation, safe publication** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Hero/content:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **public pages:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **impact:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **80G:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **navigation:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **safe publication:** source attributes/status from CG-18-BR01–CG-18-BR28; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Editorial draft/reviewed/published/hidden/scheduled; CMS may not edit actual project/doctor/clinical/financial business source or claim statutory certification**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete CMS, publication and public projection

`cms_page(id,route,type,status,revision,owner)`, `content_section(id,page_ref,kind,structured_fields,sort_order)`, `hero_banner(id,media_ref,text,cta,order,mobile_media_ref)` and `publication_revision(source_ref,approved_by,effective_at,status)` separate editable draft from approved published snapshot. Support allowed CMS navigation toggles and scheduled publication without treating menu visibility as backend permission.

The source requires **all ten Our Impact content groups** (hero, pillars, statistics, growth, geography, category breakdown, focus areas, stories, updates and CTA) with content/source provenance. 80G/PAN/registration/compliance pages store actual client-approved document/validity metadata but do not prove legal certification; never publish private scanned ID or fabricated impact stat.

A public-safe **allowlist projection** reads real approved CG-05 projects, CG-14 provider/doctor, CG-07 campaign, CG-17 benefit and CG-20 aggregates from owner facades. CMS can edit captions/order/placement and gate visibility, but cannot edit fees, slot availability, professional verification, member activation, patient records or ledger source.

**QA:** draft invisible to anonymous, scheduled/expired page, unauthorized publish, changed source after preview, missing consent for beneficiary story, 80G expiry disclaimer, XSS in rich text, malicious CTA URL and Web/Public Android same published revision.

## Specific owner contracts and source-QA

- **Editorial versioning:** `cms_page(id,route,revision,editor,status)`, `content_section(page_ref,kind,order,payload,source_ref)`, `hero_banner(id,desktop_media,mobile_media,order,status)`, `publication_revision(id,source_ref,approved_by,approved_at)`; draft, reviewed, published and scheduled versions are distinct and reversible.
- **Source projections:** published team/project/doctor/provider/benefit/impact figures use a **verified field allowlist from their real owners**; CMS may arrange/describe but not alter those masters or publish beneficiary/patient stories without privacy basis. If CG-14/17 or CG-20 are not implemented, no fictional provider cards/discount/statistics are rendered. 80G/PAN legal metadata remains editable evidence with current validity review, not automatic certification.
- **QA:** unpublished hero visibility, scheduled publish while approval revoked, source project suspended after public post, fake 80G claims, menu Login/Join toggle, indexed private page, publication preview/rollback and tenant media ACL.

## Typed API and coordination

An authenticated `/api/cms-public-content` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-066** — Admin edits Foundation site: Manage homepage, About/Our Work, projects, team, hero images/typography, CTAs, website navigation and public Login/Join visibility with authorized preview/publish controls. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-067** — Admin edits NGO impact/transparency: Publish editable Impact groups, geography/charts/stories with appropriate provenance; maintain 80G/PAN/registration, annual and financial disclosure pages/documents. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-068** — Admin publishes reusable content: Manage galleries, videos, publications, media, articles, updates, events, notices and public enquiries with controlled fields, review, ordering, preview and status. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-069** — Healthcare content is published: Show approved directory/category cards, provider profiles, doctors, current price/facility/benefit messaging; don't allow CMS to overwrite provider verification, scheduling or contribution ownership. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U23, U24, U25, U26, U27, U28, U29, U30, C20, C21, C22, C23, C24, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C36, C37, C38. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-19 media, CG-03 content review, real source projections. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.