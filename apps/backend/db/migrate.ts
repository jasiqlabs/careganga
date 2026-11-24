import { createHash } from "node:crypto";
import dns from "node:dns";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import {composeCg19HistoricalMigration} from "./cg19-migration-compatibility";

// Ensure dual-stack environments resolve IPv4 addresses first to avoid ISP IPv6 DNS ENOTFOUND
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}

// Safely load environment files if present in cwd or workspace root
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(); } catch {}
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.("../../.env"); } catch {}

// A duplicate table-creation migration was accidentally committed to main
// after the canonical original CG19 1438 migration. Preserve its historical
// bytes/checksum: deployed schema_migration ledgers may already contain it.
// On a fresh database the canonical first 1438 has already created the tables.
// Record this *exact* legacy file as a documented no-op, never execute its
// duplicate CREATE TABLE statements or accept an arbitrary modified checksum.
// A forward-only 1445 migration carries the needed supplemental constraints.
const legacyDuplicate1438 = {
  filename: "1438_cg19_patient_owned_private_files.sql",
  sha256: "4d6fdea87c43adf79248d610978512f10e2b3f2017f23912e3fad93500ac8579"
} as const;

async function migrate(): Promise<void> {
  const rawUrl = process.env.DATABASE_MIGRATION_URL;
  if (!rawUrl) throw new Error("DATABASE_MIGRATION_URL is required; use a direct database connection");
  // Neon connection pooler (-pooler.) uses PgBouncer in transaction mode where session-level
  // advisory locks can persist across pooled connections. Automatically normalize to direct host.
  const url = rawUrl.replace("-pooler.", ".");
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 15_000,
    application_name: "careganga-migrations"
  });
  let client;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1) + Math.random() * 500));
    }
  }
  if (!client) throw new Error("Failed to connect to database after bounded retries");
  let lockAcquired = false;
  try {
    // Acquire pg_advisory_lock safely via pg_try_advisory_lock with bounded retry
    for (let i = 0; i < 15; i++) {
      const lockRes = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(16041115, 1) AS locked");
      if (lockRes.rows[0]?.locked) {
        lockAcquired = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!lockAcquired) {
      throw new Error("Could not acquire pg_advisory_lock(16041115, 1) within 15 seconds. Ensure direct database connection is used and no concurrent migration is running.");
    }
    try {
      if (process.argv.includes("--existing-only")) {
        const found = await client.query("SELECT to_regclass('public.schema_migration') AS ledger");
        if (!found.rows[0]?.ledger) throw new Error("Database initialization required; upgrades never initialize a database.");
      } else await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
        filename text PRIMARY KEY,
        sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const localMigrations = typeof __dirname !== "undefined" ? resolve(__dirname, "migrations") : "";
      const candidateDirs = [
        join(process.cwd(), "db", "migrations"),
        join(process.cwd(), "apps", "backend", "db", "migrations"),
        ...(localMigrations ? [localMigrations] : [])
      ];
      let directory = candidateDirs[0];
      for (const d of candidateDirs) {
        try {
          await readdir(d);
          directory = d;
          break;
        } catch {}
      }
      const files = (await readdir(directory)).filter(x => /^\d+_cg\d+_[a-z0-9_-]+\.sql$/.test(x))
        .sort((a,b) => Number(a.split("_")[0])-Number(b.split("_")[0]) || (a<b?-1:a>b?1:0));
      // Never accept a checkout that silently omits an already applied migration.
      // A hash match alone only detects edited files, not deleted historical files.
      const applied = await client.query<{ filename:string }>(
        "SELECT filename FROM schema_migration"
      );
      const present = new Set(files);
      if (applied.rows.some(row => !present.has(row.filename)))
        throw new Error("An applied migration file is missing from this checkout");
      for (const name of files) {
        const sql = await readFile(join(directory, name), "utf8");
        const digest = createHash("sha256").update(sql).digest("hex");
        const prior = await client.query<{ sha256: string }>(
          "SELECT sha256 FROM schema_migration WHERE filename = $1", [name]
        );
        if (prior.rowCount) {
          if (name === "0908_cg09_balanced_voucher_effect.sql" &&
              prior.rows[0].sha256 === "bd8779a8de51c613654c1731aac8c8301ffd725cfc13386157fc57cff71f07e5") {
            const start = sql.indexOf("CREATE FUNCTION cg09_voucher_accounting_guard");
            const end = sql.indexOf("END; $$;", start) + "END; $$;".length;
            const fnSql = sql.substring(start, end).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
            await client.query("BEGIN");
            try {
              await client.query(fnSql);
              await client.query(
                "UPDATE schema_migration SET sha256 = $1 WHERE filename = $2",
                [digest, name]
              );
              await client.query("COMMIT");
            } catch (err) {
              await client.query("ROLLBACK");
              throw err;
            }
            continue;
          }
          if (prior.rows[0].sha256 !== digest) throw new Error("Applied migration changed: " + name);
          continue;
        }
        if (name === legacyDuplicate1438.filename) {
          if (digest !== legacyDuplicate1438.sha256)
            throw new Error("Known legacy CG19 migration checksum changed: " + name);
          // Running the duplicate migration would fail CREATE TABLE on clean
          // installs. Require the canonical original patient tables and event
          // timestamp so an incomplete/unexpected DB cannot be treated as good.
          const proof = await client.query<{
            intent: boolean; file: boolean; event: boolean; event_created_at: boolean
          }>(`SELECT
            to_regclass('cg19_patient_file_intent') IS NOT NULL AS intent,
            to_regclass('cg19_patient_private_file') IS NOT NULL AS file,
            to_regclass('cg19_patient_file_event') IS NOT NULL AS event,
            EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema=current_schema()
                AND table_name='cg19_patient_file_event'
                AND column_name='created_at') AS event_created_at`);
          if (!proof.rows[0]?.intent || !proof.rows[0]?.file ||
              !proof.rows[0]?.event || !proof.rows[0]?.event_created_at)
            throw new Error("Canonical CG19 1438 schema absent; requires DBA reconciliation");
          await client.query("BEGIN");
          try {
            await client.query(
              "INSERT INTO schema_migration (filename,sha256) VALUES ($1,$2)",
              [name,digest]
            );
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
          continue;
        }
        await client.query("BEGIN");
        try {
          await client.query(composeCg19HistoricalMigration(name,sql));
          await client.query("INSERT INTO schema_migration (filename, sha256) VALUES ($1,$2)", [name, digest]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(16041115, 1)").catch(() => {});
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
void migrate().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`CareGanga migration failed: ${reason}\nno partial changes from failing migration committed.\n`);
  process.exitCode = 1;
});
