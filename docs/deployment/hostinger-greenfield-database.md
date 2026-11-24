# CareGanga: simple Hostinger database setup

Owner-authorized greenfield deployment simplification, no business-schema or UI contract change. Branch `feature/careganga-greenfield-db-baseline-20261124`. Current implementation status: source candidate; real baseline generation and PostgreSQL qualification **PENDING**. Do not deploy an empty or unverified schema.

## Architecture

Keep existing Web and backend services and one persistent PostgreSQL database. The database is either managed PostgreSQL or the existing PostgreSQL service on Hostinger with a named persistent data volume, separate from application containers. No additional permanent service, Docker container, orchestration platform, or ORM. Do not put PGDATA in the uploaded application directory or a replaceable container layer. Preserve backups and storage on upgrades. Never use docker compose down -v or delete/recreate the database volume as part of app deployment.

## Developer release preparation (before uploading)

1. Select the PostgreSQL major version used by Hostinger (17 recommended). Install matching pg_dump on the **developer** machine. Create two completely empty isolated local databases named careganga_baseline_source and careganga_baseline_verify. No application connections, no root account, no sample or real data.
2. From the checked-out release root, run npm ci and the normal manual build. Inject CAREGANGA_BASELINE_SOURCE_URL and CAREGANGA_BASELINE_VERIFY_URL into the local process environment, using protected direct localhost PostgreSQL URLs. Run `npm run db:baseline:generate`. It builds the backend, checks both DBs are empty, replays the 311 historical migration files on source, creates the final consolidated SQL with migration-produced defaults and ledger, restores it on verify, compares both full and schema-only dumps, and records the SQL hash and source checksums. Any failure blocks artifact generation. No existing DB is cleared automatically.
3. Inspect resulting apps/backend/db/baseline/schema.sql and manifest.json, run schema/ACL/default-data/business integrity and all existing QA; verify no personal/operational data, credentials or unapproved content was exported. Ownership/ACL are deliberately environment-specific in pg_dump (--no-owner --no-privileges); compare security predicates and provision reviewed runtime grants explicitly. Commit both files after independent review and run `npm run db:release:check`. Never replace the published baseline. Historical SQL files remain in source for old QA and ledger compatibility; fresh installation does not replay them.
4. Build the normal backend and Web packages. Include apps/backend/db (baseline files, .mjs and SQL source history), apps/backend/dist (compiled server and schema-contract.json), workspace package manifests, runtime node_modules or normal dependency-install method, CMS scripts/assets and existing Web artifacts in the usual Docker image or ZIP. The first-release package must pass db:release:check. No PostgreSQL client binary is needed on Hostinger for db:init; native pg executes the prepared SQL.

## First Hostinger deployment only

Use the same existing upload/deploy process and database service. Configure DATABASE_URL with a restricted application role. Configure DATABASE_MIGRATION_URL with the schema-owner/direct connection **only in the release shell or one-time deployment command**, never permanently in normal backend environment. Ensure privileges and search_path are correct: runtime needs read-only schema_migration, business DML/sequence/function access as authorized, no schema ownership, CREATE/ALTER/DROP or ledger write access. Review exact grants and test them in local QA (do not blindly grant all tables/functions).

From the normal deployed workspace, before enabling application traffic, run:

```bash
npm run db:release:check
npm run db:init -- --confirm-new-db
```

The root command explicitly forwards the confirmation flag to the backend workspace; alternatively run `cd apps/backend && npm run db:init -- --confirm-new-db`. Initialization locks, verifies empty state and checksums, restores schema and mandatory defaults transactionally; rerun on known initialized history is a no-op. Refuses unknown/partial history or unexpected objects. It does not drop tables or create admin credentials. Do not point it at an old partially migrated development DB; provision an explicitly authorized new DB instead. Back up and preserve any existing data.

Securely run the compiled one-time root provisioning command `npm run bootstrap:root:release -w apps/backend -- --confirm-one-time-root` using operator secrets and existing confirmation. Remove operator secrets afterward. Start the backend as usual (npm run start -w apps/backend or node dist/src/main.js from apps/backend), with DATABASE_URL only. Existing CMS first-release preparation and authorized publication remain mandatory before public traffic; use the existing CMS deployment guide and `npm run deploy:cms:first -- --manifest /private/path/approved-baseline.json --apply`. No fake approvals or direct publication table writes. Verify /health/ready, Web and public Android acceptance. Initial schema installation target under 60 seconds, not yet measured; CMS media, approval and builds are separate.

## Normal restart or update without schema change

Upload/deploy the image or ZIP as before. Start the usual backend command. It runs **read-only** connectivity/schema ledger checks and does not invoke db:init, db:upgrade, seeds or CMS publication. Backend/container/VPS restarts preserve PostgreSQL records and admin modifications if persistent storage survives. Missing/incompatible DB is unready, never silently initialized.

## Future release with a schema change

Use an increasing unique numeric prefix above the baseline maximum; never edit an already applied SQL file. Back up database and plan compatible upgrade/downtime. Run `npm run db:upgrade` once in the existing release shell using DATABASE_MIGRATION_URL. It rejects an uninitialized/incompatible ledger; the existing transactional locked runner executes only unapplied changes. Start the new backend with restricted DATABASE_URL. New release startup requires the exact compiled schema history; for single-server upgrades stop the old backend before incompatible upgrades. Do not add the database commands to normal Docker CMD, npm start, restart policies or frontend build. Keep credentials out of ZIP/images/logs.

## Release acceptance / known limits

The source includes five focused baseline guard tests (`npm run verify:db:baseline`), authored but not executed here. No database artifact exists yet; generator, SQL restore, PostgreSQL roles/privileges, migration order, baseline schema/data equivalence, startup/restart, concurrent setup, rollback, backups, CMS first publication, complete builds and independent review are **NOT_RUN** at this source checkpoint. A checksum ledger proves applied history, not arbitrary out-of-band schema drift; actual catalog comparison and module integrity tests are required in release qualification. Direct connection and correct persistent volume are hosting configuration, not inferred from source. No production reset or merge authorized.
