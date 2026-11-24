import dns from "node:dns";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

dns.setDefaultResultOrder?.("ipv4first");
try { process.loadEnvFile?.(".env"); } catch {}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function hex64() {
  return randomBytes(32).toString("hex");
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const realmRes = await client.query("SELECT id FROM access_realm WHERE realm_key = 'FOUNDATION_ROOT'");
    const rootRealmId = realmRes.rows[0].id;

    // Get P1 account & patient
    const p1AccRes = await client.query("SELECT id FROM account WHERE normalized_mobile = '9065015407'");
    const p1AccId = p1AccRes.rows[0].id;

    // Mark phone verified
    await client.query("UPDATE account SET contact_phone_verified_at = now() WHERE id = $1", [p1AccId]);

    const p1PatRes = await client.query("SELECT id FROM cg15_patient WHERE root_realm_id = $1 AND virtual_display_id = 'CGP-0000000000000001'", [rootRealmId]);
    const p1Id = p1PatRes.rows[0].id;

    // Get Rep X account
    const repXRes = await client.query("SELECT id FROM account WHERE normalized_mobile = '9065015413'");
    const repXId = repXRes.rows[0].id;

    // Get Clinic X
    const clinicXRes = await client.query("SELECT id FROM health_center WHERE public_slug = 'careganga-health-clinic-varanasi-central'");
    const clinicXId = clinicXRes.rows[0].id;

    // Check if challenge exists
    const challengeId = randomUUID();
    await client.query(
      `INSERT INTO cg15_patient_identity_challenge (
        root_realm_id, id, patient_id, issued_by_account, token_digest, created_at, expires_at, used_at
      ) VALUES ($1, $2, $3, $4, $5, now() - interval '1 hour', now() + interval '1 day', now())
      ON CONFLICT (root_realm_id, id) DO NOTHING`,
      [rootRealmId, challengeId, p1Id, p1AccId, hex64()]
    );

    // Insert identity event
    const eventId = randomUUID();
    await client.query(
      `INSERT INTO cg15_patient_identity_event (
        root_realm_id, id, patient_id, center_id, challenge_id, verified_by_account,
        request_key, request_digest, identity_checked_in_person, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
      ON CONFLICT (root_realm_id, patient_id) DO NOTHING`,
      [rootRealmId, eventId, p1Id, clinicXId, challengeId, repXId, randomUUID(), hex64()]
    );

    await client.query("COMMIT");
    console.log("✓ Patient P1 in-person identity verification successfully recorded!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error seeding patient identity:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
