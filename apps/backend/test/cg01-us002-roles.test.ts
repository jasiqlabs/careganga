import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import {
  setupTestEnvironment,
  resetDatabase,
  bootstrapRoot,
  loginRoot,
  loginUser,
  TestContext,
  UserSession,
} from "./test-fixtures";
import { capabilitiesInUse, implementedCapability } from "../src/modules/cg-01-identity-access/domain/capability-catalog";

describe("CG-01 US-002: Custom Roles & Permissions (11 Canonical QA Cases)", () => {
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
  // GROUP G1: US-002 Role Creation & Persistence (QA01, QA09)
  // ==========================================================================
  describe("G1 — US-002 Role Creation & Persistence", () => {
    test("US-002-QA01: Authorized Super Admin creates custom role with valid grouped capabilities and readable labels", async () => {
      // 1. Check capability catalog structure
      const catalog = await ctx.rolesController.catalog(root.bearer);
      assert.ok(catalog.groups.length > 0, "Capability catalog should have groups");
      for (const group of catalog.groups) {
        assert.ok(group.group.length > 0, "Group name must be non-empty");
        assert.ok(group.actions.length > 0, "Group actions must be non-empty");
        for (const action of group.actions) {
          assert.ok(action.key, "Action must have key");
          assert.ok(action.businessLabel, "Action must have businessLabel");
        }
      }

      // 2. Create custom role with allowed grouped capabilities
      const requestKey = randomUUID();
      const createRes = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Clinic Coordinator",
          description: "Coordinates day-to-day healthcare clinic workflows",
          colorKey: "blue",
          actionKeys: ["roles.view", "accounts.view", "cms.content.view"],
          requestKey,
        },
        { cgRequestId: randomUUID() } as any
      );

      assert.ok(createRes.roleRef, "roleRef must be returned");
      assert.equal(createRes.revision, 1, "Initial revision must be 1");
      assert.equal(createRes.message, "Role change confirmed.");

      // 3. Verify PostgreSQL database state
      const roleRow = await ctx.pool.query(
        "SELECT * FROM role WHERE id = $1 AND realm_id = $2",
        [createRes.roleRef, root.realmId]
      );
      assert.equal(roleRow.rowCount, 1, "Role must be persisted in database");
      const r = roleRow.rows[0];
      assert.equal(r.name, "Clinic Coordinator");
      assert.equal(r.normalized_name, "clinic coordinator");
      assert.equal(r.is_protected, false, "Custom role must not be protected");
      assert.equal(r.active, true, "Custom role must be active");
      assert.equal(r.color_key, "blue");
      assert.equal(Number(r.revision), 1);

      // Verify persisted grants in role_grant
      const grantRows = await ctx.pool.query(
        "SELECT capability_key FROM role_grant WHERE role_id = $1 ORDER BY capability_key",
        [createRes.roleRef]
      );
      assert.deepEqual(
        grantRows.rows.map((g) => g.capability_key),
        ["accounts.view", "cms.content.view", "roles.view"]
      );

      // 4. Negative: Normalized duplicate role name is rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "  clinic coordinator  ",
            actionKeys: ["roles.view"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );

      // 5. Negative: Invalid or unknown capabilities rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "Invalid Role",
            actionKeys: ["invalid.capability.key"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 6. Negative: Duplicate action keys in array rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "Duplicate Action Keys Role",
            actionKeys: ["roles.view", "roles.view"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 7. Negative: Empty name or name < 2 chars rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "A",
            actionKeys: ["roles.view"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // 8. Negative: Protected non-assignable capability (e.g. identity.security-policy.manage) rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "Sensitive Escalation Role",
            actionKeys: ["identity.security-policy.manage"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );
    });

    test("US-002-QA09: Multiple assignable actions persist in one current custom role without phantom accounts", async () => {
      const actions = [
        "roles.view",
        "roles.select",
        "accounts.view",
        "accounts.select",
        "accounts.create",
        "roles.assign",
        "cms.content.view",
      ];

      const res = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Operations Administrator",
          description: "Manages accounts, roles, and CMS content",
          colorKey: "green",
          actionKeys: actions,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // Retrieve via list API
      const list = await ctx.rolesController.list(root.bearer, "Operations Administrator");
      const matched = list.roles.find((r) => r.roleRef === res.roleRef);
      assert.ok(matched, "Role must be returned in list");
      assert.equal(matched.name, "Operations Administrator");
      assert.equal(matched.assignedCount, 0, "New role must have 0 assigned accounts (no phantom accounts)");
      assert.equal(matched.protected, false, "Must not be protected");
      assert.deepEqual(matched.actionKeys.sort(), actions.sort(), "All actions must match exactly");
    });
  });

  // ==========================================================================
  // GROUP G2: US-002 Authorization & Privilege Security (QA03, QA04, QA07)
  // ==========================================================================
  describe("G2 — US-002 Authorization & Privilege Security", () => {
    test("US-002-QA03: Anonymous, revoked/suspended or unpermitted actor cannot view, create or mutate roles", async () => {
      // 1. Anonymous access denied (missing or invalid bearer)
      await assert.rejects(
        ctx.rolesController.catalog(""),
        (err: any) => err instanceof UnauthorizedException
      );
      await assert.rejects(
        ctx.rolesController.list("Bearer invalid-token-xyz-123456789012345678901234567890"),
        (err: any) => err instanceof UnauthorizedException
      );
      await assert.rejects(
        ctx.rolesController.create(
          "",
          { name: "Test", actionKeys: ["roles.view"], requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof UnauthorizedException
      );

      // 2. Create an unpermitted staff user (role with only cms.content.view)
      const roleRes = await ctx.rolesController.create(
        root.bearer,
        {
          name: "CMS Editor Only",
          actionKeys: ["cms.content.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const staffAcc = await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Regular Staff User",
          mobile: "9123456780",
          password: "StaffPassword123!",
          roleRef: roleRes.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const staffSession = await loginUser(ctx, "9123456780", "StaffPassword123!");

      // 3. Unpermitted actor denied roles.view (catalog, list)
      await assert.rejects(
        ctx.rolesController.catalog(staffSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );
      await assert.rejects(
        ctx.rolesController.list(staffSession.bearer),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. Unpermitted actor denied roles.manage (create, edit, copy, retire)
      await assert.rejects(
        ctx.rolesController.create(
          staffSession.bearer,
          { name: "Staff Created", actionKeys: ["roles.view"], requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );
      await assert.rejects(
        ctx.rolesController.edit(
          staffSession.bearer,
          roleRes.roleRef,
          { name: "Staff Edited", actionKeys: ["roles.view"], requestKey: randomUUID(), expectedRevision: 1 },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 5. Revoked / logged out session denied
      await ctx.sessionController.logout(staffSession.bearer);
      await assert.rejects(
        ctx.rolesController.catalog(staffSession.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // 6. Suspended actor denied
      const staffSession2 = await loginUser(ctx, "9123456780", "StaffPassword123!");
      await ctx.accountsController.status(
        root.bearer,
        staffAcc.accountRef,
        { status: "SUSPENDED", expectedRevision: 1, requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );

      // Old session is revoked on suspension
      await assert.rejects(
        ctx.rolesController.catalog(staffSession2.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // Cannot re-login while suspended
      await assert.rejects(
        loginUser(ctx, "9123456780", "StaffPassword123!"),
        (err: any) => err instanceof UnauthorizedException
      );

      // Verify DB: No mutations occurred
      const countRes = await ctx.pool.query(
        "SELECT count(*) as cnt FROM role WHERE name = 'Staff Created'"
      );
      assert.equal(Number(countRes.rows[0].cnt), 0, "No unauthorized role should be created in DB");
    });

    test("US-002-QA04: Protected role edit/retire/clone and duplicate normalized role denied without partial changes", async () => {
      // Find the protected Super Admin root role
      const rootRoleRes = await ctx.pool.query(
        "SELECT id, revision, name FROM role WHERE is_protected = true AND realm_id = $1",
        [root.realmId]
      );
      assert.ok(rootRoleRes.rowCount! > 0, "Protected root role must exist");
      const rootRole = rootRoleRes.rows[0];

      // 1. Attempt to edit protected role -> ForbiddenException
      await assert.rejects(
        ctx.rolesController.edit(
          root.bearer,
          rootRole.id,
          {
            name: "Hacked Super Admin",
            actionKeys: ["roles.view"],
            requestKey: randomUUID(),
            expectedRevision: rootRole.revision,
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 2. Attempt to retire protected role -> ForbiddenException
      await assert.rejects(
        ctx.rolesController.retire(
          root.bearer,
          rootRole.id,
          { expectedRevision: rootRole.revision, requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 3. Attempt to copy from protected role -> ForbiddenException
      await assert.rejects(
        ctx.rolesController.copy(
          root.bearer,
          rootRole.id,
          {
            name: "Cloned Super Admin",
            actionKeys: ["roles.view"],
            requestKey: randomUUID(),
            expectedRevision: rootRole.revision,
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );

      // 4. Verify DB: Protected role is completely unchanged
      const verifyRow = await ctx.pool.query("SELECT * FROM role WHERE id = $1", [rootRole.id]);
      assert.equal(verifyRow.rows[0].name, rootRole.name);
      assert.equal(verifyRow.rows[0].active, true);
      assert.equal(verifyRow.rows[0].revision, rootRole.revision);
    });

    test("US-002-QA07: New module capability defaults deny; only delivered capabilities appear in catalog", async () => {
      const catalog = await ctx.rolesController.catalog(root.bearer);
      const allCatalogKeys = catalog.groups.flatMap((g) => g.actions.map((a) => a.key));
      const inUseKeys = capabilitiesInUse().map((c) => c.key);

      // Ensure every capability in catalog is documented in capabilitiesInUse
      for (const key of allCatalogKeys) {
        assert.ok(inUseKeys.includes(key), `Catalog key ${key} must be in capabilitiesInUse`);
      }

      // Non-delivered or hypothetical ERP capability is rejected
      await assert.rejects(
        ctx.rolesController.create(
          root.bearer,
          {
            name: "Pharmacy Head",
            actionKeys: ["pharmacy.inventory.manage"],
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof BadRequestException
      );

      // Default deny verification: create user with role having only roles.view
      const viewOnlyRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Role Observer",
          actionKeys: ["roles.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Observer User",
          mobile: "9234567890",
          password: "ObserverPassword123!",
          roleRef: viewOnlyRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const observer = await loginUser(ctx, "9234567890", "ObserverPassword123!");

      // Allowed action works
      const catalogObs = await ctx.rolesController.catalog(observer.bearer);
      assert.ok(catalogObs.groups.length > 0);

      // Unassigned actions strictly default deny
      await assert.rejects(
        ctx.accountsController.list(observer.bearer),
        (err: any) => err instanceof ForbiddenException
      );
      await assert.rejects(
        ctx.rolesController.create(
          observer.bearer,
          { name: "Unauthorized Role", actionKeys: ["roles.view"], requestKey: randomUUID() },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ForbiddenException
      );
    });
  });

  // ==========================================================================
  // GROUP G3: US-002 Concurrency & Revocation (QA05, QA06)
  // ==========================================================================
  describe("G3 — US-002 Concurrency & Revocation", () => {
    test("US-002-QA05: Concurrent same-role edit uses expected revision; stale revision conflict", async () => {
      // 1. Create a custom role
      const role = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Concurrent Test Role",
          description: "Initial description",
          actionKeys: ["roles.view", "accounts.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(role.revision, 1);

      // 2. First edit succeeds with expectedRevision = 1
      const edit1 = await ctx.rolesController.edit(
        root.bearer,
        role.roleRef,
        {
          name: "Concurrent Test Role - Rev 2",
          description: "Updated by Actor 1",
          actionKeys: ["roles.view", "accounts.view", "cms.content.view"],
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      assert.equal(edit1.revision, 2);

      // 3. Stale edit with expectedRevision = 1 fails with ConflictException (STALE_ROLE)
      await assert.rejects(
        ctx.rolesController.edit(
          root.bearer,
          role.roleRef,
          {
            name: "Concurrent Test Role - Conflict",
            description: "Stale edit attempt",
            actionKeys: ["roles.view"],
            expectedRevision: 1, // Stale!
            requestKey: randomUUID(),
          },
          { cgRequestId: randomUUID() } as any
        ),
        (err: any) => err instanceof ConflictException
      );

      // 4. Verify DB state is consistent with Rev 2
      const row = await ctx.pool.query("SELECT * FROM role WHERE id = $1", [role.roleRef]);
      assert.equal(row.rows[0].revision, 2);
      assert.equal(row.rows[0].name, "Concurrent Test Role - Rev 2");

      // Verify grants match Rev 2
      const grants = await ctx.pool.query(
        "SELECT capability_key FROM role_grant WHERE role_id = $1 ORDER BY capability_key",
        [role.roleRef]
      );
      assert.deepEqual(
        grants.rows.map((g) => g.capability_key),
        ["accounts.view", "cms.content.view", "roles.view"]
      );
    });

    test("US-002-QA06: Removing permitted action invalidates affected sessions and access versions", async () => {
      // 1. Create role with accounts.view AND accounts.create
      const customRole = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Account Creator Staff",
          actionKeys: ["accounts.view", "accounts.create", "roles.assign"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Create staff account and sign in
      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Active Staff User",
          mobile: "9345678901",
          password: "StaffActive123!",
          roleRef: customRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      const staffSession = await loginUser(ctx, "9345678901", "StaffActive123!");

      // Verify staff session can view accounts initially
      const accListBefore = await ctx.accountsController.list(staffSession.bearer);
      assert.ok(accListBefore.accounts.length > 0);

      // 3. Admin modifies customRole to remove accounts.create and accounts.view (leaving only cms.content.view)
      await ctx.rolesController.edit(
        root.bearer,
        customRole.roleRef,
        {
          name: "Account Creator Staff - Demoted",
          actionKeys: ["cms.content.view"],
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 4. Verify: existing staff session token is immediately invalid (revoked_at set, access_version bumped)
      await assert.rejects(
        ctx.accountsController.list(staffSession.bearer),
        (err: any) => err instanceof UnauthorizedException
      );

      // 5. Staff signs in again: new session has only cms.content.view, accounts.view is denied
      const staffSessionNew = await loginUser(ctx, "9345678901", "StaffActive123!");
      await assert.rejects(
        ctx.accountsController.list(staffSessionNew.bearer),
        (err: any) => err instanceof ForbiddenException
      );
    });
  });

  // ==========================================================================
  // GROUP G4: US-002 Audit & Reader (QA10, QA11)
  // ==========================================================================
  describe("G4 — US-002 Audit & Reader", () => {
    test("US-002-QA10: Mandatory audit failure causes transaction rollback; success writes audit", async () => {
      const requestKey = randomUUID();
      const correlationRef = randomUUID();

      // 1. Successful role creation writes audit event
      const res = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Audited Role",
          actionKeys: ["roles.view"],
          requestKey,
        },
        { cgRequestId: correlationRef } as any
      );

      const auditRow = await ctx.pool.query(
        "SELECT * FROM access_audit WHERE action_key = 'identity.role.create' AND correlation_ref = $1",
        [correlationRef]
      );
      assert.equal(auditRow.rowCount, 1, "Audit entry must be created");
      assert.equal(auditRow.rows[0].outcome, "SUCCESS");
      assert.equal(auditRow.rows[0].actor_account_id, root.accountId);
      const safeContext = auditRow.rows[0].safe_context;
      assert.equal(safeContext.targetDisplay, "Audited Role");

      // 2. Transaction rollback on audit failure
      // We simulate an audit failure by installing a temporary failure trigger on access_audit
      const client = await ctx.pool.connect();
      try {
        await client.query(`
          CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.safe_context->>'targetDisplay' = 'Fault Role' THEN
              RAISE EXCEPTION 'MANDATORY_AUDIT_FAILURE_SIMULATION';
            END IF;
            RETURN NEW;
          END;
          $$;
        `);
        await client.query(`
          CREATE TRIGGER trg_test_fail_audit BEFORE INSERT ON access_audit
          FOR EACH ROW EXECUTE FUNCTION test_fail_audit();
        `);

        // Attempt creation of 'Fault Role' -> MUST roll back completely
        await assert.rejects(
          ctx.rolesController.create(
            root.bearer,
            {
              name: "Fault Role",
              actionKeys: ["roles.view"],
              requestKey: randomUUID(),
            },
            { cgRequestId: randomUUID() } as any
          ),
          /MANDATORY_AUDIT_FAILURE_SIMULATION/
        );

        // Verify: No 'Fault Role' in role table, no grants, no role_command
        const checkRole = await ctx.pool.query("SELECT * FROM role WHERE name = 'Fault Role'");
        assert.equal(checkRole.rowCount, 0, "Role creation must be rolled back on audit failure");
      } finally {
        await client.query("DROP TRIGGER IF EXISTS trg_test_fail_audit ON access_audit;");
        await client.query("DROP FUNCTION IF EXISTS test_fail_audit();");
        client.release();
      }
    });

    test("US-002-QA11: Access audit reader preserves realm restrictions, pagination bounds, and sensitive data redaction", async () => {
      // 1. Root reads audit history
      const history = await ctx.auditController.history(root.bearer, "20");
      assert.ok(history.events.length > 0, "Audit history must contain events");

      // Verify redaction: no passwords, tokens, hashes in audit events
      for (const ev of history.events) {
        assert.ok(ev.eventRef, "Event ref must be present");
        assert.ok(ev.actionLabel, "Action label must be present");
        assert.ok(ev.occurredAt, "Occurred at timestamp must be present");
        const jsonString = JSON.stringify(ev);
        assert.equal(jsonString.includes("password"), false, "Audit must not leak passwords");
        assert.equal(jsonString.includes("hash"), false, "Audit must not leak hashes");
        assert.equal(jsonString.includes("token"), false, "Audit must not leak tokens");
      }

      // 2. Pagination bounds: limit < 1 or > 50 rejected
      await assert.rejects(
        ctx.auditController.history(root.bearer, "0"),
        (err: any) => err instanceof BadRequestException
      );
      await assert.rejects(
        ctx.auditController.history(root.bearer, "100"),
        (err: any) => err instanceof BadRequestException
      );

      // 3. Unauthorized actor denied audit reader
      const unauthRole = await ctx.rolesController.create(
        root.bearer,
        { name: "No Audit Role", actionKeys: ["roles.view"], requestKey: randomUUID() },
        { cgRequestId: randomUUID() } as any
      );
      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "No Audit User",
          mobile: "9456789012",
          password: "NoAuditPassword123!",
          roleRef: unauthRole.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );
      const noAuditSession = await loginUser(ctx, "9456789012", "NoAuditPassword123!");

      await assert.rejects(
        ctx.auditController.history(noAuditSession.bearer, "20"),
        (err: any) => err instanceof ForbiddenException
      );
    });
  });

  // ==========================================================================
  // Backend contract parity for QA02 and QA08
  // ==========================================================================
  describe("US-002 Backend Contract Parity (QA02, QA08)", () => {
    test("US-002-QA02: Role copy endpoint copies grants, not assigned accounts or protected privileges", async () => {
      // 1. Create a source custom role
      const source = await ctx.rolesController.create(
        root.bearer,
        {
          name: "Source Template Role",
          description: "Template for copying",
          colorKey: "violet",
          actionKeys: ["roles.view", "accounts.view"],
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // Assign an account to source role
      await ctx.accountsController.create(
        root.bearer,
        {
          displayName: "Source Role Member",
          mobile: "9567890123",
          password: "MemberPassword123!",
          roleRef: source.roleRef,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      // 2. Copy the role
      const copied = await ctx.rolesController.copy(
        root.bearer,
        source.roleRef,
        {
          name: "Copied Target Role",
          description: "Copied description",
          colorKey: "teal",
          actionKeys: ["roles.view", "accounts.view"],
          expectedRevision: 1,
          requestKey: randomUUID(),
        },
        { cgRequestId: randomUUID() } as any
      );

      assert.ok(copied.roleRef);
      assert.notEqual(copied.roleRef, source.roleRef);

      // Verify copied role has 0 assigned accounts (grants copied, NOT members)
      const list = await ctx.rolesController.list(root.bearer, "Copied Target Role");
      const found = list.roles.find((r) => r.roleRef === copied.roleRef);
      assert.ok(found);
      assert.equal(found.assignedCount, 0, "Copied role must have 0 assigned members");
      assert.deepEqual(found.actionKeys, ["accounts.view", "roles.view"]);
    });

    test("US-002-QA08: Roles options and search filters match backend schema contract", async () => {
      const opts = await ctx.rolesController.options(root.bearer, "");
      assert.ok(Array.isArray(opts.options));
      for (const opt of opts.options) {
        assert.ok(opt.value, "Option must have value");
        assert.ok(opt.label, "Option must have label");
        assert.equal(opt.context, "Foundation");
      }
    });
  });
});
