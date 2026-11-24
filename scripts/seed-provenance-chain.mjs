import dns from "node:dns";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

dns.setDefaultResultOrder?.("ipv4first");
try { process.loadEnvFile?.(".env"); } catch {}

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

function hex64() {
  return randomBytes(32).toString("hex");
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get root realm
    const realmRes = await client.query("SELECT id FROM access_realm WHERE realm_key = 'FOUNDATION_ROOT' LIMIT 1");
    const rootRealmId = realmRes.rows[0].id;

    // 2. Get accounts: Super Admin (proposer) and Reviewer (approver)
    const adminRes = await client.query("SELECT id FROM account WHERE normalized_mobile = '9065015409' LIMIT 1");
    const proposerId = adminRes.rows[0].id;

    const reviewerRes = await client.query("SELECT id FROM account WHERE normalized_mobile = '9065015410' LIMIT 1");
    const reviewerId = reviewerRes.rows[0].id;

    // 3. Get Clinic X and Provider
    const clinicXRes = await client.query("SELECT id, provider_id, publication_generation FROM health_center WHERE public_slug = 'careganga-health-clinic-varanasi-central' LIMIT 1");
    if (!clinicXRes.rows.length) {
      throw new Error("Clinic X not found in health_center");
    }
    const clinicX = clinicXRes.rows[0];
    const centerId = clinicX.id;
    const providerId = clinicX.provider_id;
    const generation = clinicX.publication_generation || 1;

    // Update clinic X publication generation to 1 if 0
    await client.query("UPDATE health_center SET publication_generation = 1 WHERE id = $1 AND publication_generation = 0", [centerId]);

    // 4. Ensure cg03_process exists for HEALTH_CENTER_VERIFICATION
    let procRes = await client.query("SELECT id, version FROM cg03_process WHERE realm_id = $1 AND process_kind = 'HEALTH_CENTER_VERIFICATION' LIMIT 1", [rootRealmId]);
    let centerProcessId;
    let centerProcessVersion;
    if (procRes.rows.length === 0) {
      const maxVerRes = await client.query("SELECT COALESCE(MAX(version), 0) + 1 AS next_ver FROM cg03_process WHERE realm_id = $1", [rootRealmId]);
      centerProcessVersion = maxVerRes.rows[0].next_ver;
      centerProcessId = randomUUID();
      await client.query(
        `INSERT INTO cg03_process (id, realm_id, version, process_kind, configured_by, created_at)
         VALUES ($1, $2, $3, 'HEALTH_CENTER_VERIFICATION', $4, now())`,
        [centerProcessId, rootRealmId, centerProcessVersion, proposerId]
      );
    } else {
      centerProcessId = procRes.rows[0].id;
      centerProcessVersion = procRes.rows[0].version;
    }

    // 5. Upload Intent & Stored File for Center License
    const centerIntentId = randomUUID();
    const centerFileId = randomUUID();
    const centerDigest = hex64();

    await client.query(
      `INSERT INTO cg19_upload_intent (
        id, realm_id, proposal_revision, requested_by, request_key, mime, size_bytes,
        expected_sha256, request_digest, classification, status, object_key,
        storage_reservation_ref, reserved_until, created_at, updated_at, owner_kind,
        health_provider_id, health_center_id, health_source_version,
        visit_consent_confirmed, campaign_media_rights_confirmed, beneficiary_consent_confirmed
      ) VALUES (
        $1, $2, 1, $3, $4, 'application/pdf', 1024,
        $5, $5, 'HEALTH_CENTER_LICENSE', 'VALIDATED', 'health/centers/center-license.pdf',
        'res-center-001', now() + interval '1 year', now(), now(), 'CG14_DRAFT',
        $6, $7, 1,
        false, false, false
      ) ON CONFLICT (id) DO NOTHING`,
      [centerIntentId, rootRealmId, proposerId, randomUUID(), centerDigest, providerId, centerId]
    );

    await client.query(
      `INSERT INTO cg19_stored_file (
        id, realm_id, upload_intent_id, proposal_revision, original_mime,
        verified_sha256, verified_size_bytes, object_key, object_version,
        scan_status, scan_proof_ref, scanned_at, created_by, created_at,
        revision, owner_kind, health_provider_id, health_center_id, health_source_version
      ) VALUES (
        $1, $2, $3, 1, 'application/pdf',
        $4, 1024, 'health/centers/center-license.pdf', 'v1',
        'CLEAN_VERIFIED', 'scan-proof-center-001', now(), $5, now(),
        1, 'CG14_DRAFT', $6, $7, 1
      ) ON CONFLICT (id) DO NOTHING`,
      [centerFileId, rootRealmId, centerIntentId, centerDigest, proposerId, providerId, centerId]
    );

    // 6. Center Revision & cg03_case & Decision
    const centerRevId = randomUUID();
    const centerCaseId = randomUUID();
    const centerDecisionId = randomUUID();
    const sourceDigest = hex64();

    await client.query(
      `INSERT INTO health_center_revision (
        id, root_realm_id, provider_id, center_id, revision_no, source_version,
        source_snapshot, source_digest, proof_file_ref, submitted_by, approval_case_ref, submitted_at
      ) VALUES (
        $1, $2, $3, $4, 1, 1,
        '{"centerName":"CareGanga Health Clinic Varanasi Central"}', $5, $6, $7, NULL, now()
      ) ON CONFLICT (id) DO NOTHING`,
      [centerRevId, rootRealmId, providerId, centerId, sourceDigest, centerFileId, proposerId]
    );

    const caseNum = 'CG-AP-' + String(Math.floor(100000 + Math.random() * 900000));
    await client.query(
      `INSERT INTO cg03_case (
        id, realm_id, case_number, process_id, process_version, proposer_id,
        account_name_snapshot, role_name_snapshot, proposal_revision, proposal_digest,
        request_digest, request_key, status, current_step, revision, submitted_at, updated_at,
        case_kind, health_provider_id, health_center_id, health_center_revision_id, health_revision_no, health_source_digest
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'CareGanga Administrator', 'Admin', 1, $7,
        $7, $8, 'OWNER_COMPLETED', 1, 2, now(), now(),
        'HEALTH_CENTER_VERIFICATION', $9, $10, $11, 1, $7
      ) ON CONFLICT (id) DO NOTHING`,
      [
        centerCaseId, rootRealmId, caseNum, centerProcessId, centerProcessVersion, proposerId,
        sourceDigest, randomUUID(), providerId, centerId, centerRevId
      ]
    );

    await client.query(
      `UPDATE health_center_revision SET approval_case_ref = $1 WHERE id = $2`,
      [centerCaseId, centerRevId]
    );

    await client.query(
      `INSERT INTO cg03_case_decision (
        id, realm_id, case_id, actor_id, action, step_ordinal,
        expected_case_revision, accepted_case_revision, request_key,
        request_digest, safe_remarks, fresh_password_verified_at, created_at
      ) VALUES (
        $1, $2, $3, $4, 'APPROVE', 1,
        1, 2, $5,
        $6, 'Approved verified center', now(), now()
      ) ON CONFLICT (id) DO NOTHING`,
      [centerDecisionId, rootRealmId, centerCaseId, reviewerId, randomUUID(), hex64()]
    );

    // 7. Center Publication
    await client.query(
      `INSERT INTO health_center_publication (
        root_realm_id, center_id, verified_center_revision_id,
        original_final_decision_ref, published_by, generation, changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, 1, now()
      ) ON CONFLICT (root_realm_id, center_id) DO UPDATE SET
        verified_center_revision_id = EXCLUDED.verified_center_revision_id,
        original_final_decision_ref = EXCLUDED.original_final_decision_ref,
        generation = 1,
        changed_at = now()`,
      [rootRealmId, centerId, centerRevId, centerDecisionId, reviewerId]
    );

    console.log("✓ Center provenance chain successfully seeded for Clinic X");

    // ============================================
    // 8. DOCTOR A PROVENANCE CHAIN
    // ============================================
    const docRes = await client.query("SELECT id FROM health_doctor WHERE full_name = 'Dr. Anita Sharma' LIMIT 1");
    if (!docRes.rows.length) {
      throw new Error("Dr. Anita Sharma not found in health_doctor");
    }
    const doctorId = docRes.rows[0].id;

    // Process for HEALTH_DOCTOR_VERIFICATION
    let docProcRes = await client.query("SELECT id, version FROM cg03_process WHERE realm_id = $1 AND process_kind = 'HEALTH_DOCTOR_VERIFICATION' LIMIT 1", [rootRealmId]);
    let docProcessId;
    let docProcessVersion;
    if (docProcRes.rows.length === 0) {
      const maxVerRes = await client.query("SELECT COALESCE(MAX(version), 0) + 1 AS next_ver FROM cg03_process WHERE realm_id = $1", [rootRealmId]);
      docProcessVersion = maxVerRes.rows[0].next_ver;
      docProcessId = randomUUID();
      await client.query(
        `INSERT INTO cg03_process (id, realm_id, version, process_kind, configured_by, created_at)
         VALUES ($1, $2, $3, 'HEALTH_DOCTOR_VERIFICATION', $4, now())`,
        [docProcessId, rootRealmId, docProcessVersion, proposerId]
      );
    } else {
      docProcessId = docProcRes.rows[0].id;
      docProcessVersion = docProcRes.rows[0].version;
    }

    // Upload intent & stored file for Doctor
    const docIntentId = randomUUID();
    const docFileId = randomUUID();
    const docDigest = hex64();

    await client.query(
      `INSERT INTO cg19_upload_intent (
        id, realm_id, proposal_revision, requested_by, request_key, mime, size_bytes,
        expected_sha256, request_digest, classification, status, object_key,
        storage_reservation_ref, reserved_until, created_at, updated_at, owner_kind,
        health_doctor_id, health_source_version,
        visit_consent_confirmed, campaign_media_rights_confirmed, beneficiary_consent_confirmed
      ) VALUES (
        $1, $2, 1, $3, $4, 'application/pdf', 1024,
        $5, $5, 'HEALTH_DOCTOR_LICENSE', 'VALIDATED', 'health/doctors/doctor-license.pdf',
        'res-doc-001', now() + interval '1 year', now(), now(), 'CG14_DOCTOR',
        $6, 1,
        false, false, false
      ) ON CONFLICT (id) DO NOTHING`,
      [docIntentId, rootRealmId, proposerId, randomUUID(), docDigest, doctorId]
    );

    await client.query(
      `INSERT INTO cg19_stored_file (
        id, realm_id, upload_intent_id, proposal_revision, original_mime,
        verified_sha256, verified_size_bytes, object_key, object_version,
        scan_status, scan_proof_ref, scanned_at, created_by, created_at,
        revision, owner_kind, health_doctor_id, health_source_version
      ) VALUES (
        $1, $2, $3, 1, 'application/pdf',
        $4, 1024, 'health/doctors/doctor-license.pdf', 'v1',
        'CLEAN_VERIFIED', 'scan-proof-doc-001', now(), $5, now(),
        1, 'CG14_DOCTOR', $6, 1
      ) ON CONFLICT (id) DO NOTHING`,
      [docFileId, rootRealmId, docIntentId, docDigest, proposerId, doctorId]
    );

    // Doctor Revision & cg03_case & Decision
    const docRevId = randomUUID();
    const docCaseId = randomUUID();
    const docDecisionId = randomUUID();
    const docSourceDigest = hex64();

    await client.query(
      `INSERT INTO health_doctor_revision (
        id, root_realm_id, doctor_id, revision_no, source_version,
        source_snapshot, source_digest, proof_file_ref, submitted_by, approval_case_ref, submitted_at
      ) VALUES (
        $1, $2, $3, 1, 1,
        '{"fullName":"Dr. Anita Sharma","registrationNumber":"UP-MED-2015-8899"}', $4, $5, $6, NULL, now()
      ) ON CONFLICT (id) DO NOTHING`,
      [docRevId, rootRealmId, doctorId, docSourceDigest, docFileId, proposerId]
    );

    const docCaseNum = 'CG-AP-' + String(Math.floor(100000 + Math.random() * 900000));
    await client.query(
      `INSERT INTO cg03_case (
        id, realm_id, case_number, process_id, process_version, proposer_id,
        account_name_snapshot, role_name_snapshot, proposal_revision, proposal_digest,
        request_digest, request_key, status, current_step, revision, submitted_at, updated_at,
        case_kind, health_doctor_id, health_doctor_revision_id, health_revision_no, health_source_digest
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'CareGanga Administrator', 'Admin', 1, $7,
        $7, $8, 'OWNER_COMPLETED', 1, 2, now(), now(),
        'HEALTH_DOCTOR_VERIFICATION', $9, $10, 1, $7
      ) ON CONFLICT (id) DO NOTHING`,
      [
        docCaseId, rootRealmId, docCaseNum, docProcessId, docProcessVersion, proposerId,
        docSourceDigest, randomUUID(), doctorId, docRevId
      ]
    );

    await client.query(
      `UPDATE health_doctor_revision SET approval_case_ref = $1 WHERE id = $2`,
      [docCaseId, docRevId]
    );

    await client.query(
      `INSERT INTO cg03_case_decision (
        id, realm_id, case_id, actor_id, action, step_ordinal,
        expected_case_revision, accepted_case_revision, request_key,
        request_digest, safe_remarks, fresh_password_verified_at, created_at
      ) VALUES (
        $1, $2, $3, $4, 'APPROVE', 1,
        1, 2, $5,
        $6, 'Approved verified doctor', now(), now()
      ) ON CONFLICT (id) DO NOTHING`,
      [docDecisionId, rootRealmId, docCaseId, reviewerId, randomUUID(), hex64()]
    );

    console.log("✓ Doctor provenance chain successfully seeded for Doctor A");

    await client.query("COMMIT");
    console.log("🎉 Complete Provenance Chain committed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error seeding provenance chain:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
