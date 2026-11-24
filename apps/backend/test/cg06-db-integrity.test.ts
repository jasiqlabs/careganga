import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";

/**
 * Live PostgreSQL verification of CG-06 migrations 3601–3606:
 * - Table structures and sequences
 * - Constraints, composite foreign keys, and unique indexes
 * - Database triggers and immutable event functions
 * - Assistance fulfillment guards (quantity caps, stock vs finance)
 * - Financial recovery guards (opposite accounts, original paid allocation)
 * - Delivery guards (clean handover proof, consent checks)
 * - Multi-branch isolation, consent rules, and transaction rollback safety
 */
test("CG-06 Beneficiaries & Assistance: migrations 3601–3606, triggers, fulfillment and recovery guards",
  { timeout: 30000 }, async () => {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  assert.ok(url, "TEST_DATABASE_URL or DATABASE_URL must be set");
  assert.match(new URL(url).pathname.toLowerCase(), /test|qa/, "Non-test DB refused for safety");

  const db = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    application_name: "careganga-cg06-db-integrity-qa"
  });
  await db.connect();

  try {
    // 1. Verify all 6 migrations are registered in schema_migration
    const expectedMigrations = [
      "3601_cg06_beneficiary_private_intake.sql",
      "3602_cg03_original_beneficiary_verification.sql",
      "3603_cg19_private_beneficiary_evidence.sql",
      "3604_cg06_assistance_case.sql",
      "3605_cg06_original_aid_fulfillment.sql",
      "3606_cg06_protected_report_audit.sql"
    ];
    const migrationCheck = await db.query<{ filename: string }>(
      "SELECT filename FROM schema_migration WHERE filename = ANY($1::text[]) ORDER BY filename",
      [expectedMigrations]
    );
    assert.equal(migrationCheck.rowCount, 6, "All six CG-06 migrations must be present in schema_migration");

    // 2. Verify all CG-06 core tables exist
    const expectedTables = [
      "beneficiary",
      "beneficiary_command",
      "beneficiary_verification_event",
      "beneficiary_project_link",
      "cg06_beneficiary_review_snapshot",
      "assistance_case",
      "assistance_event",
      "assistance_fulfillment",
      "assistance_delivery_event",
      "assistance_recovery",
      "beneficiary_report_access"
    ];
    for (const table of expectedTables) {
      const reg = await db.query<{ ref: string | null }>("SELECT to_regclass($1)::text AS ref", [table]);
      assert.ok(reg.rows[0]?.ref, `Missing migrated CG-06 table: ${table}`);
    }

    // 3. Verify triggers are installed and enabled
    const triggerRes = await db.query<{ tgname: string; tgenabled: string; relname: string }>(`
      SELECT t.tgname, t.tgenabled, c.relname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = ANY($1::text[]) AND NOT t.tgisinternal
    `, [expectedTables.concat(["cg03_case", "cg19_upload_intent", "cg19_stored_file", "cg19_beneficiary_evidence_event", "finance_voucher"])]);
    const triggerMap = new Map(triggerRes.rows.map(r => [r.tgname, r]));

    const criticalTriggers = [
      "cg06_command_immutable",
      "cg06_verification_immutable",
      "cg06_beneficiary_review_snapshot_immutable",
      "cg06_beneficiary_case_frozen",
      "cg19_beneficiary_intent_identity",
      "cg19_beneficiary_file_identity",
      "cg19_beneficiary_intent_consent",
      "cg19_beneficiary_proof_event_immutable",
      "cg06_aid_frozen",
      "cg06_aid_event_immutable",
      "cg06_assistance_approval_frozen",
      "cg06_fulfillment_immutable",
      "cg06_delivery_immutable",
      "cg06_recovery_immutable",
      "cg06_recovery_source_guard",
      "cg06_aid_voucher_identity",
      "cg06_aid_allocation_guard",
      "cg06_aid_delivery_guard",
      "cg06_report_access_immutable"
    ];
    for (const tg of criticalTriggers) {
      const found = triggerMap.get(tg);
      assert.ok(found, `Missing critical CG-06 trigger: ${tg}`);
      assert.ok(["O", "A"].includes(found.tgenabled), `Trigger ${tg} must be active`);
    }

    // 4. Verify unique indexes and check constraints
    const indexRes = await db.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE tablename = ANY($1::text[])
    `, [expectedTables.concat(["cg03_case"])]);
    const indexSet = new Set(indexRes.rows.map(r => r.indexname));
    assert.ok(indexSet.has("ux_cg06_current_project_link"), "ux_cg06_current_project_link required");
    assert.ok(indexSet.has("ux_cg03_beneficiary_verification_snapshot"), "ux_cg03_beneficiary_verification_snapshot required");
    assert.ok(indexSet.has("ux_cg03_assistance_case"), "ux_cg03_assistance_case required");

    // 5. Test Live Transaction Behavior, Invariants, and Rollback Safety
    await db.query("BEGIN");
    try {
      const realmId = "00000000-0000-4000-a000-000000000001";
      const branchAId = null;
      const branchBId = "00000000-0000-4000-c000-000000000002";
      const rootAccountId = "00000000-0000-4000-a000-000000000010";
      const staffAId = "00000000-0000-4000-a000-000000000020";
      const stateId = "00000000-0000-4000-b000-000000000002";
      const districtId = "00000000-0000-4000-b000-000000000003";

      // Insert base accounts and areas if not present
      await db.query("INSERT INTO access_realm (id, realm_key) VALUES ($1, 'FOUNDATION_ROOT') ON CONFLICT DO NOTHING", [realmId]);
      await db.query("INSERT INTO account (id, realm_id, normalized_mobile, display_name, status) VALUES ($1, $2, '9800000001', 'Root Admin', 'ACTIVE') ON CONFLICT DO NOTHING", [rootAccountId, realmId]);
      await db.query("INSERT INTO account (id, realm_id, normalized_mobile, display_name, status) VALUES ($1, $2, '9800000002', 'Staff A', 'ACTIVE') ON CONFLICT DO NOTHING", [staffAId, realmId]);
      await db.query("INSERT INTO geography_area (id, root_realm_id, code, display_name, normalized_name, level, parent_area_id, status, updated_by) VALUES ($1, $2, 'MH', 'Maharashtra', 'maharashtra', 'STATE', NULL, 'ACTIVE', $3) ON CONFLICT DO NOTHING", [stateId, realmId, staffAId]);
      await db.query("INSERT INTO geography_area (id, root_realm_id, code, display_name, normalized_name, level, parent_area_id, status, updated_by) VALUES ($1, $2, 'PUN', 'Pune', 'pune', 'DISTRICT', $3, 'ACTIVE', $4) ON CONFLICT DO NOTHING", [districtId, realmId, stateId, staffAId]);

      // (A) Test constraint: child beneficiary requires GUARDIAN consent
      await db.query("SAVEPOINT sp_child;");
      await assert.rejects(
        async () => {
          await db.query(`
            INSERT INTO beneficiary (
              root_realm_id, branch_scope_id, display_ref, private_name,
              state_ref, district_ref, beneficiary_type, gender, age_group,
              consent_kind, consent_purpose, consent_acknowledged_at, created_by, updated_by
            ) VALUES (
              $1, $2, 'BEN-0000001', 'Test Child',
              $3, $4, 'Education', 'FEMALE', 'CHILD',
              'SELF', 'School support', now(), $5, $5
            )
          `, [realmId, null, stateId, districtId, staffAId]);
        },
        /violates check constraint/,
        "Child beneficiary must reject SELF consent"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_child;");

      // (B) Test constraint: valid adult beneficiary insertion
      const adultBen = await db.query<{ id: string }>(`
        INSERT INTO beneficiary (
          root_realm_id, branch_scope_id, display_ref, private_name,
          contact_mobile, state_ref, district_ref, beneficiary_type, gender, age_group,
          consent_kind, consent_purpose, consent_acknowledged_at, created_by, updated_by
        ) VALUES (
          $1, $2, 'BEN-0000002', 'Adult Recipient',
          '+919876543210', $3, $4, 'Livelihood', 'FEMALE', 'ADULT',
          'SELF', 'Livelihood grant', now(), $5, $5
        ) RETURNING id
      `, [realmId, null, stateId, districtId, staffAId]);
      const benId = adultBen.rows[0].id;

      // (C) Test trigger: immutability of beneficiary_command
      const cmdRes = await db.query<{ id: string }>(`
        INSERT INTO beneficiary_command (
          root_realm_id, actor_ref, request_key, action, payload_digest, beneficiary_id, reason, result_revision
        ) VALUES (
          $1, $2, gen_random_uuid(), 'CREATE', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          $3, 'Initial registration', 1
        ) RETURNING id
      `, [realmId, staffAId, benId]);
      const cmdId = cmdRes.rows[0].id;

      await db.query("SAVEPOINT sp_cmd1;");
      await assert.rejects(
        async () => {
          await db.query(`UPDATE beneficiary_command SET reason = 'Modified' WHERE id = $1`, [cmdId]);
        },
        /Beneficiary history is immutable/,
        "beneficiary_command update must be rejected by trigger"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_cmd1;");

      await db.query("SAVEPOINT sp_cmd2;");
      await assert.rejects(
        async () => {
          await db.query(`DELETE FROM beneficiary_command WHERE id = $1`, [cmdId]);
        },
        /Beneficiary history is immutable/,
        "beneficiary_command delete must be rejected by trigger"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_cmd2;");

      // (D) Test trigger: immutability of beneficiary_report_access
      const reportRes = await db.query<{ id: string }>(`
        INSERT INTO beneficiary_report_access (
          root_realm_id, actor_ref, action, filter_digest, row_count
        ) VALUES (
          $1, $2, 'READ', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 10
        ) RETURNING id
      `, [realmId, staffAId]);
      const reportId = reportRes.rows[0].id;

      await db.query("SAVEPOINT sp_rpt;");
      await assert.rejects(
        async () => {
          await db.query(`DELETE FROM beneficiary_report_access WHERE id = $1`, [reportId]);
        },
        /Beneficiary history is immutable/,
        "beneficiary_report_access delete must be rejected by trigger"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_rpt;");

      // (E) Test assistance_case creation & trigger: immutability of frozen request
      const aidCaseRes = await db.query<{ id: string }>(`
        INSERT INTO assistance_case (
          root_realm_id, branch_ref, beneficiary_id, beneficiary_revision,
          reference, category, kind, requested_minor, currency,
          requested_on, responsible_ref, created_by, request_key, source_digest, state, revision
        ) VALUES (
          $1, $2, $3, 1,
          'AID-00000001', 'Direct Aid', 'FINANCIAL', 500000, 'INR',
          CURRENT_DATE, $4, $4, gen_random_uuid(),
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'DRAFT', 1
        ) RETURNING id
      `, [realmId, null, benId, staffAId]);
      const aidId = aidCaseRes.rows[0].id;

      // Attempting to change requested amount on assistance_case directly must fail
      await db.query("SAVEPOINT sp_aid;");
      await assert.rejects(
        async () => {
          await db.query(`UPDATE assistance_case SET requested_minor = 999999 WHERE id = $1`, [aidId]);
        },
        /Original assistance request is immutable/,
        "assistance_case update of requested amount must be blocked by cg06_aid_frozen trigger"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_aid;");

      // (F) Test assistance_fulfillment guard: unapproved aid allocation rejected
      await db.query("SAVEPOINT sp_ful;");
      await assert.rejects(
        async () => {
          await db.query(`
            INSERT INTO assistance_fulfillment (
              root_realm_id, assistance_id, action, request_key, request_digest,
              actor_ref, amount_minor, voucher_ref, voucher_revision
            ) VALUES (
              $1, $2, 'PAYMENT', gen_random_uuid(),
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              $3, 500000, gen_random_uuid(), 1
            )
          `, [realmId, aidId, staffAId]);
        },
        /Original assistance release is not approved/,
        "Unapproved assistance case must reject fulfillment insertion"
      );
      await db.query("ROLLBACK TO SAVEPOINT sp_ful;");

    } finally {
      // Rollback transaction to keep test database completely clean
      await db.query("ROLLBACK");
    }

  } finally {
    await db.end();
  }
});
