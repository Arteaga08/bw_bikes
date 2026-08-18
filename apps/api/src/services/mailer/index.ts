import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { Mailer } from "./mailer.interface.js";
import { resendMailer } from "./resend.mailer.js";
import { stubMailer } from "./stub.mailer.js";

export type { Mailer };

/** Logged once per process, not once per call — registration/reset happen far more often than a restart. */
let warnedOnce = false;

/**
 * Factory (M7), same shape as `services/notifier/index.ts`: selected by env
 * config (`env.isResendConfigured`) — callers only ever depend on `Mailer`,
 * so registering the real Resend adapter (landed ahead of M15, at the
 * owner's request) touched nothing in `auth.service.ts`. The stub remains
 * the fallback wherever it isn't configured (local dev without a Resend key,
 * CI, `test` env), and the one-time warning makes that state visible in the
 * log stream instead of only inferable from the stub's per-email debug lines.
 */
export function createMailer(): Mailer {
  if (env.isResendConfigured) return resendMailer;

  if (!warnedOnce) {
    warnedOnce = true;
    logger.warn("[mailer] no provider configured — transactional email will only be logged.");
  }
  return stubMailer;
}
