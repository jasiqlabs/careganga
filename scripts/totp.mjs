import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";

try {
  if (existsSync(".env")) process.loadEnvFile(".env");
  else if (existsSync("../.env")) process.loadEnvFile("../.env");
} catch {}

const base32 = process.env.CAREGANGA_ROOT_TOTP_BASE32 || "DP57LL2GX5ZS6QNNTIJJD4EHTIPF5DF4";

function decodeBase32(value) {
  const clean = value.toUpperCase().replace(/\s+/g, "").replace(/=+$/, "");
  let bits = 0, accumulator = 0;
  const bytes = [];
  for (const char of clean) {
    accumulator = (accumulator << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((accumulator >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}

const secret = decodeBase32(base32);
const now = Date.now();
const counter = Math.floor(now / 30_000);
const remainingSeconds = 30 - Math.floor((now % 30_000) / 1000);

const b = Buffer.alloc(8);
b.writeBigUInt64BE(BigInt(counter));
const digest = createHmac("sha1", secret).update(b).digest();
const offset = digest[digest.length - 1] & 0xf;
const n = ((digest[offset] & 0x7f) << 24 | digest[offset + 1] << 16 |
  digest[offset + 2] << 8 | digest[offset + 3]) % 1_000_000;
const code = String(n).padStart(6, "0");

console.log(`\n========================================`);
console.log(`CareGanga Root Authenticator (MFA)`);
console.log(`========================================`);
console.log(`Email:      ${process.env.CAREGANGA_ROOT_EMAIL || "superadmin@careganga.org"}`);
console.log(`TOTP Code:  \x1b[32m\x1b[1m${code}\x1b[0m  (valid for ${remainingSeconds}s)`);
console.log(`========================================\n`);

