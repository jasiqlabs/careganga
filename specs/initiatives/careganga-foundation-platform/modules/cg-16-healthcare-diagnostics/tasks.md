# CG-16 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-055, FR-056, FR-057, FR-058, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Manage diagnostic test master, codes/category/sample type, center-specific…

Outcome: Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history.
Requirements: FR-055, CG-16-BR01, CG-16-BR02, CG-16-BR03; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the relevant original Admin/Center Portal + public safe Web/native consumer and NestJS/PostgreSQL workflow. Implement all required BR fields, real references and domain rules, with real source owners and no mock future owners.
Acceptance: Create real center test/package catalog with sample type, category, approved price and version. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-001-QA01:** Given correctly scoped actor and genuine delivered owner records, create real center test/package catalog with sample type, category, approved price and version. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-001-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — business regression:** Unsupported test or unapproved center price is not offered as orderable. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-001-QA08 — Healthcare source-specific boundary:** Admin edits a test code and package test list while a previous lab order is already accepted; historic order shows original included parameters and fee, current public published price follows approved effective version.
- **US-001-QA09 — Disabled ERP catalog independence:** Global Lab ERP OFF and no CG-15 patient or CG-19 report; verified CG-14 approved lab still adds genuine test master/pricing and searchable H09 catalog, no sample/report buttons/API or due workers.
- **US-001-QA10 — Center-specific price approval:** Two verified labs publish distinct approved test price/discount effective revisions; wrong center cannot alter another's price, two reviewer concurrent updates select one effective date revision and historical price retained.
- **US-001-QA11 — Original H09 full-stack UI:** Check real test category/sample type/name/code, right pricing/lab mapping tabs, scoped search/filter/export, Center Portal and public safe display; global ON alone cannot grant sample permissions, no invented stock/booking counts.
- **US-001-QA12 — Canonical DB and NFR:** Composite root/center test/price FK, unique code and valid time/amount, index scoped list and rollback; flags OFF avoid worker/tenant scans; actual SQL/EXPLAIN/render/device QA NOT_RUN.
Verification: On actual implementation source-trace US-001-QA01–QA12 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Create authorized patient test/package order and track collection…

Outcome: Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state.
Requirements: FR-056, CG-16-BR04, CG-16-BR05, CG-16-BR06, CG-16-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the relevant original Admin/Center Portal + public safe Web/native consumer and NestJS/PostgreSQL workflow. Implement all required BR fields, real references and domain rules, with real source owners and no mock future owners.
Acceptance: Order test for verified patient, track sample and release actual validated report with provider signature/status. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-002-QA01:** Given correctly scoped actor and genuine delivered owner records, order test for verified patient, track sample and release actual validated report with provider signature/status. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-002-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — business regression:** Draft/unreviewed result cannot appear to public patient or wrong center. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-002-QA08 — Healthcare source-specific boundary:** Center staff receives patient test order, collects sample, uploads a private result and requests professional release; upload alone leaves it unreleased, authorized clinician release changes source state and records version/time.
- **US-002-QA09 — Global OFF and center grant:** With `CAREGANGA_ERP_LAB_ENABLED=false` or missing, block order/sample/result API and H10 Lab ERP actions regardless of Super Admin/Center A grant; continue H09 price catalog and permitted historical lawful report access.
- **US-002-QA10 — Live consent and release privilege:** Global ON, center approved and licensed, real CG-15 consented patient, generate order/collect actual sample, independent approved professional reviews correct CG-19 report version; technician cannot release or read unrelated patient/center.
- **US-002-QA11 — Replay/concurrent sample and report:** Duplicate collection callback, stale reviewed digest, two simultaneous release attempts and result PDF upload failure yield one immutable event/issued current report, true pending/reject recovery, no fake paid or delivered state.
- **US-002-QA12 — Original H10 private screen and QA:** H10 sample/booking status list and right patient/sample/report/history panel, authorized original report download, cross-root/center export denied; actual DB migration/restore/clinical reviewer/pixel/native QA NOT_RUN.
Verification: On actual implementation source-trace US-002-QA01–QA12 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — View published lab/service menus, real price and discounts where authorized

Outcome: View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician.
Requirements: FR-057, CG-16-BR06, CG-16-BR07, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the relevant original Admin/Center Portal + public safe Web/native consumer and NestJS/PostgreSQL workflow. Implement all required BR fields, real references and domain rules, with real source owners and no mock future owners.
Acceptance: Expose approved lab service menus and genuine price/discount accurately, without fake booking or payment result. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-003-QA01:** Given correctly scoped actor and genuine delivered owner records, expose approved lab service menus and genuine price/discount accurately, without fake booking or payment result. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-003-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — business regression:** Stale invalid fee or unapproved discount cannot become confirmed total. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-003-QA08 — Healthcare source-specific boundary:** Authorized patient opens own released report and center clinician with actual care relationship sees it; guessed signed URL and staff from another center cannot access unapproved or private report.
- **US-003-QA09 — Real independence from Lab ERP:** With global Lab ERP OFF, genuine approved test categories/center prices and basic public safe lab service menu remain available without US-002 order/sample source.
- **US-003-QA10 — No fake report or checkout:** An anonymous public user cannot create internal lab sample/paid booking or access private report by test catalog request, with global ON or OFF; only authenticated entitled patient can retrieve genuine existing report when permitted.
- **US-003-QA11 — Price/source privacy and revocation:** Invalidated lab/test price or suspended CG-14 center immediately removes approved public price/enquiry projection, retaining old protected internal reference and no cross-center private data.
- **US-003-QA12 — Cross-channel UI and QA:** H09 real mapped test/pricing data vs public Next.js/native Public Android current lab catalog/enquiry; unknown price/offline/consent/unavailable state, accessible original CareGanga responsive design; runtime visual NOT_RUN.
Verification: On actual implementation source-trace US-003-QA01–QA12 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001 genuine approved test/master/price and CG-14 provider; **no US-002 sample/report workflow or optional ERP activation**.

### US-004 — Show approved center/service information with enquiry/contact actions

Outcome: Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch.
Requirements: FR-058, CG-16-BR08, CG-16-BR09, CG-16-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-16 owns the relevant original Admin/Center Portal + public safe Web/native consumer and NestJS/PostgreSQL workflow. Implement all required BR fields, real references and domain rules, with real source owners and no mock future owners.
Acceptance: Publish only approved center/service info and real enquiry contact action, not invented pharmacy/order features. Actual authorization, concurrency/replay, Web/native and original CareGanga UI states are verified against authoritative source; no technical IDs or fake downstream records.
QA cases:
- **US-004-QA01:** Given correctly scoped actor and genuine delivered owner records, publish only approved center/service info and real enquiry contact action, not invented pharmacy/order features. Expected: true Web/Android state (where applicable), one guarded DB commit or explicit pending result, secure audit and no fabricated integration.
- **US-004-QA02:** Unrelated, unauthorized or revoked actor tries Web/native deep link, guessed resource ID, selector or export → protected API denies without any data leak or mutation.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable real owner/provider or uncertain response → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — business regression:** Unpublished provider and leaked patient clinical data are blocked from directory. Verify persisted state after race/retry, scoped response and other-client/report consistency.
- **US-004-QA08 — Healthcare source-specific boundary:** Public center card for lab/medicine/nursing displays verified service, applicable contact and any approved information-only benefit; unsupported online checkout or fabricated price is not clickable.
- **US-004-QA09 — Base directory while Lab ERP OFF:** Real verified lab and current CG-14 service category displays public listing/contact only; no ERP room/equipment/staff/sample/booking or fabricated discount.
- **US-004-QA10 — Partner approval and search:** Unknown/expired/rejected lab cannot publish, scoped center/service/geo filters use verified source, safe public contact, no patient record access.
- **US-004-QA11 — Future optional ERP isolation:** Activate Lab ERP in Center A only; public lab enquiry still works for Center B with no grant, and direct API sample/report calls to Center B denied.
- **US-004-QA12 — Directory regression and source QA:** Original H08 verified lab listing, H09 price and public Next.js/native safe cards preserve CG-14 directory with CG-16 optional module OFF/ON, no duplicate lab master, runtime/source code not yet verified.
Verification: On actual implementation source-trace US-004-QA01–QA12 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-005 — Maintain optional lab equipment readiness and quality/compliance evidence

Outcome: With actual enabled Lab ERP, verified partner center owns real lab equipment/readiness, maintenance due and QA evidence, without duplicating CG-12 Foundation inventory or automatically generating clinical diagnoses. Catalog US-001 and directory US-004 work without US-005.
Scope: CG-16 owns `lab_equipment`, protected equipment maintenance and quality source events, original CG-19 document refs and real CG-14 center consent/licensing verification. Center Portal/Admin H08/H10 supplemental Equipment & Inventory and Quality & Compliance options, no new native clinical equipment editor or future CG-20 dependency.
Acceptance: Current scoped authorized lab adds real equipment, records signed service/maintenance, restricted quality evidence and readiness; an unavailable/expired equipment is not reported ready. Global `CAREGANGA_ERP_LAB_ENABLED=false` prevents all equipment actions/jobs, preserves legally permitted past history and genuine partner listing.

Manual QA cases (all PLANNED / NOT_RUN):
- **US-005-QA01:** Verified CG-14 Lab Center A with global ON and approved LAB_ERP grant creates one genuine equipment record with human code, owner and licensed location.
- **US-005-QA02:** With global OFF/missing, no equipment/quality menu, private list/create/worker/export API available; existing test/price enquiry remains unaffected.
- **US-005-QA03:** Global ON but Center B without LAB_ERP grant is denied equipment list/write and does not see Center A's service/QA documents.
- **US-005-QA04:** Equipment maintenance event with authorized worker/service time, next due and document proof updates genuine readiness only; stale date/actor denied.
- **US-005-QA05:** Concurrent two quality readiness approvals with old version produce one accepted result and immutable decision/evidence history, not silent overwrite.
- **US-005-QA06:** CG-19 evidence validates source, MIME/scan and permissioned view/download; private equipment documentation cannot appear on public lab or native cards.
- **US-005-QA07:** Qualitative readiness/expiry status on H08/H10 applies only to actual center equipment, never clinical interpretation or invented analyzer/LIS data.
- **US-005-QA08:** Revoked role, suspended lab or expired license immediately denies new maintenance/quality changes, keeps lawful view/history and current approved public test catalog appropriately scoped.
- **US-005-QA09:** Malformed equipment code/location, duplicate original maintenance event and invalid quality approval fail with source-safe validation/no duplicate worker notification.
- **US-005-QA10:** Bounded index(root,center,due_at) processes only current enabled qualified due rows; zero jobs across 100 centers causes no per-center polling/egress.
- **US-005-QA11:** Original H08 partner diagnostic detail and H10 sidebar equipment/quality visual shell, responsive own-center form and authorized Foundation review use current statuses; no actual screenshot pixel/device QA PASS.
- **US-005-QA12:** Trace equipment API→CG-01 role/CG-14 center→CG-19 evidence→root/center SQL, migration/rollback/restore and public directory regression, actual SQL/security/visual runtime NOT_RUN.
Verification: For US-005-QA01–QA12 use source file:function evidence and real QA when implemented; no unverified backend/SQL/medical/device PASS.
Dependencies: Actual CG-14 verified lab center, CG-19 protected evidence and current CG-01 staff role; **does not depend on US-002 sample/order, CG-15 patient or CG-17 finance**.

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
