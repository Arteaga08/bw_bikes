import "dotenv/config";

/**
 * Fail-fast environment loader. Validates every variable this milestone
 * actually depends on and aborts with a clear message if one is missing or
 * malformed — never falls back to a silent default for anything security
 * sensitive. Variables needed only by later milestones (Stripe, Cloudinary,
 * Resend, Telegram...) are added here when the feature that needs them lands,
 * not before.
 */

const REQUIRED_VARS = [
  "NODE_ENV",
  "PORT",
  "MONGODB_URI",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "CLIENT_URL",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
] as const;

/**
 * Required to **boot in production**, optional in development and test.
 *
 * These belong to a third-party integration that only one feature needs (the
 * catalog gallery, M3). Making them block startup everywhere would mean the
 * whole API — auth, catalog reads, everything — is unreachable locally until a
 * Cloudinary account exists, which is a bad trade while the backend is still
 * being built out. Production still fails fast: shipping a deploy where an
 * admin discovers at upload time that media was never configured is exactly
 * what §9's fail-fast rule exists to prevent.
 *
 * Without them, the API runs and the gallery endpoints answer with an explicit
 * "not configured" error (see services/storage/storage.service.ts). They never
 * pretend to succeed — there is no stub that fakes an upload.
 */
const PRODUCTION_REQUIRED_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

type NodeEnv = "development" | "production" | "test";

const VALID_NODE_ENVS: readonly NodeEnv[] = ["development", "production", "test"];

const MIN_SECRET_LENGTH = 32;

function fail(message: string): never {
  console.error(`[env] Fatal: ${message}`);
  process.exit(1);
}

function isSet(key: string): boolean {
  const value = process.env[key];
  return Boolean(value) && value?.trim() !== "";
}

function assertPresent(): void {
  const missing = REQUIRED_VARS.filter((key) => !isSet(key));
  if (missing.length > 0) {
    fail(`missing required environment variable(s): ${missing.join(", ")}`);
  }
}

function assertMinLength(name: string, value: string, min: number): void {
  if (value.length < min) {
    fail(`${name} must be at least ${min} characters long (got ${value.length})`);
  }
}

function parseNodeEnv(raw: string): NodeEnv {
  if (!VALID_NODE_ENVS.includes(raw as NodeEnv)) {
    fail(`NODE_ENV must be one of ${VALID_NODE_ENVS.join(", ")} (got "${raw}")`);
  }
  return raw as NodeEnv;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    fail(`PORT must be a valid integer between 1 and 65535 (got "${raw}")`);
  }
  return port;
}

// Short duration format understood by jsonwebtoken's `expiresIn` (the `ms`
// package grammar): an integer followed by a single unit — seconds,
// minutes, hours, or days. Kept intentionally narrow (no "2 days" / "1y")
// so a typo fails fast at boot instead of silently minting a token with an
// unintended lifetime.
const EXPIRES_IN_PATTERN = /^\d+[smhd]$/;

function parseExpiresIn(name: string, raw: string): string {
  if (!EXPIRES_IN_PATTERN.test(raw)) {
    fail(`${name} must match <integer><s|m|h|d> (e.g. "15m", "7d") (got "${raw}")`);
  }
  return raw;
}

function buildEnv() {
  assertPresent();

  const nodeEnv = parseNodeEnv(process.env["NODE_ENV"]!);
  const port = parsePort(process.env["PORT"]!);
  const jwtSecret = process.env["JWT_SECRET"]!;
  const encryptionKey = process.env["ENCRYPTION_KEY"]!;
  const clientUrl = process.env["CLIENT_URL"]!;
  const mongoUri = process.env["MONGODB_URI"]!;
  const jwtAccessExpiresIn = parseExpiresIn("JWT_ACCESS_EXPIRES_IN", process.env["JWT_ACCESS_EXPIRES_IN"]!);
  const jwtRefreshExpiresIn = parseExpiresIn("JWT_REFRESH_EXPIRES_IN", process.env["JWT_REFRESH_EXPIRES_IN"]!);
  const cloudinaryCloudName = process.env["CLOUDINARY_CLOUD_NAME"] ?? "";
  const cloudinaryApiKey = process.env["CLOUDINARY_API_KEY"] ?? "";
  const cloudinaryApiSecret = process.env["CLOUDINARY_API_SECRET"] ?? "";
  const isCloudinaryConfigured = PRODUCTION_REQUIRED_VARS.every(isSet);

  assertMinLength("JWT_SECRET", jwtSecret, MIN_SECRET_LENGTH);
  assertMinLength("ENCRYPTION_KEY", encryptionKey, MIN_SECRET_LENGTH);

  if (nodeEnv === "production") {
    if (!clientUrl.startsWith("https://")) {
      fail("CLIENT_URL must use https:// in production");
    }

    const missingInProduction = PRODUCTION_REQUIRED_VARS.filter((key) => !isSet(key));
    if (missingInProduction.length > 0) {
      fail(`missing production-required environment variable(s): ${missingInProduction.join(", ")}`);
    }
  } else if (!isCloudinaryConfigured) {
    // Loud, but not fatal: everything except image upload works without it.
    console.warn(
      "[env] Cloudinary is not configured — gallery uploads will be rejected with a clear error. " +
        `Set ${PRODUCTION_REQUIRED_VARS.join(", ")} in .env.${nodeEnv}.local to enable them.`,
    );
  }

  return Object.freeze({
    nodeEnv,
    port,
    mongoUri,
    jwtSecret,
    encryptionKey,
    clientUrl,
    jwtAccessExpiresIn,
    jwtRefreshExpiresIn,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    isCloudinaryConfigured,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
  });
}

export const env = buildEnv();
export type Env = typeof env;
