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
  console.log("=== EXECUTING CG-14 WALKTHROUGHS B01 - B08 ===\n");
  const evidence = {};

  // Log in actors
  console.log("Logging in actors...");
  const adminAuth = await login("9065015409", "CareGanga@123");
  const repXAuth = await login("9065015413", "CareGanga@123");
  const repYAuth = await login("9065015414", "CareGanga@123");
  const reviewerAuth = await login("9065015410", "CareGanga@123");
  console.log("Actors logged in: Super Admin, Rep X, Rep Y, Reviewer.\n");

  // --- B01: Create provider/center draft validation ---
  console.log("--- B01: Validation on provider/center draft ---");
  const badProviderRes = await fetch(`${BASE}/api/v1/health-network/providers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.sessionToken}`
    },
    body: JSON.stringify({
      requestKey: "00000000-0000-0000-0000-000000000001",
      provider: {
        providerCode: "bad code with spaces",
        legalName: "Bad Provider",
        providerType: "CLINIC",
        contactName: "Bad Contact",
        contactPhone: "123"
      },
      centers: []
    })
  });
  const badProviderJson = await badProviderRes.json();
  console.log("B01 Negative Test - HTTP status:", badProviderRes.status);
  console.log("B01 Negative Test - Code/Message:", badProviderJson.code, badProviderJson.message, "field:", badProviderJson.field);
  evidence.B01 = {
    status: badProviderRes.status === 400 ? "PASS" : "FAIL",
    httpStatus: badProviderRes.status,
    response: badProviderJson
  };

  // --- B03: Reviewer approved X; do not approve Y; search public directory ---
  console.log("\n--- B03: Public directory verification (Published X vs Unpublished Y) ---");
  const publicCentersRes = await fetch(`${BASE}/api/v1/public/health-network/centers`);
  const publicCenters = await publicCentersRes.json();
  const centerItems = publicCenters.items || [];
  console.log("B03 - Public centers count:", centerItems.length);
  console.log("B03 - Public centers list:", centerItems.map(c => ({ name: c.centerName, slug: c.slug })));
  
  const hasX = centerItems.some(c => c.slug === "careganga-health-clinic-varanasi-central");
  const hasY = centerItems.some(c => c.slug === "careganga-health-clinic-sarnath-outpost");
  console.log(`B03 Verification: Clinic X in public directory? ${hasX} (expected true). Clinic Y in public directory? ${hasY} (expected false).`);
  evidence.B03 = {
    status: (hasX && !hasY) ? "PASS" : "FAIL",
    hasX,
    hasY,
    publishedCount: centerItems.length,
    items: centerItems
  };

  // --- B05: Doctor affiliations and different fee versions ---
  console.log("\n--- B05: Doctor affiliations & fees at Clinic X vs Clinic Y ---");
  const publicDoctorsRes = await fetch(`${BASE}/api/v1/public/health-network/doctors`);
  const publicDoctors = await publicDoctorsRes.json();
  const doctorItems = publicDoctors.items || [];
  console.log("B05 - Public doctors count:", doctorItems.length);
  for (const d of doctorItems) {
    console.log(`  Doctor: ${d.doctorName} (${d.specialties?.join(", ")}) | Reg Ref: ${d.doctorRef}`);
    console.log(`    -> Center: ${d.centerName} (${d.centerSlug}) | Fee: ₹${(d.fee?.amountMinor || 0)/100} (${d.fee?.kind})`);
  }
  const drA = doctorItems.find(d => d.doctorName?.includes("Anita"));
  evidence.B05 = {
    status: (drA && drA.fee?.amountMinor === 30000) ? "PASS" : "FAIL",
    doctor: drA
  };

  // --- B06: Cross-Center Isolation (Rep X tries Clinic Y) ---
  console.log("\n--- B06: Cross-Center Isolation (Rep X tries Clinic Y) ---");
  const adminProvRes = await fetch(`${BASE}/api/v1/health-network/providers`, {
    headers: { Authorization: `Bearer ${adminAuth.sessionToken}` }
  });
  const adminProvData = await adminProvRes.json();
  const provRef = adminProvData.providers?.[0]?.providerRef;
  const provDetailRes = await fetch(`${BASE}/api/v1/health-network/providers/${provRef}`, {
    headers: { Authorization: `Bearer ${adminAuth.sessionToken}` }
  });
  const provDetail = await provDetailRes.json();
  const centerY = provDetail.centers?.find(c => c.code === "CG-HC-VNS02");
  console.log("Clinic Y centerRef:", centerY?.centerRef);

  // Rep X attempts to submit or edit Clinic Y content
  const repXTriesYRes = await fetch(`${BASE}/api/v1/health-network/my-centers/${centerY?.centerRef}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${repXAuth.sessionToken}`
    },
    body: JSON.stringify({
      requestKey: "00000000-0000-0000-0000-000000000002",
      expectedVersion: 1,
      proofFileRef: "00000000-0000-0000-0000-000000000003"
    })
  });
  console.log("B06 Rep X access to Clinic Y submit HTTP status:", repXTriesYRes.status);
  const repXTriesYJson = await repXTriesYRes.json().catch(() => ({}));
  console.log("B06 Rep X response:", repXTriesYJson);
  evidence.B06 = {
    status: (repXTriesYRes.status === 403 || repXTriesYRes.status === 404) ? "PASS" : "FAIL",
    httpStatus: repXTriesYRes.status,
    response: repXTriesYJson
  };

  // --- B07: Center Content / Details ---
  console.log("\n--- B07: Public Center detail for Clinic X ---");
  const centerDetailRes = await fetch(`${BASE}/api/v1/public/health-network/centers/careganga-health-clinic-varanasi-central`);
  console.log("Clinic X detail HTTP status:", centerDetailRes.status);
  const centerDetailJson = await centerDetailRes.json();
  console.log("Clinic X centerName:", centerDetailJson.centerName);
  console.log("Clinic X address:", centerDetailJson.address, centerDetailJson.pinCode);
  console.log("Clinic X declaredServices:", centerDetailJson.declaredServices);
  console.log("Clinic X hours:", centerDetailJson.hours?.length, "entries");
  evidence.B07 = {
    status: centerDetailRes.status === 200 ? "PASS" : "FAIL",
    detail: {
      centerName: centerDetailJson.centerName,
      declaredServices: centerDetailJson.declaredServices,
      hoursCount: centerDetailJson.hours?.length
    }
  };

  // --- B08: ERP OFF partner public offers ---
  console.log("\n--- B08: Partner public offers with ERP OFF ---");
  const offersRes = await fetch(`${BASE}/api/v1/public/health-network/partner-offers/careganga-health-clinic-varanasi-central`);
  console.log("Partner offers HTTP status:", offersRes.status);
  const offersJson = await offersRes.json().catch(() => ({}));
  console.log("Partner offers response:", offersJson);
  evidence.B08 = {
    status: offersRes.status === 200 ? "PASS" : "FAIL",
    response: offersJson
  };

  console.log("\n=======================================================");
  console.log("CG-14 WALKTHROUGHS EXECUTION SUMMARY:");
  console.log(JSON.stringify(evidence, null, 2));
  console.log("=======================================================");
}

main().catch(console.error);
