import { vi } from "vitest";
import { passwordBreachService } from "../../src/services/password-breach.service.js";

/**
 * `passwordBreachService.isBreached` is stubbed to `false` by default for
 * every test (see tests/setup.ts) — none of this suite runs against the real
 * network, and the service's own fail-open design means "unreachable" and
 * "not breached" already behave identically in production. Call this only
 * when a test specifically wants to exercise the breached-password path.
 */
export function stubPasswordBreach(breached: boolean): void {
  vi.spyOn(passwordBreachService, "isBreached").mockResolvedValue(breached);
}
