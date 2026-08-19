import { vi } from "vitest";
import type { AdminNotification } from "../../src/services/notifier/notifier.interface.js";
import { stubNotifier } from "../../src/services/notifier/stub.notifier.js";

/**
 * `stubNotifier` is a module-level singleton — `createNotifier()` always
 * returns this exact object in tests (`env.isTelegramConfigured` is false),
 * so spying on it here intercepts whatever the service under test "notifies"
 * without touching any production code. Restored globally in
 * `tests/setup.ts`'s `afterEach` via `vi.restoreAllMocks()`. Same pattern as
 * `helpers/mailer.ts`'s `captureNext*` helpers.
 */
export function captureNextAdminNotification(): { getNotification: () => AdminNotification | undefined } {
  let notification: AdminNotification | undefined;
  vi.spyOn(stubNotifier, "notifyAdmin").mockImplementationOnce(async (input) => {
    notification = input;
  });
  return { getNotification: () => notification };
}
