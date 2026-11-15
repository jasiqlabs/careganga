import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { decodeBase32, encryptTotpSecret, hashPassword, matchedTotpCounter } from "../domain/secret-crypto";

// Run once, from a secured operator shell, against a new database. No public bootstrap API.
// Never log secrets, passwords, enrollment QR, TOTP or the DB URL.
async function bootstrapRoot(): Promise<void> {
  if (!process.argv.includes("--confirm-one-time-root"))
    throw new Error("Explicit --confirm-one-time-root is required");
  const url = process.env.DATABASE_MIGRATION_URL;
  const email = process.env.CAREGANGA_ROOT_EMAIL?.trim().toLowerCase();
  const name = process.env.CAREGANGA_ROOT_NAME?.trim();
  const password = process.env.CAREGANGA_ROOT_PASSWORD ?? "";
  const proof = process.env.CAREGANGA_ROOT_TOTP_PROOF ?? "";
  const base32 = process.env.CAREGANGA_ROOT_TOTP_BASE32 ?? "";
  if (!url || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length < 2)
    throw new Error("Secure operator name/email and migration DB URL required");
  const rawSecret = decodeBase32(base32);
  const matchedCounter = matchedTotpCounter(rawSecret, proof);
  if (matchedCounter === null) throw new Error("Authenticator proof is missing or invalid");
  const passwordHash = await hashPassword(password);
  const encrypted = encryptTotpSecret(rawSecret);
  rawSecret.fill(0);
  const pool = new Pool({ connectionString: url, max: 1, application_name: "careganga-root-provision" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const realm = await client.query<{ id: string }>(
        "INSERT INTO access_realm(realm_key) VALUES('FOUNDATION_ROOT') ON CONFLICT(realm_key) DO UPDATE SET realm_key = EXCLUDED.realm_key RETURNING id"
      );
      const realmId = realm.rows[0].id;
      await client.query("SELECT id FROM access_realm WHERE id = $1 FOR UPDATE", [realmId]);
      const existing = await client.query("SELECT id FROM account LIMIT 1");
      if (existing.rowCount) throw new Error("Root setup closed: accounts already exist; operator review required");
      const root = await client.query<{ id: string }>(
        `INSERT INTO account (realm_id,display_name,normalized_email,email_verified_at,status)
         VALUES ($1,$2,$3,now(),'ACTIVE') RETURNING id`, [realmId,name,email]
      );
      const accountId = root.rows[0].id;
      await client.query(
        "INSERT INTO identity_credential(account_id,password_hash,totp_ciphertext,totp_nonce,totp_tag,last_totp_counter) VALUES($1,$2,$3,$4,$5,$6)",
        [accountId,passwordHash,encrypted.ciphertext,encrypted.nonce,encrypted.tag,matchedCounter]
      );
      const role = await client.query<{ id: string }>(
        `INSERT INTO role(realm_id,name,normalized_name,description,is_protected)
         VALUES($1,'Super Admin','super admin','Protected Foundation administrator',true) RETURNING id`, [realmId]
      );
      await client.query("INSERT INTO account_role(account_id,role_id,realm_id) VALUES($1,$2,$3)",
        [accountId,role.rows[0].id,realmId]);
      await client.query(
        `INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,safe_context,correlation_ref)
         VALUES($1,$2,$2,'identity.root.bootstrap','SUCCESS','{}'::jsonb,$3)`,
        [realmId,accountId,randomUUID()]
      );
      await client.query("COMMIT");
      process.stdout.write("Protected CareGanga Foundation root provisioned successfully. Unset the operator secrets.\n");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
  } finally { client.release(); await pool.end(); }
}
void bootstrapRoot().catch(() => {
  process.stderr.write("Protected one-time root provisioning did not complete. Verify setup privately.\n");
  process.exitCode = 1;
});
