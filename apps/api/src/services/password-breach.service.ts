import { createHash } from "node:crypto";
import { logger } from "../config/logger.js";

/**
 * Checks a candidate password against the "Have I Been Pwned" breached-password
 * corpus, using the k-anonymity range API so the real password (or even its
 * full hash) never leaves the process:
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * Only the first 5 hex characters of the SHA-1 hash are sent; the API returns
 * every suffix that shares that prefix (typically several hundred), and the
 * match happens locally. Note that SHA-1 here is not a security control —
 * it's simply the hash HIBP's corpus is keyed by. Passwords are still hashed
 * with bcrypt for storage (config/auth.ts) regardless of this check's result.
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const REQUEST_TIMEOUT_MS = 3_000;

function sha1Hex(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

/**
 * `true` only when the corpus confirms a match. On any failure to reach the
 * API (timeout, DNS, HIBP outage) this **fails open** — returns `false`,
 * i.e. "not known to be breached" — rather than blocking registration or a
 * password reset because a third party is unreachable. A breached-password
 * check is a defense-in-depth improvement, not the primary control (bcrypt +
 * a minimum length already are); availability of the shop must not depend on
 * an external service's uptime.
 */
async function isBreached(password: string): Promise<boolean> {
  const hash = sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      logger.warn({ status: response.status }, "HIBP range lookup returned a non-2xx status; failing open");
      return false;
    }

    const body = await response.text();
    return body.split("\n").some((line) => line.split(":")[0]?.trim() === suffix);
  } catch (error) {
    logger.warn({ err: error }, "HIBP range lookup failed; failing open");
    return false;
  }
}

export const passwordBreachService = { isBreached };
