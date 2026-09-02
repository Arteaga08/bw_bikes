import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stripePublishableKey } from "./config";

describe("stripePublishableKey", () => {
  const ORIGINAL_ENV = process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
    } else {
      process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = ORIGINAL_ENV;
    }
  });

  beforeEach(() => {
    delete process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  });

  it("throws when the env var is missing", () => {
    expect(() => stripePublishableKey()).toThrow("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  });

  it("returns the configured key", () => {
    process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_abc123";
    expect(stripePublishableKey()).toBe("pk_test_abc123");
  });
});
