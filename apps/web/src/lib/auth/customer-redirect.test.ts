import { describe, expect, it } from "vitest";
import { loginHref, safeRedirectTarget } from "./customer-redirect";

describe("loginHref", () => {
  it("returns the bare login path with no returnTo", () => {
    expect(loginHref()).toBe("/ingresar");
  });

  it("appends returnTo as an encoded redirect query param", () => {
    expect(loginHref("/mi-cuenta")).toBe("/ingresar?redirect=%2Fmi-cuenta");
  });
});

describe("safeRedirectTarget", () => {
  it("accepts a same-site path", () => {
    expect(safeRedirectTarget("/mi-cuenta")).toBe("/mi-cuenta");
  });

  it("rejects a protocol-relative host (//evil.com)", () => {
    expect(safeRedirectTarget("//evil.com")).toBeNull();
  });

  it("rejects an absolute URL to another host", () => {
    expect(safeRedirectTarget("http://evil.com")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(safeRedirectTarget("")).toBeNull();
  });

  it("rejects undefined", () => {
    expect(safeRedirectTarget(undefined)).toBeNull();
  });

  it("takes the first value when given an array, validating it the same way", () => {
    expect(safeRedirectTarget(["/mi-cuenta", "/otro"])).toBe("/mi-cuenta");
    expect(safeRedirectTarget(["//evil.com"])).toBeNull();
  });
});
