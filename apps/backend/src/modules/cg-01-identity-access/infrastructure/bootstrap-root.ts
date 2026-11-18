import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../domain/secret-crypto";

// Safely load environment files if present in cwd or workspace root
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(); } catch {}
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.("../../../../../../.env"); } catch {}

// One-time secure local operator action, run only after applying greenfield PostgreSQL migrations.
// NEVER add a public bootstrap endpoint or print the password, mobile or credentials.
async function bootstrapRoot(): Promise<void> {
  if (!process.argv.includes("--confirm-one-time-root"))
    throw new Error("Explicit --confirm-one-time-root is required");
  const url = process.env.DATABASE_MIGRATION_URL;
  const mobile = process.env.CAREGANGA_ROOT_MOBILE?.trim() ?? "";
  const email = process.env.CAREGANGA_ROOT_EMAIL?.trim().toLowerCase() || null;
  const name = process.env.CAREGANGA_ROOT_NAME?.trim() ?? "";
  const password = process.env.CAREGANGA_ROOT_PASSWORD ?? "";
  if (!url || !/^[6-9][0-9]{9}$/.test(mobile) ||
      (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      name.length < 2 || name.length > 160)
    throw new Error("Root setup requires migration DB URL, name, 10-digit mobile and optional valid email");
  const passwordHash = await hashPassword(password);
  const pool = new Pool({ connectionString: url, max: 1, application_name: "careganga-root-provision" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const realm = await client.query<{id:string}>(
        "INSERT INTO access_realm(realm_key) VALUES('FOUNDATION_ROOT') ON CONFLICT(realm_key) DO UPDATE SET realm_key=EXCLUDED.realm_key RETURNING id"
      );
      const realmId = realm.rows[0].id;
      await client.query("SELECT id FROM access_realm WHERE id=$1 FOR UPDATE", [realmId]);
      const existing = await client.query("SELECT id FROM account LIMIT 1");
      if (existing.rowCount) throw new Error("Root setup already closed; do not provision twice");
      const created = await client.query<{id:string}>(
        "INSERT INTO account(realm_id,display_name,normalized_mobile,normalized_email,contact_phone,status) "+
        "VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING id",
        [realmId,name,mobile,email,"+91"+mobile]
      );
      const accountId = created.rows[0].id;
      await client.query("INSERT INTO identity_credential(account_id,password_hash) VALUES($1,$2)",
        [accountId,passwordHash]);
      const role = await client.query<{id:string}>(
        "INSERT INTO role(realm_id,name,normalized_name,description,is_protected) "+
        "VALUES($1,'Super Admin','super admin','Protected Foundation administrator',true) RETURNING id",
        [realmId]
      );
      await client.query("INSERT INTO account_role(account_id,role_id,realm_id) VALUES($1,$2,$3)",
        [accountId,role.rows[0].id,realmId]);
      await client.query(
        "INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,safe_context,correlation_ref) "+
        "VALUES($1,$2,$2,'identity.root.bootstrap','SUCCESS','{}'::jsonb,$3)",
        [realmId,accountId,randomUUID()]
      );
      await client.query("COMMIT");
      process.stdout.write("Protected CareGanga Super Admin provisioned. Unset operator secrets.\n");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
  } finally { client.release(); await pool.end(); }
}
void bootstrapRoot().catch(() => {
  process.stderr.write("One-time root provisioning failed. Review protected setup logs privately.\n");
  process.exitCode = 1;
});
