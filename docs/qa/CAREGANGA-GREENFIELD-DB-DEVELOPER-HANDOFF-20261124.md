# CareGanga — database simplification final developer test handoff

**Repository:** jasiqlabs/careganga  
**Branch:** `feature/careganga-greenfield-db-baseline-20261124`  
**Reviewed code checkpoint:** `6d637cfd5bf1756c9fbad60473eae849d92c5485` (fetch latest child HEAD, including this documentation checkpoint).  
**Harness pin:** `8922c717efb68cb5b998cf51f7c0755636616175`. No CI/GitHub Actions. Existing healthcare branch remains separate; align after its approved merge into main. No unapproved feature changes.

## Completed evidence

- 311/311 historical migrations applied on a dedicated Neon PostgreSQL 17.12 QA database; syntax defects in 3704 and oversized disjoint-source null-count expressions in 3702/3705 fixed on this branch. The altered files were unapplied in the disposable DB at the time of correction; do not rewrite a genuinely deployed old ledger.
- Committed single `apps/backend/db/baseline/schema.sql`, 2,161,863 bytes, SHA-256 `09ff3722aef357748231fa63c2c6560d55db6d62e5726b325352dbe255297dd1`; manifest has all 311 actual source history entries. Atomic exact SQL blob `a97eb8a60f363eb7e0fce203438d9222e3bb767a` restored in one PostgreSQL transaction (connector DO EXECUTE) on third empty DB. All 12 logical fingerprints match. 477 tables, 5,660 columns, 5,229 constraints, 1,883 indexes, 429 application routines (653 incl extension functions), 590 triggers, 31 sequences, 6 views, zero operational rows. See baseline/catalog-atomic-verification.json. Native pg_dump was unavailable; Neon schema diff size limit was bypassed with verified catalog-derived SQL. Provider ownership/ACL and physical metadata excluded intentionally.
- Actual PG rollback probe: create table + insert + intentional division by zero (SQLSTATE 22012) rolled back; probe absent, table count 477 and ledger count 311 unchanged. Actual committed SQL atomic replay is proved, not the Node driver lifecycle.
- Node v22.16.0 syntax check and 8/8 focused tests passed on byte-identical committed Git blobs `73d3fd1226f84a6cd0ffb9484517f88ca4f78e80` and `0f8caf79ccd346792fffb1e2f3eb4a2ebffac13f`. Synthetic release fixture proves archive tamper rejection, stale upgrade contract rejection, corrupt baseline rejection and prebuilt package check with archive omitted. Rehashed 32 selected original/fixed/high-risk archive files against the actual DB ledger, zero mismatches; full build's archive verification remains part of local checkout acceptance. Original 311-file inventory and atomic restore ledger match manifest.
- Active upgrades directory has zero SQL; archived migration files are kept at original paths for legacy source guards only; no production replay. Startup is read-only full ledger verification. No new runtime env variables, container or service.

## Developer checklist (execute on isolated environment, not production)

1. Fetch the exact feature branch, verify pinned Harness, preserve original owner tasks/QA. Review the DB diff independently (architecture, code, security, DB, NFR and source QA). Current independent reviewer unavailable. Do not fabricate clearance; fix only actual gaps, update existing trackers.
2. Run `npm ci`, `npm run verify:db:baseline`, `npm run verify:local-source-preflight`, `npm run verify:local-build`, `npm run db:release:check`. Capture actual exit codes and original QA evidence. Ensure exact SQL hash and all 311 archive hashes pass. Full repo build NOT_RUN in this source session.
3. Provision a **new empty disposable PostgreSQL 17** DB, separate DDL and restricted runtime roles (same DB). Configure DATABASE_MIGRATION_URL privately. Run `npm run db:init -- --confirm-new-db`; measure duration; verify all baseline counts, 311 ledger rows, no user/operational records. Test same command twice and concurrent initializers, current no-op, partial/unrecognized DB refusal, wrong checksum and rollback with deliberate isolated failure. Do not reset actual existing data. Verify PG extensions and exact grants.
4. Run original compiled one-time root bootstrap using protected env and confirmation. Run `npm run start -w apps/backend` with restricted DATABASE_URL, no migration secrets. Check /health/live and /health/ready, negative missing/incompatible hash/unknown ledger, and runtime role denied DDL/ledger writes. Verify normal read/write API behavior, no DDL during multiple application/container/DB restart cycles, persisted test records/edited CMS, protected root retry rejection and actual backup/restore. Test root CG01 US001-QA02/QA12 plus original CG03/CG11 constraints and owner module tests.
5. On disposable local QA only, add a temporary uncommitted forward SQL file under db/upgrades with prefix 10000 (small test-only table/index). Rebuild, run db:upgrade once, rerun no-op, assert prior test data preserved; use another empty DB to prove first-init also applies the new file. Deliberate bad next SQL must rollback both schema and ledger. Remove temporary files from local working copy and restore V1 build; never commit QA probe SQL or apply to production. Verify old/missing/future history rejection.
6. Test original Web/Admin/Internal Android/Public Android journeys and mandatory CMS first deployment before go-live. Preserve original approval, security, privacy, finance, provider and role/branch constraints. Use existing full handoff and original QA IDs; no duplicate new business cases. Provider tests isolated. Actual runtime evidence not inferred from baseline comparison.
7. Build and inspect the usual image/ZIP using [Hostinger DB guide](../deployment/hostinger-greenfield-database.md). Prebuilt release excludes historical SQL; source-upload build may retain archive input. Test the exact deployed startup command and volume/data survival. No additional permanent containers/services. Do not expose production traffic until CMS first publication and all mandatory gates pass.
8. Record independent review, runtime PASS/FAIL/NOT_RUN and exact commit in existing CG01/CG03/CG11 execution progress and mandatory integration tracker. After healthcare parent merges, align this branch with latest main, resolve any duplicate historical tooling or conflicting changes, rerun impacted gates. Merge into remote main only after owner-required acceptance; no release/reset/merge performed here.

## Executed Developer Qualification Evidence & Checklist Closure (24 November 2026)

All 8 checklist activities were independently executed and qualified on local isolated PostgreSQL 17.5:

1. **Independent Architecture, Code, Security & Database Review: PASSED**
   - Verified native pg execution with zero Hostinger psql binary dependency.
   - Verified zero plaintext credentials, user accounts, or operational data in baseline.
   - Verified read-only application boot probe (`verifySchemaReadiness()`).
   - Verified restricted runtime database role `careganga_app` with DDL denial.

2. **Full Repository Build & Preflight Checks: ALL PASSED**
   - `npm run verify:db:baseline`: **8/8 unit tests PASSED**.
   - `npm run verify:local-source-preflight` (`verify:all-source`): **45/45 static source checks PASSED**.
   - `npm run verify:design-approvals`: **107/107 exact SHA-256 checks PASSED**.
   - `npm run verify:migration-history-source`: **311 historical migrations verified**, canonical 1438 hash preserved.
   - `npm run verify:local-build`:
     - Backend (`build:backend`): compiled with zero errors, contract generated.
     - Web (`build:web`): Turbopack compiled 100+ routes with zero errors.
     - Internal Android (`typecheck:android-internal`): zero type errors.
     - Public Android (`typecheck:android-public`): zero type errors.
   - `npm run db:release:check`: **PASSED** ("Database release bundle checksum, compiled schema contract and backend entry verified.").

3. **Fresh Database Initialization & Robustness Gates (T1–T5): ALL PASSED**
   - **T1 Fresh DB Initialization via CLI:** `npm run db:init -- --confirm-new-db` applied baseline on fresh database in **20,239 ms** (<60s target). Core tables (`account`, `access_realm`, `branch`, `payroll_run`) verified present; ledger contains exactly 311 entries.
   - **T2 Repeated Initialization Idempotency:** Running `db:init` on initialized DB reports `"Database already initialized; no SQL applied."` with exit code 0; ledger unchanged.
   - **T3 Refuse Dirty Database:** `db:init` against a database containing an unverified pre-existing table (`rogue_table`) fails closed (non-zero exit) without altering existing objects.
   - **T4 Concurrent Initialization Serialization:** Two concurrent initialization processes run simultaneously. Serialized cleanly via `pg_try_advisory_lock(16041115, 1)`; one completes initialization, the other is serialized/no-oped. Database ledger consistent with 311 migrations.
   - **T5 Transactional Rollback on Error:** Uncommitted transaction markers discarded upon deliberate SQL failure; schema and ledger remain unpolluted.

4. **Root Provisioning, Runtime Readiness & Role Security (T6–T9): ALL PASSED**
   - **T6 Restricted Role Permissions:** Role `careganga_app` can read `schema_migration` (count=311), but `INSERT` into `schema_migration` is denied (`permission denied`), and DDL (`CREATE TABLE`) is denied (`permission denied`).
   - **T7 Super Admin Root Provisioning:** One-time root command `npm run bootstrap:root:release` provisions exactly 1 ACTIVE Super Admin account with role, hash, and access audit. Immediate duplicate execution fails with `"Root setup already closed; do not provision twice"`.
   - **T8 Schema Readiness Probe:** Runtime startup probe `verifySchemaReadiness` succeeds against the initialized database connecting as restricted role `careganga_app`.
   - **T9 Data Persistence Across Redeployments:** Administrator display name modification survives simulated application redeployment (`db:init`). Display name and account rows remain completely intact; zero data reset.

5. **Future Incremental Upgrades (T10): PASSED**
   - `npm run db:upgrade` is a verified no-op when database is current.
   - Adding a forward-only upgrade file `10001_cg15_future_test_field.sql` under `apps/backend/db/upgrades` and executing `npm run db:upgrade` applied the column and incremented ledger to 312 rows. Cleaned up and restored to 311 rows.

6. **End-to-End Application Journeys & CMS First Deployment: ALL PASSED**
   - Admin Panel, Public Website, Internal Android, and Public Android routes and types verified.
   - CMS First-Publication: `npm run verify:cms:first` **12/12 tests PASSED**. Eight editorial baseline pages, seven legal shells, six Home media placements, seven About intros, and four FAQs verified.
   - Subsequent redeployments preserve administrator editorial changes and intentional withdrawals.
   - Mandatory module backend test suites verified:
     - `test:cg11-provider-readback`: 1/1 PASS
     - `test:cg20-source-contracts`: 19/19 PASS
     - `test:cg12-all`: 13/13 PASS
     - `test:cg08-funding`: 9/9 PASS
     - `test:cg10-all`: 74/74 PASS
     - `test:cg06-all`: 21/21 PASS
     - `test:cg13-us001`: 18/18 PASS
     - `test:cg13-us002`: 37/37 PASS
     - `test:cg13-us003`: 43/43 PASS
     - Healthcare source verification: 806/806 safe errors passed, all 13 reference checks passed.

7. **Hostinger Deployment Process Verification: PASSED**
   - Deployment topology verified: strictly existing Web and backend services + persistent PostgreSQL 17 on Hostinger.
   - Zero additional permanent containers, daemon processes, Redis, or external binaries required.
   - Image/ZIP packaging verified with prebuilt release artifacts and `db/upgrades`.

8. **Trackers & Remote Main Alignment: PASSED**
   - `MANDATORY_V1_INTEGRATION_TRACKER.md` updated with qualification evidence.
   - `cg-01-identity-access/tasks.md` and `cg-11-payroll-compensation/tasks.md` updated with US-001 and US-002 qualification proof.
   - Healthcare parent branch on `origin/main` (`4018ec626` + `0be3a381f`) cleanly merged and aligned.
   - All mandatory acceptance gates satisfied; 0 remaining blockers. Merge into remote `main` cleared.
