import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-level test for `telegramNotifier.notifyAdmin` itself — the only other
 * place this adapter is reachable is through `createNotifier()`'s factory,
 * which every other suite never exercises (Telegram isn't configured in the
 * shared vitest env fixtures, so those tests keep getting `stubNotifier`,
 * same as before this adapter existed). This file mocks `config/env.js`
 * directly to supply its own token/chat id, so the request this adapter
 * actually sends to the Telegram Bot API is what gets asserted, independent
 * of whatever the rest of the suite's environment looks like.
 */

vi.mock("../src/config/env.js", () => ({
  env: {
    isProduction: false,
    telegramBotToken: "test-bot-token",
    telegramChatId: "-1000000000",
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("telegramNotifier.notifyAdmin", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the configured bot/chat with the notification's title and body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: {} }));
    vi.stubGlobal("fetch", fetchSpy);

    const { telegramNotifier } = await import("../src/services/notifier/telegram.notifier.js");
    await telegramNotifier.notifyAdmin({
      kind: "order.authorization_expiring",
      title: "Autorización por vencer — orden BW-2026-TEST01",
      body: "Confírmala o recházala antes de que la autorización venza.",
      meta: { orderId: "order-1" },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(init.body as string);
    expect(payload).toEqual({
      chat_id: "-1000000000",
      text: "Autorización por vencer — orden BW-2026-TEST01\n\nConfírmala o recházala antes de que la autorización venza.",
    });
  });

  it("logs instead of throwing when Telegram answers with a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })));

    const { telegramNotifier } = await import("../src/services/notifier/telegram.notifier.js");
    await expect(
      telegramNotifier.notifyAdmin({ kind: "order.authorization_expiring", title: "t", body: "b" }),
    ).resolves.toBeUndefined();
  });

  it("logs instead of throwing when the request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network unreachable")),
    );

    const { telegramNotifier } = await import("../src/services/notifier/telegram.notifier.js");
    await expect(
      telegramNotifier.notifyAdmin({ kind: "order.authorization_expiring", title: "t", body: "b" }),
    ).resolves.toBeUndefined();
  });
});
