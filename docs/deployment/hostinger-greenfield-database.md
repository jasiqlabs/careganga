# CareGanga — one database, simple Hostinger deployment

**Current child branch:** `feature/careganga-greenfield-db-baseline-20261124`. Keep the existing frontend, backend and one persistent PostgreSQL 17 database; no additional permanent container or service. Application restarts and ordinary redeployments execute no DDL, initialization, seeds or CMS publication.

## 1. Developer release preparation (already-generated baseline)

The committed `apps/backend/db/baseline/schema.sql` (2,161,863 bytes) is the complete V1 logical schema. Its SHA-256 is `09ff3722aef357748231fa63c2c6560d55db6d62e5726b325352dbe255297dd1`. Do **not** generate it again. It came from actual PostgreSQL 17 replay after correcting three unapplied payroll/approval migration files. A second empty DB was recreated from catalog statements and the exact final Git blob was restored in one transaction on a third empty DB. All 12 normalized logical catalog fingerprints match, with zero non-ledger populated tables. See baseline/catalog-atomic-verification.json. Environment-specific roles and ownership/ACL/physical metadata are not copied. Eight source guard/package tests passed on Node 22.16.0 (exact committed blobs); actual Node-to-DB and Hostinger deployment qualification remain the developer's acceptance.

From the normal repository checkout:

```sh
npm ci
npm run verify:db:baseline
npm run verify:local-source-preflight
npm run verify:local-build
npm run db:release:check
```

The backend build validates the frozen 311 source files against the real baseline ledger and writes dist/db/schema-contract.json. Use the normal existing image/ZIP process; there is no new build service or required PostgreSQL client on Hostinger. Package the root/backend npm manifests and required workspace/runtime dependencies, existing Web artifacts and CMS scripts/assets, and the following backend paths:

- apps/backend/dist (including dist/db/schema-contract.json and compiled main/root entry files)
- apps/backend/db/baseline.mjs
- apps/backend/db/baseline/schema.sql and manifest.json
- apps/backend/db/upgrades/ (currently README only; keep directory in artifact)

The 311 original SQL files stay at db/migrations/ solely as a **frozen source archive** for existing QA and build-time checks. Exclude them and historical replay tooling from a prebuilt release. If the existing Hostinger workflow builds a source ZIP on host, keep them in that build input only; no historical SQL is executed. Do not add db:migrate/db:init/db:upgrade or CMS publication to Docker CMD, application start or restart policies. No automatic DB creation/reset. Do not omit the baseline from the uploaded release.

## 2. First deployment only

Use the existing PostgreSQL 17 instance/service on persistent storage. Explicitly provision one new empty database (never reset an existing client database). Set the existing DATABASE_URL to the restricted runtime login and the existing DATABASE_MIGRATION_URL to the direct schema-owner login in the protected release shell only. These are connections to the same dedicated database; no new permanent environment variables. Use a protected secret manager/environment; do not put credentials in ZIP, image, git or logs.

```sh
npm run db:release:check
npm run db:init -- --confirm-new-db
```

Run from repository/release root; equivalent command from apps/backend is npm run db:init -- --confirm-new-db. Initialization verifies manifest, SQL checksum, compiled contract and PostgreSQL major, locks the target, rejects any unexpected existing objects/history, applies the single baseline in one transaction and verifies the ledger. There are **zero** V1 active upgrade SQL files. On a later release first-install includes its pending forward upgrades in that same transaction. Repeating init on exactly current history is a no-op; older known history asks for explicit upgrade, unknown/partial history fails closed. Baseline ledger timestamps are provenance from the historical QA replay, not claims of 311 production migration executions.

### One-time restricted runtime access

Reuse the existing restricted application role, not the schema owner. The DBA provisions the role/password outside the app and confirms no membership of owner/superuser, no CREATE DATABASE/ROLE, no bypass RLS, no schema CREATE and no object ownership. As DB owner grant CONNECT and schema USAGE, SELECT on authorized application tables/views and ledger, necessary INSERT/UPDATE/DELETE on application-owned regular tables (excluding schema_migration), USAGE/SELECT on sequences, and required routine EXECUTE. Do not grant TRUNCATE, schema CREATE, DDL ownership, ledger writes or broad administrative rights. Application service uses one DB role; end-user permissions remain enforced by existing backend/constraints. Verify actual role grants against all existing module runtime tests; renew grants only for new objects in a future upgrade. On PostgreSQL 17 the default public schema does not give CREATE to an unrelated user; verify existing configured role rather than assuming. No provider-specific grants or role credentials are included in schema.sql.

Provision root exactly once using existing protected credentials:

```sh
npm run bootstrap:root:release -w apps/backend -- --confirm-one-time-root
npm run start -w apps/backend
```

Remove DDL/bootstrap secrets from the long-running backend environment; keep existing runtime/provider configuration. The root command uses the original secured root bootstrap and must refuse a second root. The backend performs a read-only full-history readiness check before listen. Start the existing Web service normally. Complete the existing authorized CMS first-publication process before enabling public traffic: [CMS guide](careganga-public-cms-first-deployment-check-20261123.md), `npm run deploy:cms:first -- --manifest /private/path/approved-baseline.json --apply`. No fabricated operational data, legal text, approval, or automatic overwrite of CMS revisions.

## 3. Routine deployment or restart

Upload/deploy the new image or ZIP and start the app as usual. Reuse the same database connection and persistent volume. No DB setup or migration commands for an unchanged schema. Never delete the database volume or mount PGDATA in an ephemeral app layer. Backend missing/incompatible history fails closed with a safe error. Persistent data survives app/container/VPS restarts if storage survives; backups are required for storage loss. No automatic empty-database repair.

## 4. A future actual schema change only

Add a reviewed SQL file under db/upgrades/ with unique increasing numeric prefix above 9999. Preserve released baseline/archive and all applied checksums. Backup before upgrade and stop old app for incompatible schema transitions (prefer expand/contract where appropriate). Build the release, and explicitly run once with the owner URL:

```sh
npm run db:upgrade
```

Only pending new upgrades are applied, under the same advisory lock and one transaction, with a full final ledger check. Current release is a no-op; no historical replay. The existing db:migrate / db:baseline:generate commands are historical/offline reference tooling, not part of deployment. Do not invoke them against existing production data or remove a published baseline.

## 5. Developer acceptance gate

Read [database developer handoff](../qa/CAREGANGA-GREENFIELD-DB-DEVELOPER-HANDOFF-20261124.md). Actual full repo build, Node CLI using a real driver/role, upgrade/repeat/restart and full Web/Android original business QA remain pending. No production deployment or merge until required independent review and runtime gates pass. Initial install target under 60 seconds must be measured locally/Hostinger, not inferred from connector elapsed time.
