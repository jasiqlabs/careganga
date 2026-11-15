import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || Buffer.byteLength(password, "utf8") > 1024)
    throw new Error("Password does not meet secure length requirements");
  const salt = randomBytes(24);
  const digest = await derive(password, salt, 64, COST) as Buffer;
  return ["scrypt", String(COST.N), salt.toString("hex"), digest.toString("hex")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [kind, cost, salt, expected] = encoded.split("$");
  if (kind !== "scrypt" || cost !== String(COST.N) || !/^[a-f0-9]{48}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(expected ?? "")) return false;
  if (Buffer.byteLength(password, "utf8") > 1024) return false;
  const actual = await derive(password, Buffer.from(salt, "hex"), 64, COST) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("IDENTITY_ENCRYPTION_KEY must contain 32 random bytes");
  return key;
}
export function encryptTotpSecret(raw: Buffer): { ciphertext: Buffer; nonce: Buffer; tag: Buffer } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}
export function decryptTotpSecret(ciphertext: Buffer, nonce: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function decodeBase32(value: string): Buffer {
  const clean = value.toUpperCase().replace(/\s+/g, "").replace(/=+$/, "");
  if (!/^[A-Z2-7]{32,80}$/.test(clean)) throw new Error("Invalid TOTP enrollment secret");
  let bits = 0, accumulator = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    accumulator = (accumulator << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
export function verifyTotp(secret: Buffer, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let valid = false;
  for (const skew of [-1,0,1]) {
    const counter = Math.floor(now / 30_000) + skew;
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", secret).update(b).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const n = ((digest[offset] & 0x7f) << 24 | digest[offset + 1] << 16 | digest[offset + 2] << 8 | digest[offset + 3]) % 1_000_000;
    const candidate = Buffer.from(String(n).padStart(6, "0"));
    valid = timingSafeEqual(candidate, Buffer.from(code)) || valid;
  }
  return valid;
}
