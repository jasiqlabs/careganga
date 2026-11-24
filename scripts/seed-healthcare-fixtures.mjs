import dns from "node:dns";
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import pg from "pg";

dns.setDefaultResultOrder?.("ipv4first");
try { process.loadEnvFile?.(".env"); } catch {}

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(value, salt) {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, 64, COST, (err, out) => err ? reject(err) : resolve(out));
  });
}
async function hashPassword(password) {
  const salt = randomBytes(24);
  const digest = await derive(password, salt);
  return ["scrypt", String(COST.N), salt.toString("hex"), digest.toString("hex")].join("$");
}

const testAccounts = [
  {
    roleName: "Approval",
    displayName: "Independent Reviewer",
    mobile: "9065015410",
    email: "reviewer.9065015410@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Branch A Manager",
    mobile: "9065015411",
    email: "brancha.9065015411@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Branch B Manager",
    mobile: "9065015412",
    email: "branchb.9065015412@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Clinic X Receptionist",
    mobile: "9065015413",
    email: "repx.9065015413@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Clinic Y Receptionist",
    mobile: "9065015414",
    email: "repy.9065015414@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Dr. Anita Sharma",
    mobile: "9065015415",
    email: "doctora.9065015415@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "sub admin",
    displayName: "Dr. Rajesh Kumar",
    mobile: "9065015416",
    email: "doctorb.9065015416@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "CareGanga Patient",
    displayName: "Sunita Devi",
    mobile: "9065015417",
    email: "patient.9065015417@careganga.org",
    password: "CareGanga@123",
  },
  {
    roleName: "CareGanga Patient",
    displayName: "Amit Patel",
    mobile: "9065015418",
    email: "patient.9065015418@careganga.org",
    password: "CareGanga@123",
  }
];

async function main() {
  const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 25000 });
  const client = await pool.connect();
  console.log("Connected to PostgreSQL");

  try {
    const realmRes = await client.query("SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 1");
    if (!realmRes.rows.length) throw new Error("FOUNDATION_ROOT realm not found");
    const realmId = realmRes.rows[0].id;
    console.log("Root realm ID:", realmId);

    const adminRes = await client.query("SELECT id FROM account WHERE normalized_mobile='9065015409'");
    const adminId = adminRes.rows[0].id;

    // 1. Geography areas
    console.log("Seeding geography areas...");
    let stateId, districtId, subdivisionId, blockId;
    
    const existingState = await client.query("SELECT id FROM geography_area WHERE root_realm_id=$1 AND normalized_name='uttar pradesh'", [realmId]);
    if (existingState.rows.length) {
      stateId = existingState.rows[0].id;
    } else {
      const insState = await client.query(`
        INSERT INTO geography_area(root_realm_id, level, parent_area_id, display_name, normalized_name, code, status, version, updated_by)
        VALUES($1, 'STATE', NULL, 'Uttar Pradesh', 'uttar pradesh', 'UP', 'ACTIVE', 1, $2)
        RETURNING id
      `, [realmId, adminId]);
      stateId = insState.rows[0].id;
    }

    const existingDist = await client.query("SELECT id FROM geography_area WHERE root_realm_id=$1 AND normalized_name='varanasi'", [realmId]);
    if (existingDist.rows.length) {
      districtId = existingDist.rows[0].id;
    } else {
      const insDist = await client.query(`
        INSERT INTO geography_area(root_realm_id, level, parent_area_id, display_name, normalized_name, code, status, version, updated_by)
        VALUES($1, 'DISTRICT', $2, 'Varanasi', 'varanasi', 'VNS', 'ACTIVE', 1, $3)
        RETURNING id
      `, [realmId, stateId, adminId]);
      districtId = insDist.rows[0].id;
    }

    const existingSub = await client.query("SELECT id FROM geography_area WHERE root_realm_id=$1 AND normalized_name='varanasi sadar'", [realmId]);
    if (existingSub.rows.length) {
      subdivisionId = existingSub.rows[0].id;
    } else {
      const insSub = await client.query(`
        INSERT INTO geography_area(root_realm_id, level, parent_area_id, display_name, normalized_name, code, status, version, updated_by)
        VALUES($1, 'SUBDIVISION', $2, 'Varanasi Sadar', 'varanasi sadar', 'VNS-SDR', 'ACTIVE', 1, $3)
        RETURNING id
      `, [realmId, districtId, adminId]);
      subdivisionId = insSub.rows[0].id;
    }

    const existingBlock = await client.query("SELECT id FROM geography_area WHERE root_realm_id=$1 AND normalized_name='kashi vidyapeeth'", [realmId]);
    if (existingBlock.rows.length) {
      blockId = existingBlock.rows[0].id;
    } else {
      const insBlock = await client.query(`
        INSERT INTO geography_area(root_realm_id, level, parent_area_id, display_name, normalized_name, code, status, version, updated_by)
        VALUES($1, 'BLOCK', $2, 'Kashi Vidyapeeth', 'kashi vidyapeeth', 'KVP', 'ACTIVE', 1, $3)
        RETURNING id
      `, [realmId, subdivisionId, adminId]);
      blockId = insBlock.rows[0].id;
    }

    console.log("Geography ready:", { stateId, districtId, subdivisionId, blockId });

    // 2. Test User Accounts
    console.log("Seeding test user accounts...");
    const accountMap = { "9065015409": adminId };
    
    const p1Res = await client.query("SELECT id FROM account WHERE normalized_mobile='9065015407'");
    if (p1Res.rows.length) accountMap["9065015407"] = p1Res.rows[0].id;

    for (const u of testAccounts) {
      const roleRes = await client.query("SELECT id FROM role WHERE realm_id=$1 AND normalized_name=LOWER($2) LIMIT 1", [realmId, u.roleName]);
      if (!roleRes.rows.length) throw new Error(`Role not found: ${u.roleName}`);
      const roleId = roleRes.rows[0].id;
      const pwdHash = await hashPassword(u.password);

      const existing = await client.query("SELECT id FROM account WHERE normalized_mobile=$1", [u.mobile]);
      let accountId;
      if (existing.rows.length) {
        accountId = existing.rows[0].id;
        await client.query(
          "UPDATE account SET display_name=$1, normalized_email=$2, contact_phone=$3, status='ACTIVE', updated_at=now() WHERE id=$4",
          [u.displayName, u.email, "+91" + u.mobile, accountId]
        );
        await client.query(
          "INSERT INTO identity_credential(account_id, password_hash, credential_version, updated_at) VALUES($1, $2, 1, now()) ON CONFLICT(account_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, credential_version=identity_credential.credential_version+1, updated_at=now()",
          [accountId, pwdHash]
        );
      } else {
        const insertAcc = await client.query(
          "INSERT INTO account(realm_id, display_name, normalized_mobile, normalized_email, contact_phone, status, access_version, revision, created_at, updated_at) VALUES($1, $2, $3, $4, $5, 'ACTIVE', 1, 1, now(), now()) RETURNING id",
          [realmId, u.displayName, u.mobile, u.email, "+91" + u.mobile]
        );
        accountId = insertAcc.rows[0].id;
        await client.query(
          "INSERT INTO identity_credential(account_id, password_hash, credential_version, updated_at) VALUES($1, $2, 1, now())",
          [accountId, pwdHash]
        );
      }

      const existingRole = await client.query(
        "SELECT id FROM account_role WHERE account_id=$1 AND role_id=$2 AND revoked_at IS NULL",
        [accountId, roleId]
      );
      if (!existingRole.rows.length) {
        await client.query(
          "INSERT INTO account_role(id, account_id, role_id, realm_id, assigned_at, revision) VALUES($1, $2, $3, $4, now(), 1)",
          [randomUUID(), accountId, roleId, realmId]
        );
      }
      accountMap[u.mobile] = accountId;
    }
    console.log("Accounts ready:", Object.keys(accountMap));

    // 3. Branches (CG-02)
    console.log("Seeding CG-02 Branches...");
    const branches = [
      { code: "CG-BR-000001", name: "Varanasi North Branch", mgr: accountMap["9065015411"], status: "ACTIVE", pin: "221002" },
      { code: "CG-BR-000002", name: "Varanasi South Branch", mgr: accountMap["9065015412"], status: "ACTIVE", pin: "221005" },
      { code: "CG-BR-000003", name: "Varanasi Rural Branch", mgr: accountMap["9065015411"], status: "CLOSED", pin: "221011" }
    ];

    for (const br of branches) {
      const existBr = await client.query("SELECT id FROM branch WHERE root_realm_id=$1 AND branch_code=$2", [realmId, br.code]);
      if (!existBr.rows.length) {
        const regRes = await client.query(`
          INSERT INTO branch_registration(root_realm_id, requested_by, updated_by, manager_account_ref, geography_area_id, current_step, draft_version, current_submission_revision, status, profile_payload)
          VALUES($1, $2, $2, $3, $4, 4, 1, 1, 'ACTIVE', '{}'::jsonb)
          RETURNING id
        `, [realmId, adminId, br.mgr, districtId]);
        const regId = regRes.rows[0].id;

        const subRes = await client.query(`
          INSERT INTO branch_registration_submission(root_realm_id, registration_id, submitted_revision, source_submission_key, immutable_payload, immutable_payload_digest, verified_file_versions, status, submitted_by)
          VALUES($1, $2, 1, gen_random_uuid(), '{}'::jsonb, repeat('a', 64), '[]'::jsonb, 'ACTIVE', $3)
          RETURNING id
        `, [realmId, regId, adminId]);
        const subId = subRes.rows[0].id;

        await client.query(`
          INSERT INTO branch(root_realm_id, registration_id, approved_submission_id, branch_code, name, normalized_name, branch_type, geography_area_id, pin_code, manager_account_ref, evidence_versions, status, updated_by)
          VALUES($1, $2, $3, $4, $5, lower($5), 'REGIONAL', $6, $7, $8, '[]'::jsonb, $9, $10)
        `, [realmId, regId, subId, br.code, br.name, districtId, br.pin, br.mgr, br.status, adminId]);
      }
    }
    console.log("Branches ready.");

    // 4. CG-14 Provider & Centers
    console.log("Seeding CG-14 Provider & Centers...");
    let providerId;
    const existProv = await client.query("SELECT id FROM health_provider WHERE root_realm_id=$1 AND provider_code='CG-HP-001'", [realmId]);
    if (existProv.rows.length) {
      providerId = existProv.rows[0].id;
    } else {
      const insProv = await client.query(`
        INSERT INTO health_provider(root_realm_id, provider_code, legal_name, normalized_name, provider_type, contact_name, contact_phone, contact_email, registration_ref, status, version, created_by)
        VALUES($1, 'CG-HP-001', 'CareGanga Health Network Partner', 'careganga health network partner', 'CLINIC', 'Dr. Alok Verma', '+919876543211', 'partner@careganga.org', 'REG-UP-2024-9988', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, adminId]);
      providerId = insProv.rows[0].id;
    }
    console.log("Provider ready:", providerId);

    // Center X: Clinic X (Varanasi Central) - PUBLISHED
    let centerXId;
    const existCenterX = await client.query("SELECT id FROM health_center WHERE root_realm_id=$1 AND center_code='CG-HC-VNS01'", [realmId]);
    if (existCenterX.rows.length) {
      centerXId = existCenterX.rows[0].id;
    } else {
      const insX = await client.query(`
        INSERT INTO health_center(root_realm_id, provider_id, center_code, display_name, center_type, address_line, state_ref, district_ref, block_ref, pin_code, latitude, longitude, time_zone, public_phone, status, version, access_state, publication_state, public_slug, publication_generation)
        VALUES($1, $2, 'CG-HC-VNS01', 'CareGanga Health Clinic Varanasi Central', 'POLYCLINIC', 'D 58/12 Sigra, Varanasi', $3, $4, $5, '221010', 25.3176, 82.9739, 'Asia/Kolkata', '+915422223344', 'VERIFIED', 1, 'ENABLED', 'PUBLISHED', 'careganga-health-clinic-varanasi-central', 1)
        RETURNING id
      `, [realmId, providerId, stateId, districtId, blockId]);
      centerXId = insX.rows[0].id;

      for (let day = 1; day <= 6; day++) {
        await client.query(`
          INSERT INTO health_center_hours(root_realm_id, center_id, weekday, open_local, close_local, service_type)
          VALUES($1, $2, $3, '09:00', '18:00', 'CONSULTATION')
        `, [realmId, centerXId, day]);
      }
      for (const cap of ['CONSULTATION', 'DIAGNOSTICS', 'PHARMACY']) {
        await client.query(`
          INSERT INTO health_center_capability(root_realm_id, center_id, capability_code)
          VALUES($1, $2, $3)
        `, [realmId, centerXId, cap]);
      }
    }

    // Center Y: Clinic Y (Sarnath Outpost) - UNPUBLISHED
    let centerYId;
    const existCenterY = await client.query("SELECT id FROM health_center WHERE root_realm_id=$1 AND center_code='CG-HC-VNS02'", [realmId]);
    if (existCenterY.rows.length) {
      centerYId = existCenterY.rows[0].id;
    } else {
      const insY = await client.query(`
        INSERT INTO health_center(root_realm_id, provider_id, center_code, display_name, center_type, address_line, state_ref, district_ref, block_ref, pin_code, latitude, longitude, time_zone, public_phone, status, version, access_state, publication_state, public_slug, publication_generation)
        VALUES($1, $2, 'CG-HC-VNS02', 'CareGanga Health Clinic Sarnath Outpost', 'CLINIC', 'Near Deer Park, Sarnath, Varanasi', $3, $4, $5, '221007', 25.3716, 83.0253, 'Asia/Kolkata', '+915422225566', 'VERIFIED', 1, 'ENABLED', 'UNPUBLISHED', 'careganga-health-clinic-sarnath-outpost', 0)
        RETURNING id
      `, [realmId, providerId, stateId, districtId, blockId]);
      centerYId = insY.rows[0].id;

      for (let day = 1; day <= 5; day++) {
        await client.query(`
          INSERT INTO health_center_hours(root_realm_id, center_id, weekday, open_local, close_local, service_type)
          VALUES($1, $2, $3, '10:00', '17:00', 'CONSULTATION')
        `, [realmId, centerYId, day]);
      }
      await client.query(`
        INSERT INTO health_center_capability(root_realm_id, center_id, capability_code)
        VALUES($1, $2, 'CONSULTATION')
      `, [realmId, centerYId]);
    }
    console.log("Centers ready:", { centerXId, centerYId });

    // Affiliations for Rep X and Rep Y
    const repXAccount = accountMap["9065015413"];
    const repYAccount = accountMap["9065015414"];
    
    await client.query(`
      INSERT INTO health_center_account_affiliation(root_realm_id, center_id, account_ref, status, assigned_by)
      VALUES($1, $2, $3, 'ACTIVE', $4)
      ON CONFLICT DO NOTHING
    `, [realmId, centerXId, repXAccount, adminId]);

    await client.query(`
      INSERT INTO health_center_account_affiliation(root_realm_id, center_id, account_ref, status, assigned_by)
      VALUES($1, $2, $3, 'ACTIVE', $4)
      ON CONFLICT DO NOTHING
    `, [realmId, centerYId, repYAccount, adminId]);
    console.log("Representatives affiliated.");

    // 5. Doctors & Affiliations & Fees (Doctor A at X and Y, Doctor B at Y)
    console.log("Seeding doctors and fee versions...");
    let doctorAId;
    const existDocA = await client.query("SELECT id FROM health_doctor WHERE root_realm_id=$1 AND registration_number='UP-MED-2015-8899'", [realmId]);
    if (existDocA.rows.length) {
      doctorAId = existDocA.rows[0].id;
    } else {
      const insDocA = await client.query(`
        INSERT INTO health_doctor(root_realm_id, registration_jurisdiction, registration_number, full_name, normalized_name, qualifications, specialties, experience_years, public_bio, status, version, created_by)
        VALUES($1, 'UTTAR PRADESH MEDICAL COUNCIL', 'UP-MED-2015-8899', 'Dr. Anita Sharma', 'dr. anita sharma', '{"MBBS", "MD (Medicine)"}', '{"General Medicine"}', 11, 'Senior consultant in internal medicine with over 11 years clinical practice.', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, adminId]);
      doctorAId = insDocA.rows[0].id;
    }

    // Link Doctor A account
    await client.query(`
      INSERT INTO health_doctor_account_link(root_realm_id, doctor_id, account_id, status, proposed_by, proposed_at, accepted_at, revision)
      VALUES($1, $2, $3, 'ACTIVE', $4, now(), now(), 1)
      ON CONFLICT DO NOTHING
    `, [realmId, doctorAId, accountMap["9065015415"], adminId]);

    // Doctor A at Center X (Fee: ₹300 = 30000 minor)
    let docACenterXId;
    const existDocACenterX = await client.query("SELECT id FROM health_doctor_center WHERE root_realm_id=$1 AND doctor_id=$2 AND center_id=$3", [realmId, doctorAId, centerXId]);
    if (existDocACenterX.rows.length) {
      docACenterXId = existDocACenterX.rows[0].id;
    } else {
      const insACenterX = await client.query(`
        INSERT INTO health_doctor_center(root_realm_id, doctor_id, center_id, affiliation_state, approved_from, version, proposed_by, approved_by)
        VALUES($1, $2, $3, 'APPROVED', now() - interval '30 days', 1, $4, $4)
        RETURNING id
      `, [realmId, doctorAId, centerXId, adminId]);
      docACenterXId = insACenterX.rows[0].id;

      await client.query(`
        INSERT INTO health_center_fee(root_realm_id, doctor_center_id, fee_kind, consultation_mode, currency, amount_minor, effective_from, status, version, proposed_by, approved_by, approved_at)
        VALUES($1, $2, 'CONSULTATION', 'IN_PERSON', 'INR', 30000, now() - interval '30 days', 'APPROVED', 1, $3, $3, now())
      `, [realmId, docACenterXId, adminId]);
    }

    // Doctor A at Center Y (Fee: ₹450 = 45000 minor)
    let docACenterYId;
    const existDocACenterY = await client.query("SELECT id FROM health_doctor_center WHERE root_realm_id=$1 AND doctor_id=$2 AND center_id=$3", [realmId, doctorAId, centerYId]);
    if (existDocACenterY.rows.length) {
      docACenterYId = existDocACenterY.rows[0].id;
    } else {
      const insACenterY = await client.query(`
        INSERT INTO health_doctor_center(root_realm_id, doctor_id, center_id, affiliation_state, approved_from, version, proposed_by, approved_by)
        VALUES($1, $2, $3, 'APPROVED', now() - interval '30 days', 1, $4, $4)
        RETURNING id
      `, [realmId, doctorAId, centerYId, adminId]);
      docACenterYId = insACenterY.rows[0].id;

      await client.query(`
        INSERT INTO health_center_fee(root_realm_id, doctor_center_id, fee_kind, consultation_mode, currency, amount_minor, effective_from, status, version, proposed_by, approved_by, approved_at)
        VALUES($1, $2, 'CONSULTATION', 'IN_PERSON', 'INR', 45000, now() - interval '30 days', 'APPROVED', 1, $3, $3, now())
      `, [realmId, docACenterYId, adminId]);
    }

    // Doctor B (Dr. Rajesh Kumar) at Center Y (Fee: ₹500 = 50000 minor)
    let doctorBId;
    const existDocB = await client.query("SELECT id FROM health_doctor WHERE root_realm_id=$1 AND registration_number='UP-MED-2018-4455'", [realmId]);
    if (existDocB.rows.length) {
      doctorBId = existDocB.rows[0].id;
    } else {
      const insDocB = await client.query(`
        INSERT INTO health_doctor(root_realm_id, registration_jurisdiction, registration_number, full_name, normalized_name, qualifications, specialties, experience_years, public_bio, status, version, created_by)
        VALUES($1, 'UTTAR PRADESH MEDICAL COUNCIL', 'UP-MED-2018-4455', 'Dr. Rajesh Kumar', 'dr. rajesh kumar', '{"MBBS", "MS (Orthopedics)"}', '{"Orthopedics"}', 8, 'Specialist orthopedic surgeon handling joint, bone and sports injury care.', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, adminId]);
      doctorBId = insDocB.rows[0].id;

      const insBCenterY = await client.query(`
        INSERT INTO health_doctor_center(root_realm_id, doctor_id, center_id, affiliation_state, approved_from, version, proposed_by, approved_by)
        VALUES($1, $2, $3, 'APPROVED', now() - interval '30 days', 1, $4, $4)
        RETURNING id
      `, [realmId, doctorBId, centerYId, adminId]);
      const docBCenterYId = insBCenterY.rows[0].id;

      await client.query(`
        INSERT INTO health_center_fee(root_realm_id, doctor_center_id, fee_kind, consultation_mode, currency, amount_minor, effective_from, status, version, proposed_by, approved_by, approved_at)
        VALUES($1, $2, 'CONSULTATION', 'IN_PERSON', 'INR', 50000, now() - interval '30 days', 'APPROVED', 1, $3, $3, now())
      `, [realmId, docBCenterYId, adminId]);
    }
    console.log("Doctors and fees ready:", { doctorAId, doctorBId });

    // 6. Doctor Schedules (CG-15) for Doctor A at Center X
    console.log("Seeding doctor schedules...");
    const existSched = await client.query("SELECT id FROM cg15_doctor_schedule WHERE root_realm_id=$1 AND doctor_id=$2 AND center_id=$3", [realmId, doctorAId, centerXId]);
    if (!existSched.rows.length) {
      await client.query("BEGIN");
      try {
        const schedId = randomUUID();
        const revId = randomUUID();

        await client.query(`
          INSERT INTO cg15_doctor_schedule(id, root_realm_id, doctor_id, center_id, association_id, consultation_mode, time_zone, status, version, current_revision_id, created_by, updated_by)
          VALUES($1, $2, $3, $4, $5, 'IN_PERSON', 'Asia/Kolkata', 'ACTIVE', 1, $6, $7, $7)
        `, [schedId, realmId, doctorAId, centerXId, docACenterXId, revId, adminId]);

        await client.query(`
          INSERT INTO cg15_schedule_revision(id, root_realm_id, schedule_id, revision_no, slot_minutes, per_slot_capacity, effective_from, effective_until, source_digest, authored_by)
          VALUES($1, $2, $3, 1, 15, 1, CURRENT_DATE - 30, CURRENT_DATE + 365, repeat('a', 64), $4)
        `, [revId, realmId, schedId, adminId]);

        for (let day = 1; day <= 6; day++) {
          await client.query(`
            INSERT INTO cg15_schedule_weekly_window(root_realm_id, schedule_id, revision_id, weekday, open_local, close_local)
            VALUES($1, $2, $3, $4, '09:00', '13:00')
          `, [realmId, schedId, revId, day]);
          await client.query(`
            INSERT INTO cg15_schedule_weekly_window(root_realm_id, schedule_id, revision_id, weekday, open_local, close_local)
            VALUES($1, $2, $3, $4, '14:00', '18:00')
          `, [realmId, schedId, revId, day]);
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("Doctor schedules ready.");

    // 7. CG-15 Patients & Consent
    console.log("Seeding patients...");
    // P1 (Ramesh Kumar - consented at Clinic X)
    let p1Id;
    const p1AccId = accountMap["9065015407"];
    const existP1 = await client.query("SELECT id FROM cg15_patient WHERE root_realm_id=$1 AND virtual_display_id='CGP-0000000000000001'", [realmId]);
    if (existP1.rows.length) {
      p1Id = existP1.rows[0].id;
    } else {
      const insP1 = await client.query(`
        INSERT INTO cg15_patient(root_realm_id, virtual_display_id, first_name, last_name, date_of_birth, profile_status, revision, created_by_account)
        VALUES($1, 'CGP-0000000000000001', 'Ramesh', 'Kumar', '1988-05-15', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, p1AccId]);
      p1Id = insP1.rows[0].id;

      await client.query(`
        INSERT INTO cg15_patient_account_link(root_realm_id, patient_id, account_id, proof_type, verified_at)
        VALUES($1, $2, $3, 'CG01_VERIFIED_ACCOUNT_CONTACT', now())
      `, [realmId, p1Id, p1AccId]);

      await client.query(`
        INSERT INTO cg15_patient_consent(root_realm_id, patient_id, revision_no, purpose, terms_version, granted, recorded_by_account)
        VALUES($1, $2, 1, 'PATIENT_CARE', 'v1.0', true, $3)
      `, [realmId, p1Id, p1AccId]);

      await client.query(`
        INSERT INTO cg15_patient_center_intake(root_realm_id, center_id, patient_id, created_by_account, request_key, request_digest, assisted_consent_attested, consent_version)
        VALUES($1, $2, $3, $4, gen_random_uuid(), repeat('b', 64), true, 'v1.0')
      `, [realmId, centerXId, p1Id, repXAccount]);
    }

    // P2 (Sunita Devi - NO consent)
    const p2AccId = accountMap["9065015417"];
    const existP2 = await client.query("SELECT id FROM cg15_patient WHERE root_realm_id=$1 AND virtual_display_id='CGP-0000000000000002'", [realmId]);
    if (!existP2.rows.length) {
      const insP2 = await client.query(`
        INSERT INTO cg15_patient(root_realm_id, virtual_display_id, first_name, last_name, date_of_birth, profile_status, revision, created_by_account)
        VALUES($1, 'CGP-0000000000000002', 'Sunita', 'Devi', '1992-08-20', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, p2AccId]);
      const p2Id = insP2.rows[0].id;

      await client.query(`
        INSERT INTO cg15_patient_account_link(root_realm_id, patient_id, account_id, proof_type, verified_at)
        VALUES($1, $2, $3, 'CG01_VERIFIED_ACCOUNT_CONTACT', now())
      `, [realmId, p2Id, p2AccId]);
    }

    // P3 (Amit Patel - linked to account)
    const p3AccId = accountMap["9065015418"];
    const existP3 = await client.query("SELECT id FROM cg15_patient WHERE root_realm_id=$1 AND virtual_display_id='CGP-0000000000000003'", [realmId]);
    if (!existP3.rows.length) {
      const insP3 = await client.query(`
        INSERT INTO cg15_patient(root_realm_id, virtual_display_id, first_name, last_name, date_of_birth, profile_status, revision, created_by_account)
        VALUES($1, 'CGP-0000000000000003', 'Amit', 'Patel', '1995-12-10', 'VERIFIED', 1, $2)
        RETURNING id
      `, [realmId, p3AccId]);
      const p3Id = insP3.rows[0].id;

      await client.query(`
        INSERT INTO cg15_patient_account_link(root_realm_id, patient_id, account_id, proof_type, verified_at)
        VALUES($1, $2, $3, 'CG01_VERIFIED_ACCOUNT_CONTACT', now())
      `, [realmId, p3Id, p3AccId]);
    }
    console.log("Patients ready: P1 (consented at X), P2 (no consent), P3.");

    // 8. CG-17 Healthcare Assistance Policy (₹200 support on Consultation at Clinic X)
    console.log("Seeding CG-17 Assistance Policy...");
    const existPolicy = await client.query("SELECT id FROM healthcare_policy_revision WHERE root_realm_id=$1 AND center_ref=$2", [realmId, centerXId]);
    if (!existPolicy.rows.length) {
      await client.query(`
        INSERT INTO healthcare_policy_revision(root_realm_id, policy_ref, center_ref, service_kind, revision_no, valid_from, valid_until, mode, fixed_minor, cap_minor, currency, eligibility, activated_at, approval_state, actor_ref, request_key, request_digest, source_digest)
        VALUES($1, gen_random_uuid(), $2, 'CONSULTATION', 1, now() - interval '1 day', now() + interval '365 days', 'FIXED', 20000, 20000, 'INR', 'VERIFIED_PATIENT_CARE', now(), 'ACTIVE', $3, gen_random_uuid(), repeat('c', 64), repeat('c', 64))
      `, [realmId, centerXId, adminId]);
    }
    console.log("CG-17 Assistance Policy ready.");

    console.log("\n=======================================================");
    console.log("ALL HEALTHCARE TEST FIXTURES SEEDED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
