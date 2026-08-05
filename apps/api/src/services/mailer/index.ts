import { logger } from "../../config/logger.js";
import type { Mailer } from "./mailer.interface.js";
import { stubMailer } from "./stub.mailer.js";

export type { Mailer };

/** Logged once per process, not once per call — registration/reset happen far more often than a restart. */
let warnedOnce = false;

/**
 * Only one adapter exists at this milestone. Structured as a factory (M7),
 * same shape as `services/notifier/index.ts`: today there is exactly one
 * branch (no provider configured → stub), and the one-time warning makes
 * that state visible in the log stream instead of only inferable from the
 * stub's per-email debug lines. M15 registers Resend, selected by env
 * config, behind this same factory — callers only ever depend on `Mailer`,
 * so neither change touches `auth.service.ts`.
 */
export function createMailer(): Mailer {
  if (!warnedOnce) {
    warnedOnce = true;
    logger.warn("[mailer] no provider configured — transactional email will only be logged.");
  }
  return stubMailer;
}
