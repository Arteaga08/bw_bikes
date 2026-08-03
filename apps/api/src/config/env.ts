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
] as const;

type NodeEnv = "development" | "production" | "test";

const VALID_NODE_ENVS: readonly NodeEnv[] = ["development", "production", "test"];

const MIN_SECRET_LENGTH = 32;

function fail(message: string): never {
  console.error(`[env] Fatal: ${message}`);
  process.exit(1);
}

function assertPresent(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
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

function buildEnv() {
  assertPresent();

  const nodeEnv = parseNodeEnv(process.env["NODE_ENV"]!);
  const port = parsePort(process.env["PORT"]!);
  const jwtSecret = process.env["JWT_SECRET"]!;
  const encryptionKey = process.env["ENCRYPTION_KEY"]!;
  const clientUrl = process.env["CLIENT_URL"]!;
  const mongoUri = process.env["MONGODB_URI"]!;

  assertMinLength("JWT_SECRET", jwtSecret, MIN_SECRET_LENGTH);
  assertMinLength("ENCRYPTION_KEY", encryptionKey, MIN_SECRET_LENGTH);

  if (nodeEnv === "production") {
    if (!clientUrl.startsWith("https://")) {
      fail("CLIENT_URL must use https:// in production");
    }
  }

  return Object.freeze({
    nodeEnv,
    port,
    mongoUri,
    jwtSecret,
    encryptionKey,
    clientUrl,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
  });
}

export const env = buildEnv();
export type Env = typeof env;
