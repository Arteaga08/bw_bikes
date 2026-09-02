// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutIdempotencyKey } from "./idempotency-key";

describe("checkoutIdempotencyKey", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("generates and stores a new key when none is stored", () => {
    const key = checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    expect(key).toEqual(expect.any(String));
    expect(key.length).toBeGreaterThan(0);
  });

  it("reuses the stored key when cartUpdatedAt matches", () => {
    const first = checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    const second = checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    expect(second).toBe(first);
  });

  it("generates a new key when cartUpdatedAt changed", () => {
    const first = checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    const second = checkoutIdempotencyKey("2026-09-01T00:05:00.000Z");
    expect(second).not.toBe(first);
  });

  it("persists the new cartUpdatedAt so a third call with the same value reuses the second key", () => {
    checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    const second = checkoutIdempotencyKey("2026-09-01T00:05:00.000Z");
    const third = checkoutIdempotencyKey("2026-09-01T00:05:00.000Z");
    expect(third).toBe(second);
  });

  it("uses crypto.randomUUID", () => {
    const randomUUIDSpy = vi.spyOn(crypto, "randomUUID");
    checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");
    expect(randomUUIDSpy).toHaveBeenCalledTimes(1);
    randomUUIDSpy.mockRestore();
  });

  it("falls back to an unpersisted key instead of throwing when sessionStorage is inaccessible", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const key = checkoutIdempotencyKey("2026-09-01T00:00:00.000Z");

    expect(key).toEqual(expect.any(String));
    expect(key.length).toBeGreaterThan(0);
    getItemSpy.mockRestore();
  });
});
