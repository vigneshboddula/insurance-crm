import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

// AES-256-GCM encryption for sensitive data (Aadhaar, PAN) and document bytes.
// Format of an encrypted string: base64(iv).base64(authTag).base64(ciphertext)
//
// KEY LOCATION: the key lives in DATA_DIR/encryption.key — OUTSIDE the
// (OneDrive-synced) project folder, next to the data it protects. The
// ENCRYPTION_KEY env var still works as a fallback for old setups.

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce size

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const dataDir = process.env.CRM_DATA_DIR?.trim() || path.join(os.homedir(), "insurance-crm-data");
  const keyFile = path.join(dataDir, "encryption.key");
  let hex: string | undefined;
  try {
    hex = fs.readFileSync(keyFile, "utf8").trim();
  } catch {
    hex = process.env.ENCRYPTION_KEY; // legacy fallback
  }
  if (!hex || hex.length !== 64) {
    throw new Error(`Encryption key missing or invalid. Expected 64 hex chars in ${keyFile} (or ENCRYPTION_KEY in .env).`);
  }
  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

/** Encrypt a UTF-8 string. Returns a self-describing token, or null for empty input. */
export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/** Decrypt a token produced by encrypt(). Returns null for null input. */
export function decrypt(token: string | null | undefined): string | null {
  if (!token) return null;
  const [ivB64, tagB64, dataB64] = token.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted token");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Encrypt raw bytes (for uploaded documents). Returns a Buffer: [12B iv][16B tag][ciphertext]. */
export function encryptBuffer(data: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

/** Decrypt a Buffer produced by encryptBuffer(). */
export function decryptBuffer(blob: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = blob.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** HMAC-SHA256 with the app key — for signing short tokens (e.g. the unlock cookie). */
export function hmacSign(data: string): string {
  return crypto.createHmac("sha256", getKey()).update(data).digest("hex");
}

/** Mask an ID for display: keep last 4 chars, mask the rest. e.g. "XXXX XXXX 1234". */
export function maskId(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= visible) return clean;
  const last = clean.slice(-visible);
  const masked = "•".repeat(Math.max(0, clean.length - visible));
  return `${masked}${last}`;
}
