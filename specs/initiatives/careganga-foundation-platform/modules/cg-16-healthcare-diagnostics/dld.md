# CG-16 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-16-BR01–CG-16-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Canonical source, authorization and data ownership

CG-16 owns only test catalog, center-specific price, internal order, sample processing and signed released clinical result. All concrete database names and transactions below are authoritative; earlier planning aliases are not duplicate tables or optional alternative models. Enforce actual typed source references, resource-scope authorization, valid transitions, DB uniqueness and versioned edits. No future owner record, fake provider response or shadow financial/medical master may be inserted to make this module appear operational.

## Concrete diagnostics, patient privacy and service information

`diagnostic_test(id,code,name,category,sample_type,parameters,status)` unique approved code; `diagnostic_package(id,code,included_test_refs,fee,version,status)` has validated active test members; `center_service_price(center_ref,test_or_package,effective_period,price)` references actual CG-14 center and preserves versioned accepted quote.

`lab_order(id,real_patient_ref,center_ref,ordered_test_refs,source,quoted_amount,status)` requires current actual CG-15 patient/care relationship. `sample(id,order_ref,collection_time,processor,status)` and `lab_report(id,order_ref,private_file_ref,professional_reviewer,release_time,version,status)` represent CREATED→COLLECTED→PROCESSING→READY→AUTHORIZED_RELEASED. An uploaded result does not automatically become patient-public.

Private report access requires authenticated own-patient identity or assigned treating clinical user in that center, even on direct object/signed URL; document release/correction has new version and audit. Center Portal filters by actual center location. Non-bookable public lab/pharmacy/nursing/OT service cards remain information/contact only.

**QA:** patient linked to wrong center, unauthorized report download, sample repeated, unapproved lab release, replaced report without version, stale package rate and public CTA accidentally creating checkout.

## Real source integration and module-specific QA

**Critical acceptance:** A verified CG-15 patient receives an authorized lab order at a real CG-14 center; sample labeling, result validation and clinician release are separately authorized. A draft report must never appear in patient download or a foreign center export; corrected final report receives a new immutable revision while previous issued version remains auditable. A scanned QR validates only minimal report validity.

**Contract availability:** No standalone online OTC pharmacy or lab booking is inferred from a screenshot. CG-17 may later price/support actual services; until then CG-16 uses real center price and truthfully pending due states, not paid.

**API acceptance:** Commands validate current action + actual record scope, owner/source ref, expected revision and idempotency key on irreversible writes; responses distinguish confirmed, pending, invalid, forbidden, conflict, provider unavailable and unknown write status. Scoped options/search may show readable authorized labels without full master read. Each named story QA case traces the real channel -> request -> authorization -> transaction -> stored status -> permitted report/published view.

## Typed API and coordination

An authenticated `/api/healthcare-diagnostics` owner facade exposes business commands, filtered read-only queries, and minimal `options/search` projections for permitted selectors. Public reads require approved publication allowlist. Each PRD command contract:
- **FR-055** — Center/central Admin configures lab: Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-056** — Center books lab service internally: Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-057** — Patient/provider views service: View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.
- **FR-058** — Additional service CTA appears publicly: Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch. Validate current actor/real scope, source record/status, revision/idempotency key, and accept only a legitimate source-owner transition.

Business outcome categories: `SUCCESS/SUBMITTED_PENDING/VALIDATION/DUPLICATE/FORBIDDEN/NOT_FOUND_OR_HIDDEN/CONFLICT/UNAVAILABLE/UNKNOWN_WRITE_STATUS`. External provider failure never becomes fake success. Use a DB transaction for state+audited result, optimistic revisions or narrowly scoped row locks for races and unique source idempotency. Cross-owner effects go through typed facades, not another module's repository. Approved HLD pattern (plain state guard, policy, adapter, facade) only where actual variation justifies it; reject universal DSL, speculative microservice or duplicated ledger. No unbounded idle polling or uncontrolled retries.

## Channel, security and source QA

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

Enforce CG-01 action+resource scope at list, private detail, export, options, files and report read. Redact clinical, payroll, token, bank/PII fields in diagnostics. Verify affected Web/Android, actual DB state/rollback and links to CG-14 centers, CG-15 patients, CG-19 private reports. For each planned QA case trace UI→typed API→authorization→domain transaction→storage/provider→other clients; source code and test execution do **not** exist yet. Owner-delegated approval is blocked on local Harness gate and current PRD/HLD reapproval.