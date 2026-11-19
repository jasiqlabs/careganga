import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import {
  getSafeTestDatabaseUrl,
  validateTestDatabaseUrl,
  cleanTestDatabase,
  ensureTestDatabaseMigrated,
} from "./test-safety";
import { runBootstrapSubprocess } from "./bootstrap-runner";
import { SessionService } from "../src/modules/cg-01-identity-access/application/session.service";
import { RolesService } from "../src/modules/cg-01-identity-access/application/roles.service";
import { AccountsService } from "../src/modules/cg-01-identity-access/application/accounts.service";
import { SecurityPolicyService } from "../src/modules/cg-01-identity-access/application/security-policy.service";
import { AccessAuditReader } from "../src/modules/cg-01-identity-access/application/access-audit-reader";
import { RolesController } from "../src/modules/cg-01-identity-access/http/roles.controller";
import { AccountsController } from "../src/modules/cg-01-identity-access/http/accounts.controller";
import { SecurityPolicyController } from "../src/modules/cg-01-identity-access/http/security-policy.controller";
import { AuditController } from "../src/modules/cg-01-identity-access/http/audit.controller";
import { SessionController } from "../src/modules/cg-01-identity-access/http/session.controller";

export const TEST_IDENTITY_ENCRYPTION_KEY =
  "qBtqVsz2cKLYDqgkRF/aDz/u1nbwZG7gNSvsZMC7sXE=";

export const ROOT_BOOTSTRAP_DEFAULTS = {
  name: "System Administrator",
  mobile: "9876543210",
  email: "admin@careganga.local",
  password: "AdminPassword123!",
};

export interface TestContext {
  pool: Pool;
  safeDbUrl: string;
  sessions: SessionService;
  rolesService: RolesService;
  accountsService: AccountsService;
  securityPolicyService: SecurityPolicyService;
  auditReader: AccessAuditReader;
  rolesController: RolesController;
  accountsController: AccountsController;
  securityPolicyController: SecurityPolicyController;
  auditController: AuditController;
  sessionController: SessionController;
}

export interface UserSession {
  bearer: string;
  token: string;
  accountId: string;
  realmId: string;
  displayName: string;
  roleName: string;
}

/**
 * Initializes the isolated test database environment.
 * Verifies safety rules and ensures migrations are up to date.
 */
export async function setupTestEnvironment(): Promise<TestContext> {
  process.env.IDENTITY_ENCRYPTION_KEY = TEST_IDENTITY_ENCRYPTION_KEY;
  const rawUrl = process.env.TEST_DATABASE_URL;
  const validation = validateTestDatabaseUrl(rawUrl);
  if (!validation.isSafe) {
    throw new Error(
      `TEST ENVIRONMENT BLOCKED: ${validation.reason} (${validation.sanitizedTarget})`
    );
  }

  const safeDbUrl = rawUrl!;
  await ensureTestDatabaseMigrated(safeDbUrl);

  const pool = new Pool({
    connectionString: safeDbUrl,
    max: 10,
    application_name: "careganga-qa-automated-suite",
  });

  const sessions = new SessionService(pool);
  const rolesService = new RolesService(pool, sessions);
  const accountsService = new AccountsService(pool, sessions);
  const securityPolicyService = new SecurityPolicyService(pool, sessions);
  const auditReader = new AccessAuditReader(pool, sessions);

  const rolesController = new RolesController(rolesService, sessions);
  const accountsController = new AccountsController(accountsService);
  const securityPolicyController = new SecurityPolicyController(securityPolicyService);
  const auditController = new AuditController(auditReader);
  const sessionController = new SessionController(sessions);

  return {
    pool,
    safeDbUrl,
    sessions,
    rolesService,
    accountsService,
    securityPolicyService,
    auditReader,
    rolesController,
    accountsController,
    securityPolicyController,
    auditController,
    sessionController,
  };
}

/**
 * Resets all test tables deterministically.
 */
export async function resetDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const currentDb = await client.query<{ current_database: string }>(
      "SELECT current_database()"
    );
    const dbName = currentDb.rows[0]?.current_database ?? "";
    if (!dbName.toLowerCase().includes("test")) {
      throw new Error(`SAFETY HALT: Attempted to clean non-test database: '${dbName}'`);
    }

    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE 
        access_audit,
        auth_security_policy_revision,
        auth_security_policy_command,
        auth_security_policy,
        role_command,
        account_command,
        role_grant,
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
 * Bootstraps the root Super Admin account in the test database.
 */
export async function bootstrapRoot(
  safeDbUrl: string,
  overrides?: Partial<typeof ROOT_BOOTSTRAP_DEFAULTS>
): Promise<void> {
  const opts = {
    ...ROOT_BOOTSTRAP_DEFAULTS,
    ...overrides,
  };
  const res = await runBootstrapSubprocess({
    databaseUrl: safeDbUrl,
    confirmFlag: true,
    name: opts.name,
    mobile: opts.mobile,
    email: opts.email,
    password: opts.password,
  });

  if (res.exitCode !== 0) {
    throw new Error(
      `Root bootstrap failed with code ${res.exitCode}. Stderr: ${res.stderr} Stdout: ${res.stdout}`
    );
  }
}

/**
 * Logs in the root Super Admin and returns session details and bearer token.
 */
export async function loginRoot(
  ctx: TestContext,
  password = ROOT_BOOTSTRAP_DEFAULTS.password,
  mobile = ROOT_BOOTSTRAP_DEFAULTS.mobile
): Promise<UserSession> {
  const correlationRef = randomUUID();
  const res = await ctx.sessions.signIn({
    identifier: mobile,
    password,
    remoteAddress: "127.0.0.1",
    deviceLabel: "qa-test-runner",
    correlationRef,
  });

  const bearer = `Bearer ${res.sessionToken}`;
  const verified = await ctx.sessions.verifySession(bearer);

  return {
    bearer,
    token: res.sessionToken,
    accountId: verified.accountId,
    realmId: verified.realmId,
    displayName: verified.displayName,
    roleName: verified.roleName,
  };
}

/**
 * Logs in any account by identifier (mobile or email) and password.
 */
export async function loginUser(
  ctx: TestContext,
  identifier: string,
  password: string
): Promise<UserSession> {
  const correlationRef = randomUUID();
  const res = await ctx.sessions.signIn({
    identifier,
    password,
    remoteAddress: "127.0.0.1",
    deviceLabel: "qa-user-agent",
    correlationRef,
  });

  const bearer = `Bearer ${res.sessionToken}`;
  const verified = await ctx.sessions.verifySession(bearer);

  return {
    bearer,
    token: res.sessionToken,
    accountId: verified.accountId,
    realmId: verified.realmId,
    displayName: verified.displayName,
    roleName: verified.roleName,
  };
}
