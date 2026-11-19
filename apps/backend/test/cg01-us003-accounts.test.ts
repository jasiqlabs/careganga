import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
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
} from "./test-fixtures";
import { verifyPassword } from "../src/modules/cg-01-identity-access/domain/secret-crypto";

describe("CG-01 US-003: Admin User Creation, Directory & Assignment (14 Canonical QA Cases)", () => {
  let ctx: TestContext;
  let root: UserSession;
  let staffRoleRef: string;
  let multiRoleRef: string;

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

    // Seed a standard custom role for staff creation
    const r1 = await ctx.rolesController.create(
      root.bearer,
      {
        name: "Healthcare Nurse Staff",
        description: "Assists clinic patients and views public CMS",
        colorKey: "blue",
        actionKeys: ["cms.content.view", "communications.notifications.view"],
        requestKey: randomUUID(),
      },
      { cgRequestId: randomUUID() } as any
    );
    staffRoleRef = r1.roleRef;

    // Seed a multi-capability role
    const r2 = await ctx.rolesController.create(
      root.bearer,
      {
        name: "Multi Capability Officer",
        description: "Dual capability role",
        colorKey: "green",
        actionKeys: ["roles.view", "accounts.view"],
        requestKey: randomUUID(),
      },
      { cgRequestId: randomUUID() } as any
    );
    multiRoleRef = r2.roleRef;
  });

  // ==========================================================================
  // GROUP G5: US-003 Account Creation & Integrity (QA01, QA04, QA05, QA12, QA13)
  // ==========================================================================
  describe("G5 — US-003 Account Creation & Integrity", () => {
    test("US-003-QA01: Authorized Admin creates ACTIVE staff with name, mobile, email, password, eligible role atomically", async () => {
      const requestKey = randomUUID();
      const correlationRef = randomUUID();

      const res = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Dr. Ananya Sharma",
          mobile: "9812345678",
          email: "ananya.sharma@careganga.org",
          password: "InitialPassword123!",
          roleRef: staffRoleRef,
          requestKey,
        },
        { cgRequestId: correlationRef } as any
      );

      assert.ok(res.accountRef, "accountRef must be returned");
      assert.equal(res.status, "ACTIVE", "New account must be immediately ACTIVE");
      assert.equal(res.revision, 1, "Initial account revision must be 1");
      assert.equal(res.message, "Account change confirmed.");

      // Verify PostgreSQL database state
      const accRow = await ctx.pool.query("SELECT * FROM account WHERE id = $1", [res.accountRef]);
      assert.equal(accRow.rowCount, 1);
      const a = accRow.rows[0];
      assert.equal(a.display_name, "Dr. Ananya Sharma");
      assert.equal(a.normalized_mobile, "9812345678");
      assert.equal(a.normalized_email, "ananya.sharma@careganga.org");
      assert.equal(a.contact_phone, "+919812345678");
      assert.equal(a.status, "ACTIVE");
      assert.equal(Number(a.access_version), 1);
      assert.equal(Number(a.revision), 1);

      // Verify credential in identity_credential
      const credRow = await ctx.pool.query(
        "SELECT * FROM identity_credential WHERE account_id = $1",
        [res.accountRef]
      );
      assert.equal(credRow.rowCount, 1);
      assert.ok(credRow.rows[0].password_hash.length > 20);
      assert.equal(credRow.rows[0].password_hash.includes("InitialPassword123!"), false, "Plaintext password must not be stored");
      assert.ok(await verifyPassword("InitialPassword123!", credRow.rows[0].password_hash));

      // Verify role assignment in account_role
      const roleAssign = await ctx.pool.query(
        "SELECT * FROM account_role WHERE account_id = $1 AND revoked_at IS NULL",
        [res.accountRef]
      );
      assert.equal(roleAssign.rowCount, 1);
      assert.equal(roleAssign.rows[0].role_id, staffRoleRef);
      assert.equal(roleAssign.rows[0].assigned_by, root.accountId);

      // Verify audit event
      const auditRow = await ctx.pool.query(
        "SELECT * FROM access_audit WHERE action_key = 'identity.account.create' AND target_account_id = $1",
        [res.accountRef]
      );
      assert.equal(auditRow.rowCount, 1);
      assert.equal(auditRow.rows[0].outcome, "SUCCESS");
    });

    test("US-003-QA04: Forged role/account, protected role, retired role, and non-Admin direct POST denied", async () => {
      // 1. Attempt assignment of protected root role -> ForbiddenException
      const rootRole = await ctx.pool.query(
        "SELECT id FROM role WHERE is_protected = true AND realm_id = $1",
        [root.realmId]
      );
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Forged Root User",
            mobile: "9812345679",
            password: "Password123!",
            roleRef: rootRole.rows[0].id,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 2. Attempt assignment of non-existent roleRef -> BadRequestException / ForbiddenException
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Forged RoleRef User",
            mobile: "9812345679",
            password: "Password123!",
            roleRef: randomUUID(),
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException || err instanceof BadRequestException
      );

      // 3. Attempt assignment of retired role -> ForbiddenException
      const retRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Temporary Retired Role",
          actionKeys: ["roles.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      await ctx.rolesController.retire(
        root.bearer,
        retRole.roleRef,
        { expectedRevision: 1, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );

      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Retired Role User",
            mobile: "9812345679",
            password: "Password123!",
            roleRef: retRole.roleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. Non-admin actor cannot create accounts
      const staffUser = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Non Admin Staff",
          mobile: "9812345671",
          password: "Password123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      const staffSession = await loginUser(ctx, "9812345671", "Password123!");

      await assert.rejects(
        ctx.accountsController.create(
          staffSession.bearer,
          {
            displayName: "Unauthorized Create",
            mobile: "9812345672",
            password: "Password123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );
    });

    test("US-003-QA05: Duplicate mobile/email and repeated/concurrent Admin Create User requests handled cleanly", async () => {
      const requestKey1 = randomUUID();

      // 1. Initial creation
      const created = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Original Account",
          mobile: "9870000001",
          email: "duplicate.test@careganga.org",
          password: "InitialPassword123!",
          roleRef: staffRoleRef,
          requestKey: requestKey1,
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Duplicate mobile rejected with ConflictException
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Another Person Same Mobile",
            mobile: "9870000001", // duplicate mobile
            email: "other.email@careganga.org",
            password: "InitialPassword123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );

      // 3. Duplicate email (case-insensitive) rejected with ConflictException
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Another Person Same Email",
            mobile: "9870000002",
            email: "DUPLICATE.TEST@CAREGANGA.ORG", // duplicate email case-insensitive
            password: "InitialPassword123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );

      // 4. Repeated request with identical requestKey and payload returns idempotent replay
      const replay = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Original Account",
          mobile: "9870000001",
          email: "duplicate.test@careganga.org",
          password: "InitialPassword123!",
          roleRef: staffRoleRef,
          requestKey: requestKey1,
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(replay.accountRef, created.accountRef, "Replay must return original accountRef");
      assert.equal(replay.revision, created.revision);
      assert.ok(replay.message.includes("Previously confirmed"));

      // 5. Replay with same requestKey but altered payload rejected with ConflictException
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Tampered Payload Account",
            mobile: "9870000003",
            password: "InitialPassword123!",
            roleRef: staffRoleRef,
            requestKey: requestKey1, // reused!
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );
    });

    test("US-003-QA12: Mobile-only account creation works and signs in without email or OTP verification", async () => {
      const mobile = "9871112233";
      const password = "MobileOnlyPassword123!";

      // Create with email omitted
      const res = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Ramesh Kumar",
          mobile,
          password,
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      assert.ok(res.accountRef);
      assert.equal(res.status, "ACTIVE");

      // Verify in DB: normalized_email is null
      const row = await ctx.pool.query("SELECT * FROM account WHERE id = $1", [res.accountRef]);
      assert.equal(row.rows[0].normalized_email, null);
      assert.equal(row.rows[0].normalized_mobile, mobile);

      // Direct sign in with mobile number succeeds immediately
      const userSession = await loginUser(ctx, mobile, password);
      assert.ok(userSession.token);
      assert.equal(userSession.displayName, "Ramesh Kumar");

      // Can execute authorized action
      const effective = await ctx.rolesController.effective(userSession.bearer);
      assert.equal(effective.displayName, "Ramesh Kumar");
    });

    test("US-003-QA13: Account create/assign/status change generates redacted audit event and clean error messages", async () => {
      const correlationRef = randomUUID();

      // 1. Create account
      const res = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Sunita Verma",
          mobile: "9872223344",
          password: "SunitaPassword123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: correlationRef } as any
      );

      // Verify create audit
      const createAudit = await ctx.pool.query(
        "SELECT * FROM access_audit WHERE action_key = 'identity.account.create' AND target_account_id = $1",
        [res.accountRef]
      );
      assert.equal(createAudit.rowCount, 1);
      assert.equal(createAudit.rows[0].safe_context.targetDisplay, "Sunita Verma");

      // 2. Status change audit
      await ctx.accountsController.status(
        root.bearer,
        res.accountRef,
        {
          status: "SUSPENDED",
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const statusAudit = await ctx.pool.query(
        "SELECT * FROM access_audit WHERE action_key = 'identity.account.status' AND target_account_id = $1",
        [res.accountRef]
      );
      assert.equal(statusAudit.rowCount, 1);
      assert.equal(statusAudit.rows[0].safe_context.targetDisplay, "Sunita Verma");

      // 3. Verify errors do not leak SQL or raw DB exceptions
      try {
        await ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Sunita Verma",
            mobile: "9872223344", // duplicate!
            password: "Password123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        );
        assert.fail("Should have thrown ConflictException");
      } catch (err: any) {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.response?.code, "DUPLICATE_ACCOUNT_OR_ASSIGNMENT");
        // No SQL or raw stack trace
        assert.equal(JSON.stringify(err.response).includes("SELECT"), false);
        assert.equal(JSON.stringify(err.response).includes("pg_"), false);
      }
    });
  });

  // ==========================================================================
  // GROUP G6: US-003 Assignment, Lifecycle & Access (QA02, QA03, QA06, QA07, QA08, QA09, QA10, QA11, QA14)
  // ==========================================================================
  describe("G6 — US-003 Assignment, Lifecycle & Access", () => {
    test("US-003-QA02: API contracts for assign, revoke, status, list maintain multi-client parity", async () => {
      // 1. Create a staff member
      const acc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Pooja Patel",
          mobile: "9873334455",
          password: "PoojaPassword123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Assign different role (PUT /api/access/accounts/:accountRef/role)
      const assignRes = await ctx.accountsController.assign(
        root.bearer,
        acc.accountRef,
        {
          roleRef: multiRoleRef,
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(assignRes.revision, 2);
      assert.equal(assignRes.accountRef, acc.accountRef);

      // 3. Revoke role (DELETE /api/access/accounts/:accountRef/role)
      const revokeRes = await ctx.accountsController.revoke(
        root.bearer,
        acc.accountRef,
        {
          expectedRevision: 2,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(revokeRes.revision, 3);

      // 4. Update status (PATCH /api/access/accounts/:accountRef/status)
      const statusRes = await ctx.accountsController.status(
        root.bearer,
        acc.accountRef,
        {
          status: "SUSPENDED",
          expectedRevision: 3,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(statusRes.status, "SUSPENDED");
      assert.equal(statusRes.revision, 4);

      // 5. Subsequent list shows updated account state
      const list = await ctx.accountsController.list(root.bearer, "Pooja Patel");
      const found = list.accounts.find((a) => a.accountRef === acc.accountRef);
      assert.ok(found);
      assert.equal(found.status, "SUSPENDED");
      assert.equal(found.roleRef, null);
    });

    test("US-003-QA03: Account/role selector returns minimum permitted names to create-only operators; full directory denied", async () => {
      // Create role for a create-only operator (accounts.create + roles.assign, but NO accounts.view)
      const createOnlyRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Create Only Operator Role",
          actionKeys: ["accounts.create", "roles.assign"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Create Only Operator",
          mobile: "9874445566",
          password: "OperatorPassword123!",
          roleRef: createOnlyRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const opSession = await loginUser(ctx, "9874445566", "OperatorPassword123!");

      // 1. Can call roles/options (to choose role when creating user)
      const roleOpts = await ctx.rolesController.options(opSession.bearer, "");
      assert.ok(roleOpts.options.length > 0);

      // 2. Can call accounts/options (because has roles.assign)
      const accOpts = await ctx.accountsController.options(opSession.bearer, "");
      assert.ok(Array.isArray(accOpts.options));

      // 3. CANNOT call full accounts directory (requires accounts.view)
      await assert.rejects(
        ctx.accountsController.list(opSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. CANNOT call full audit history (requires access.audit.view)
      await assert.rejects(
        ctx.auditController.history(opSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );
    });

    test("US-003-QA06: Suspension, deactivation, and role revocation invalidate current sessions immediately", async () => {
      // 1. Create user and login
      const acc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Revocation Test User",
          mobile: "9875556677",
          password: "UserPassword123!",
          roleRef: multiRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const userSession = await loginUser(ctx, "9875556677", "UserPassword123!");
      // Session is valid initially
      const eff1 = await ctx.rolesController.effective(userSession.bearer);
      assert.equal(eff1.displayName, "Revocation Test User");

      // 2. Admin revokes role -> session invalidated immediately
      await ctx.accountsController.revoke(
        root.bearer,
        acc.accountRef,
        { expectedRevision: 1, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );

      // Existing bearer token is now rejected with UnauthorizedException
      await assert.rejects(
        ctx.rolesController.effective(userSession.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // 3. Re-assign role, log in again
      await ctx.accountsController.assign(
        root.bearer,
        acc.accountRef,
        { roleRef: staffRoleRef, expectedRevision: 2, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );
      const userSession2 = await loginUser(ctx, "9875556677", "UserPassword123!");
      assert.ok(userSession2.token);

      // 4. Admin suspends account -> session invalidated immediately
      await ctx.accountsController.status(
        root.bearer,
        acc.accountRef,
        { status: "SUSPENDED", expectedRevision: 3, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );
      await assert.rejects(
        ctx.rolesController.effective(userSession2.bearer),
        (err: any) => err instanceof UnauthorizedException
      );
      // Login blocked while suspended
      await assert.rejects(
        loginUser(ctx, "9875556677", "UserPassword123!"),
        (err: any) => err instanceof UnauthorizedException
      );

      // 5. Admin deactivates account -> cannot re-activate or assign
      await ctx.accountsController.status(
        root.bearer,
        acc.accountRef,
        { status: "DEACTIVATED", expectedRevision: 4, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );
      await assert.rejects(
        ctx.accountsController.status(
          root.bearer,
          acc.accountRef,
          { status: "ACTIVE", expectedRevision: 5, requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );
    });

    test("US-003-QA07: Empty/no-results, boundary names/mobile, and stale revision handling", async () => {
      // 1. Search with no results returns clean empty array and zero count
      const emptySearch = await ctx.accountsController.list(root.bearer, "NonExistentNameXYZ12345");
      assert.equal(emptySearch.accounts.length, 0);
      assert.equal(emptySearch.total, 0);

      // 2. Name boundaries (< 2 chars or > 160 chars) rejected
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "X", // too short
            mobile: "9876667788",
            password: "Password123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "A".repeat(161), // too long
            mobile: "9876667788",
            password: "Password123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 3. Mobile boundaries (invalid Indian format) rejected
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Valid Name",
            mobile: "1234567890", // does not start with 6-9
            password: "Password123!",
            roleRef: staffRoleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 4. Stale revision conflict on assign
      const acc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Revision Boundary User",
          mobile: "9876667788",
          password: "Password123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await assert.rejects(
        ctx.accountsController.assign(
          root.bearer,
          acc.accountRef,
          {
            roleRef: multiRoleRef,
            expectedRevision: 999, // Stale!
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );
    });

    test("US-003-QA08: No HR/branch/clinical owner records are invented for standalone account creation", async () => {
      const res = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Minimal Staff",
          mobile: "9877778899",
          password: "Password123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // Verify DB columns: only core account fields exist, no phantom future modules
      const accRow = await ctx.pool.query("SELECT * FROM account WHERE id = $1", [res.accountRef]);
      const cols = Object.keys(accRow.rows[0]);
      assert.equal(cols.includes("department_id"), false);
      assert.equal(cols.includes("branch_id"), false);
      assert.equal(cols.includes("clinical_specialty"), false);
      assert.equal(cols.includes("hr_employee_code"), false);
    });

    test("US-003-QA09: Factual account summary counts match PostgreSQL database counts exactly", async () => {
      const list = await ctx.accountsController.list(root.bearer);
      const summary = list.summary;

      // Verify against direct DB counts
      const dbCounts = await ctx.pool.query(`
        SELECT count(*)::int as total,
          count(*) FILTER(WHERE status='ACTIVE')::int as active,
          count(*) FILTER(WHERE status='SUSPENDED')::int as suspended,
          count(*) FILTER(WHERE status='DEACTIVATED')::int as deactivated
        FROM account WHERE realm_id = $1`, [root.realmId]);

      assert.equal(summary.total, dbCounts.rows[0].total);
      assert.equal(summary.active, dbCounts.rows[0].active);
      assert.equal(summary.suspended, dbCounts.rows[0].suspended);
      assert.equal(summary.deactivated, dbCounts.rows[0].deactivated);
    });

    test("US-003-QA10: Sensitive role with roles.manage cannot be directly assigned; follows CG-03 approval boundary", async () => {
      // 1. Create a custom role that contains roles.manage (as root)
      const sensitiveRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Role Manager Candidate",
          actionKeys: ["roles.view", "roles.manage"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Direct assignment via accounts.create MUST fail closed
      await assert.rejects(
        ctx.accountsController.create(
          root.bearer,
          {
            displayName: "Escalated User Candidate",
            mobile: "9878889900",
            password: "Password123!",
            roleRef: sensitiveRole.roleRef,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 3. Direct assignment via accounts.assign MUST fail closed
      const normalAcc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Normal User",
          mobile: "9878889901",
          password: "Password123!",
          roleRef: staffRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await assert.rejects(
        ctx.accountsController.assign(
          root.bearer,
          normalAcc.accountRef,
          {
            roleRef: sensitiveRole.roleRef,
            expectedRevision: 1,
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );
    });

    test("US-003-QA11: Last protected root cannot be demoted, suspended, or deactivated", async () => {
      // 1. Attempt to suspend root account -> ForbiddenException
      await assert.rejects(
        ctx.accountsController.status(
          root.bearer,
          root.accountId,
          { status: "SUSPENDED", expectedRevision: 1, requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 2. Attempt to deactivate root account -> ForbiddenException
      await assert.rejects(
        ctx.accountsController.status(
          root.bearer,
          root.accountId,
          { status: "DEACTIVATED", expectedRevision: 1, requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 3. Attempt to revoke root account role -> ForbiddenException
      await assert.rejects(
        ctx.accountsController.revoke(
          root.bearer,
          root.accountId,
          { expectedRevision: 1, requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. Verify in DB: root account is still ACTIVE and role is still protected
      const rootDb = await ctx.pool.query("SELECT * FROM account WHERE id = $1", [root.accountId]);
      assert.equal(rootDb.rows[0].status, "ACTIVE");
    });

    test("US-003-QA14: Custom role with multiple capabilities assigned atomically and enforced; switching removes rights", async () => {
      // 1. Assign multiRoleRef (has roles.view AND accounts.view) to staff user
      const acc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Dual Access Staff",
          mobile: "9879990011",
          password: "Password123!",
          roleRef: multiRoleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const session1 = await loginUser(ctx, "9879990011", "Password123!");

      // 2. Both capabilities are active
      const catalog = await ctx.rolesController.catalog(session1.bearer);
      assert.ok(catalog.groups.length > 0);
      const accList = await ctx.accountsController.list(session1.bearer);
      assert.ok(accList.accounts.length > 0);

      // 3. Switch role to staffRoleRef (has only cms.content.view, notices.view)
      await ctx.accountsController.assign(
        root.bearer,
        acc.accountRef,
        {
          roleRef: staffRoleRef,
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 4. Old session token revoked
      await assert.rejects(
        ctx.rolesController.catalog(session1.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // 5. New session has previous rights removed
      const session2 = await loginUser(ctx, "9879990011", "Password123!");
      await assert.rejects(
        ctx.rolesController.catalog(session2.bearer),
        (err: any) => err instanceof ForbiddenException
      );
      await assert.rejects(
        ctx.accountsController.list(session2.bearer),
        (err: any) => err instanceof ForbiddenException
      );
    });
  });
});
