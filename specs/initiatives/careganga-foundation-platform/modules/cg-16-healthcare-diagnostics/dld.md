# CG-16 — Detailed-Level Design

**Source:** [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-16-BR01–CG-16-BR10, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs · PRD N-13/HLD H-12.  
**State:** REQUIRED/DRAFT; exact schema, local Harness resolver, independent critical DB review and code QA NOT_RUN.

## Domain and data contracts

Own a cohesive typed domain/application module for **Test/package catalog, center prices, internal order, sample and released report** with one PostgreSQL business source. Proposed domain records derive from the original BR and must be frozen by exact migrations; each has UUID PK, verified owner/resource FK, status, change revision, created/updated time, appropriate unique business reference/source operation and indexed scope/status/date access. Explicitly model:
- **Test/package catalog:** source attributes/status from CG-16-BR01–CG-16-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **center prices:** source attributes/status from CG-16-BR01–CG-16-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **internal order:** source attributes/status from CG-16-BR01–CG-16-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.
- **sample and released report:** source attributes/status from CG-16-BR01–CG-16-BR10; actual owner-scoped foreign reference, UNIQUE/CHECK/NOT NULL as appropriate, optimistic version and privacy classification.

State/invariant: **Order created/collected/processing/report ready/released; No public lab checkout or release of private patient report to strangers**. Do not invent future FK rows. Additive safe migrations and controlled rollback/forward repair; correct locking/uniqueness for money, slots, stock, approvals and privileged state where applicable.

## Concrete diagnostics, patient privacy and service information

`diagnostic_test(id,code,name,category,sample_type,parameters,status)` unique approved code; `diagnostic_package(id,code,included_test_refs,fee,version,status)` has validated active test members; `center_service_price(center_ref,test_or_package,effective_period,price)` references actual CG-14 center and preserves versioned accepted quote.

`lab_order(id,real_patient_ref,center_ref,ordered_test_refs,source,quoted_amount,status)` requires current actual CG-15 patient/care relationship. `sample(id,order_ref,collection_time,processor,status)` and `lab_report(id,order_ref,private_file_ref,professional_reviewer,release_time,version,status)` represent CREATED→COLLECTED→PROCESSING→READY→AUTHORIZED_RELEASED. An uploaded result does not automatically become patient-public.

Private report access requires authenticated own-patient identity or assigned treating clinical user in that center, even on direct object/signed URL; document release/correction has new version and audit. Center Portal filters by actual center location. Non-bookable public lab/pharmacy/nursing/OT service cards remain information/contact only.

**QA:** patient linked to wrong center, unauthorized report download, sample repeated, unapproved lab release, replaced report without version, stale package rate and public CTA accidentally creating checkout.

## Specific owner contracts and source-QA

- **Catalog:** `diagnostic_test(id,code,sample_type,parameter_schema,status)`, `package(id,code,included_tests,fee_version)`, `center_test_rate(center_ref,test_or_package_ref,amount,validity)` require real CG-14 center and effective price; package changes do not rewrite accepted order amounts.
- **Internal lab:** `lab_order(id,patient_ref,center_ref,selected_test_version,status,price_snapshot)`, `sample_collection(order_ref,time,collector,state)`, `lab_report(order_ref,private_file_ref,version,released_by,released_at,status)`. A lab upload is only *result ready*; authorized professional release is a separate recorded transition, and report correction creates a new version.
- **Clinical scope:** patient-own or treatment-purpose clinician access only; center public cards show real service menu/fee and enquiry rather than unsupported online lab/medicine/nursing checkout. **QA:** duplicate order, wrong-center order read, unauthorized report release, leaked signed file, new fee during processing and old report version retrieval.

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