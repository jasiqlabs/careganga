# CareGanga greenfield database — Hostinger / ZIP / Docker

Owner-approved direction (24 Nov 2026): one independent persistent PostgreSQL database; one versioned initial SQL artifact; no DDL, seed, root creation or CMS publication on application restart. Existing business schema, API and Web/Android contracts remain unchanged.

## One-time developer generation (not a deploy command)

Use PostgreSQL client utilities `psql` and `pg_dump` compatible with the target PostgreSQL major version, Node 22 and `npm ci`. Provision **two empty, dedicated, isolated scratch databases** named e.g. `careganga_baseline_source` and `careganga_baseline_verify`; never point at client, staging or production data. Set their direct URLs privately as `DATABASE_BASELINE_SCRATCH_URL` and `DATABASE_BASELINE_VERIFY_URL`. Do not run backend, root provisioning, CMS or sample data loaders against them.

```sh
npm run db:generate-baseline -- --confirm-empty-scratch
```

The script replays the exact 311-file historical chain on the first scratch database, verifies the actual SHA-256 ledger and zero accounts, exports the schema and migration-created data using pg_dump, restores the dump in a single transaction on the second scratch database, verifies the ledger and compares round-trip dumps (ignoring random psql restriction keys). No automatic DB creation/drop/reset. On failure, investigate and create new isolated empty scratch databases; do not bypass failed migration/restore checks. Review all nonempty table data, grants, object ownership, triggers, constraints, indexes, reference defaults and source/runtime tests independently. Only then commit `apps/backend/db/baseline/V0001__baseline.sql` and `manifest.json` together. The artifact is **not generated or approved at the current source checkpoint**. Existing historical files remain active only for compatibility with existing source guards, readiness, old DBs and future incremental migrations; do not delete them or invent ledger entries. The baseline carries the genuine migration ledger from the validated scratch DB, not 311 runtime DDL executions. Later archive/refactor ledger and upgrade runner only after the independent migration cutover is verified.

## First installation on Hostinger

Use managed PostgreSQL or a dedicated PostgreSQL Docker service with a persistent named volume or stable host-mounted data directory. Never embed PGDATA in the application image or remove its volume on deploy. Provision a dedicated empty target explicitly, with a protected direct `DATABASE_MIGRATION_URL` (owner/DDL role) and a different `DATABASE_URL` for the runtime role. Grant only the required schema/table/sequence/function access to the runtime role, not ownership, CREATE/ALTER/DROP or write access to the migration ledger; validate privileges and all DB integrity tests. Preserve any required grants/roles from the baseline. Deployment host or one-off release container needs PostgreSQL clients; ordinary backend image does not need them. Package the root script, baseline SQL, manifest and current migration inventory in the release artifact. Keep database credentials out of the ZIP/image/logs.

```sh
npm run db:init -- --confirm-empty-target
```

This is **only** for explicitly authorized empty targets. It validates artifact checksum and current source history, checks emptiness, locks the database and restores the complete schema/data/real ledger atomically. A second call against a populated database deliberately refuses; it is not a routine start step. Never drop a partly initialized or old test DB automatically. Legacy DBs use the existing documented migration/backup/reconciliation path or an explicitly authorized fresh replacement database. First install then provisions Super Admin using the existing secure script, starts backend, and completes existing authorized CMS publication and real media readiness checks before enabling public traffic. No dummy patient, donor, payment, financial or employee records.

## Start / restart / redeploy

Backend command: `npm run start -w apps/backend` (built backend). Frontend uses its existing start command. Reuse the same PostgreSQL endpoint and persistent storage every time. Do NOT chain db:init, db:migrate, root provisioning or CMS scripts into the start command or restart policy. Current application startup does not call migration tooling. The existing readiness endpoint still uses its legacy subset ledger guard; a complete release/schema compatibility guard is a remaining cutover item. Database deployment credentials belong only to the operator/release step. Routine redeploy executes no DDL. Future releases apply only pending reviewed migrations through a separate explicit upgrade step; the existing runner remains compatible with the baseline ledger until its planned simplification. Back up before upgrades; no automatic destructive reset or rollback.

## Release gate

Current checkpoint is SOURCE_AUTHORED / INDEPENDENT_REVIEW_UNAVAILABLE / RUNTIME_NOT_RUN. The script has not been executed against PostgreSQL here. Before deployment: run generation and fresh restore, verify schema/data/permissions with actual DB integrity tests, reject nonempty DB and wrong checksum, simulate concurrent initialization and rollback on error, restart application and DB containers with persistent storage, verify CMS modifications and actual test records survive, exercise Web and both Android clients; verify backup/restore and future additive migration. Record exact source/manifest hashes, durations and reviewer evidence in existing mandatory integration tracker. Fresh schema setup target under 60 seconds is not yet benchmarked. No CI/GitHub Actions. Do not mark deployment ready until these gates pass.
