# CareGanga CG-16 US-001 — original 16 QA-case source trace

Date: 2026-11-20. Feature branch: feature/careganga-cg16-cg17-healthcare-dev-20261120. Current source review HEAD: a599db9fd58a4c3ca82e54e72ebca3e2c2dff988.

## Evidence boundary

Provisional JASIQ-dev source inspection and authored source changes only. Source-only case disposition IS NOT a runtime PASS. No local build, SQL migrations, database rollback, static tool execution, browser/device, native Android pixel comparison, release/clinical/compliance or independent DB/security test has been executed here. CG14 facility licence-expiry owner model is not currently available; no inferred date from CG19 evidence. CG16 US002 source accepted-order trace does not yet exist.

## Original accepted US-001 cases

| Original ID | Source-only state | Source evidence and limitations |
|---|---|---|
| US-001-QA01 | SOURCE_VERIFIED | DiagnosticsCatalogService.createTest/createCategory -> CG01 role/root -> 1601 unique current real diagnostic test and category; H09 Web; ERP-independent; SQL NOT_RUN |
| US-001-QA02 | SOURCE_VERIFIED | CenterLabPricingPanel and MyLabPricingWorkspace own-center UI -> CG16 my-centers route -> HealthLabCatalogSourceFacade.assertLab CG14 active affiliation and CG01 action; no global test edit |
| US-001-QA03 | SOURCE_GAP | CG01 current role/root and CG14 verified proof/provider/center gates source-checked; CG14 does NOT yet store authoritative regulatory licence-expiry timestamp; cannot assert expired licence rejection; SQL/live role negative NOT_RUN |
| US-001-QA04 | SOURCE_VERIFIED | 1601 UNIQUE(root_realm_id,unique_test_code), lab_catalog_command key/digest, DiagnosticsCatalogService.command and pgError duplicate conflict; concurrent PostgreSQL NOT_RUN |
| US-001-QA05 | SOURCE_VERIFIED | DiagnosticsCatalogService.createPackage uses real active source tests and quantities, diagnostic_package_line(test_revision_at_approval) plus immutable revision snapshots in 1601 |
| US-001-QA06 | SOURCE_VERIFIED | 1603 diagnostic_test active_from/active_to; createPackage refuses empty, expired or future-only components and cannot contain package/self/cyclic lines; root/source and effective-bound checks; public packages reject expired components; runtime NOT_RUN |
| US-001-QA07 | SOURCE_VERIFIED | CG14 original verified center + capability/affiliation asserted per mapping, root-composite mapping FKs; independent commercial price proposed per center; no shadow lab master |
| US-001-QA08 | SOURCE_VERIFIED | 1601 GiST exclusion for APPROVED overlap, mapping lock, immutable price revision, source-checked supersession + append-only closure; PostgreSQL concurrent races NOT_RUN |
| US-001-QA09 | NOT_VERIFIABLE | Original professionally accepted US-002 lab order/reprice/frozen-order read not implemented; 1601 tariff and test/package immutable histories alone do not prove it |
| US-001-QA10 | SOURCE_VERIFIED | Approved commercial patient/base tariff only; CG03 authorizes price but not CG09 journal, CG17 benefit, patient payment, receipt or collected status; Web labels explicit |
| US-001-QA11 | SOURCE_VERIFIED | 1602 source-only migration adds CG03 price case/FK/immutable source and SQL guard; DiagnosticsPriceReviewSource.create/decide/finish and DiagnosticsCatalogService.proposePrice/approvePrice/rejectPrice require independent protected CG01 reviewer, current-password proof, unchanged price digest and case CAS; no runtime DB verification |
| US-001-QA12 | SOURCE_VERIFIED | CG16 public catalog and H09 published totals use current CG14 publication+original CG03/CG19 proof, active test/package/center and approved live pricing; now also require original CG03 completed lab-price case+decision; no old-price fallback |
| US-001-QA13 | SOURCE_VERIFIED | H09 test/package tabs, mapped eligible centers, history, live source KPIs/price provenance, expiry status/input/duplicate/deactivate, human CG03 review number and approve/reject; CSS/device/screenshots NOT_RUN |
| US-001-QA14 | SOURCE_VERIFIED | DiagnosticsCatalogService.exportSelected bound to current CG01 action+root and limited refs; Web CSV escaping; always-on H09 import omitted; owner-gated future import not implemented |
| US-001-QA15 | SOURCE_VERIFIED | CG16 catalogue and public center-price paths have no LAB_ERP dependency, patient/order/report action or CG17 payment; OFF live negative tests NOT_RUN |
| US-001-QA16 | SOURCE_VERIFIED | H09 Web and own-center Web -> authenticated BFF -> CG16 Nest controller -> CG01 current root/CG14 live center -> SQL constraints and CG03 price source; no global Internal Android editor; SQL/Web/Android runtime NOT_RUN |

## Source review—material changes

- Migration 1602 adds original CG03 lab-price source case; original reviewer decision, fresh credential, protected separation and only one owner-applied outcome. Existing CG03 case types preserved by replaced kind/disjoint constraints. Live SQL migration and data upgrade: NOT_RUN.
- CG16 reviewed H09 price proposal writes source-pinned CG03 case in same transaction; independent approve/reject changes original decision and price outcome atomically. Original SQL trigger additionally rejects final price transitions lacking matching case. Public and H09 published price summary now JOIN genuine CG03 completed tariff review decision, so unreviewed preexisting approved rows fail closed rather than appearing current.
- Migration 1603 adds source-owned diagnostic-test availability windows. Test/package price windows checked against real item bounds; future/expired diagnostic components do not appear public and cannot be used in packages and current eligible center package options. These date fields DO NOT certify lab regulatory licensing.
- H09 original Web maintains test dates/expiry indication; actual CG03 case number/status, protected password and two-stage reject confirmation. No clinical order, private patient result, paid receipt, Foundation assistance or new ERP records.
- Source-only preflight scripts updated in repository; NOT EXECUTED here. Human specialist readback remains self-review, not an independent reviewer signoff. Real UI must match current CG01/Irfan + client-provided healthcare references at local QA.

## Source gaps / next JASIQ-dev action

**QA03: SOURCE_GAP.** CG14 owning module must define a trustworthy facility licence expiry field, verification and publication-policy expiry, and test backend/public withdrawal based on that source. It must not be derived from a file name, upload timestamp or synthetic placeholder.

**QA09: NOT_VERIFIABLE.** CG16 US-002 will own real accepted order line source/revision/price freeze and protected retained past reports; do not mark this QA verified before the order owner is implemented.

Other source-reviewed cases are not approved for QA PASS. US-001 retains `IN_PROGRESS | PROVISIONAL_SOURCE_ONLY` because missing real predecessor source, independent approvals, and executable validation remain. Other story definitions/progress lines are unchanged. Owner explicitly forbids merging into `main` before all CG16/CG17 user stories are developed, reviewed, traced and accepted.
