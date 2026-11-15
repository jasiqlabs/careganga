# CG-14 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-14-BR01–CG-14-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-14 owns only healthcare provider entity, physical center, professional doctor and center-specific approved associations/fees. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete provider, center, doctor and publication design

`provider(id,legal_name,verification_state,publication_state)`, `center_location(id,provider_id,address,geo,facilities,active)` distinguish independent provider centers from Foundation CG-02 operating branches. A center operator's role/scope is valid only for explicitly authorized active real locations.

`doctor(id,registration_jurisdiction,registration_number,qualification,verification_state)` identifies one verified professional across multiple centers, with scoped uniqueness for verified registration. `doctor_center(doctor_id,center_location_id,affiliation_state,service,validity)` is a many-to-many link: no duplicate doctor profile per center. `center_fee(doctor_center_id,service,amount,effective_from/to,version)` retains fee history and supplies a versioned accepted quote to CG-15.

Provider/doctor verification via CG-03 returns actual approved/rejected/returned status; source activation and publication are separately guarded. Public projections expose only verified active published center/doctor/service/fees, authenticated approved badges and genuine ratings only when a validated owner/source exists. Private bank, credential and verification documents are never public.

**QA:** doctor in two real centers, center suspended/revoked, unverifiable doctor registration, overlapping fee versions, forged location lookup, wrong-center staff update, public unpublished center, fees changing after confirmed booking and CG-01 center-options minimum fields.

## CG-14-introduced center support — CG-19 original case owner

In CG-14 US-005, reuse delivered real CG-14 center/account active affiliation and CG-01 center-scoped current role/grant to expose a minimal `getCurrentCenterSupportScope(actor)` facade consumed by **CG-19's existing support_case API**. CG-19 stores the original ticket, private sender, assignment/reply/history and keeps authoritative state transitions; CG-14 never writes its rows or clones support tables. Introduce the **smallest reviewed CG-19 source schema extension only if required** to store a true verified `center_ref`/FK after CG-14's actual center table exists, with backfill and safe authorization. Every Center A/B list, detail, attachment, status, reply, export, notification and guessed ID validates current center affiliation (including suspended account and cross-center data). A center public website FAQ may be a CG-18 published projection but has no source support-case ownership. Source QA in CG-14 US-005-QA08, no CG-14/CG-19 support dependency for CG-14 US-001–US-004.

## CG-14 introducing ownership for verified provider directory and center content (transferred CG-18 BR19/21/28)

CG-14 US-004 owns the actual public verified center/doctor directory, search, status, service/facility and current eligible fee cards for public Web/Public Android. The prior CG-18 US-004 works as **generic editorial healthcare landing without CG-14**. Once real CG-14 source is delivered, CG-14 US-004 introduces a typed permissioned/public-safe source projection into existing CG-18 approved editorial headings/card slots; it builds and tests that live directory/search UI. A suspended/unapproved doctor/center, outdated fee version, guessed provider ID or missing public consent never appears. CG-18 owns page placement/theme/publication only; neither module creates the other's provider or CMS page master.

CG-14 US-005 owns the Center Portal submit/edit of real center-specific description/photos/services/FAQ and center identity, with genuine CG-01 center-scoped permissions, CG-19 protected file and CG-03/CG-14 review. It **introduces** a source-safe public center presentation proposal/updated status into CG-18's approved content/placement process; CG-18 must not invent a center data source or publish before Foundation authorization. A center can edit its own source, not another center or live fee under CMS guise. CG-14 owned US-004/005 QA must cover public Web/Android and provider revocation/fee freshness. These are receiving-owner changes, **not a delegated approval of all CG-14 artifacts**.

## Real source integration and module-specific QA

**Critical acceptance:** Register center, verify license/business evidence, associate one doctor with two genuinely approved centers and publish only permitted fields. A doctor suspended at one center remains represented accurately at the other; center operators cannot read unrelated professional files/bank data or edit global doctor identity. Canceled/rejected center is never searchable. Fee change is versioned for future bookings, not retroactive CG-15 price rewrite.

**Contract availability:** CG-01 authenticates users, CG-02 provides real geography, CG-03 approves; CG-15 subsequently consumes doctor-center availability, CG-17 subsidy and CG-18 safe directory projection. No future booking/payment record required for provider creation.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/healthcare-network` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-042** — Foundation or center submits provider: Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-043** — Foundation verifies provider: Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-044** — Foundation or center registers doctor: Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-045** — Patient searches healthcare: Search/filter/sort doctor or center by location, specialty, facilities, availability and approved verified/partner status; view published price, map/directions, contact and real supported benefits. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-046** — Center maintains permitted presentation: Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-01, CG-03, actual CG-02 geography. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.