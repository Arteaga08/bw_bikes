import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Fail-fast environment loader. Validates every variable this milestone
 * actually depends on and aborts with a clear message if one is missing or
 * malformed — never falls back to a silent default for anything security
 * sensitive. Variables needed only by later milestones (Resend, Telegram...)
 * are added here when the feature that needs them lands, not before.
 *
 * ## Which file is read
 *
 * `.env.<NODE_ENV>.local` first, then `.env` as a shared base. dotenv never
 * overwrites a variable that is already set, so the precedence is:
 *
 *   real process environment  >  .env.<NODE_ENV>.local  >  .env
 *
 * That ordering is what matters in production: the host's secret manager
 * (Render/Railway/Atlas) injects real variables into the process, and they
 * must win over any file that happens to be sitting in the image.
 *
 * `NODE_ENV` itself has to come from the actual environment — it selects which
 * file to read, so it can't be defined inside the file being selected. Unset
 * means development, which is the only environment where guessing is safe.
 *
 * Paths resolve from the package root rather than `process.cwd()`, so the API
 * finds its own env file no matter which directory it was launched from.
 */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvFiles(): void {
  const nodeEnv = process.env["NODE_ENV"] ?? "development";
  loadDotenv({ path: resolve(PACKAGE_ROOT, `.env.${nodeEnv}.local`) });
  loadDotenv({ path: resolve(PACKAGE_ROOT, ".env") });
}

loadEnvFiles();

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
const CLOUDINARY_REQUIRED_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

/**
 * Same policy as Cloudinary, for the same reason (M5): the whole API must not
 * be unbootable locally because a Stripe account is not wired up yet. Without
 * these, checkout and the payment webhook answer with an explicit "payments
 * are not configured" error — there is deliberately **no** stub provider that
 * fakes a successful charge. A fake payment is worse than no payment.
 *
 * Kept as its own array rather than appended to the Cloudinary one: that array
 * doubles as the source of the `isCloudinaryConfigured` flag, so merging them
 * would make "Stripe is missing" read as "images are missing".
 */
const STRIPE_REQUIRED_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

/** Every variable that must be present to boot in production. */
const PRODUCTION_REQUIRED_VARS = [...CLOUDINARY_REQUIRED_VARS, ...STRIPE_REQUIRED_VARS] as const;

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

/**
 * Operational knobs with a documented default: unset means "use the default",
 * a malformed value still fails fast. They're tuning parameters, not secrets —
 * a silent fallback here can't weaken anything, unlike a missing JWT secret.
 *
 * These move to the `Settings` singleton in M7, which is where
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md wants business thresholds so the owner
 * can change them without a redeploy. Until that collection exists, env is the
 * honest place for them.
 */
function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer (got "${raw}")`);
  }
  return parsed;
}

/** How long a checkout may hold stock before the expiry job takes it back. */
const DEFAULT_RESERVATION_TTL_MINUTES = 30;

/** How often that job sweeps. Well under the TTL, so an expiry is acted on promptly. */
const DEFAULT_REAPER_INTERVAL_MS = 60_000;

/** How long a finished reservation is kept for forensics before Mongo's TTL drops it. */
const DEFAULT_RESERVATION_RETENTION_DAYS = 30;

/**
 * How long an order may sit in `pending_payment` holding stock while the
 * customer completes the payment form. Shorter than the generic reservation
 * TTL on purpose: a checkout in progress is a live user, not an abandoned
 * cart, and holding a bike for half an hour per attempt is how a catalog looks
 * sold out without a single sale.
 *
 * This is only the *payment* window. Once a manual-capture order is
 * authorized, its holds are extended to cover the supplier-confirmation window
 * (see `extendHold` in inventory.service.ts) — otherwise the in-stock helmet
 * of a mixed cart would be released while the admin is still confirming the
 * made-to-order bike.
 */
const DEFAULT_ORDER_PAYMENT_TTL_MINUTES = 15;

/**
 * Stripe drops an uncaptured authorization after about 7 days. These two
 * thresholds keep the shop ahead of that deadline: warn the admin on day 5,
 * and on day 6.5 cancel the authorization ourselves.
 *
 * Cancelling deliberately rather than letting it lapse is what makes the
 * outcome deterministic — we release the stock and notify the customer at a
 * moment we chose, instead of discovering after the fact that a hold silently
 * evaporated.
 */
const DEFAULT_ORDER_AUTH_ALERT_HOURS = 120;
const DEFAULT_ORDER_AUTH_CANCEL_HOURS = 156;

/** How often the authorization sweep runs. Minutes-level is plenty for a day-scale deadline. */
const DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS = 300_000;

/**
 * Backstop for payments whose webhook never arrived (provider outage, our own
 * downtime, a dropped delivery). The job asks the provider what really
 * happened instead of leaving the order orphaned.
 */
const DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS = 600_000;

/** Grace period before an unresolved `pending_payment` order is worth reconciling. */
const DEFAULT_PAYMENT_RECONCILIATION_AFTER_MINUTES = 20;

/**
 * Webhook signature timestamp tolerance, in seconds. Short window so a
 * captured event cannot be replayed at leisure; 5 minutes is Stripe's own
 * default and absorbs ordinary clock skew.
 */
const DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * IVA in basis points, used **only** to break the tax out of a total that
 * already contains it (Mexican B2C prices are quoted IVA-included). It never
 * adds to what is charged: `tax = round(total × bps / (10000 + bps))`.
 */
const DEFAULT_TAX_RATE_BPS = 1600;

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
  const isCloudinaryConfigured = CLOUDINARY_REQUIRED_VARS.every(isSet);
  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const stripeWebhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
  const isStripeConfigured = STRIPE_REQUIRED_VARS.every(isSet);
  const stockReservationTtlMinutes = parsePositiveInt(
    "STOCK_RESERVATION_TTL_MINUTES",
    DEFAULT_RESERVATION_TTL_MINUTES,
  );
  const reservationReaperIntervalMs = parsePositiveInt(
    "RESERVATION_REAPER_INTERVAL_MS",
    DEFAULT_REAPER_INTERVAL_MS,
  );
  const reservationRetentionDays = parsePositiveInt(
    "RESERVATION_RETENTION_DAYS",
    DEFAULT_RESERVATION_RETENTION_DAYS,
  );
  const orderPaymentTtlMinutes = parsePositiveInt(
    "ORDER_PAYMENT_TTL_MINUTES",
    DEFAULT_ORDER_PAYMENT_TTL_MINUTES,
  );
  const orderAuthAlertHours = parsePositiveInt("ORDER_AUTH_ALERT_HOURS", DEFAULT_ORDER_AUTH_ALERT_HOURS);
  const orderAuthCancelHours = parsePositiveInt("ORDER_AUTH_CANCEL_HOURS", DEFAULT_ORDER_AUTH_CANCEL_HOURS);
  const orderAuthSweepIntervalMs = parsePositiveInt(
    "ORDER_AUTH_SWEEP_INTERVAL_MS",
    DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS,
  );
  const paymentReconciliationIntervalMs = parsePositiveInt(
    "PAYMENT_RECONCILIATION_INTERVAL_MS",
    DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS,
  );
  const paymentReconciliationAfterMinutes = parsePositiveInt(
    "PAYMENT_RECONCILIATION_AFTER_MINUTES",
    DEFAULT_PAYMENT_RECONCILIATION_AFTER_MINUTES,
  );
  const stripeWebhookToleranceSeconds = parsePositiveInt(
    "STRIPE_WEBHOOK_TOLERANCE_SECONDS",
    DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  );
  const taxRateBps = parsePositiveInt("TAX_RATE_BPS", DEFAULT_TAX_RATE_BPS);

  // Warning the admin *after* the authorization was already cancelled would
  // make the alert useless, so the ordering is enforced rather than assumed.
  if (orderAuthAlertHours >= orderAuthCancelHours) {
    fail(
      `ORDER_AUTH_ALERT_HOURS (${orderAuthAlertHours}) must be lower than ORDER_AUTH_CANCEL_HOURS (${orderAuthCancelHours})`,
    );
  }

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
  } else {
    // Loud, but not fatal: everything except the feature behind each
    // integration works without it.
    if (!isCloudinaryConfigured) {
      console.warn(
        "[env] Cloudinary is not configured — gallery uploads will be rejected with a clear error. " +
          `Set ${CLOUDINARY_REQUIRED_VARS.join(", ")} in .env.${nodeEnv}.local to enable them.`,
      );
    }

    if (!isStripeConfigured) {
      console.warn(
        "[env] Stripe is not configured — checkout and the payment webhook will be rejected with a clear error. " +
          `Set ${STRIPE_REQUIRED_VARS.join(", ")} in .env.${nodeEnv}.local to enable them.`,
      );
    }
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
    stripeSecretKey,
    stripeWebhookSecret,
    isStripeConfigured,
    stripeWebhookToleranceSeconds,
    orderPaymentTtlMinutes,
    orderAuthAlertHours,
    orderAuthCancelHours,
    orderAuthSweepIntervalMs,
    paymentReconciliationIntervalMs,
    paymentReconciliationAfterMinutes,
    taxRateBps,
    stockReservationTtlMinutes,
    reservationReaperIntervalMs,
    reservationRetentionDays,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
  });
}

export const env = buildEnv();
export type Env = typeof env;
