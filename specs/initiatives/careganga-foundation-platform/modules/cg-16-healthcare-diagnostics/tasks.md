# CG-16 — Full-stack stories and 80 manual source QA

**Source:** [module](module.md), [DLD](dld.md), [UIUX H08-H10](uiux.md), [PRD FR055-058/082](../../prd.md), [HLD](../../hld.md), [BR CG-16-BR01-14](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md), D-01/04/17/22/26/27/28, [canonical tracker row 19](../../DEVELOPMENT_ORDER.md). H08-H10 are actual user-supplied additional healthcare Admin UI references, NOT working clinical/Android proof.

**QA status:** all 80 QA cases PLANNED/NOT_RUN. Delegated design content only; real code, database migrations, independent qualified CRITICAL DB/clinical/privacy review, clinical staff credential proof, authenticated Harness resolver, Web/Center Portal/Public Android/Internal Android/Play/pixel/motion/security/p95/idle tests NOT_RUN. Never imply production, licensed diagnostics or runtime PASS.

**Execution:** Verify actual CG01/14/19 owners. US001 real catalogue → US003 public menu → US004 mapped contact with ERP OFF; US005 independently with true CG14/19 and ERP ON+grant, no patient/order; US002 separately after US001 and real CG15 consented patient + CG14 LAB ERP center + CG19 clinical file and actual qualified reviewer. Every story covers real source DB, NestJS guards, Web/Center Portal, Public Website/native Android or explicit N/A, Internal Android assigned or N/A and NFR. Implement → expert review → fix → re-review → trace every labeled case file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE/NOT_APPLICABLE in the only mutable execution status, never fabricated QA PASS. No CI/GH Actions.

## Approved task definitions

### US-001 — Approved test/package master and real center tariff

Outcome: Create one source-owned test/package/category and effective center commercial price with global ERP OFF.
Requirements: FR-055, BR01-03/11, H08/H09, D-17/22/26/28, N-01/02/04/05/06/09/10/11/12/13.
Scope: CG16 original test/package/mapping/price DB and NestJS, CG14 actual provider, CG03 optional rate review, Foundation Admin H09, Center Portal own rates; public test read US003, Internal Android full Admin editor N/A.
Acceptance: Real test and price work with no CG15 patient/US002 operations/CG17 finance and preserve original accepted revisions.

QA cases (16 individually PLANNED scenarios):
- **US-001-QA01 — manual/source:** Real Foundation catalog admin creates uniquely coded test with sample category and true CG14 lab while Lab ERP OFF and no CG15 patient.
- **US-001-QA02 — manual/source:** Center Portal lab staff edits only own approved center mapping and tariff, cannot edit Foundation global test master.
- **US-001-QA03 — manual/source:** Wrong root, unverified center, expired license, revoked role and guessed test/price ID are rejected in backend list/write/export.
- **US-001-QA04 — manual/source:** Concurrent duplicate test code creation, same idempotency key replay and changed payload digest cannot create second master.
- **US-001-QA05 — manual/source:** Package with true active included tests and exact approved component quantity is stored as immutable effective version.
- **US-001-QA06 — manual/source:** Empty, cyclic, expired, foreign-root or inactive package components are rejected with clear field errors.
- **US-001-QA07 — manual/source:** One approved test is mapped to two current CG14 lab locations with independently configured allowed pricing.
- **US-001-QA08 — manual/source:** Two overlapping APPROVED effective tariff revisions for one center test are rejected by unique/range or locked CAS.
- **US-001-QA09 — manual/source:** Changed approved test/price does not reprice an already accepted real internal order or historic catalogue event.
- **US-001-QA10 — manual/source:** Partner published base and patient price are not CG17 Foundation discount or proof of patient paid, no CG09 journal.
- **US-001-QA11 — manual/source:** Configured sensitive rate approval requires genuine CG03 case and same frozen revision, stale or self-approval rejected.
- **US-001-QA12 — manual/source:** Center suspension or test deactivation removes public offer without deleting historical accepted price/document records.
- **US-001-QA13 — manual/source:** H09 list/categories/tabs/test details/mapping/prices/KPIs/search/drawer duplicate/deactivate actions use real data not screenshot demo.
- **US-001-QA14 — manual/source:** H09 Import requires actual temporary authorized import capability and explicit validation; otherwise hidden, export scoped.
- **US-001-QA15 — manual/source:** Lab ERP OFF leaves authorized H09 test/package/price and public catalogue available while clinical/order/quality endpoints fail closed.
- **US-001-QA16 — manual/source:** Source trace Foundation Web and Center Portal to NestJS root guard, original CG14 mapping, Postgres test/package/price constraints; actual SQL/device tests NOT_RUN.

Verification: For each US-001-QA01-QA16 manually trace actual H08/H09/H10 applicable Foundation Web/Center Portal/Public Website/native Public Android/Internal Android or explicit N/A → CG01 role/root+CG14 center and actual CG15 consent when used → NestJS controller/owner facade → source-keyed PostgreSQL uniqueness/CAS/transaction and original CG19 private report/file when used → other authorized client and truthful success/conflict/unknown/disabled result. Record exact file:function and evidence; independent SQL/device/pixel/medical/perf QA NOT_RUN.
Dependencies: None

### US-002 — Center lab order, specimen custody and signed result

Outcome: Verified enabled lab performs original patient-consented internal test and immutable custody, licensed independent report approval, protected professional release.
Requirements: FR-056/082, BR04-07/11/12/14, H10, D-01/04/22/26/27, N-01/02/04/05/06/09/10/11/12/13.
Scope: CG16 original order/lines/specimens/custody/result/release DB, actual CG14 LAB ERP center license, CG15 patient consent, CG19 report file; Center Portal clinical operations, Foundation oversight, Public Web/native Android only real released report, Internal Android assigned evidence only.
Acceptance: Flag ON plus current clinical readiness, no public lab checkout or fake PAID/DELIVERED, legal read after OFF; no CG17 or US005 required.

QA cases (16 individually PLANNED scenarios):
- **US-002-QA01 — manual/source:** Real enabled licensed CG14 center and CG15 consented patient allow one original current US001 test/package internal order.
- **US-002-QA02 — manual/source:** Flag OFF, center capability OFF, expired lab license, unready code or wrong center role deny new clinical order/sample/report actions.
- **US-002-QA03 — manual/source:** Public Website or Public Android cannot create lab booking or payable by calling an internal sample endpoint.
- **US-002-QA04 — manual/source:** Center A technician cannot list or order for Center B patient without actual care consent, even knowing Virtual Patient ID.
- **US-002-QA05 — manual/source:** Accepted order expands actual package test lines with immutable current approved price/source rather than CG17 payment receipt.
- **US-002-QA06 — manual/source:** One order with several specimen types creates genuine distinct sample labels linked to its original order lines.
- **US-002-QA07 — manual/source:** Two concurrent callbacks for one label/custody step create only one source event with safe replay or stale conflict.
- **US-002-QA08 — manual/source:** Rejected contaminated or missing sample cannot skip recollection to processing or clinically approved release.
- **US-002-QA09 — manual/source:** Original CG19 private file upload changes result to RESULT_READY only, not reviewed, released or delivered.
- **US-002-QA10 — manual/source:** Clinician reviewer must have actual valid credentials, discipline/center authorization and report-release role.
- **US-002-QA11 — manual/source:** Processing operator cannot self-approve when real separation policy requires independent sign-off.
- **US-002-QA12 — manual/source:** Expired reviewer license, wrong root, mismatched report digest or stale revision cannot finalize professional release.
- **US-002-QA13 — manual/source:** After true valid approval and original CG19 document issuance, only owning CG15 patient or treating clinician may download.
- **US-002-QA14 — manual/source:** Corrected result generates new immutable revision, new licensed review and distinct CG19 issue preserving prior audit.
- **US-002-QA15 — manual/source:** Result uploaded, professionally released, and message delivered have separate genuine source statuses and outbox evidence.
- **US-002-QA16 — manual/source:** After Lab ERP OFF, no new order/review workers run but prior legally released patient report remains restricted and readable.

Verification: For each US-002-QA01-QA16 manually trace actual H08/H09/H10 applicable Foundation Web/Center Portal/Public Website/native Public Android/Internal Android or explicit N/A → CG01 role/root+CG14 center and actual CG15 consent when used → NestJS controller/owner facade → source-keyed PostgreSQL uniqueness/CAS/transaction and original CG19 private report/file when used → other authorized client and truthful success/conflict/unknown/disabled result. Record exact file:function and evidence; independent SQL/device/pixel/medical/perf QA NOT_RUN.
Dependencies: US-001

### US-003 — Publish safe lab tests and real price

Outcome: Public Website and native Public Android offer approved center-specific test/package menus with source-valid tariff and no clinical/private information.
Requirements: FR-057 catalogue, BR02/06-10, H08/H09, D-01/22/26, N-01/02/04/05/06/09/10/11/12/13.
Scope: CG16 public safe allowlist projection of US001 and actual published CG14 center; Foundation/Center preview; public Web/native parity; protected patient report integration introduced by US002 only.
Acceptance: With Lab ERP OFF, no US002/CG15 patient, payable, Foundation contribution or ghost clinical report.

QA cases (16 individually PLANNED scenarios):
- **US-003-QA01 — manual/source:** Current published CG14 lab with approved US001 test and tariff is listed in Public Website and native Public Android while ERP OFF.
- **US-003-QA02 — manual/source:** No CG15 patient, US002 samples, CG17 settlement or lab worker needed for approved public test catalogue.
- **US-003-QA03 — manual/source:** Two centers with same test show distinct actual location, tariff, validity and approved patient commercial discount.
- **US-003-QA04 — manual/source:** Unpublished center, expired rate or inactive mapping hides current public offer without reverting to outdated price.
- **US-003-QA05 — manual/source:** Public test search and category filter use bounded safe fields and never expose patient/specimen/results.
- **US-003-QA06 — manual/source:** Authenticated patient without released report sees honest empty reports while catalogue remains available.
- **US-003-QA07 — manual/source:** Actual US002 released report may later appear under verified own CG15 patient and CG19 permission, no US002 prerequisite now.
- **US-003-QA08 — manual/source:** Guessed order ID or report label through public test API cannot expose protected patient or technician data.
- **US-003-QA09 — manual/source:** Public Web and Public Android support equivalent real test filter, center selection, detail, price and unavailable states.
- **US-003-QA10 — manual/source:** H08 mapped popular test overlay and H09 active price summary reflect actual source, not example numbers.
- **US-003-QA11 — manual/source:** Displayed patient price is a commercial partner rate, not Foundation support, received cash or verified settlement.
- **US-003-QA12 — manual/source:** Test description is informational and never generates diagnosis or analyzer interpretation.
- **US-003-QA13 — manual/source:** CG14 provider with no CG16 test stays discoverable in independent provider directory and shows no approved tests.
- **US-003-QA14 — manual/source:** Foundation/Center Portal preview reflects current eligible published tariff and grants, not another center private rates.
- **US-003-QA15 — manual/source:** Price changes during public view re-evaluate current source and any later internal order rechecks accepted revision.
- **US-003-QA16 — manual/source:** Source trace public safe projection CG14/CG16 to Web/native with root mapping and privacy; live/browser/device QA NOT_RUN.

Verification: For each US-003-QA01-QA16 manually trace actual H08/H09/H10 applicable Foundation Web/Center Portal/Public Website/native Public Android/Internal Android or explicit N/A → CG01 role/root+CG14 center and actual CG15 consent when used → NestJS controller/owner facade → source-keyed PostgreSQL uniqueness/CAS/transaction and original CG19 private report/file when used → other authorized client and truthful success/conflict/unknown/disabled result. Record exact file:function and evidence; independent SQL/device/pixel/medical/perf QA NOT_RUN.
Dependencies: US-001

### US-004 — Lab-specific enquiry on existing provider

Outcome: Add source-backed test-specific contact/enquiry only to original published CG14 lab profile and optional CG18 placement.
Requirements: FR-058, BR08-10, H08, D-01/17/22/26, N-01/02/04/05/06/09/10/11/12/13.
Scope: CG16 safe lab CTA, actual CG14 center contact/current source and optional existing CG19 helpdesk or CG18 editorial; Public Web/native same options, Foundation H08 overlay, Internal Android N/A; no duplicate CG14 center.
Acceptance: ERP OFF genuine Enquire works without lab order, public checkout, CG17 payment, CG18 CMS dependency.

QA cases (16 individually PLANNED scenarios):
- **US-004-QA01 — manual/source:** Existing CG14 published lab with approved mapped test shows lab-specific View Tests and Enquire links with ERP OFF.
- **US-004-QA02 — manual/source:** CG14 provider page continues independently even when CG16 catalogue is absent, without fake test enquiry.
- **US-004-QA03 — manual/source:** CG18 generic editorial healthcare content remains independent and only places live CG16 CTA when available.
- **US-004-QA04 — manual/source:** Multi-location organization enquiry requires explicit correct CG14 center and current source-specific contact.
- **US-004-QA05 — manual/source:** Suspended center, unpublished test or expired price immediately removes specific active CTA and raw link access.
- **US-004-QA06 — manual/source:** Public lab enquiry is contact information or actual CG19 general request, never lab order or checkout.
- **US-004-QA07 — manual/source:** Persisted enquiry reuses genuine existing CG19 helpdesk source with safe duplicate replay and spam guard.
- **US-004-QA08 — manual/source:** WhatsApp or email send claims require actual configured approved provider and real recipient source.
- **US-004-QA09 — manual/source:** Changed center contact is fetched from current CG14 source, not duplicated into lab test master.
- **US-004-QA10 — manual/source:** Public visitor never sees lab private bank, license evidence, patients or sample/report status by enquiry URL.
- **US-004-QA11 — manual/source:** Public Web and native Public Android show same true enquiry/link/center/price and no Book Lab Test action.
- **US-004-QA12 — manual/source:** Foundation H08 lab detail combines CG14 center profile with CG16 mapped tests, no cloned lab provider editor.
- **US-004-QA13 — manual/source:** Internal Android generic lab enquiry and global Admin controls are NOT_APPLICABLE under D17.
- **US-004-QA14 — manual/source:** Lab ERP OFF preserves lab-specific public contact but disables private H10 sample/order/report clinical controls.
- **US-004-QA15 — manual/source:** Enquiry URL is allowlisted and validated against injection, open redirect, unsafe host or forged sender.
- **US-004-QA16 — manual/source:** Source trace CG14 publication, CG16 mapping, optional CG18 placement and CG19 request, no CG17 payout or patient booking.

Verification: For each US-004-QA01-QA16 manually trace actual H08/H09/H10 applicable Foundation Web/Center Portal/Public Website/native Public Android/Internal Android or explicit N/A → CG01 role/root+CG14 center and actual CG15 consent when used → NestJS controller/owner facade → source-keyed PostgreSQL uniqueness/CAS/transaction and original CG19 private report/file when used → other authorized client and truthful success/conflict/unknown/disabled result. Record exact file:function and evidence; independent SQL/device/pixel/medical/perf QA NOT_RUN.
Dependencies: US-001

### US-005 — Optional equipment readiness and quality evidence

Outcome: Grant-enabled own laboratory maintains signed instrument/maintenance and quality evidence without hospital stock/ERP procurement.
Requirements: FR-082, BR13/14, H08/H10, D-17/22/26/27, N-01/02/04/05/06/09/10/11/12/13.
Scope: CG16 original equipment/event/quality DB, CG14 verified lab grant, CG19 document, Center Portal own actions, Foundation scoped conditional overview and Internal Android only genuinely assigned evidence, Public no editor.
Acceptance: Lab ERP ON required; no US001 test master, US002 patient/order, CG15/17 prerequisite and no CG12 Foundation stock shadow.

QA cases (16 individually PLANNED scenarios):
- **US-005-QA01 — manual/source:** Verified enabled CG14 LAB ERP center with CG19 evidence creates equipment readiness record without US002 orders or CG15 patient.
- **US-005-QA02 — manual/source:** Flag OFF, suspended lab, wrong root or missing center capability forbids equipment/new quality actions and due workers.
- **US-005-QA03 — manual/source:** Concurrent same center equipment code insert and replay produce one original record with unique key.
- **US-005-QA04 — manual/source:** Equipment readiness requires qualified genuine inspection or validated maintenance proof, not image-implied READY.
- **US-005-QA05 — manual/source:** Expired calibration or out-of-service decision changes status without changing any CG12 stock quantity.
- **US-005-QA06 — manual/source:** Two concurrent maintenance edits use expected revision and one immutable original audit event.
- **US-005-QA07 — manual/source:** Maintenance and quality evidence upload via original protected CG19 file validates MIME, scan and authorization.
- **US-005-QA08 — manual/source:** Another center clinician cannot access source quality document or sign its review through guessed ID.
- **US-005-QA09 — manual/source:** H08 accreditation badge cannot imply NABL verification unless CG14 actual valid license source confirms.
- **US-005-QA10 — manual/source:** CG16 equipment is not CG12 stock SKU, warehouse, purchase or supplier master and cannot create stock transactions.
- **US-005-QA11 — manual/source:** Foundation Web scoped quality summary and Center Portal permitted edit, Internal Android only explicitly assigned capture.
- **US-005-QA12 — manual/source:** Indexed due maintenance reconciliation only scans actual ON+grant-active centers with eligible work, no idle per-center traffic.
- **US-005-QA13 — manual/source:** Switching ERP OFF preserves legally retained file/audit but refuses new maintenance and equipment actions.
- **US-005-QA14 — manual/source:** US002 sample order cannot depend on universal US005 equipment unless genuine test-specific clinical policy requires it.
- **US-005-QA15 — manual/source:** Quality evidence is private and never published as medical diagnosis, patient report, or public test description.
- **US-005-QA16 — manual/source:** Source trace conditional H08/H10 menus through role/capability guard, actual own DB and CG19 document; runtime QA NOT_RUN.

Verification: For each US-005-QA01-QA16 manually trace actual H08/H09/H10 applicable Foundation Web/Center Portal/Public Website/native Public Android/Internal Android or explicit N/A → CG01 role/root+CG14 center and actual CG15 consent when used → NestJS controller/owner facade → source-keyed PostgreSQL uniqueness/CAS/transaction and original CG19 private report/file when used → other authorized client and truthful success/conflict/unknown/disabled result. Record exact file:function and evidence; independent SQL/device/pixel/medical/perf QA NOT_RUN.
Dependencies: None

## Execution progress
- **US-001: IN_PROGRESS | owner-authorized PROVISIONAL_SOURCE_DEVELOPMENT; current design content DELEGATED_APPROVED only; formal RESOLVER_NOT_RUN; independent specialist and runtime NOT_RUN.** CG-16 migration 1601 includes Foundation-scoped category, test/revision, package/immutable lines, center mapping, tariff range-exclusion, idempotent source key and immutable audit event. DiagnosticsCatalogService/Controller, CG14 verified lab source facade, CG01 diagnostics capability keys and protected Web BFF are committed. H09 original-pattern Foundation Admin and restricted own Center Portal plus dedicated role-hidden lab pricing entry point are committed. This is not actual SQL, backend, Web or Android execution.
- **Original 16-case SOURCE-only disposition as of branch commit ebbe321803e1bc1ca1d6b2966e395cfde3869af0: 9 SOURCE_VERIFIED / 6 SOURCE_GAP / 1 NOT_VERIFIABLE / 0 executed runtime QA PASS.** Each classification records code-source existence only:
  - **US-001-QA01 SOURCE_VERIFIED** — DiagnosticsCatalogService.createCategory/createTest; test_category, diagnostic_test, immutable test_revision, protected H09; no patient/ERP prerequisite.
  - **US-001-QA02 SOURCE_VERIFIED** — HealthLabCatalogSourceFacade.assertLab and DiagnosticsCatalogService.mapItem/proposePrice; MyLabPricingWorkspace/CenterLabPricingPanel honor current assigned-center + pricing action, no global edit.
  - **US-001-QA03 SOURCE_GAP** — CG-01 current root/grant + CG-14 verified/enabled center checks exist; current license-expiry invalidation and negative-case proof remain untraced.
  - **US-001-QA04 SOURCE_VERIFIED** — Postgres root unique test code; lab_catalog_command digest, DiagnosticsCatalogService.command/done, duplicate 23505 conflict; SQL race NOT_RUN.
  - **US-001-QA05 SOURCE_VERIFIED** — DiagnosticsCatalogService.createPackage active tests, diagnostic_package_line exact test revision FK, immutable snapshot/line triggers.
  - **US-001-QA06 SOURCE_GAP** — Empty/duplicate/inactive/foreign components rejected; no nested cycles; test expiry policy and wording not evidenced.
  - **US-001-QA07 SOURCE_VERIFIED** — lab_center_test_mapping scoped uniqueness permits independent verified labs; lab_center_price_version per mapping; Foundation and center UI owners.
  - **US-001-QA08 SOURCE_VERIFIED** — Postgres exclusion cg16_approved_price_no_overlap, mapping row lock, independent approvePrice self-approval rejection; concurrency execution NOT_RUN.
  - **US-001-QA09 NOT_VERIFIABLE** — Historic test/approved price snapshots immutable but no real accepted Lab ERP US-002 order exists for repricing regression.
  - **US-001-QA10 SOURCE_VERIFIED** — Commercial base/patient minor amounts only in CG16 store/UI, no CG17 benefits, patient PAID, or CG09 journal writes.
  - **US-001-QA11 SOURCE_GAP** — Separate price approval and self-approval denial exist, configured original CG03 immutable approval-case adapter not implemented.
  - **US-001-QA12 SOURCE_GAP** — Protected current lab/test checks and historical immutable pricing exist; CG16 US003 public-offer withdrawal projection does not yet exist.
  - **US-001-QA13 SOURCE_VERIFIED** — LabTestMasterWorkspace H09 source KPI/list/test tabs/category/package/center mapping/price/deactivation; actual screenshot/device VISUAL_NOT_RUN.
  - **US-001-QA14 SOURCE_GAP** — Import hidden; CSV of up to 100 visible role-filtered rows is escaped, fresh server-authorized export and temporary import policy missing.
  - **US-001-QA15 SOURCE_GAP** — Catalogue API never checks Lab ERP flag, and no operational ERP APIs added; US003 public catalogue with ERP OFF and runtime guard tests pending.
  - **US-001-QA16 SOURCE_VERIFIED** — Protected Admin and own-center routes -> same-origin diagnostics BFF -> Nest DiagnosticsCatalogController -> CG01 current grant/CG14 lab -> root-scoped SQL command+audit; runtime NOT_RUN.
- **Review/fix/re-review:** Independently re-read selected branch source and confirmed resolvable local imports, balanced named H09 JSX elements, backend/module wiring and no unresolved merge markers; repaired view-only pricing access, separate lab staff entry point, scoped current-center H09 pending-save state, and atomic original audit events. No qualified independent clinical/CRITICAL DB/security/human visual signoff was performed. Original H09 exact client rendered pixel/motion QA, PostgreSQL migration/backup/restore/races, backend/Next/Expo builds, current-hash Harness resolver, auth provider/storage integration, performance and accessibility remain NOT_RUN.
- **Pending source work:** configured CG03 price approval adapter, verified license-expiry source policy, component expiry semantics, CG16 US003 future-owned public publication/withdrawal parity, server-authorized bounded export/conditional import. US-001 remains IN_PROGRESS, not SOURCE_COMPLETE or ready for main/production. Internal Android global H09 editor N/A under D-17; CG16 US003 owns public Android test directory. Do not alter existing US-002–005 execution statuses or approvals.json.
- US-002: BLOCKED | DELEGATED_DESIGN_APPROVED_CONTENT_ONLY; authenticated Harness and independent CRITICAL DB/clinical/security SQL and runtime NOT_RUN; real code/owner prerequisites NOT_VERIFIED/NOT_STARTED; 16 manual/source scenarios, actual Web/Center Portal/Public Android/Internal Android/database/Play/pixel/motion/NFR tests NOT_RUN.
- US-003: BLOCKED | DELEGATED_DESIGN_APPROVED_CONTENT_ONLY; authenticated Harness and independent CRITICAL DB/clinical/security SQL and runtime NOT_RUN; real code/owner prerequisites NOT_VERIFIED/NOT_STARTED; 16 manual/source scenarios, actual Web/Center Portal/Public Android/Internal Android/database/Play/pixel/motion/NFR tests NOT_RUN.
- US-004: BLOCKED | DELEGATED_DESIGN_APPROVED_CONTENT_ONLY; authenticated Harness and independent CRITICAL DB/clinical/security SQL and runtime NOT_RUN; real code/owner prerequisites NOT_VERIFIED/NOT_STARTED; 16 manual/source scenarios, actual Web/Center Portal/Public Android/Internal Android/database/Play/pixel/motion/NFR tests NOT_RUN.
- US-005: BLOCKED | DELEGATED_DESIGN_APPROVED_CONTENT_ONLY; authenticated Harness and independent CRITICAL DB/clinical/security SQL and runtime NOT_RUN; real code/owner prerequisites NOT_VERIFIED/NOT_STARTED; 16 manual/source scenarios, actual Web/Center Portal/Public Android/Internal Android/database/Play/pixel/motion/NFR tests NOT_RUN.
