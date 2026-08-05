import { logger } from "../../config/logger.js";
import type { Notifier } from "./notifier.interface.js";
import { stubNotifier } from "./stub.notifier.js";

export type { AdminNotification, Notifier } from "./notifier.interface.js";

/** Logged once per process, not once per call — a notifier fires far more often than the process restarts. */
let warnedOnce = false;

/**
 * Only one adapter exists at this milestone. Same factory shape as
 * `mailer/index.ts`: today there is exactly one branch (no provider
 * configured → stub), structured so M15 can add the real Telegram adapter
 * behind it — selected by env config — without any caller changing.
 */
export function createNotifier(): Notifier {
  if (!warnedOnce) {
    warnedOnce = true;
    logger.warn("[notifier] no provider configured — admin notifications will only be logged.");
  }
  return stubNotifier;
}
