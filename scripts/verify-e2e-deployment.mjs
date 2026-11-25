import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { readiness } from "./verify-cms-first-publication.mjs";

const ADMIN_URL = "postgres://postgres:admin@localhost:5432/postgres";
const TEST_DB = "careganga_auto_first";
const TEST_DB_URL = `postgres://postgres:admin@localhost:5432/${TEST_DB}`;

async function recreateDatabase() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB}' AND pid != pg_backend_pid()
    `).catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
    console.log(`[E2E] Clean database ${TEST_DB} created.`);
  } finally {
    await admin.end();
  }
}

function startBackend() {
  const proc = spawn(process.execPath, ["dist/src/main.js"], {
    cwd: "apps/backend",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
      DATABASE_MIGRATION_URL: TEST_DB_URL,
      PORT: "8080",
      CAREGANGA_ROOT_NAME: "Platform Super Admin",
      CAREGANGA_ROOT_MOBILE: "9876543210",
      CAREGANGA_ROOT_PASSWORD: "SuperSecretRootPassword123#",
      CAREGANGA_ROOT_EMAIL: "admin@careganga.org",
      WEB_ORIGIN: "http://localhost:3000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  proc.stdout.on("data", d => process.stdout.write(`[BACKEND] ${d}`));
  proc.stderr.on("data", d => process.stderr.write(`[BACKEND ERR] ${d}`));
  return proc;
}

async function waitForBackendReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch("http://127.0.0.1:8080/api/public/content/navigation", {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        console.log(`[E2E] Backend responded healthy after ${Date.now() - start}ms.`);
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Backend failed to start within timeout");
}

async function run() {
  console.log("=== PHASE 1: Clean Database & First Deployment Verification ===");
  await recreateDatabase();

  console.log("[E2E] Starting backend against completely empty PostgreSQL 17 database...");
  let backend = startBackend();

  try {
    await waitForBackendReady();

    const pool = new Pool({ connectionString: TEST_DB_URL, max: 2 });
    try {
      // 1. Verify schema migration ledger
      const ledger = await pool.query("SELECT COUNT(*) FROM public.schema_migration");
      console.log(`[E2E] Ledger row count: ${ledger.rows[0].count}`);
      assert.equal(Number(ledger.rows[0].count), 312, "Ledger must contain 312 entries");

      // 2. Verify Super Admin provisioned
      const rootAcc = await pool.query(
        "SELECT display_name, status FROM public.account"
      );
      assert.equal(rootAcc.rowCount, 1, "Exactly one Super Admin provisioned");
      assert.equal(rootAcc.rows[0].display_name, "Platform Super Admin");
      assert.equal(rootAcc.rows[0].status, "ACTIVE");
      console.log(`[E2E] Protected Super Admin verified: ${rootAcc.rows[0].display_name} (ACTIVE)`);

      // 3. Verify CMS Pages: 8 published, 7 unpublished policy drafts
      const totalPages = await pool.query("SELECT COUNT(*) FROM public.cms_page");
      assert.equal(Number(totalPages.rows[0].count), 15);

      const publishedPages = await pool.query(
        "SELECT p.slug FROM public.cms_publication pub JOIN public.cms_page p ON p.id = pub.page_id WHERE pub.state = 'EFFECTIVE' ORDER BY p.slug"
      );
      const publishedSlugs = publishedPages.rows.map(r => r.slug);
      console.log(`[E2E] Published editorial pages (${publishedSlugs.length}):`, publishedSlugs);
      assert.deepEqual(publishedSlugs, ["80g", "about", "collaboration", "contact", "gallery", "healthcare", "home", "our-impact"]);

      const draftPolicies = await pool.query(
        "SELECT COUNT(*) FROM public.cms_page WHERE kind = 'POLICY' AND id NOT IN (SELECT page_id FROM public.cms_publication WHERE state = 'EFFECTIVE')"
      );
      assert.equal(Number(draftPolicies.rows[0].count), 7, "All 7 legal policies must remain unpublished drafts");
      console.log(`[E2E] Verified: 7 legal policy shells remain unpublished drafts.`);

      // 4. Verify 16 release assets in DB
      const assets = await pool.query("SELECT COUNT(*) FROM public.cms_release_asset");
      assert.equal(Number(assets.rows[0].count), 16, "All 16 illustrations registered in cms_release_asset");
      console.log(`[E2E] Verified: all 16 release illustrations present in database.`);

      // 5. Test verify-cms-first-publication readiness gate
      const failures = await readiness("http://127.0.0.1:8080");
      console.log(`[E2E] CMS first-publication readiness failures:`, failures);
      assert.deepEqual(failures, [], "CMS first publication readiness gate must pass with 0 failures");
      console.log("[E2E] Readiness check: 100% PASSED.");

      // 6. Test actual HTTP delivery of WebP illustrations
      const heroRes = await fetch("http://127.0.0.1:8080/api/public/content/release-media/community-illustration-hero");
      assert.equal(heroRes.status, 200);
      assert.equal(heroRes.headers.get("content-type"), "image/webp");
      const heroBuf = Buffer.from(await heroRes.arrayBuffer());
      assert.equal(heroBuf.length, 330146);
      console.log(`[E2E] HTTP delivery of community-illustration-hero: 200 OK (${heroBuf.length} bytes WebP).`);

      const healthHeroRes = await fetch("http://127.0.0.1:8080/api/public/content/release-media/healthcare-hero");
      assert.equal(healthHeroRes.status, 200);
      assert.equal(healthHeroRes.headers.get("content-type"), "image/webp");
      const healthHeroBuf = Buffer.from(await healthHeroRes.arrayBuffer());
      assert.equal(healthHeroBuf.length, 9392);
      console.log(`[E2E] HTTP delivery of healthcare-hero: 200 OK (${healthHeroBuf.length} bytes WebP).`);

      const ayurvedicRes = await fetch("http://127.0.0.1:8080/api/public/content/release-media/healthcare-ayurvedic-centre");
      assert.equal(ayurvedicRes.status, 200);
      const ayurvedicBuf = Buffer.from(await ayurvedicRes.arrayBuffer());
      assert.equal(ayurvedicBuf.length, 8104);
      console.log(`[E2E] HTTP delivery of healthcare-ayurvedic-centre: 200 OK (${ayurvedicBuf.length} bytes WebP).`);

      // 7. Verify policy page returns 404 (unpublished draft)
      const policyRes = await fetch("http://127.0.0.1:8080/api/public/content/pages/privacy-policy");
      assert.equal(policyRes.status, 404, "Unpublished policy draft must not be publicly accessible");
      console.log("[E2E] Verified: /api/public/content/pages/privacy-policy returns 404 NOT_PUBLISHED.");
    } finally {
      await pool.end();
    }
  } finally {
    backend.kill();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n=== PHASE 2: Subsequent Redeployment & Restart Verification ===");
  const pool2 = new Pool({ connectionString: TEST_DB_URL, max: 2 });
  try {
    // Simulate administrator changes:
    // A. Admin updates display name
    await pool2.query("UPDATE public.account SET display_name = 'Modified Admin Organization Head'");
    // B. Admin withdraws Gallery page
    await pool2.query(`
      UPDATE public.cms_publication
      SET state = 'WITHDRAWN', revoked_at = now()
      WHERE page_id IN (SELECT id FROM public.cms_page WHERE slug = 'gallery')
    `);
    console.log("[E2E] Simulated administrator edits: changed display name and withdrew gallery.");
  } finally {
    await pool2.end();
  }

  console.log("[E2E] Starting backend second time (redeploy/restart simulation)...");
  backend = startBackend();

  try {
    await waitForBackendReady();

    const pool3 = new Pool({ connectionString: TEST_DB_URL, max: 2 });
    try {
      // 1. Verify ledger is unchanged (no re-init)
      const ledger = await pool3.query("SELECT COUNT(*) FROM public.schema_migration");
      assert.equal(Number(ledger.rows[0].count), 312, "Ledger count must remain exactly 312");

      // 2. Verify admin display name is preserved
      const rootAcc = await pool3.query("SELECT display_name FROM public.account");
      assert.equal(rootAcc.rows[0].display_name, "Modified Admin Organization Head", "Admin changes must persist across redeploy");
      console.log(`[E2E] Verified admin display name preserved: "${rootAcc.rows[0].display_name}"`);

      // 3. Verify withdrawn page is NOT resurrected
      const galleryPub = await pool3.query(
        "SELECT pub.state FROM public.cms_publication pub JOIN public.cms_page p ON p.id = pub.page_id WHERE p.slug = 'gallery'"
      );
      assert.equal(galleryPub.rows[0]?.state, "WITHDRAWN", "Withdrawn page must remain WITHDRAWN");

      const galleryHttp = await fetch("http://127.0.0.1:8080/api/public/content/pages/gallery");
      assert.equal(galleryHttp.status, 404, "Withdrawn page must not be publicly served");
      console.log("[E2E] Verified withdrawn page /gallery is not resurrected and returns 404.");

      // 4. Verify policy drafts still unpublished
      const privacyHttp = await fetch("http://127.0.0.1:8080/api/public/content/pages/privacy-policy");
      assert.equal(privacyHttp.status, 404);
      console.log("[E2E] Verified policy drafts still unpublished.");

      // 5. Total page count is still 15
      const totalPages = await pool3.query("SELECT COUNT(*) FROM public.cms_page");
      assert.equal(Number(totalPages.rows[0].count), 15, "No duplicate CMS pages created");

      console.log("\n=== ALL AUTOMATIC FIRST DEPLOYMENT AND REDEPLOYMENT GATES PASSED! ===");
    } finally {
      await pool3.end();
    }
  } finally {
    backend.kill();
  }
}

run().catch(err => {
  console.error("FATAL E2E FAILURE:", err);
  process.exit(1);
});

