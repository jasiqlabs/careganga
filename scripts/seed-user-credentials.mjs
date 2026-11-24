import dns from "node:dns";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import pg from "pg";

dns.setDefaultResultOrder?.("ipv4first");
try { process.loadEnvFile?.(".env"); } catch {}
try { process.loadEnvFile?.("apps/backend/.env"); } catch {}

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

const users = [
  {
    roleName: "Super Admin",
    displayName: "Admin User",
    mobile: "9065015409",
    email: "admin.9065015409@careganga.org",
    password: "CareGanga@123",
    appTarget: "Web Admin & Internal Operations (Full Access)"
  },
  {
    roleName: "sub admin",
    displayName: "Internal Staff Operator",
    mobile: "9065015408",
    email: "staff.9065015408@careganga.org",
    password: "CareGanga@123",
    appTarget: "Internal Android App (Staff / Field Visits / Operations)"
  },
  {
    roleName: "CareGanga Patient",
    displayName: "Patient User",
    mobile: "9065015407",
    email: "patient.9065015407@careganga.org",
    password: "CareGanga@123",
    appTarget: "Public Android App & Patient Portal"
  }
];

async function main() {
  const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 15000 });
  let client;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      client = await pool.connect();
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  try {
    const realmRes = await client.query("SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 1");
    if (!realmRes.rows.length) throw new Error("FOUNDATION_ROOT realm not found");
    const realmId = realmRes.rows[0].id;

    for (const u of users) {
      const roleRes = await client.query("SELECT id FROM role WHERE realm_id=$1 AND normalized_name=LOWER($2) LIMIT 1", [realmId, u.roleName]);
      if (!roleRes.rows.length) throw new Error(`Role not found: ${u.roleName}`);
      const roleId = roleRes.rows[0].id;

      const pwdHash = await hashPassword(u.password);

      // Check if account already exists
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

      // Assign role if not active
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

      console.log(`PROVISIONED: ${u.roleName} | Mobile: ${u.mobile} | Email: ${u.email} | Target: ${u.appTarget}`);
    }
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});
