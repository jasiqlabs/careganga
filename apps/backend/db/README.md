# CareGanga database release lifecycle

- `baseline/schema.sql`: one complete verified initial PostgreSQL 17 schema; `baseline/manifest.json`: immutable checksums/history.
- `upgrades/`: future actual schema changes only; zero active SQL files in V1.
- `migrations/`: frozen historical source archive retained for existing QA/build validation only; not required in a prebuilt deployment.
- `baseline.mjs`: explicit db:init, db:upgrade, db:release:check and build contract. Normal startup is read-only.

Read [Hostinger deployment guide](../../../docs/deployment/hostinger-greenfield-database.md) and [developer test handoff](../../../docs/qa/CAREGANGA-GREENFIELD-DB-DEVELOPER-HANDOFF-20261124.md). No extra service/container or PostgreSQL client binary is needed on Hostinger. Exact single SQL atomic restore and catalog comparison verified on isolated PostgreSQL 17; actual Node CLI, build, role and hosting/runtime acceptance remain separate.
