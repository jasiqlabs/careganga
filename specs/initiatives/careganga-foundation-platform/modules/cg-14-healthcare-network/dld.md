# CG-14 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-042, FR-043, FR-044, FR-045, FR-046, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-14-BR01–CG-14-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Provider/center and doctor professional profiles, many-center affiliation, fee/service catalog** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Provider/center and doctor professional profiles:** source attributes/status from CG-14-BR01–CG-14-BR20; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **many-center affiliation:** source attributes/status from CG-14-BR01–CG-14-BR20; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **fee/service catalog:** source attributes/status from CG-14-BR01–CG-14-BR20; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Provider/doctor pending/approved/returned/suspended, publication separate; One doctor identity across centers; no fake verified badge or public private bank info**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete provider, center, doctor and publication design

`provider(id,legal_name,verification_state,publication_state)`, `center_location(id,provider_id,address,geo,facilities,active)` distinguish independent provider centers from Foundation CG-02 operating branches. A center operator's role/scope is valid only for explicitly authorized active real locations.

`doctor(id,registration_jurisdiction,registration_number,qualification,verification_state)` identifies one verified professional across multiple centers, with scoped uniqueness for verified registration. `doctor_center(doctor_id,center_location_id,affiliation_state,service,validity)` is a many-to-many link: no duplicate doctor profile per center. `center_fee(doctor_center_id,service,amount,effective_from/to,version)` retains fee history and supplies a versioned accepted quote to CG-15.

Provider/doctor verification via CG-03 returns actual approved/rejected/returned status; source activation and publication are separately guarded. Public projections expose only verified active published center/doctor/service/fees, authenticated approved badges and genuine ratings only when a validated owner/source exists. Private bank, credential and verification documents are never public.

**QA:** doctor in two real centers, center suspended/revoked, unverifiable doctor registration, overlapping fee versions, forged location lookup, wrong-center staff update, public unpublished center, fees changing after confirmed booking and CG-01 center-options minimum fields.

## Specific owner contracts and source-QA

- **Provider & locations:** `provider(id,legal_identity,verification_state,publish_state)`, `center_location(provider_ref,actual_geo,contact,facilities,status)`, `doctor(id,professional_registration,qualification,verification_state)` and `doctor_center(doctor_ref,center_location_ref,association_status,fee_version,active_period)`; doctor professional ID is unique and **not duplicated per affiliated center**.
- **Verification/fees:** CG-03 authorized review finalizes provider/doctor verification. `center_service(center_ref,service,fee,valid_from,status)` effective-dates center-specific fees and restrictions, while CG-15 snapshots accepted prices. Provider bank/settlement credentials are protected and never in public directory.
- **Visibility/scope:** only verified and separately published active center/doctor records display, using a minimum-field public projection with no fabricated ratings, review scores or eligibility badges. CG-01 center staff receive exact location scope, not blanket clinical access. **QA:** doctor at two centers, unverified provider public link, center suspension, stale fee, guessed other-center staff file, private bank leak and publication retraction.

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