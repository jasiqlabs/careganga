import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

// Safely load environment files if present in cwd or workspace root
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(); } catch {}
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.("../../.env"); } catch {}

async function migrate(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is required; use a direct database connection");
  const pool = new Pool({ connectionString: url, max: 1, application_name: "careganga-migrations" });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(16041115, 1)");
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
        filename text PRIMARY KEY,
        sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const directory = join(process.cwd(), "db", "migrations");
      const files = (await readdir(directory)).filter(x => /^\d+_cg\d+_[a-z0-9_-]+\.sql$/.test(x)).sort();
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
          if (prior.rows[0].sha256 !== digest) throw new Error("Applied migration changed: " + name);
          continue;
        }
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migration (filename, sha256) VALUES ($1,$2)", [name, digest]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock(16041115, 1)");
    }
  } finally {
    client.release();
    await pool.end();
  }
}
void migrate().catch(() => {
  process.stderr.write("CareGanga migration failed; no partial changes from failing migration committed.\n");
  process.exitCode = 1;
});
