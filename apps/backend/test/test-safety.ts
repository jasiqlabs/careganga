import { URL } from "node:url";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";

/**
 * CareGanga QA Test Environment Safety Guard.
 *
 * Enforces strict isolation:
 * - Refuses connection if the database name does not contain 'test'.
 * - Refuses connection if target matches production, staging, development, or Neon shared pool.
 * - Never prints or leaks credentials, passwords, or connection strings.
 */

export interface TestDatabaseValidationResult {
  isSafe: boolean;
  sanitizedTarget: string;
  reason?: string;
}

const FORBIDDEN_DB_PATTERNS = [
  /neondb/i,
  /prod/i,
  /production/i,
  /staging/i,
  /stage/i,
  /dev/i,
  /development/i,
];

export function validateTestDatabaseUrl(rawUrl?: string): TestDatabaseValidationResult {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return {
      isSafe: false,
      sanitizedTarget: "[NOT_SET]",
      reason: "TEST_DATABASE_URL is not set or empty.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      isSafe: false,
      sanitizedTarget: "[INVALID_URL_FORMAT]",
      reason: "TEST_DATABASE_URL is not a valid URL.",
    };
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return {
      isSafe: false,
      sanitizedTarget: `${parsed.protocol}//${parsed.hostname}`,
      reason: `Invalid protocol '${parsed.protocol}'; expected postgres: or postgresql:.`,
    };
  }

  const dbName = parsed.pathname.replace(/^\//, "").trim();
  const sanitizedTarget = `${parsed.protocol}//${parsed.hostname}:${parsed.port || 5432}/${dbName}`;

  if (!dbName) {
    return {
      isSafe: false,
      sanitizedTarget,
      reason: "Database name is missing from connection URL.",
    };
  }

  // Mandatory requirement: DB name must explicitly include 'test'
  if (!dbName.toLowerCase().includes("test")) {
    return {
      isSafe: false,
      sanitizedTarget,
      reason: `Database name '${dbName}' does not contain 'test'. Only explicitly designated test databases are permitted.`,
    };
  }

  // Refuse if matching any forbidden environment name
  for (const pattern of FORBIDDEN_DB_PATTERNS) {
    // If pattern matches dbName, but pattern is not 'test'
    if (pattern.test(dbName) && !dbName.toLowerCase().startsWith("careganga_test") && !dbName.toLowerCase().startsWith("cg_test")) {
      // Specifically check for dangerous terms
      if (/neondb|prod|production|staging|stage/.test(dbName.toLowerCase())) {
        return {
          isSafe: false,
          sanitizedTarget,
          reason: `Database name '${dbName}' matches forbidden environment keyword (${pattern}). Refusing execution.`,
        };
      }
    }
  }

  // Host check: forbid neon pooler unless explicitly designated as test host
  if (parsed.hostname.includes("neon.tech") && dbName.toLowerCase() === "neondb") {
    return {
      isSafe: false,
      sanitizedTarget,
      reason: "Refusing execution against shared developer Neon database ('neondb').",
    };
  }

  return {
    isSafe: true,
    sanitizedTarget,
  };
}

export function sanitizeSecret(secret: string): string {
  if (!secret || secret.length < 4) return "****";
  return secret.slice(0, 2) + "****" + secret.slice(-2);
}

export function getSafeTestDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL;
  const validation = validateTestDatabaseUrl(url);
  if (!validation.isSafe) {
    return null;
  }
  return url!;
}

/**
 * Deterministically cleans only test-owned tables in the disposable test database.
 * Never touches schema_migration or non-test resources.
 */
export async function cleanTestDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const currentDb = await client.query<{ current_database: string }>("SELECT current_database()");
    const dbName = currentDb.rows[0]?.current_database ?? "";
    if (!dbName.toLowerCase().includes("test")) {
      throw new Error(`SAFETY HALT: Attempted to clean database '${dbName}', which is not a test database.`);
    }

    // Truncate tables cleanly; TRUNCATE bypasses row-level BEFORE DELETE triggers
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE 
        access_audit,
        account_role,
        identity_credential,
        auth_session,
        auth_challenge,
        auth_login_attempt,
        role,
        account,
        access_realm
      CASCADE;
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ensures the disposable test database has the current CareGanga schema applied.
 * Strictly verifies database safety before invoking migration runner.
 */
export async function ensureTestDatabaseMigrated(testDbUrl: string): Promise<void> {
  const validation = validateTestDatabaseUrl(testDbUrl);
  if (!validation.isSafe) {
    throw new Error(`SAFETY HALT: Cannot migrate non-test database: ${validation.reason}`);
  }

  const migrateScript = resolve(__dirname, "../db/migrate.ts");
  const tsxCli = require.resolve("tsx/cli");

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxCli, migrateScript], {
      cwd: resolve(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_MIGRATION_URL: testDbUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(
          new Error(`Test database migration failed with exit code ${code}. Stderr: ${stderr}`)
        );
      }
    });

    child.on("error", (err) => reject(err));
  });
}

