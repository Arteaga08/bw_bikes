import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { Notifier } from "./notifier.interface.js";
import { stubNotifier } from "./stub.notifier.js";
import { telegramNotifier } from "./telegram.notifier.js";

export type { AdminNotification, Notifier } from "./notifier.interface.js";

/** Logged once per process, not once per call — a notifier fires far more often than the process restarts. */
let warnedOnce = false;

/**
 * Same factory shape as `mailer/index.ts`, selected by env config
 * (`env.isTelegramConfigured`) — no caller changes when the adapter behind
 * it does. The real Telegram adapter landed ahead of M15, at the owner's
 * request; the stub remains the fallback wherever it isn't configured
 * (local dev without a test bot, CI, `test` env).
 */
export function createNotifier(): Notifier {
  if (env.isTelegramConfigured) return telegramNotifier;

  if (!warnedOnce) {
    warnedOnce = true;
    logger.warn("[notifier] no provider configured — admin notifications will only be logged.");
  }
  return stubNotifier;
}
