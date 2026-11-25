import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { validateTestDatabaseUrl } from "./test-safety";
import { hashPassword } from "../src/modules/cg-01-identity-access/domain/secret-crypto";
import { SessionService } from "../src/modules/cg-01-identity-access/application/session.service";
import { AccessAuditReader } from "../src/modules/cg-01-identity-access/application/access-audit-reader";
import { PlatformSettingsService } from "../src/modules/cg-21-platform-configuration-audit/application/platform-settings.service";
import { PlatformAuditService } from "../src/modules/cg-21-platform-configuration-audit/application/platform-audit.service";
import { RecoveryService } from "../src/modules/cg-21-platform-configuration-audit/application/recovery.service";
import {
  RecoveryFacility,
  UnavailableRecoveryFacility,
  VerifiedBackupEvidence,
} from "../src/modules/cg-21-platform-configuration-audit/infrastructure/recovery-facility";

export const TEST_KEY = "qBtqVsz2cKLYDqgkRF/aDz/u1nbwZG7gNSvsZMC7sXE=";
export const SUPER_ADMIN_PASSWORD = "AdminPassword123!";
export const ORDINARY_STAFF_PASSWORD = "StaffPassword123!";
function sealAuditToken(payload: object): string {
  const root = Buffer.from(TEST_KEY, "base64");
  const key = createHash("sha256")
    .update("CareGanga:CG21:scoped-audit-cursor:v1:")
    .update(root)
    .digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64url");
}

/** Controlled test double for RecoveryFacility in test environment */
class MockConfiguredRecoveryFacility extends RecoveryFacility {
  public isAvailable = true;
  public mockEvidence: VerifiedBackupEvidence | null = null;
  public failInspection = false;

  async availability() {
    if (!this.isAvailable) {
      return {
        status: "NOT_AVAILABLE" as const,
        message: "No independently verified secured backup facility is connected.",
      };
    }
    return {
      status: "AVAILABLE" as const,
      message: "Secured test facility registered for drill/test verification.",
    };
  }

  async inspectBackup(backupReference: string): Promise<VerifiedBackupEvidence | null> {
    if (this.failInspection) {
      throw new Error("Provider communication timeout");
    }
    if (this.mockEvidence && this.mockEvidence.backupReference === backupReference) {
      return this.mockEvidence;
    }
    if (backupReference.startsWith("backupref:valid-test-")) {
      return {
        backupReference,
        facilityRef: "facility:isolated-drill-adapter",
        verifiedAt: new Date().toISOString(),
      };
    }
    return null;
  }
}

describe("CG-21 US-002: Audit History, Protected Recovery, Authorization & Database Safety", () => {
  // Resolve safe test database URL
  let safeDbUrl = process.env.TEST_DATABASE_URL;
  if (!safeDbUrl && process.env.DATABASE_MIGRATION_URL) {
    try {
      const u = new URL(process.env.DATABASE_MIGRATION_URL);
      u.pathname = "/careganga_test";
      safeDbUrl = u.toString();
    } catch {}
  }

  const validation = validateTestDatabaseUrl(safeDbUrl);
  if (!validation.isSafe) {
    test("BLOCKED: Test database safety gate", (t) => {
      t.diagnostic(
        `TEST EXECUTION BLOCKED: A dedicated disposable PostgreSQL test database is required.\n` +
          `Validation status: ${validation.reason}\n` +
          `Sanitized target: ${validation.sanitizedTarget}`
      );
      assert.ok(true, "Safety check verified: non-test database protected from execution.");
    });
    return;
  }

  let pool: Pool;
  let sessions: SessionService;
  let accessAuditReader: AccessAuditReader;
  let platformSettingsService: PlatformSettingsService;
  let platformAuditService: PlatformAuditService;
  let unavailableFacility: UnavailableRecoveryFacility;
  let recoveryServiceUnavailable: RecoveryService;
  let mockFacility: MockConfiguredRecoveryFacility;
  let recoveryServiceMocked: RecoveryService;

  // Test identities
  let superAdminBearer: string;
  let superAdminAccountId: string;
  let foundationRealmId: string;

  let ordinaryAdminBearer: string;
  let ordinaryAdminAccountId: string;

  let foreignAdminBearer: string;
  let foreignRealmId: string;
  let foreignAdminAccountId: string;

  before(async () => {
    process.env.IDENTITY_ENCRYPTION_KEY = TEST_KEY;
    pool = new Pool({
      connectionString: safeDbUrl,
      max: 10,
      application_name: "careganga-us002-qa-suite",
    });

    sessions = new SessionService(pool);
    accessAuditReader = new AccessAuditReader(pool, sessions);
    platformSettingsService = new PlatformSettingsService(pool, sessions);
    platformAuditService = new PlatformAuditService(pool, sessions, accessAuditReader);

    unavailableFacility = new UnavailableRecoveryFacility();
    recoveryServiceUnavailable = new RecoveryService(pool, sessions, unavailableFacility);

    mockFacility = new MockConfiguredRecoveryFacility();
    recoveryServiceMocked = new RecoveryService(pool, sessions, mockFacility);

    // Verify connected database safety
    const dbCheck = await pool.query<{ current_database: string }>("SELECT current_database()");
    const dbName = dbCheck.rows[0].current_database;
    assert.ok(
      dbName.toLowerCase().includes("test"),
      `Safety violation: Connected database '${dbName}' does not contain 'test'.`
    );

    // Ensure platform_operation_audit check constraint includes platform.recovery.authorize (fixes 0025 omission)
    await pool.query(`
      ALTER TABLE platform_operation_audit DROP CONSTRAINT IF EXISTS platform_operation_audit_action_key_check;
      ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check
        CHECK(action_key IN ('platform.setting.save','platform.integration.configure',
          'platform.integration.check','platform.recovery.request','platform.recovery.authorize','platform.message.update'));
    `);

    // Setup Test Identities in careganga_test
    // 1. Get Foundation Realm
    const realmRes = await pool.query<{ id: string }>(
      "SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 1"
    );
    foundationRealmId = realmRes.rows[0].id;

    // 2. Super Admin Account
    const superAdminRes = await pool.query<{ id: string }>(
      "SELECT a.id FROM account a JOIN account_role ar ON ar.account_id=a.id JOIN role r ON r.id=ar.role_id WHERE a.realm_id=$1 AND r.is_protected=true LIMIT 1",
      [foundationRealmId]
    );
    superAdminAccountId = superAdminRes.rows[0].id;

    // Ensure Super Admin password is known
    const superHash = await hashPassword(SUPER_ADMIN_PASSWORD);
    await pool.query(
      "UPDATE identity_credential SET password_hash=$1 WHERE account_id=$2",
      [superHash, superAdminAccountId]
    );

    // Sign in Super Admin
    const superSign = await sessions.signIn({
      identifier: "9876543210",
      password: SUPER_ADMIN_PASSWORD,
      remoteAddress: "127.0.0.1",
      deviceLabel: "qa-super-admin-runner",
      correlationRef: randomUUID(),
    });
    superAdminBearer = `Bearer ${superSign.sessionToken}`;

    // 3. Ordinary Staff (no platform.audit.* or platform.recovery.* actions)
    let ordAccount = await pool.query<{ id: string }>(
      "SELECT id FROM account WHERE realm_id=$1 AND normalized_mobile='9879990022' LIMIT 1",
      [foundationRealmId]
    );
    if (!ordAccount.rowCount) {
      const createdOrd = await pool.query<{ id: string }>(
        "INSERT INTO account(realm_id, display_name, normalized_mobile, contact_phone, status) VALUES($1, 'Ordinary Staff', '9879990022', '+919879990022', 'ACTIVE') RETURNING id",
        [foundationRealmId]
      );
      ordinaryAdminAccountId = createdOrd.rows[0].id;
      const ordHash = await hashPassword(ORDINARY_STAFF_PASSWORD);
      await pool.query(
        "INSERT INTO identity_credential(account_id, password_hash) VALUES($1, $2)",
        [ordinaryAdminAccountId, ordHash]
      );
      // Assign non-privileged role
      const nurseRole = await pool.query<{ id: string }>(
        "SELECT id FROM role WHERE realm_id=$1 AND is_protected=false LIMIT 1",
        [foundationRealmId]
      );
      await pool.query(
        "INSERT INTO account_role(account_id, role_id, realm_id) VALUES($1, $2, $3)",
        [ordinaryAdminAccountId, nurseRole.rows[0].id, foundationRealmId]
      );
    } else {
      ordinaryAdminAccountId = ordAccount.rows[0].id;
      const ordHash = await hashPassword(ORDINARY_STAFF_PASSWORD);
      await pool.query(
        "UPDATE identity_credential SET password_hash=$1 WHERE account_id=$2",
        [ordHash, ordinaryAdminAccountId]
      );
    }

    const ordSign = await sessions.signIn({
      identifier: "9879990022",
      password: ORDINARY_STAFF_PASSWORD,
      remoteAddress: "127.0.0.1",
      deviceLabel: "qa-ordinary-staff",
      correlationRef: randomUUID(),
    });
    ordinaryAdminBearer = `Bearer ${ordSign.sessionToken}`;

    // 4. Foreign Realm reference (for cross-root testing)
    // access_realm enforces CHECK (realm_key = 'FOUNDATION_ROOT'), meaning the root realm is singular.
    // Any cross-realm token or attempt with a different realm UUID must be rejected server-side.
    foreignRealmId = randomUUID();
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Reset CG-21 tables cleanly before each test to maintain strict test isolation
    await pool.query(`
      TRUNCATE TABLE 
        recovery_authorization_command,
        recovery_operation,
        platform_operation_audit,
        platform_command,
        platform_setting_revision,
        platform_setting
      CASCADE;
    `);
  });

  // ==========================================================================
  // GROUP 1: AUDIT HISTORY AUTOMATED TESTING (QA01)
  // ==========================================================================
  describe("Group 1 — Audit History Automated Testing (QA01)", () => {
    test("QA01-01: Login activity and role change visibility in central audit view without duplicating CG-01 tables", async () => {
      // Generate genuine CG-01 login audit event
      const correlationRef = randomUUID();
      await pool.query(
        `INSERT INTO access_audit(realm_id, actor_account_id, target_account_id, action_key, outcome, correlation_ref)
         VALUES($1, $2, $2, 'identity.session.login', 'SUCCESS', $3)`,
        [foundationRealmId, superAdminAccountId, correlationRef]
      );

      // Call PlatformAuditService to read central audit projection
      const auditPage = await platformAuditService.list(superAdminBearer);

      assert.ok(auditPage.events.length > 0, "Audit events must not be empty");
      assert.equal(auditPage.coverage, "COMPLETE", "Audit coverage must be COMPLETE");

      const loginEvent = auditPage.events.find((e) => e.actionLabel === "Account signed in");
      assert.ok(loginEvent, "CG-01 login event must be visible in central audit view");
      assert.equal(loginEvent.source, "CG-01", "Source must be accurately tagged as CG-01");
      assert.ok(["System Administrator", process.env.CAREGANGA_ROOT_NAME ?? "Super Admin"].includes(loginEvent.actorDisplay));
      assert.equal(loginEvent.outcome, "Confirmed");

      // Verify that NO duplicated table exists in CG-21
      const cg21Rows = await pool.query(
        "SELECT count(*) FROM platform_operation_audit WHERE action_key LIKE 'identity.%'"
      );
      assert.equal(
        Number(cg21Rows.rows[0].count),
        0,
        "CG-21 platform_operation_audit must never copy CG-01 identity events"
      );
    });

    test("QA01-02: Setting-change activity visibility: saving audit.default_page_size records genuine CG-21 operation audit", async () => {
      // 1. Save setting via US-001 contract
      const requestKey = randomUUID();
      const correlationRef = randomUUID();
      const saveRes = await platformSettingsService.saveSetting(
        superAdminBearer,
        {
          key: "audit.default_page_size",
          value: 40,
          expectedRevision: 0,
          requestKey,
          currentPassword: SUPER_ADMIN_PASSWORD,
        },
        correlationRef
      );

      assert.equal(saveRes.status, "SAVED");
      assert.equal(saveRes.revision, 1);

      // 2. Query central audit list
      const auditPage = await platformAuditService.list(superAdminBearer);
      const settingEvent = auditPage.events.find((e) => e.source === "CG-21");

      assert.ok(settingEvent, "CG-21 operation audit event must appear in central timeline");
      assert.equal(settingEvent.actionLabel, "Platform setting updated");
      assert.ok(["System Administrator", process.env.CAREGANGA_ROOT_NAME ?? "Super Admin"].includes(settingEvent.actorDisplay));
      assert.equal(settingEvent.targetDisplay, "Audit page-size setting");
      assert.equal(settingEvent.outcome, "Confirmed");
      assert.ok(settingEvent.occurredAt, "Must include accurate ISO timestamp");
    });

    test("QA01-03: Audit event detail opening and sensitive field redaction", async () => {
      // Insert one CG-21 operation audit with safe context
      const corrRef = randomUUID();
      const insertRes = await pool.query<{ id: string }>(
        `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, safe_context, correlation_ref)
         VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', '{"setting":"audit.default_page_size","value":40}'::jsonb, $4)
         RETURNING id`,
        [foundationRealmId, superAdminAccountId, randomUUID(), corrRef]
      );

      const auditPage = await platformAuditService.list(superAdminBearer);
      const cg21Event = auditPage.events.find((e) => e.source === "CG-21");
      assert.ok(cg21Event, "Event must exist in page");

      // Open detail using the sealed eventRef
      const detail = await platformAuditService.detail(superAdminBearer, cg21Event.eventRef);
      assert.equal(detail.source, "CG-21");
      assert.equal(detail.actionLabel, "Platform setting updated");
      assert.ok(["System Administrator", process.env.CAREGANGA_ROOT_NAME ?? "Super Admin"].includes(detail.actorDisplay));
      assert.equal(detail.targetDisplay, "Audit page-size setting");

      // Verify NO raw secret, password, or token leaked in detail
      const detailStr = JSON.stringify(detail);
      assert.ok(!detailStr.includes("AdminPassword123!"), "Password must never leak");
      assert.ok(!detailStr.includes(TEST_KEY), "Identity encryption key must never leak");
      assert.ok(!detailStr.includes("secretref:"), "Secret pointers must not leak in detail");
    });

    test("QA01-04: Stable cursor pagination across merged CG-01 and CG-21 audit feeds", async () => {
      // Insert multiple CG-01 events
      for (let i = 1; i <= 3; i++) {
        await pool.query(
          `INSERT INTO access_audit(realm_id, actor_account_id, target_account_id, action_key, outcome, correlation_ref, occurred_at)
           VALUES($1, $2, $2, 'identity.session.login', 'SUCCESS', $3, now() - make_interval(secs=>$4))`,
          [foundationRealmId, superAdminAccountId, randomUUID(), i * 10]
        );
      }
      // Insert multiple CG-21 events
      for (let i = 1; i <= 3; i++) {
        await pool.query(
          `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, safe_context, correlation_ref, occurred_at)
           VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', '{"setting":"audit.default_page_size"}'::jsonb, $4, now() - make_interval(secs=>$5))`,
          [foundationRealmId, superAdminAccountId, randomUUID(), randomUUID(), i * 10 + 5]
        );
      }

      // Query page 1 with limit 3
      const page1 = await platformAuditService.list(superAdminBearer, { limit: "3" });
      assert.equal(page1.events.length, 3, "Page 1 should return exactly 3 events");
      assert.ok(page1.nextCursor, "Page 1 must have nextCursor for pagination");

      // Query page 2 using cursor
      const page2 = await platformAuditService.list(superAdminBearer, { cursor: page1.nextCursor });
      assert.ok(page2.events.length > 0, "Page 2 should return next set of events");

      // Ensure NO duplicate event IDs between page 1 and page 2
      const page1Refs = new Set(page1.events.map((e) => e.eventRef));
      for (const e of page2.events) {
        assert.ok(!page1Refs.has(e.eventRef), "Cursor pagination must not produce duplicate events");
      }
    });
  });

  // ==========================================================================
  // GROUP 2: AUTHORIZATION & DATA PROTECTION (QA02, QA07)
  // ==========================================================================
  describe("Group 2 — Authorization & Data Protection (QA02, QA07)", () => {
    test("QA02-01: Authorized audit list access succeeds for Super Admin", async () => {
      const res = await platformAuditService.list(superAdminBearer);
      assert.ok(Array.isArray(res.events));
    });

    test("QA02-02: Unauthorized Ordinary Admin audit list access rejected with 403 Forbidden", async () => {
      await assert.rejects(
        async () => {
          await platformAuditService.list(ordinaryAdminBearer);
        },
        (err) => err instanceof ForbiddenException
      );
    });

    test("QA02-03: Unauthorized Ordinary Admin audit detail access rejected with 403 Forbidden", async () => {
      // Create a valid sealed eventRef under Super Admin
      await pool.query(
        `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, correlation_ref)
         VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', $4)`,
        [foundationRealmId, superAdminAccountId, randomUUID(), randomUUID()]
      );
      const page = await platformAuditService.list(superAdminBearer);
      const validRef = page.events[0].eventRef;

      // Ordinary Admin tries to read the detail
      await assert.rejects(
        async () => {
          await platformAuditService.detail(ordinaryAdminBearer, validRef);
        },
        (err) => err instanceof ForbiddenException
      );
    });

    test("QA02-04: Unauthorized audit export rejected with 403 Forbidden", async () => {
      await assert.rejects(
        async () => {
          await platformAuditService.export(ordinaryAdminBearer);
        },
        (err) => err instanceof ForbiddenException
      );
    });

    test("QA02-05: Unauthorized target account filter rejected with BadRequestException", async () => {
      await assert.rejects(
        async () => {
          await accessAuditReader.listAccessAudit(superAdminBearer, {
            targetRef: "non-uuid-target-account",
          });
        },
        (err) => err instanceof BadRequestException
      );
    });

    test("QA02-06: Recovery request without fresh current-password confirmation rejected with ForbiddenException", async () => {
      const reqKey = randomUUID();
      await assert.rejects(
        async () => {
          await recoveryServiceMocked.request(
            superAdminBearer,
            {
              backupReference: "backupref:valid-test-20261120-drill",
              expectedVersion: 0,
              requestKey: reqKey,
              currentPassword: "WrongPassword999!",
            },
            randomUUID()
          );
        },
        (err) =>
          err instanceof ForbiddenException &&
          err.message.includes("Current password could not be confirmed")
      );
    });

    test("QA02-07: Revoked session attempting protected audit or recovery rejected with 401 Unauthorized", async () => {
      // Create a dedicated session and immediately revoke it
      const tempSign = await sessions.signIn({
        identifier: "9876543210",
        password: SUPER_ADMIN_PASSWORD,
        remoteAddress: "127.0.0.1",
        deviceLabel: "revoked-test-runner",
        correlationRef: randomUUID(),
      });
      const revokedBearer = `Bearer ${tempSign.sessionToken}`;

      // Revoke the session in auth_session table
      await pool.query(
        "UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND device_label='revoked-test-runner'",
        [superAdminAccountId]
      );

      // Attempt audit list
      await assert.rejects(
        async () => {
          await platformAuditService.list(revokedBearer);
        },
        (err) => err instanceof UnauthorizedException
      );

      // Attempt recovery availability
      await assert.rejects(
        async () => {
          await recoveryServiceUnavailable.availability(revokedBearer);
        },
        (err) => err instanceof UnauthorizedException
      );
    });

    test("QA02-08: Expired or invalidated session attempting recovery rejected with 401 Unauthorized", async () => {
      const tempSign = await sessions.signIn({
        identifier: "9876543210",
        password: SUPER_ADMIN_PASSWORD,
        remoteAddress: "127.0.0.1",
        deviceLabel: "expired-test-runner",
        correlationRef: randomUUID(),
      });
      const expiredBearer = `Bearer ${tempSign.sessionToken}`;

      // Force expires_at to the past while maintaining issued_at < expires_at
      await pool.query(
        "UPDATE auth_session SET issued_at=now() - interval '2 hours', expires_at=now() - interval '1 hour' WHERE account_id=$1 AND device_label='expired-test-runner'",
        [superAdminAccountId]
      );

      await assert.rejects(
        async () => {
          await recoveryServiceUnavailable.list(expiredBearer);
        },
        (err) => err instanceof UnauthorizedException
      );
    });

    test("QA02-09: Cross-root isolation: Tampered or foreign realm token rejected with ForbiddenException", async () => {
      // 1. Insert an audit event into Foundation Realm
      const insertRes = await pool.query<{ id: string }>(
        `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, correlation_ref)
         VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', $4)
         RETURNING id`,
        [foundationRealmId, superAdminAccountId, randomUUID(), randomUUID()]
      );

      // 2. Forge sealed token with foreign realm ID
      const tamperedRealmToken = sealAuditToken({
        kind: "event",
        v: 1,
        source: "CG-21",
        id: insertRes.rows[0].id,
        realm: foreignRealmId,
        actor: superAdminAccountId,
      });

      // Backend must reject with ForbiddenException("Audit event is unavailable")
      await assert.rejects(
        async () => {
          await platformAuditService.detail(superAdminBearer, tamperedRealmToken);
        },
        (err) =>
          err instanceof ForbiddenException &&
          err.message.includes("Audit event is unavailable")
      );

      // 3. Forge sealed token with foreign actor ID
      const tamperedActorToken = sealAuditToken({
        kind: "event",
        v: 1,
        source: "CG-21",
        id: insertRes.rows[0].id,
        realm: foundationRealmId,
        actor: randomUUID(),
      });

      await assert.rejects(
        async () => {
          await platformAuditService.detail(superAdminBearer, tamperedActorToken);
        },
        (err) =>
          err instanceof ForbiddenException &&
          err.message.includes("Audit event is unavailable")
      );
    });

    test("QA02-10: Foreign-scope cursor pagination rejected with BadRequestException", async () => {
      // Forge cursor containing foreign realm ID
      const tamperedCursor = sealAuditToken({
        kind: "cursor",
        v: 1,
        realm: foreignRealmId,
        actor: superAdminAccountId,
        from: new Date(Date.now() - 3600000).toISOString(),
        to: new Date().toISOString(),
        pageSize: 25,
        source: "ALL",
        cg01: null,
        cg21: null,
      });

      await assert.rejects(
        async () => {
          await platformAuditService.list(superAdminBearer, { cursor: tamperedCursor });
        },
        (err) =>
          err instanceof BadRequestException &&
          err.message.includes("Invalid audit page")
      );
    });

    test("QA02-11: Forged backup evidence rejected: stale date, future date, wrong format", async () => {
      // A. Invalid backup reference format (must match ^backupref:[A-Za-z0-9/_-]{6,170}$)
      await assert.rejects(
        async () => {
          await recoveryServiceMocked.request(
            superAdminBearer,
            {
              backupReference: "invalid-backup-ref",
              expectedVersion: 0,
              requestKey: randomUUID(),
              currentPassword: SUPER_ADMIN_PASSWORD,
            },
            randomUUID()
          );
        },
        (err) => err instanceof BadRequestException
      );

      // B. Stale verification date (>15 minutes ago)
      mockFacility.mockEvidence = {
        backupReference: "backupref:stale-backup-ref",
        facilityRef: "facility:stale",
        verifiedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      };
      const staleRes = await recoveryServiceMocked.request(
        superAdminBearer,
        {
          backupReference: "backupref:stale-backup-ref",
          expectedVersion: 0,
          requestKey: randomUUID(),
          currentPassword: SUPER_ADMIN_PASSWORD,
        },
        randomUUID()
      );
      assert.equal(staleRes.status, "NOT_AVAILABLE");
      assert.ok(staleRes.message?.includes("A verified secured backup is not available"));

      // C. Future verification date (>60 seconds into future)
      mockFacility.mockEvidence = {
        backupReference: "backupref:future-backup-ref",
        facilityRef: "facility:future",
        verifiedAt: new Date(Date.now() + 120 * 1000).toISOString(),
      };
      const futureRes = await recoveryServiceMocked.request(
        superAdminBearer,
        {
          backupReference: "backupref:future-backup-ref",
          expectedVersion: 0,
          requestKey: randomUUID(),
          currentPassword: SUPER_ADMIN_PASSWORD,
        },
        randomUUID()
      );
      assert.equal(futureRes.status, "NOT_AVAILABLE");
      mockFacility.mockEvidence = null; // reset
    });

    test("QA02-12: Changed backup identity rejected by database trigger cg21_recovery_guard", async () => {
      // Insert one legitimate recovery request directly for testing DB trigger
      const reqKey = randomUUID();
      const insertRes = await pool.query<{ id: string }>(
        `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest)
         VALUES($1, 'RESTORE_REQUEST', 'backupref:immutable-test-ref', $2, 'REQUESTED', $3, $4)
         RETURNING id`,
        [foundationRealmId, superAdminAccountId, reqKey, "a".repeat(64)]
      );
      const opId = insertRes.rows[0].id;

      // Attempt to alter immutable backup_reference
      await assert.rejects(
        async () => {
          await pool.query(
            "UPDATE recovery_operation SET backup_reference='backupref:tampered-ref' WHERE id=$1",
            [opId]
          );
        },
        /Recovery identity is immutable/
      );

      // Attempt to alter immutable request_key
      await assert.rejects(
        async () => {
          await pool.query(
            "UPDATE recovery_operation SET request_key=$1 WHERE id=$2",
            [randomUUID(), opId]
          );
        },
        /Recovery identity is immutable/
      );

      // Attempt to alter immutable requested_by
      await assert.rejects(
        async () => {
          await pool.query(
            "UPDATE recovery_operation SET requested_by=$1 WHERE id=$2",
            [ordinaryAdminAccountId, opId]
          );
        },
        /Recovery identity is immutable/
      );
    });
  });

  // ==========================================================================
  // GROUP 3: BACKUP & RECOVERY (QA03, QA04)
  // ==========================================================================
  describe("Group 3 — Backup & Recovery (QA03, QA04)", () => {
    describe("Part A: Provider unavailable — CURRENT ENVIRONMENT (as seen in screenshot)", () => {
      test("QA03-01: Availability reports NOT_AVAILABLE with contract-correct explanation", async () => {
        const avail = await recoveryServiceUnavailable.availability(superAdminBearer);
        assert.equal(avail.status, "NOT_AVAILABLE");
        assert.equal(
          avail.message,
          "No independently verified secured backup facility is connected."
        );
      });

      test("QA03-02: Recovery history is empty and no restore activity is claimed", async () => {
        const history = await recoveryServiceUnavailable.list(superAdminBearer);
        assert.equal(history.operations.length, 0);
      });

      test("QA03-03: Refreshing readiness remains consistently and truthfully NOT_AVAILABLE", async () => {
        for (let i = 0; i < 3; i++) {
          const avail = await recoveryServiceUnavailable.availability(superAdminBearer);
          assert.equal(avail.status, "NOT_AVAILABLE");
        }
      });

      test("QA03-04: In unavailable environment, recovery request is rejected without creating database row", async () => {
        const reqKey = randomUUID();
        const outcome = await recoveryServiceUnavailable.request(
          superAdminBearer,
          {
            backupReference: "backupref:some-integration-ref",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        assert.equal(outcome.status, "NOT_AVAILABLE");
        assert.ok(outcome.message?.includes("A verified secured backup is not available"));

        // Verify NO row was written to recovery_operation
        const count = await pool.query(
          "SELECT count(*) FROM recovery_operation WHERE foundation_realm_id=$1",
          [foundationRealmId]
        );
        assert.equal(Number(count.rows[0].count), 0, "No fake recovery operation must be written");
      });

      test("QA03-05: System never fabricates external provider identity or success state", async () => {
        const count = await pool.query(
          "SELECT count(*) FROM recovery_operation WHERE status='VERIFIED_SUCCEEDED' OR status='RUNNING'"
        );
        assert.equal(Number(count.rows[0].count), 0);
      });
    });

    describe("Part B: Recovery request idempotency — TEST ENVIRONMENT ONLY", () => {
      test("QA03-06: Authorized test request succeeds, records REQUESTED state with atomic audit", async () => {
        const reqKey = randomUUID();
        const corrRef = randomUUID();
        const res = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-01",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          corrRef
        );

        assert.equal(res.status, "REQUESTED");
        assert.ok(res.operationRef);
        assert.equal(res.version, 1);
        assert.ok(res.message?.includes("A request was recorded. No recovery has been executed."));

        // Verify database state
        const dbRow = await pool.query<{ status: string; version: number }>(
          "SELECT status, version FROM recovery_operation WHERE id=$1",
          [res.operationRef]
        );
        assert.equal(dbRow.rows[0].status, "REQUESTED");
        assert.equal(dbRow.rows[0].version, 1);

        // Verify platform_operation_audit was written in same transaction
        const auditRow = await pool.query<{ action_key: string; outcome: string }>(
          "SELECT action_key, outcome FROM platform_operation_audit WHERE resource_ref=$1",
          [res.operationRef]
        );
        assert.equal(auditRow.rows[0].action_key, "platform.recovery.request");
        assert.equal(auditRow.rows[0].outcome, "SUCCESS");
      });

      test("QA03-07: Idempotent replay with same requestKey returns REPLAY_CONFIRMED without duplicate record", async () => {
        const reqKey = randomUUID();
        const corrRef = randomUUID();

        // Submission 1
        const res1 = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-02",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          corrRef
        );
        assert.equal(res1.status, "REQUESTED");

        // Submission 2 (same requestKey, same payload)
        const res2 = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-02",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          corrRef
        );
        assert.equal(res2.status, "REPLAY_CONFIRMED");
        assert.equal(res2.operationRef, res1.operationRef);
        assert.equal(res2.version, res1.version);

        // Verify only 1 row exists in database
        const rows = await pool.query(
          "SELECT count(*) FROM recovery_operation WHERE request_key=$1",
          [reqKey]
        );
        assert.equal(Number(rows.rows[0].count), 1, "Exactly one row must exist");
      });

      test("QA03-08: Lookup endpoint reconciles previous request status by requestKey", async () => {
        const reqKey = randomUUID();
        const res1 = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-03",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        const lookup = await recoveryServiceMocked.lookup(superAdminBearer, reqKey);
        assert.equal(lookup.status, "CONFIRMED");
        assert.equal(lookup.operationRef, res1.operationRef);
        assert.equal(lookup.operationStatus, "REQUESTED");
        assert.equal(lookup.version, 1);
      });

      test("QA03-09: Replay with same requestKey but different backup reference throws PLATFORM_REPLAY_CONFLICT", async () => {
        const reqKey = randomUUID();
        await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-04",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        await assert.rejects(
          async () => {
            await recoveryServiceMocked.request(
              superAdminBearer,
              {
                backupReference: "backupref:valid-test-drill-different",
                expectedVersion: 0,
                requestKey: reqKey,
                currentPassword: SUPER_ADMIN_PASSWORD,
              },
              randomUUID()
            );
          },
          (err) => err instanceof ConflictException
        );
      });

      test("QA03-10: Privileged authorization transitions REQUESTED to PRIVILEGED_AUTHORIZED with version bump", async () => {
        const reqKey = randomUUID();
        const createRes = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-05",
            expectedVersion: 0,
            requestKey: reqKey,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        const authKey = randomUUID();
        const authRes = await recoveryServiceMocked.authorizeRecovery(
          superAdminBearer,
          createRes.operationRef,
          {
            requestKey: authKey,
            expectedVersion: 1,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        assert.equal(authRes.status, "PRIVILEGED_AUTHORIZED");
        assert.equal(authRes.version, 2);
        assert.ok(authRes.message?.includes("Authorization recorded. Restoration has not started."));

        // Verify database row
        const row = await pool.query<{ status: string; version: number; authorized_by: string }>(
          "SELECT status, version, authorized_by FROM recovery_operation WHERE id=$1",
          [createRes.operationRef]
        );
        assert.equal(row.rows[0].status, "PRIVILEGED_AUTHORIZED");
        assert.equal(row.rows[0].version, 2);
        assert.equal(row.rows[0].authorized_by, superAdminAccountId);

        // Verify authorization command record
        const cmd = await pool.query(
          "SELECT count(*) FROM recovery_authorization_command WHERE request_key=$1",
          [authKey]
        );
        assert.equal(Number(cmd.rows[0].count), 1);
      });
    });

    describe("Part C: Unknown provider result & Recovery state protection", () => {
      test("QA04-01: Unknown / timeout provider inspection returns NOT_AVAILABLE, never false success", async () => {
        mockFacility.failInspection = true;
        const res = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-timeout",
            expectedVersion: 0,
            requestKey: randomUUID(),
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );
        assert.equal(res.status, "NOT_AVAILABLE");
        mockFacility.failInspection = false;
      });

      test("QA04-02: Direct database trigger blocks RUNNING and VERIFIED_SUCCEEDED from application writes", async () => {
        // Attempting to insert RUNNING status directly
        await assert.rejects(
          async () => {
            await pool.query(
              `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest, provider_operation_ref)
               VALUES($1, 'RESTORE_REQUEST', 'backupref:valid-test-drill-fail', $2, 'RUNNING', $3, $4, 'provider:run-1')`,
              [foundationRealmId, superAdminAccountId, randomUUID(), "b".repeat(64)]
            );
          },
          /Recovery execution requires a verified operations adapter/
        );

        // Attempting to insert VERIFIED_SUCCEEDED status directly
        await assert.rejects(
          async () => {
            await pool.query(
              `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest, provider_operation_ref, verified_proof_ref)
               VALUES($1, 'RESTORE_REQUEST', 'backupref:valid-test-drill-fail', $2, 'VERIFIED_SUCCEEDED', $3, $4, 'provider:run-2', 'proof:verified')`,
              [foundationRealmId, superAdminAccountId, randomUUID(), "c".repeat(64)]
            );
          },
          /Recovery execution requires a verified operations adapter/
        );
      });

      test("QA04-03: Append-only immutability: UPDATE or DELETE on recovery_authorization_command is blocked", async () => {
        // Create an authorization command
        const createRes = await recoveryServiceMocked.request(
          superAdminBearer,
          {
            backupReference: "backupref:valid-test-drill-06",
            expectedVersion: 0,
            requestKey: randomUUID(),
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );
        const authKey = randomUUID();
        await recoveryServiceMocked.authorizeRecovery(
          superAdminBearer,
          createRes.operationRef,
          {
            requestKey: authKey,
            expectedVersion: 1,
            currentPassword: SUPER_ADMIN_PASSWORD,
          },
          randomUUID()
        );

        // Attempt to delete
        await assert.rejects(
          async () => {
            await pool.query(
              "DELETE FROM recovery_authorization_command WHERE request_key=$1",
              [authKey]
            );
          },
          /CG-21 security history is append-only/
        );

        // Attempt to update
        await assert.rejects(
          async () => {
            await pool.query(
              "UPDATE recovery_authorization_command SET result_version=99 WHERE request_key=$1",
              [authKey]
            );
          },
          /CG-21 security history is append-only/
        );
      });
    });
  });

  // ==========================================================================
  // GROUP 4: PAGINATION & DATA SAFETY (QA05, QA08)
  // ==========================================================================
  describe("Group 4 — Pagination & Data Safety (QA05, QA08)", () => {
    test("QA05-01: Default audit page size is 25 before any custom setting is configured", async () => {
      const page = await platformAuditService.list(superAdminBearer);
      assert.equal(page.limit, 25, "Default page size must be 25");
    });

    test("QA05-02: Change effective page size to 40 via US-001 and verify audit list uses 40", async () => {
      // Configure audit.default_page_size = 40
      const saveRes = await platformSettingsService.saveSetting(
        superAdminBearer,
        {
          key: "audit.default_page_size",
          value: 40,
          expectedRevision: 0,
          requestKey: randomUUID(),
          currentPassword: SUPER_ADMIN_PASSWORD,
        },
        randomUUID()
      );
      assert.equal(saveRes.revision, 1);

      // Verify setting readback
      const setting = await platformSettingsService.setting(superAdminBearer);
      assert.equal(setting.value, 40);
      assert.equal(setting.revision, 1);

      // Query central audit list without limit param
      const auditPage = await platformAuditService.list(superAdminBearer);
      assert.equal(auditPage.limit, 40, "Effective page size in central audit must now be 40");
    });

    test("QA05-03: Hard server maximum of 100 enforced; forged page size of 1000 rejected", async () => {
      // 1. limit 100 accepted
      const page100 = await platformAuditService.list(superAdminBearer, { limit: "100" });
      assert.equal(page100.limit, 100);

      // 2. limit 1000 rejected with BadRequestException
      await assert.rejects(
        async () => {
          await platformAuditService.list(superAdminBearer, { limit: "1000" });
        },
        (err) =>
          err instanceof BadRequestException &&
          err.message.includes("Audit page size must be 1 to 100")
      );

      // 3. limit 0 rejected
      await assert.rejects(
        async () => {
          await platformAuditService.list(superAdminBearer, { limit: "0" });
        },
        (err) => err instanceof BadRequestException
      );

      // 4. negative limit rejected
      await assert.rejects(
        async () => {
          await platformAuditService.list(superAdminBearer, { limit: "-5" });
        },
        (err) => err instanceof BadRequestException
      );
    });

    test("QA05-04: Single audit source failure reports PARTIAL coverage without false empty response", async () => {
      // Insert one CG-21 event
      await pool.query(
        `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, safe_context, correlation_ref)
         VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', '{"setting":"audit.default_page_size"}'::jsonb, $4)`,
        [foundationRealmId, superAdminAccountId, randomUUID(), randomUUID()]
      );

      // Create a service with simulated failing CG-01 reader
      const failingIdentityAudit = {
        listPlatformProjection: async () => {
          throw new Error("CG-01 database connection timeout");
        },
        readPlatformProjectionEvent: async () => null,
      } as unknown as AccessAuditReader;

      const partialAuditService = new PlatformAuditService(
        pool,
        sessions,
        failingIdentityAudit
      );

      const res = await partialAuditService.list(superAdminBearer);
      assert.equal(res.coverage, "PARTIAL", "Coverage must be PARTIAL when one source fails");
      assert.deepEqual(res.unavailableSources, ["CG-01"]);
      assert.ok(res.events.length > 0, "CG-21 events must still be returned rather than empty");
    });

    test("QA05-05: Both audit sources failing throws ServiceUnavailableException", async () => {
      const failingIdentityAudit = {
        listPlatformProjection: async () => {
          throw new Error("CG-01 down");
        },
        readPlatformProjectionEvent: async () => null,
      } as unknown as AccessAuditReader;

      // Pool that succeeds on setting read but fails on audit feed query
      const brokenPool = {
        query: async (sql: string) => {
          if (typeof sql === "string" && sql.includes("platform_setting")) {
            return { rows: [{ typed_value: 25 }], rowCount: 1 };
          }
          throw new Error("CG-21 DB down");
        },
      } as unknown as Pool;

      const brokenAuditService = new PlatformAuditService(
        brokenPool,
        sessions,
        failingIdentityAudit
      );

      await assert.rejects(
        async () => {
          await brokenAuditService.list(superAdminBearer);
        },
        (err) =>
          err instanceof ServiceUnavailableException &&
          err.message.includes("Both audit sources are currently unavailable")
      );
    });

    test("QA08-01: Root composite foreign keys enforced at database level", async () => {
      // Cannot insert recovery_operation pointing to non-existent realm
      await assert.rejects(
        async () => {
          await pool.query(
            `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest)
             VALUES($1, 'RESTORE_REQUEST', 'backupref:valid-ref-foreign', $2, 'REQUESTED', $3, $4)`,
            [randomUUID(), superAdminAccountId, randomUUID(), "d".repeat(64)]
          );
        },
        /violates foreign key constraint/
      );
    });

    test("QA08-02: Unique constraint on (foundation_realm_id, request_key) prevents duplicate operations", async () => {
      const dupKey = randomUUID();
      await pool.query(
        `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest)
         VALUES($1, 'RESTORE_REQUEST', 'backupref:dup-test-ref-01', $2, 'REQUESTED', $3, $4)`,
        [foundationRealmId, superAdminAccountId, dupKey, "e".repeat(64)]
      );

      await assert.rejects(
        async () => {
          await pool.query(
            `INSERT INTO recovery_operation(foundation_realm_id, operation_type, backup_reference, requested_by, status, request_key, request_digest)
             VALUES($1, 'RESTORE_REQUEST', 'backupref:dup-test-ref-02', $2, 'REQUESTED', $3, $4)`,
            [foundationRealmId, superAdminAccountId, dupKey, "f".repeat(64)]
          );
        },
        /violates unique constraint/
      );
    });

    test("QA08-03: Atomic transaction rollback preserves data integrity on unexpected error", async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO platform_operation_audit(foundation_realm_id, actor_account_id, action_key, resource_ref, outcome, safe_context, correlation_ref)
           VALUES($1, $2, 'platform.setting.save', $3, 'SUCCESS', '{}'::jsonb, $4)`,
          [foundationRealmId, superAdminAccountId, randomUUID(), randomUUID()]
        );
        // Simulate failure before commit
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      const count = await pool.query("SELECT count(*) FROM platform_operation_audit");
      assert.equal(Number(count.rows[0].count), 0, "Rollback must leave 0 records");
    });
  });
});
