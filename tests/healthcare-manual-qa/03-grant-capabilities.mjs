import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder?.("ipv4first");
try { process.loadEnvFile?.(".env"); } catch {}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const caps = [
  "health.patients.admin.view",
  "health.visits.manage",
  "health.visits.clinical.manage",
  "health.appointments.cancel",
  "health.appointments.override",
  "health.patients.intake",
  "health.schedules.view",
  "health.schedules.manage",
  "health.providers.view",
  "health.providers.manage",
  "health.doctors.view",
  "health.doctors.manage",
  "health.doctors.verify",
  "health.centers.draft.edit",
  "health.providers.finance.view",
  "health.providers.finance.manage",
  "health.providers.verify",
  "health.centers.activate",
  "health.centers.publish",
  "diagnostics.catalog.view",
  "diagnostics.catalog.manage",
  "diagnostics.pricing.view",
  "diagnostics.pricing.manage",
  "diagnostics.pricing.approve",
  "healthcare.assistance.merchant.manage",
  "healthcare.assistance.merchant.verify",
  "healthcare.assistance.collections.view",
  "healthcare.assistance.collections.record",
  "healthcare.assistance.collections.refund",
  "healthcare.assistance.liabilities.view",
  "healthcare.assistance.liabilities.manage",
  "healthcare.assistance.settlements.view",
  "healthcare.assistance.settlements.manage",
  "healthcare.assistance.settlements.review"
];

async function main() {
  const roles = await pool.query("SELECT id, normalized_name FROM role WHERE normalized_name IN ('sub admin', 'approval')");
  for (const r of roles.rows) {
    for (const c of caps) {
      await pool.query(
        "INSERT INTO role_grant (role_id, capability_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [r.id, c]
      );
    }
    console.log(`Granted healthcare capabilities to role: ${r.normalized_name}`);
  }
  await pool.end();
}

main().catch(console.error);
