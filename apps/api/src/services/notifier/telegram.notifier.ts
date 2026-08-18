import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { AdminNotification, Notifier } from "./notifier.interface.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Real Telegram Bot API adapter (landed ahead of M15, at the owner's
 * request) — `sendMessage` only, plain text, no `parse_mode`: `title`/`body`
 * are written by this codebase, not by a customer, but Telegram's Markdown
 * parser rejects unescaped `_`/`*`/`[` and a rejected send is worse than a
 * plain one.
 *
 * Only reachable through `createNotifier()` (`index.ts`), which already
 * gates on `env.isTelegramConfigured` — this adapter never checks it itself.
 *
 * Same fail-soft contract as `password-breach.service.ts`'s HIBP lookup:
 * timeout via `AbortController`, and any failure (timeout, non-2xx, network
 * error) is logged, never thrown. `order-maintenance.service.ts`'s sweep is
 * the one caller, and a flaky Telegram delivery must not stop it from
 * sealing `adminAlertedAt`.
 */
export const telegramNotifier: Notifier = {
  async notifyAdmin({ kind, title, body, meta }: AdminNotification) {
    const text = `${title}\n\n${body}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${TELEGRAM_API_BASE}/bot${env.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.telegramChatId, text }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const responseBody = await response.text();
        logger.error(
          { kind, meta, status: response.status, responseBody },
          "[telegram-notifier] Telegram API rejected the admin notification",
        );
      }
    } catch (error) {
      logger.error({ kind, meta, err: error }, "[telegram-notifier] failed to reach the Telegram API");
    }
  },
};
