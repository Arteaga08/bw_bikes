import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("formats an ISO timestamp without throwing", () => {
    expect(formatDateTime("2026-08-07T15:30:00.000Z")).toMatch(/2026/);
  });
});
