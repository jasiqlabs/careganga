// Greenfield release tooling. Never import this script from application startup.
// Baseline is generated only from dedicated empty scratch DBs, not a live dump.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = join(root, "apps", "backend");
const output = join(backend, "db", "baseline");
const sqlPath = join(output, "V0001__baseline.sql");
const manifestPath = join(output, "manifest.json");
const hash = value => createHash("sha256").update(value).digest("hex");
const migrationName = /^\d+_cg\d+_[a-z0-9_-]+\.sql$/;
function history() {
  const folder = join(backend, "db", "migrations");
  const files = readdirSync(folder).filter(name => migrationName.test(name)).sort();
  if (!files.length) throw Error("Historical migration inventory is missing.");
  return files.map(filename => ({ filename, sha256: hash(readFileSync(join(folder, filename))) }));
}
function connection(name, scratch = false) {
  let url;
  try { url = new URL(process.env[name] || ""); }
  catch { throw Error("Set " + name + " to an explicit direct PostgreSQL URL."); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname ||
      !url.username || !url.pathname.slice(1) || url.hash || url.hostname.includes("-pooler."))
    throw Error(name + " must identify a direct PostgreSQL database.");
  // Do not accept connection overrides or secret query parameters.
  const allowed = new Set(["sslmode", "channel_binding", "sslrootcert", "connect_timeout", "application_name"]);
  for (const key of url.searchParams.keys())
    if (!allowed.has(key)) throw Error("Unsupported connection option in " + name + ".");
  if (scratch && !/^careganga_baseline_[a-z0-9_]+$/.test(decodeURIComponent(url.pathname.slice(1))))
    throw Error("Scratch databases must have a careganga_baseline_ name.");
  const raw = url.href;
  const password = decodeURIComponent(url.password);
  url.password = "";
  return { raw, safe: url.href, password };
}
function run(command, args, options = {}, label = command) {
  const r = spawnSync(command, args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
    ...options });
  if (r.error || r.status !== 0)
    throw Error(label + " failed. Exit: " + (r.status ?? "unavailable") +
      ". Inspect the isolated database or local tool installation; no raw connection errors are printed.");
  return r.stdout;
}
function client(command, target, args, input) {
  return run(command, ["--no-password", "--dbname=" + target.safe, ...args], {
    env: { ...process.env, PGPASSWORD: target.password, PGCONNECT_TIMEOUT: "15" },
    ...(input === undefined ? {} : { input })
  }, command);
}
function query(target, sql) {
  return client("psql", target, ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]).trim();
}
// Refuse any application object, schema, extension or schema-dependent object.
// Never drop or repair a populated database.
const empty = "NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_')" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_namespace n ON d.refobjid=n.oid WHERE d.refclassid='pg_catalog.pg_namespace'::regclass AND n.nspname='public')" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public')" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public')" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname<>'plpgsql')" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger)" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_foreign_server)" +
  " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication)";
function requireEmpty(target) {
  if (query(target, "SELECT " + empty) !== "t")
    throw Error("Target is not an empty PostgreSQL database. No initialization performed.");
}
function requireHistory(target, expected) {
  const actual = query(target, "SELECT filename || ' ' || sha256 FROM public.schema_migration ORDER BY filename COLLATE \"C\"");
  if (actual !== expected.map(x => x.filename + " " + x.sha256).join("\n"))
    throw Error("Database migration ledger does not match the reviewed source inventory.");
}
function dump(target) {
  // Include only data created by migrations in the isolated scratch database.
  // Preserve grants; omit machine-specific ownership. Do not use --clean.
  return client("pg_dump", target, ["--format=plain", "--no-owner"]);
}
function canonicalDump(sql) {
  // Modern pg_dump emits random psql restriction keys.
  return sql.replace(/^\\(?:un)?restrict .+$/gm, "").trim();
}
function restore(target, sql, expected) {
  requireEmpty(target);
  // The second check is inside the same transaction and lock as restoration.
  // Any concurrent installer or migration runner uses the existing lock key.
  const guard = "SELECT pg_catalog.pg_advisory_xact_lock(16041115,1);\n" +
    "DO $cg_guard$ BEGIN IF NOT (" + empty + ") THEN RAISE EXCEPTION 'Target not empty'; END IF; END $cg_guard$;\n";
  const values = expected.map(x => "('" + x.filename + "','" + x.sha256 + "')").join(",");
  const verify = "\nDO $cg_verify$ BEGIN IF (SELECT count(*) FROM public.schema_migration) <> " + expected.length +
    " OR EXISTS (SELECT 1 FROM (VALUES " + values + ") AS e(filename,sha256) LEFT JOIN public.schema_migration m USING(filename) WHERE m.sha256 IS DISTINCT FROM e.sha256)" +
    " THEN RAISE EXCEPTION 'Baseline history mismatch'; END IF; END $cg_verify$;\n";
  client("psql", target, ["-X", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", "-"],
    guard + sql + verify);
}
function generate() {
  if (existsSync(output)) throw Error("Baseline output already exists. Review it explicitly; generation never overwrites it.");
  const source = connection("DATABASE_BASELINE_SCRATCH_URL", true);
  const check = connection("DATABASE_BASELINE_VERIFY_URL", true);
  if (source.raw === check.raw) throw Error("Two separate empty scratch databases are required.");
  requireEmpty(source);
  requireEmpty(check);
  const expected = history();
  // Inject the scratch URL into BOTH names so local .env files cannot redirect
  // the existing runner to another database. Never use an application/live DB.
  run(process.execPath, [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "db/migrate.ts"],
    { cwd: backend, env: { ...process.env, DATABASE_MIGRATION_URL: source.raw, DATABASE_URL: source.raw } },
    "Historical migration replay on scratch");
  requireHistory(source, expected);
  if (query(source, "SELECT count(*) FROM public.account") !== "0")
    throw Error("Scratch database contains accounts; baseline export refused.");
  const sql = dump(source);
  restore(check, sql, expected);
  requireHistory(check, expected);
  if (canonicalDump(sql) !== canonicalDump(dump(check)))
    throw Error("Baseline round-trip differs; investigate before release.");
  mkdirSync(output);
  writeFileSync(sqlPath, sql, { flag: "wx" });
  writeFileSync(manifestPath, JSON.stringify({ format: 1, sha256: hash(sql), history: expected }, null, 2) + "\n", { flag: "wx" });
  console.log("Baseline generated and restored on isolated scratch DBs. Independently review seed rows, privileges and runtime QA before committing the two artifacts.");
}
function install() {
  const target = connection("DATABASE_MIGRATION_URL");
  if (!existsSync(sqlPath) || !existsSync(manifestPath))
    throw Error("Verified baseline artifact is missing. Generate and review it before deployment.");
  const sql = readFileSync(sqlPath, "utf8");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expected = history();
  if (manifest.format !== 1 || manifest.sha256 !== hash(sql) ||
      JSON.stringify(manifest.history) !== JSON.stringify(expected))
    throw Error("Baseline checksum or source inventory mismatch. Deployment stopped.");
  // Explicit first install only. An existing DB is not touched, even if its
  // migration history matches; routine application restarts use npm start.
  restore(target, sql, expected);
  console.log("Baseline installed in one transaction. Run secure root provisioning and approved first CMS publication separately.");
}
try {
  const args = process.argv.slice(2);
  if (args.join(" ") === "generate --confirm-empty-scratch") generate();
  else if (args.join(" ") === "install --confirm-empty-target") install();
  else throw Error("Use generate --confirm-empty-scratch or install --confirm-empty-target. No startup or reset mode.");
} catch (error) {
  // All expected messages are authored above; never echo raw parser/DB secrets.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Set |DATABASE_|Scratch databases|Unsupported connection|Historical migration|Target is|Database migration ledger|Baseline |Two separate|Scratch database|Verified baseline|Use |psql failed|pg_dump failed)/.test(message);
  console.error(safe ? message : "Database baseline operation failed. Review local files and protected configuration.");
  process.exitCode = 1;
}
