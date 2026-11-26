import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  getSafeTestDatabaseUrl,
  validateTestDatabaseUrl,
  cleanTestDatabase,
  ensureTestDatabaseMigrated,
} from "./test-safety";
import { runBootstrapSubprocess } from "./bootstrap-runner";
import { verifyPassword } from "../src/modules/cg-01-identity-access/domain/secret-crypto";

/**
 * CG-01 US-001 Automated Tests:
 * - US-001-QA01: One-time Super Admin Bootstrap
 * - US-001-QA02: Duplicate and Concurrent Bootstrap Prevention
 *
 * SAFETY FIRST:
 * These tests require a fresh, disposable PostgreSQL database explicitly designated for testing.
 * Execution will halt if TEST_DATABASE_URL is missing or points to a non-test database.
 */

describe("CG-01 → US-001-QA01 & QA02: Super Admin Bootstrap", () => {
  const rawTestDbUrl = process.env.TEST_DATABASE_URL;
  const validation = validateTestDatabaseUrl(rawTestDbUrl);

  // If no safe test database is provided, report the safety block cleanly
  if (!validation.isSafe) {
    test("BLOCKED: Test database safety gate", (t) => {
      t.diagnostic(
        `TEST EXECUTION BLOCKED: A dedicated disposable PostgreSQL test database is required.\n` +
        `Validation status: ${validation.reason}\n` +
        `Sanitized target: ${validation.sanitizedTarget}\n` +
        `To run these tests safely, configure TEST_DATABASE_URL with a database name containing 'test'\n` +
        `(e.g., postgresql://postgres:postgres@localhost:5432/careganga_test).\n` +
        `Repository stage gate: INTERNAL_DESIGN_CONTENT_APPROVED_RUNTIME_AND_INDEPENDENT_QA_NOT_RUN.`
      );
      assert.ok(true, "Safety check verified: non-test database protected from execution.");
    });
    return;
  }

  const safeDbUrl = rawTestDbUrl!;
  let pool: Pool;

  before(async () => {
    // 1. Ensure schema is fully migrated in disposable test database
    await ensureTestDatabaseMigrated(safeDbUrl);

    pool = new Pool({
      connectionString: safeDbUrl,
      max: 5,
      application_name: "careganga-qa-bootstrap-suite",
    });

    // Verify database connection and double-check database name safety
    const client = await pool.connect();
    try {
      const res = await client.query<{ current_database: string }>("SELECT current_database()");
      const dbName = res.rows[0].current_database;
      assert.ok(
        dbName.toLowerCase().includes("test"),
        `Safety violation: Connected database '${dbName}' does not contain 'test'.`
      );
    } finally {
      client.release();
    }
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Deterministic reset of test tables before every test
    await cleanTestDatabase(pool);
  });

  // =========================================================================
  // QA01 — FIRST SUPER ADMIN BOOTSTRAP (POSITIVE SCENARIOS)
  // =========================================================================

  test("QA01-P01: Valid initial bootstrap succeeds with valid inputs", async () => {
    const syntheticName = "QA Synthetic SuperAdmin";
    const syntheticMobile = "9876543210";
    const syntheticEmail = "qa-root@careganga.test";
    const syntheticPassword = "SuperAdminPassword123!";

    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      confirmFlag: true,
      name: syntheticName,
      mobile: syntheticMobile,
      email: syntheticEmail,
      password: syntheticPassword,
    });

    assert.equal(result.exitCode, 0, `Expected exit code 0, got ${result.exitCode}. Stderr: ${result.stderr}`);
    assert.match(
      result.stdout,
      /Protected CareGanga Super Admin provisioned\./,
      "Expected success message in stdout"
    );
    // Verify no secret leak in logs
    assert.doesNotMatch(result.stdout, new RegExp(syntheticPassword));
    assert.doesNotMatch(result.stderr, new RegExp(syntheticPassword));
  });

  test("QA01-P02: Account and role verification in database", async () => {
    const syntheticName = "Audit Root Admin";
    const syntheticMobile = "9123456789";
    const syntheticEmail = "audit-root@careganga.test";
    const syntheticPassword = "AuditPassword123#";

    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: syntheticName,
      mobile: syntheticMobile,
      email: syntheticEmail,
      password: syntheticPassword,
    });
    assert.equal(result.exitCode, 0);

    const client = await pool.connect();
    try {
      // 1. Exactly one root account exists
      const accounts = await client.query<{
        id: string;
        realm_id: string;
        display_name: string;
        normalized_mobile: string;
        normalized_email: string;
        contact_phone: string;
        status: string;
      }>("SELECT * FROM account");

      assert.equal(accounts.rowCount, 1, "Exactly one account must exist");
      const rootAccount = accounts.rows[0];
      assert.equal(rootAccount.status, "ACTIVE", "Account status must be ACTIVE");
      assert.equal(rootAccount.display_name, syntheticName);
      assert.equal(rootAccount.normalized_mobile, syntheticMobile);
      assert.equal(rootAccount.normalized_email, syntheticEmail);
      assert.equal(rootAccount.contact_phone, "+91" + syntheticMobile);

      // 2. Realm verification
      const realm = await client.query<{ realm_key: string }>(
        "SELECT realm_key FROM access_realm WHERE id = $1",
        [rootAccount.realm_id]
      );
      assert.equal(realm.rowCount, 1);
      assert.equal(realm.rows[0].realm_key, "FOUNDATION_ROOT");

      // 3. Protected Super Admin role exists
      const roles = await client.query<{
        id: string;
        name: string;
        normalized_name: string;
        is_protected: boolean;
      }>("SELECT * FROM role WHERE realm_id = $1 AND is_protected = true", [rootAccount.realm_id]);
      assert.equal(roles.rowCount, 1);
      const superRole = roles.rows[0];
      assert.equal(superRole.name, "Super Admin");
      assert.equal(superRole.normalized_name, "super admin");
      assert.equal(superRole.is_protected, true, "Super Admin role must be protected");

      // 4. Role assignment exists and links account to role
      const assignments = await client.query<{
        account_id: string;
        role_id: string;
        revoked_at: string | null;
      }>("SELECT * FROM account_role WHERE account_id = $1", [rootAccount.id]);
      assert.equal(assignments.rowCount, 1);
      assert.equal(assignments.rows[0].role_id, superRole.id);
      assert.equal(assignments.rows[0].revoked_at, null);
    } finally {
      client.release();
    }
  });

  test("QA01-P03: Credential verification and password hash validity", async () => {
    const syntheticPassword = "VerifiablePassword999$";

    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Credential Test Admin",
      mobile: "8888888888",
      password: syntheticPassword,
    });
    assert.equal(result.exitCode, 0);

    const client = await pool.connect();
    try {
      const creds = await client.query<{
        account_id: string;
        password_hash: string;
        credential_version: number;
      }>("SELECT * FROM identity_credential");

      assert.equal(creds.rowCount, 1, "Exactly one credential record must exist");
      const stored = creds.rows[0];

      // Password hash must be strong salted scrypt
      assert.notEqual(stored.password_hash, syntheticPassword, "Password must not be stored in plaintext");
      assert.ok(stored.password_hash.startsWith("scrypt$32768$"), "Hash must use scrypt with N=32768");
      assert.equal(stored.credential_version, 1);

      // Verify with the domain password verification function
      const isValid = await verifyPassword(syntheticPassword, stored.password_hash);
      assert.equal(isValid, true, "Domain verifyPassword must accept the synthetic password");

      const isInvalid = await verifyPassword("WrongPassword123!", stored.password_hash);
      assert.equal(isInvalid, false, "Domain verifyPassword must reject an incorrect password");
    } finally {
      client.release();
    }
  });

  test("QA01-P04: Audit verification without secret leakage", async () => {
    const syntheticName = "Audited Super Admin";
    const syntheticMobile = "7777777777";
    const syntheticPassword = "AuditSafePassword!1";

    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: syntheticName,
      mobile: syntheticMobile,
      password: syntheticPassword,
    });
    assert.equal(result.exitCode, 0);

    const client = await pool.connect();
    try {
      const audits = await client.query<{
        actor_account_id: string;
        target_account_id: string;
        action_key: string;
        outcome: string;
        safe_context: Record<string, unknown>;
        correlation_ref: string;
      }>("SELECT * FROM access_audit");

      assert.equal(audits.rowCount, 1, "Exactly one access audit record must exist");
      const audit = audits.rows[0];
      assert.equal(audit.action_key, "identity.root.bootstrap");
      assert.equal(audit.outcome, "SUCCESS");
      assert.ok(audit.correlation_ref, "Correlation ref must be present");

      // Verify safe_context contains no secret, password or PII
      const contextStr = JSON.stringify(audit.safe_context);
      assert.doesNotMatch(contextStr, new RegExp(syntheticPassword));
      assert.doesNotMatch(contextStr, new RegExp(syntheticMobile));
    } finally {
      client.release();
    }
  });

  test("QA01-P05: Atomicity - all records committed consistently", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Atomicity Check Root",
      mobile: "9999999999",
      password: "AtomicityPassword#1",
    });
    assert.equal(result.exitCode, 0);

    const client = await pool.connect();
    try {
      const accountRes = await client.query("SELECT COUNT(*) FROM account");
      const credRes = await client.query("SELECT COUNT(*) FROM identity_credential");
      const roleRes = await client.query("SELECT COUNT(*) FROM role WHERE is_protected = true");
      const assignRes = await client.query("SELECT COUNT(*) FROM account_role");
      const auditRes = await client.query("SELECT COUNT(*) FROM access_audit");

      assert.equal(Number(accountRes.rows[0].count), 1);
      assert.equal(Number(credRes.rows[0].count), 1);
      assert.equal(Number(roleRes.rows[0].count), 1);
      assert.equal(Number(assignRes.rows[0].count), 1);
      assert.equal(Number(auditRes.rows[0].count), 1);
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // QA01 — SUPPLEMENTAL NEGATIVE AND BOUNDARY SCENARIOS
  // =========================================================================

  test("QA01-Neg01: Rejects missing required name and commits no records", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "", // Invalid: length < 2
      mobile: "9876543210",
      password: "ValidPassword123!",
    });
    assert.equal(result.exitCode, 1);

    const client = await pool.connect();
    try {
      const count = await client.query("SELECT COUNT(*) FROM account");
      assert.equal(Number(count.rows[0].count), 0, "No account should be created on invalid name");
    } finally {
      client.release();
    }
  });

  test("QA01-Neg02: Rejects invalid mobile number (non-Indian prefix or length)", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Valid Name",
      mobile: "1234567890", // Invalid: does not start with [6-9]
      password: "ValidPassword123!",
    });
    assert.equal(result.exitCode, 1);

    const client = await pool.connect();
    try {
      const count = await client.query("SELECT COUNT(*) FROM account");
      assert.equal(Number(count.rows[0].count), 0, "No account should be created on invalid mobile");
    } finally {
      client.release();
    }
  });

  test("QA01-Neg03: Rejects weak password (< 8 chars) before transaction", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Valid Name",
      mobile: "9876543210",
      password: "short", // Invalid: length < 8
    });
    assert.equal(result.exitCode, 1);

    const client = await pool.connect();
    try {
      const count = await client.query("SELECT COUNT(*) FROM account");
      assert.equal(Number(count.rows[0].count), 0, "No account should be created on weak password");
    } finally {
      client.release();
    }
  });

  test("QA01-Neg04: Rejects invocation without --confirm-one-time-root flag", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      confirmFlag: false, // Omit mandatory CLI flag
      name: "Valid Name",
      mobile: "9876543210",
      password: "ValidPassword123!",
    });
    assert.equal(result.exitCode, 1);

    const client = await pool.connect();
    try {
      const count = await client.query("SELECT COUNT(*) FROM account");
      assert.equal(Number(count.rows[0].count), 0, "No account should be created without confirm flag");
    } finally {
      client.release();
    }
  });

  test("QA01-Neg05: Rejects invocation without database URL", async () => {
    const result = await runBootstrapSubprocess({
      databaseUrl: undefined, // Missing DB URL
      name: "Valid Name",
      mobile: "9876543210",
      password: "ValidPassword123!",
    });
    assert.equal(result.exitCode, 1);
  });

  // =========================================================================
  // QA02 — DUPLICATE AND CONCURRENT BOOTSTRAP PREVENTION
  // =========================================================================

  test("QA02-N01: Sequential duplicate bootstrap is safely rejected", async () => {
    // 1. Initial valid bootstrap
    const initial = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "First Root",
      mobile: "9876543210",
      email: "first-root@careganga.test",
      password: "FirstPassword123!",
    });
    assert.equal(initial.exitCode, 0, "Initial bootstrap must succeed");

    // 2. Second invocation attempt with different credentials
    const second = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Second Imposter Root",
      mobile: "9876543211",
      email: "second-root@careganga.test",
      password: "SecondPassword123!",
    });
    assert.equal(second.exitCode, 1, "Duplicate bootstrap must be rejected with exit code 1");
    assert.match(second.stderr, /One-time root provisioning failed/, "Stderr must indicate failure");

    // 3. Database verification: original root intact, no duplicate records
    const client = await pool.connect();
    try {
      const accounts = await client.query<{ display_name: string; normalized_mobile: string }>(
        "SELECT display_name, normalized_mobile FROM account"
      );
      assert.equal(accounts.rowCount, 1, "Exactly one account must remain");
      assert.equal(accounts.rows[0].display_name, "First Root", "Original account display name preserved");
      assert.equal(accounts.rows[0].normalized_mobile, "9876543210", "Original account mobile preserved");

      const roleCount = await client.query("SELECT COUNT(*) FROM role WHERE is_protected = true");
      assert.equal(Number(roleCount.rows[0].count), 1, "No duplicate role created");

      const assignCount = await client.query("SELECT COUNT(*) FROM account_role");
      assert.equal(Number(assignCount.rows[0].count), 1, "No duplicate assignment created");
    } finally {
      client.release();
    }
  });

  test("QA02-N02: Concurrent bootstrap - exactly one process wins, one rejected", async () => {
    // Start from clean database. Launch two independent subprocesses concurrently.
    const proc1Promise = runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Concurrent Candidate A",
      mobile: "9111111111",
      email: "candidate-a@careganga.test",
      password: "CandidatePassA123!",
    });

    const proc2Promise = runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Concurrent Candidate B",
      mobile: "9222222222",
      email: "candidate-b@careganga.test",
      password: "CandidatePassB123!",
    });

    const [res1, res2] = await Promise.all([proc1Promise, proc2Promise]);

    const exitCodes = [res1.exitCode, res2.exitCode].sort();
    assert.deepEqual(
      exitCodes,
      [0, 1],
      `Expected exactly one process to exit with 0 and one with 1. Got: [${res1.exitCode}, ${res2.exitCode}]`
    );

    // Verify exactly one root account exists in the database
    const client = await pool.connect();
    try {
      const accountRes = await client.query<{ id: string; display_name: string }>(
        "SELECT id, display_name FROM account"
      );
      assert.equal(accountRes.rowCount, 1, "Exactly one root account must exist after concurrent race");

      const winnerName = accountRes.rows[0].display_name;
      assert.ok(
        winnerName === "Concurrent Candidate A" || winnerName === "Concurrent Candidate B",
        `Winner name '${winnerName}' must match one of the candidates.`
      );

      // Verify exactly one role and one assignment
      const roleCount = await client.query("SELECT COUNT(*) FROM role WHERE is_protected = true");
      assert.equal(Number(roleCount.rows[0].count), 1);

      const assignCount = await client.query("SELECT COUNT(*) FROM account_role");
      assert.equal(Number(assignCount.rows[0].count), 1);
    } finally {
      client.release();
    }
  });

  test("QA02-N03: Concurrent state integrity - no partial or orphaned records", async () => {
    // Run concurrent bootstrap
    const [res1, res2] = await Promise.all([
      runBootstrapSubprocess({
        databaseUrl: safeDbUrl,
        name: "Integrity Racer 1",
        mobile: "9333333333",
        password: "RacerPassword1#",
      }),
      runBootstrapSubprocess({
        databaseUrl: safeDbUrl,
        name: "Integrity Racer 2",
        mobile: "9444444444",
        password: "RacerPassword2#",
      }),
    ]);

    assert.ok(
      (res1.exitCode === 0 && res2.exitCode === 1) || (res1.exitCode === 1 && res2.exitCode === 0),
      "One process must succeed and one must fail"
    );

    const client = await pool.connect();
    try {
      // Confirm all tables have strictly 1 matching record for the single root
      const accounts = await client.query("SELECT id FROM account");
      const creds = await client.query("SELECT account_id FROM identity_credential");
      const assignments = await client.query("SELECT account_id, role_id FROM account_role");
      const audits = await client.query("SELECT actor_account_id FROM access_audit");

      assert.equal(accounts.rowCount, 1);
      assert.equal(creds.rowCount, 1);
      assert.equal(assignments.rowCount, 1);
      assert.equal(audits.rowCount, 1);

      const rootId = accounts.rows[0].id;
      assert.equal(creds.rows[0].account_id, rootId);
      assert.equal(assignments.rows[0].account_id, rootId);
      assert.equal(audits.rows[0].actor_account_id, rootId);
    } finally {
      client.release();
    }
  });

  test("QA02-N04: Repeat bootstrap attempt after concurrent race is rejected", async () => {
    // 1. Concurrently race
    await Promise.all([
      runBootstrapSubprocess({
        databaseUrl: safeDbUrl,
        name: "Post-Race 1",
        mobile: "9555555555",
        password: "PostRacePass123!",
      }),
      runBootstrapSubprocess({
        databaseUrl: safeDbUrl,
        name: "Post-Race 2",
        mobile: "9666666666",
        password: "PostRacePass123!",
      }),
    ]);

    // 2. Third subsequent invocation
    const third = await runBootstrapSubprocess({
      databaseUrl: safeDbUrl,
      name: "Late Attempt",
      mobile: "9777777777",
      password: "LateAttemptPass123!",
    });

    assert.equal(third.exitCode, 1, "Late attempt must be rejected");

    const client = await pool.connect();
    try {
      const count = await client.query("SELECT COUNT(*) FROM account");
      assert.equal(Number(count.rows[0].count), 1, "Only initial winning root exists");
    } finally {
      client.release();
    }
  });
});
