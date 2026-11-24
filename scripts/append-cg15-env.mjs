import { randomBytes } from "node:crypto";
import fs from "node:fs";

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");
const k3 = randomBytes(32).toString("base64");

const lines = [
  "\n# CG-15 & CG-19 Configuration for Healthcare Booking & Patient Care",
  "CG15_HOLD_MINUTES=10",
  `CG19_APPOINTMENT_QR_KEY=${k1}`,
  `CG15_BOOKING_REASON_KEY_BASE64=${k2}`,
  `CG15_PATIENT_DETAILS_KEY_BASE64=${k3}`,
  "CG15_PATIENT_CONSENT_VERSION=1",
  "CG15_PATIENT_CONSENT_TEXT=I consent to the processing of my medical and personal data for healthcare services by CareGanga Foundation and its affiliated healthcare providers.\n"
].join("\n");

fs.appendFileSync(".env", lines);
console.log("Appended CG-15 env keys successfully.");
