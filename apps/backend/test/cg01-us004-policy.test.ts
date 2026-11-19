import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import {
  setupTestEnvironment,
  resetDatabase,
  bootstrapRoot,
  loginRoot,
  loginUser,
  TestContext,
  UserSession,
  ROOT_BOOTSTRAP_DEFAULTS,
} from "./test-fixtures";

describe("CG-01 US-004: Session & Security Policy (8 Canonical QA Cases)", () => {
  let ctx: TestContext;
  let root: UserSession;

  before(async () => {
    ctx = await setupTestEnvironment();
  });

  after(async () => {
    if (ctx?.pool) {
      await ctx.pool.end();
    }
  });

  beforeEach(async () => {
    await resetDatabase(ctx.pool);
    await bootstrapRoot(ctx.safeDbUrl);
    root = await loginRoot(ctx);
  });

  // ==========================================================================
  // GROUP G7: US-004 Security Policy & Revision (QA01, QA02, QA03, QA04)
  // ==========================================================================
  describe("G7 — US-004 Security Policy & Revision", () => {
    test("US-004-QA01: Protected Super Admin reads session defaults and saves permitted versioned revision after password proof", async () => {
      // 1. Read policy defaults before any update
      const initial = await ctx.securityPolicyController.read(root.bearer);
      assert.equal(initial.maxSessionAgeSeconds, 28800);
      assert.equal(initial.idleTimeoutSeconds, 1800);
      assert.equal(initial.failedAttemptWindowSeconds, 900);
      assert.equal(initial.maxFailedAttempts, 6);
      assert.equal(initial.rootPasswordReauthRequired, true);
      assert.equal(initial.revision, 0, "Initial revision before DB row is 0");

      // 2. Save versioned update with valid current password proof
      const idempotencyKey = randomUUID();
      const correlationRef = randomUUID();

      const updateRes = await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 14400, // 4 hours
          idleTimeoutSeconds: 1200,    // 20 minutes
          failedAttemptWindowSeconds: 600,
          maxFailedAttempts: 5,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey,
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: correlationRef } as any
      );

      assert.equal(updateRes.status, "SAVED");
      assert.equal(updateRes.revision, 1);

      // 3. Verify in PostgreSQL database
      const policyRow = await ctx.pool.query(
        "SELECT * FROM auth_security_policy WHERE access_realm_id = $1",
        [root.realmId]
      );
      assert.equal(policyRow.rowCount, 1);
      const p = policyRow.rows[0];
      assert.equal(p.revision, 1);
      assert.equal(p.max_session_age_seconds, 14400);
      assert.equal(p.idle_timeout_seconds, 1200);
      assert.equal(p.failed_attempt_window_seconds, 600);
      assert.equal(p.max_failed_attempts, 5);
      assert.equal(p.root_password_reauth_required, true);

      // Verify immutable revision row in auth_security_policy_revision
      const revRow = await ctx.pool.query(
        "SELECT * FROM auth_security_policy_revision WHERE policy_id = $1 AND revision = 1",
        [p.id]
      );
      assert.equal(revRow.rowCount, 1);
      assert.equal(revRow.rows[0].actor_ref, root.accountId);
      assert.equal(revRow.rows[0].correlation_ref, correlationRef);

      // Verify audit row in access_audit
      const auditRow = await ctx.pool.query(
        "SELECT * FROM access_audit WHERE action_key = 'identity.security-policy.update' AND correlation_ref = $1",
        [correlationRef]
      );
      assert.equal(auditRow.rowCount, 1);
      assert.equal(auditRow.rows[0].outcome, "SUCCESS");

      // 4. Read again via controller returns revision 1
      const updated = await ctx.securityPolicyController.read(root.bearer);
      assert.equal(updated.revision, 1);
      assert.equal(updated.maxSessionAgeSeconds, 14400);
      assert.equal(updated.idleTimeoutSeconds, 1200);
    });

    test("US-004-QA02: Other actors, revoked session, forged root, or wrong password cannot inspect/change policy", async () => {
      // 1. Create a regular staff user
      const customRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Standard Staff Role",
          actionKeys: ["roles.view", "accounts.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Regular Staff Member",
          mobile: "9900112233",
          password: "StaffPassword123!",
          roleRef: customRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const staffSession = await loginUser(ctx, "9900112233", "StaffPassword123!");

      // 2. Non-root staff cannot read security policy -> ForbiddenException (403)
      await assert.rejects(
        ctx.securityPolicyController.read(staffSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );

      // 3. Non-root staff cannot update security policy -> ForbiddenException (403)
      await assert.rejects(
        ctx.securityPolicyController.update(
          staffSession.bearer,
          {
            maxSessionAgeSeconds: 14400,
            idleTimeoutSeconds: 1200,
            failedAttemptWindowSeconds: 600,
            maxFailedAttempts: 5,
            rootPasswordReauthRequired: true,
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
            currentPassword: "StaffPassword123!",
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. Root with WRONG password proof -> ForbiddenException ("Current password could not be confirmed")
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          {
            maxSessionAgeSeconds: 14400,
            idleTimeoutSeconds: 1200,
            failedAttemptWindowSeconds: 600,
            maxFailedAttempts: 5,
            rootPasswordReauthRequired: true,
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
            currentPassword: "WrongPassword999!",
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 5. Revoked root session cannot read policy -> UnauthorizedException
      await ctx.sessionController.logout(root.bearer);
      await assert.rejects(
        ctx.securityPolicyController.read(root.bearer),
        (err: any) => err instanceof UnauthorizedException
      );
    });

    test("US-004-QA03: Cannot disable required reauth; unbounded durations, unsafe limits, unknown keys rejected", async () => {
      const basePayload = {
        maxSessionAgeSeconds: 14400,
        idleTimeoutSeconds: 1200,
        failedAttemptWindowSeconds: 600,
        maxFailedAttempts: 5,
        rootPasswordReauthRequired: true,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
      };

      // 1. rootPasswordReauthRequired cannot be false
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, rootPasswordReauthRequired: false },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 2. Unbounded maxSessionAgeSeconds (< 900 or > 28800) rejected
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, maxSessionAgeSeconds: 800 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, maxSessionAgeSeconds: 30000 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 3. Unbounded idleTimeoutSeconds (> maxSessionAgeSeconds or < 300) rejected
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, idleTimeoutSeconds: 200 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, maxSessionAgeSeconds: 1000, idleTimeoutSeconds: 1200 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 4. Unbounded maxFailedAttempts (< 3 or > 10) rejected
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, maxFailedAttempts: 2 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, maxFailedAttempts: 15 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 5. Unknown keys in payload rejected
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          { ...basePayload, unknownField: "malicious" },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );
    });

    test("US-004-QA04: Concurrent revision conflicts and idempotent retries resolve consistently", async () => {
      const idempotencyKey = randomUUID();

      // 1. Initial valid update
      const update1 = await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 14400,
          idleTimeoutSeconds: 1200,
          failedAttemptWindowSeconds: 600,
          maxFailedAttempts: 5,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey,
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(update1.status, "SAVED");
      assert.equal(update1.revision, 1);

      // 2. Idempotent retry with identical idempotencyKey and payload returns REPLAY_CONFIRMED
      const replay = await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 14400,
          idleTimeoutSeconds: 1200,
          failedAttemptWindowSeconds: 600,
          maxFailedAttempts: 5,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey,
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(replay.status, "REPLAY_CONFIRMED");
      assert.equal(replay.revision, 1);

      // 3. Lookup endpoint returns CONFIRMED
      const lookup = await ctx.securityPolicyController.lookup(root.bearer, idempotencyKey);
      assert.equal(lookup.status, "CONFIRMED");
      assert.equal(lookup.revision, 1);

      // 4. Stale revision conflict: attempting update with expectedRevision: 0 when revision is 1
      await assert.rejects(
        ctx.securityPolicyController.update(
          root.bearer,
          {
            maxSessionAgeSeconds: 10800,
            idleTimeoutSeconds: 900,
            failedAttemptWindowSeconds: 600,
            maxFailedAttempts: 5,
            rootPasswordReauthRequired: true,
            expectedRevision: 0, // Stale!
            idempotencyKey: randomUUID(),
            currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );
    });
  });

  // ==========================================================================
  // GROUP G8: US-004 Session, Regression & DB Security (QA05, QA06, QA07, QA08)
  // ==========================================================================
  describe("G8 — US-004 Session, Regression & DB Security", () => {
    test("US-004-QA05: Shorter session max/idle limits apply dynamically to sessions without client polling", async () => {
      // 1. Initial policy: max 28800 (8h), idle 1800 (30m)
      // Login root and staff
      const customRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Session Enforcement Role",
          actionKeys: ["roles.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Session User",
          mobile: "9911223344",
          password: "SessionUser123!",
          roleRef: customRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const staff = await loginUser(ctx, "9911223344", "SessionUser123!");
      // Session works initially
      const eff = await ctx.rolesController.effective(staff.bearer);
      assert.equal(eff.displayName, "Session User");

      // 2. Reduce maxSessionAgeSeconds to 900 (15 min) and idleTimeoutSeconds to 300 (5 min)
      await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 900,
          idleTimeoutSeconds: 300,
          failedAttemptWindowSeconds: 300,
          maxFailedAttempts: 4,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: randomUUID() } as any
      );

      // 3. Simulate an expired session by artificially moving issued_at back by 1000 seconds
      const digest1 = createHash("sha256").update(staff.token).digest("hex");
      await ctx.pool.query(
        "UPDATE auth_session SET issued_at = now() - interval '1000 seconds' WHERE token_digest = $1",
        [digest1]
      );

      // 4. Session is immediately rejected as max session age exceeded dynamically on server
      await assert.rejects(
        ctx.rolesController.effective(staff.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // 5. Simulate idle session by moving last_seen_at back by 400 seconds
      const staff2 = await loginUser(ctx, "9911223344", "SessionUser123!");
      const digest2 = createHash("sha256").update(staff2.token).digest("hex");
      await ctx.pool.query(
        "UPDATE auth_session SET last_seen_at = now() - interval '400 seconds' WHERE token_digest = $1",
        [digest2]
      );

      await assert.rejects(
        ctx.rolesController.effective(staff2.bearer),
        (err: any) => err instanceof UnauthorizedException
      );
    });

    test("US-004-QA06: Core identity workflows (login, change password, roles, accounts) remain functional after policy update", async () => {
      // 1. Update policy
      await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 7200,
          idleTimeoutSeconds: 900,
          failedAttemptWindowSeconds: 600,
          maxFailedAttempts: 5,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Super Admin login works
      const rootReLogin = await loginRoot(ctx);
      assert.ok(rootReLogin.token);

      // 3. Role creation works
      const testRole = await ctx.rolesController.create(
        rootReLogin.bearer,
        {
          name: "Post Policy Update Role",
          actionKeys: ["roles.view", "accounts.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.ok(testRole.roleRef);

      // 4. Account creation works
      const testAcc = await ctx.accountsController.create(
        rootReLogin.bearer,
        {
          displayName: "Post Policy Staff",
          mobile: "9922334455",
          password: "OriginalPassword123!",
          roleRef: testRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.ok(testAcc.accountRef);

      // 5. User signs in and changes password
      const userSession = await loginUser(ctx, "9922334455", "OriginalPassword123!");
      const chPass = await ctx.sessionController.changePassword(
        userSession.bearer,
        {
          currentPassword: "OriginalPassword123!",
          newPassword: "NewChangedPassword123!",
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(chPass.status, "PASSWORD_CHANGED");

      // Old session is revoked
      await assert.rejects(
        ctx.rolesController.effective(userSession.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // Sign in with new password succeeds
      const newSession = await loginUser(ctx, "9922334455", "NewChangedPassword123!");
      assert.ok(newSession.token);
    });

    test("US-004-QA07: Protected policy navigation authorization; public/staff actors denied policy endpoints", async () => {
      // 1. Unauthenticated request -> UnauthorizedException (401)
      await assert.rejects(
        ctx.securityPolicyController.read(""),
        (err: any) => err instanceof UnauthorizedException
      );

      // 2. Staff user denied policy lookup and read -> ForbiddenException (403)
      const staffRole = await ctx.rolesController.create(
        root.bearer,
        { name: "Public Notice Staff", actionKeys: ["cms.content.view"], requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );
      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "General User",
          mobile: "9933445566",
          password: "UserPassword123!",
          roleRef: staffRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      const generalSession = await loginUser(ctx, "9933445566", "UserPassword123!");

      await assert.rejects(
        ctx.securityPolicyController.read(generalSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );
      await assert.rejects(
        ctx.securityPolicyController.lookup(generalSession.bearer, randomUUID()),
        (err: any) => err instanceof ForbiddenException
      );
    });

    test("US-004-QA08: CRITICAL DB integrity: unique revision, immutable revision history, fail-closed constraints", async () => {
      // 1. Update policy to create DB revision
      const updateRes = await ctx.securityPolicyController.update(
        root.bearer,
        {
          maxSessionAgeSeconds: 14400,
          idleTimeoutSeconds: 1200,
          failedAttemptWindowSeconds: 600,
          maxFailedAttempts: 5,
          rootPasswordReauthRequired: true,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
          currentPassword: ROOT_BOOTSTRAP_DEFAULTS.password,
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Verify immutable trigger on auth_security_policy_revision:
      // Direct UPDATE on auth_security_policy_revision MUST throw
      await assert.rejects(
        ctx.pool.query("UPDATE auth_security_policy_revision SET revision = 999 WHERE revision = 1"),
        /Security policy revision history is immutable/
      );

      // Direct DELETE on auth_security_policy_revision MUST throw
      await assert.rejects(
        ctx.pool.query("DELETE FROM auth_security_policy_revision WHERE revision = 1"),
        /Security policy revision history is immutable/
      );

      // 3. Verify immutable trigger on access_audit:
      await assert.rejects(
        ctx.pool.query("UPDATE access_audit SET outcome = 'TAMPERED'"),
        /CG-01 access audit history is immutable/
      );
      await assert.rejects(
        ctx.pool.query("DELETE FROM access_audit"),
        /CG-01 access audit history is immutable/
      );

      // 4. Verify unique constraints on access_realm (only one FOUNDATION_ROOT allowed)
      await assert.rejects(
        ctx.pool.query("INSERT INTO access_realm(realm_key) VALUES('FOUNDATION_ROOT')"),
        (err: any) => err.code === "23505"
      );
    });
  });
});
