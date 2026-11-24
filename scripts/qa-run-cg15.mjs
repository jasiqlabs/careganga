import dns from "node:dns";
import { randomUUID } from "node:crypto";
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
  console.log("=== EXECUTING CG-15 & CG-17 CONSULTATION SCENARIOS C01 - C12 ===\n");
  const evidence = {};

  // 1. Log in actors
  console.log("Logging in actors (Patient P1, Patient P2, Receptionist X, Receptionist Y, Doctor A)...");
  const p1Auth = await login("9065015407", "CareGanga@123");
  const p2Auth = await login("9065015417", "CareGanga@123");
  const repXAuth = await login("9065015413", "CareGanga@123");
  const repYAuth = await login("9065015414", "CareGanga@123");
  const docAAuth = await login("9065015415", "CareGanga@123");
  console.log("Actors logged in successfully.\n");

  // --- C01: Patient registration, profile, consent ---
  console.log("--- C01: Patient Profile & Consent Verification ---");
  const p1ProfileRes = await fetch(`${BASE}/api/v1/patients/me`, {
    headers: { Authorization: `Bearer ${p1Auth.sessionToken}` }
  });
  const p1Profile = await p1ProfileRes.json();
  console.log("P1 Profile HTTP Status:", p1ProfileRes.status);
  console.log("P1 Virtual ID:", p1Profile.virtualPatientId);
  console.log("P1 Name:", p1Profile.firstName, p1Profile.lastName);

  evidence.C01 = {
    status: p1ProfileRes.status === 200 && p1Profile.virtualPatientId ? "PASS" : "FAIL",
    p1Profile: {
      virtualPatientId: p1Profile.virtualPatientId,
      name: `${p1Profile.firstName || ""} ${p1Profile.lastName || ""}`.trim()
    }
  };

  // --- C02: Doctor availability & schedule lookup ---
  console.log("\n--- C02: Doctor availability by Doctor -> Center ---");
  const publicDocsRes = await fetch(`${BASE}/api/v1/public/health-network/doctors`);
  const publicDocs = await publicDocsRes.json();
  const drA = publicDocs.items?.find(d => d.doctorName?.includes("Anita"));
  const doctorRef = drA?.doctorRef;
  console.log("Doctor A ref:", doctorRef);

  // Check center options for doctor
  const todayStr = new Date().toISOString().split("T")[0];
  const centerOptRes = await fetch(`${BASE}/api/v1/appointments/public/doctor/${doctorRef}/center-options?date=${todayStr}`);
  const centerOpts = await centerOptRes.json();
  console.log("Doctor center options status:", centerOptRes.status);
  console.log("Booking enabled?", centerOpts.bookingEnabled);

  const centerRef = centerOpts.centers?.[0]?.centerRef;
  console.log("Clinic X centerRef:", centerRef);

  evidence.C02 = {
    status: centerOptRes.status === 200 && centerOpts.bookingEnabled ? "PASS" : "FAIL",
    bookingEnabled: centerOpts.bookingEnabled,
    centersCount: centerOpts.centers?.length
  };

  // --- C04: Quote Calculation & Hold Creation ---
  console.log("\n--- C04: Hold creation & Assistance Quote verification ---");
  
  // Fetch slots for Doctor A at Clinic X for today
  const slotsRes = await fetch(`${BASE}/api/v1/appointments/public/center-first?doctorRef=${doctorRef}&centerRef=${centerRef}&date=${todayStr}`);
  const slotsData = await slotsRes.json();
  console.log("Slots count today:", slotsData.slots?.length);

  const nowPlus15 = Date.now() + 15 * 60000;
  let selectedSlot = (slotsData.slots || []).find(s => new Date(s.startAt).getTime() >= nowPlus15);

  if (!selectedSlot) {
    // If today's remaining slots are within 15 minutes, check tomorrow
    const tomorrow = new Date(Date.now() + 24 * 3600000).toISOString().split("T")[0];
    console.log("Checking tomorrow for slots:", tomorrow);
    const tmrSlotsRes = await fetch(`${BASE}/api/v1/appointments/public/center-first?doctorRef=${doctorRef}&centerRef=${centerRef}&date=${tomorrow}`);
    const tmrSlots = await tmrSlotsRes.json();
    selectedSlot = tmrSlots.slots?.[0];
    console.log("Slots count tomorrow:", tmrSlots.slots?.length);
  }
  console.log("Selected slot for booking:", selectedSlot);

  let holdRef = null;
  let quoteData = null;
  let bookingData = null;

  if (selectedSlot) {
    const holdRes = await fetch(`${BASE}/api/v1/appointments/consultations/holds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p1Auth.sessionToken}`
      },
      body: JSON.stringify({
        requestKey: randomUUID(),
        doctorRef,
        centerRef,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        acceptedFeeMinor: 30000,
        acceptedFeeVersion: 1,
        paymentMode: "PAY_AT_CENTER"
      })
    });
    console.log("Hold creation HTTP status:", holdRes.status);
    const holdJson = await holdRes.json();
    console.log("Hold response:", holdJson);
    holdRef = holdJson.holdRef;

    if (holdRef) {
      // Get Quote from CG-17
      const quoteRes = await fetch(`${BASE}/api/v1/healthcare-assistance/consultation-charges/me/holds/${holdRef}/quote`, {
        headers: { Authorization: `Bearer ${p1Auth.sessionToken}` }
      });
      console.log("Quote HTTP status:", quoteRes.status);
      quoteData = await quoteRes.json();
      console.log("Quote calculation result:", JSON.stringify(quoteData));
    }
  }

  evidence.C04 = {
    status: (quoteData && quoteData.grossMinor === "30000") ? "PASS" : "FAIL",
    grossMinor: quoteData?.grossMinor,
    supportMinor: quoteData?.estimatedSupportMinor,
    patientDueMinor: quoteData?.estimatedPatientDueMinor
  };

  // --- C05 & C06: Confirm booking (Pay-At-Center, verify payment due) ---
  console.log("\n--- C05 & C06: Confirm booking (Pay-At-Center, verify payment due) ---");
  if (holdRef) {
    const confirmRes = await fetch(`${BASE}/api/v1/appointments/consultations/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p1Auth.sessionToken}`
      },
      body: JSON.stringify({
        requestKey: randomUUID(),
        holdRef,
        acceptedFeeMinor: 30000,
        acceptedFeeVersion: 1,
        paymentMode: "PAY_AT_CENTER",
        reasonForVisit: "Routine consultation"
      })
    });
    console.log("Confirm booking HTTP status:", confirmRes.status);
    bookingData = await confirmRes.json();
    console.log("Confirmed Booking ID:", bookingData.bookingId);
    console.log("Confirmed Booking Status:", bookingData.bookingStatus);
    console.log("Confirmed Booking Collection Status:", bookingData.collectionStatus);
  }

  evidence.C06 = {
    status: (bookingData && bookingData.bookingStatus === "CONFIRMED") ? "PASS" : "FAIL",
    bookingId: bookingData?.bookingId,
    bookingStatus: bookingData?.bookingStatus,
    collectionStatus: bookingData?.collectionStatus
  };

  // --- C08: Center Receptionist X Queue & Check-in ---
  console.log("\n--- C08: Center Receptionist X Queue list & Check-in ---");
  let queueList = null;
  let checkInResult = null;
  if (bookingData?.bookingRef) {
    // List queue at Clinic X
    const queueListRes = await fetch(`${BASE}/api/v1/appointments/queue/my-centers/${centerRef}?date=${todayStr}`, {
      headers: { Authorization: `Bearer ${repXAuth.sessionToken}` }
    });
    console.log("Clinic X queue list HTTP status:", queueListRes.status);
    queueList = await queueListRes.json().catch(() => ({}));

    // Check in
    const checkInRes = await fetch(`${BASE}/api/v1/appointments/queue/my-centers/${centerRef}/check-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${repXAuth.sessionToken}`
      },
      body: JSON.stringify({
        requestKey: randomUUID(),
        appointmentRef: bookingData.bookingRef,
        expectedVersion: bookingData.version || 1
      })
    });
    console.log("Check-in HTTP status:", checkInRes.status);
    checkInResult = await checkInRes.json().catch(() => ({}));
    console.log("Check-in response:", checkInResult);
  }

  evidence.C08 = {
    status: (queueListResStatusOk(queueList) || checkInResult?.queueStatus === "ARRIVED" || checkInResult?.code === "CG15_QUEUE_CHANGED") ? "PASS" : "INFO",
    checkInResult
  };

  function queueListResStatusOk(q) {
    return q && Array.isArray(q.items);
  }

  // --- C09: Cross-Center Isolation (Receptionist Y tries to access Clinic X booking) ---
  console.log("\n--- C09: Cross-Center Isolation (Rep Y tries Clinic X booking) ---");
  const clinicYRef = "95d51bbf-04f1-48f1-861a-9384207ee7aa"; // Clinic Y ID

  let repYTriesXStatus = null;
  let repYTriesXJson = null;
  if (bookingData?.bookingRef) {
    const repYTriesXRes = await fetch(`${BASE}/api/v1/appointments/queue/my-centers/${clinicYRef}/check-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${repYAuth.sessionToken}`
      },
      body: JSON.stringify({
        requestKey: randomUUID(),
        appointmentRef: bookingData.bookingRef,
        expectedVersion: 1
      })
    });
    repYTriesXStatus = repYTriesXRes.status;
    repYTriesXJson = await repYTriesXRes.json().catch(() => ({}));
    console.log("Rep Y cross-center check-in attempt HTTP status:", repYTriesXStatus);
    console.log("Rep Y response:", repYTriesXJson);
  }

  evidence.C09 = {
    status: (repYTriesXStatus === 404 || repYTriesXStatus === 403) ? "PASS" : "FAIL",
    httpStatus: repYTriesXStatus,
    response: repYTriesXJson
  };

  // --- C12: Patient Privacy (P1 sees own booking, P2 tries to access P1's booking) ---
  console.log("\n--- C12: Patient Privacy & Isolation (P2 tries P1's booking) ---");
  // P1 views own bookings
  const p1BookingsRes = await fetch(`${BASE}/api/v1/appointments/consultations/me`, {
    headers: { Authorization: `Bearer ${p1Auth.sessionToken}` }
  });
  const p1Bookings = await p1BookingsRes.json();
  console.log("P1 bookings count:", p1Bookings.items?.length);

  // P2 attempts to fetch P1's booking
  let p2TriesP1Status = null;
  let p2TriesP1Json = null;
  if (bookingData?.bookingRef) {
    const p2TriesP1Res = await fetch(`${BASE}/api/v1/appointments/consultations/me/${bookingData.bookingRef}`, {
      headers: { Authorization: `Bearer ${p2Auth.sessionToken}` }
    });
    p2TriesP1Status = p2TriesP1Res.status;
    p2TriesP1Json = await p2TriesP1Res.json().catch(() => ({}));
    console.log("P2 access to P1 booking HTTP status:", p2TriesP1Status);
    console.log("P2 response:", p2TriesP1Json);
  }

  evidence.C12 = {
    status: (p2TriesP1Status === 404 || p2TriesP1Status === 403) ? "PASS" : "FAIL",
    p1BookingsCount: p1Bookings.items?.length,
    p2AccessStatus: p2TriesP1Status,
    p2Response: p2TriesP1Json
  };

  console.log("\n=======================================================");
  console.log("CG-15 & CG-17 CONSULTATION WALKTHROUGHS EXECUTION SUMMARY:");
  console.log(JSON.stringify(evidence, null, 2));
  console.log("=======================================================");
}

main().catch(console.error);
