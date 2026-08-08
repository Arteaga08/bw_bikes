import { describe, expect, it } from "vitest";
import { authorizationDeadline } from "./authorization-deadline";

// Real Settings.orders defaults (M7): orderAuthAlertHours=120 (5d), orderAuthCancelHours=156 (6.5d).
const ALERT_HOURS = 120;
const CANCEL_HOURS = 156;

describe("authorizationDeadline", () => {
  it("returns null when the order was never authorized", () => {
    expect(
      authorizationDeadline({ authorizedAt: undefined, alertHours: ALERT_HOURS, cancelHours: CANCEL_HOURS }),
    ).toBeNull();
  });

  it("is 'ok' well before the alert threshold", () => {
    const authorizedAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date("2026-08-01T12:00:00.000Z"); // 12h in, alert fires at 120h
    const result = authorizationDeadline({
      authorizedAt: authorizedAt.toISOString(),
      alertHours: ALERT_HOURS,
      cancelHours: CANCEL_HOURS,
      now,
    });
    expect(result?.level).toBe("ok");
    expect(result?.daysLeft).toBeCloseTo(6, 1); // 156h - 12h = 144h = 6d
  });

  it("is 'critical' at the exact alert threshold", () => {
    const authorizedAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date(authorizedAt.getTime() + ALERT_HOURS * 3_600_000); // exactly 120h later
    const result = authorizationDeadline({
      authorizedAt: authorizedAt.toISOString(),
      alertHours: ALERT_HOURS,
      cancelHours: CANCEL_HOURS,
      now,
    });
    expect(result?.level).toBe("critical");
    expect(result?.hoursLeft).toBeCloseTo(36, 1); // 156h - 120h
  });

  it("is 'expired' at the exact cancel threshold", () => {
    const authorizedAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date(authorizedAt.getTime() + CANCEL_HOURS * 3_600_000); // exactly 156h later
    const result = authorizationDeadline({
      authorizedAt: authorizedAt.toISOString(),
      alertHours: ALERT_HOURS,
      cancelHours: CANCEL_HOURS,
      now,
    });
    expect(result?.level).toBe("expired");
    expect(result?.msLeft).toBeLessThanOrEqual(0);
  });

  it("stays 'expired' well past the cancel threshold (sweep hasn't run yet)", () => {
    const authorizedAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date(authorizedAt.getTime() + (CANCEL_HOURS + 10) * 3_600_000);
    const result = authorizationDeadline({
      authorizedAt: authorizedAt.toISOString(),
      alertHours: ALERT_HOURS,
      cancelHours: CANCEL_HOURS,
      now,
    });
    expect(result?.level).toBe("expired");
  });
});
