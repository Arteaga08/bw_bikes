import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const AES_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * `env.encryptionKey` is a validated string (≥32 chars), not a 32-byte AES
 * key — derive one deterministically via sha256 rather than truncating it.
 */
function deriveKey(): Buffer {
  return createHash("sha256").update(env.encryptionKey).digest();
}

/**
 * Encrypts a secret (e.g. a TOTP secret) for at-rest storage with
 * AES-256-GCM, per BACKEND_SECURITY_GUIDELINES.md §2. Output format is
 * `ivHex:authTagHex:cipherHex`; a fresh random IV is generated every call —
 * reusing an IV with GCM breaks its confidentiality guarantees.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Reverses `encryptSecret`. Throws if the payload is malformed or the auth
 * tag doesn't verify (tampered ciphertext or wrong key) — GCM authenticates
 * on decrypt, so a mismatch surfaces here rather than silently returning
 * garbage plaintext.
 */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted payload: expected ivHex:authTagHex:cipherHex");
  }
  const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];

  const decipher = createDecipheriv(AES_ALGORITHM, deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * CSPRNG token for anything handed to the client that must later be
 * exchanged back (email verification, password reset, refresh token). The
 * raw value is what's emailed/cookied; only its hash (see `hashToken`) is
 * ever persisted, so a DB leak doesn't hand out valid tokens.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** One-way hash of a raw token, for storage/lookup — never the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
