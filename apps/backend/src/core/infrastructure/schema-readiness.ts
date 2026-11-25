import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Pool } from "pg";

type Entry = { filename: string; sha256: string };
let required: readonly Entry[] | undefined;
function contract(): readonly Entry[] {
  if (required) return required;
  const entries: unknown = JSON.parse(readFileSync(resolve(__dirname,"../../../db/schema-contract.json"),"utf8"));
  if (!Array.isArray(entries) || !entries.length ||
      entries.some(e => !e || typeof e.filename !== "string" || !/^\d+_cg\d+_[a-z0-9_-]+\.sql$/.test(e.filename) ||
        typeof e.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(e.sha256)) ||
      new Set(entries.map(e=>e.filename)).size !== entries.length)
    throw new Error("Invalid release schema contract");
  required = entries as Entry[];
  return required;
}

// Read-only on every startup/readiness probe; no migrations, seed or repair.
export async function verifySchemaReadiness(db: Pick<Pool,"query">): Promise<void> {
  const expected = contract();
  const objects = await db.query("SELECT to_regclass('public.account') AS account, to_regclass('public.schema_migration') AS ledger");
  if (!objects.rows[0]?.account || !objects.rows[0]?.ledger) throw new Error("Database not initialized");
  const applied = await db.query<Entry>("SELECT filename, sha256 FROM public.schema_migration");
  const hashes = new Map(applied.rows.map(e => [e.filename,e.sha256]));
  if (hashes.size !== expected.length || expected.some(e => hashes.get(e.filename) !== e.sha256))
    throw new Error("Database schema version incompatible");
}
