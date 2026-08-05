import { logger } from "../../config/logger.js";
import type { Notifier } from "./notifier.interface.js";

/**
 * No real provider (Telegram) is configured until M15. This adapter never
 * sends anything — it logs at `warn`, so the alert is still visible in the
 * hosting provider's log stream even without a chat to post it to. Never a
 * stub that pretends the notification went out: the whole point of an
 * operational alert is that someone sees it, and a false "sent" here would
 * be worse than an honest "logged only".
 */
export const stubNotifier: Notifier = {
  async notifyAdmin({ kind, title, body, meta }) {
    logger.warn({ kind, title, body, meta }, "[stub-notifier] admin notification not sent — no provider configured");
  },
};
