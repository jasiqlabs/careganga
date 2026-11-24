import dns from "node:dns";
dns.setDefaultResultOrder?.("ipv4first");

const BASE = "http://localhost:4000";

async function login(mobile, password) {
  const res = await fetch(`${BASE}/api/identity/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: mobile, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${mobile}: ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function main() {
  console.log("=== EXECUTING CG-16 DIAGNOSTICS WALKTHROUGHS E01 - E03 ===\n");
  const evidence = {};

  // Log in actors
  console.log("Logging in actors (Super Admin, Receptionist X, Patient P1)...");
  const adminAuth = await login("9065015409", "CareGanga@123");
  const repXAuth = await login("9065015413", "CareGanga@123");
  const p1Auth = await login("9065015407", "CareGanga@123");
  console.log("Actors logged in successfully.\n");

  // --- E01: Diagnostics Catalog & Pricing Lookup ---
  console.log("--- E01: Diagnostics Catalog Categories & Tests ---");
  const catRes = await fetch(`${BASE}/api/v1/diagnostics/categories`, {
    headers: { Authorization: `Bearer ${adminAuth.sessionToken}` }
  });
  console.log("Categories HTTP status:", catRes.status);
  const categories = await catRes.json().catch(() => ({}));
  console.log("Categories count:", categories.items?.length || (Array.isArray(categories) ? categories.length : 0));

  const testsRes = await fetch(`${BASE}/api/v1/diagnostics/tests`, {
    headers: { Authorization: `Bearer ${adminAuth.sessionToken}` }
  });
  console.log("Tests HTTP status:", testsRes.status);
  const tests = await testsRes.json().catch(() => ({}));
  console.log("Tests count:", tests.items?.length || (Array.isArray(tests) ? tests.length : 0));

  const packagesRes = await fetch(`${BASE}/api/v1/diagnostics/packages`, {
    headers: { Authorization: `Bearer ${adminAuth.sessionToken}` }
  });
  console.log("Packages HTTP status:", packagesRes.status);
  const packages = await packagesRes.json().catch(() => ({}));
  console.log("Packages count:", packages.items?.length || (Array.isArray(packages) ? packages.length : 0));

  evidence.E01 = {
    status: (catRes.status === 200 && testsRes.status === 200 && packagesRes.status === 200) ? "PASS" : "FAIL",
    categoriesStatus: catRes.status,
    testsStatus: testsRes.status,
    packagesStatus: packagesRes.status
  };

  // --- E02: Public Diagnostics Offers with LAB ERP OFF ---
  console.log("\n--- E02: Public Diagnostics Offers & Facets ---");
  const facetsRes = await fetch(`${BASE}/api/v1/public/diagnostics/facets`);
  console.log("Public facets HTTP status:", facetsRes.status);
  const facets = await facetsRes.json().catch(() => ({}));

  const offersRes = await fetch(`${BASE}/api/v1/public/diagnostics/offers`);
  console.log("Public offers HTTP status:", offersRes.status);
  const offers = await offersRes.json().catch(() => ({}));
  console.log("Public offers count:", offers.items?.length || 0);

  evidence.E02 = {
    status: (facetsRes.status === 200 && offersRes.status === 200) ? "PASS" : "FAIL",
    facetsStatus: facetsRes.status,
    offersStatus: offersRes.status,
    offersCount: offers.items?.length || 0
  };

  // --- E03: ERP OFF Safety Guard (Direct private lab order denied without ERP) ---
  console.log("\n--- E03: Lab Operational Guard with LAB ERP OFF ---");
  const orderRes = await fetch(`${BASE}/api/v1/diagnostics/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${repXAuth.sessionToken}`
    },
    body: JSON.stringify({
      centerRef: "3838d597-8317-4b46-92a9-08be9f54a095",
      patientRef: "9b59460a-2711-47b6-872c-f56757e3dc7a"
    })
  });
  console.log("Private lab order attempt HTTP status:", orderRes.status);
  const orderJson = await orderRes.json().catch(() => ({}));
  console.log("Private lab order response:", orderJson);

  evidence.E03 = {
    status: (orderRes.status === 403 || orderRes.status === 404 || orderRes.status === 400) ? "PASS" : "FAIL",
    httpStatus: orderRes.status,
    response: orderJson
  };

  console.log("\n=======================================================");
  console.log("CG-16 DIAGNOSTICS WALKTHROUGH SUMMARY:");
  console.log(JSON.stringify(evidence, null, 2));
  console.log("=======================================================");
}

main().catch(console.error);
