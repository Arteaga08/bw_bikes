// @vitest-environment jsdom
//
// Same reasoning as client.test.ts: pure logic, but the redirect below is a
// real `window.location` write, so this one file needs a DOM.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_PATH } from "../config";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("../api/client", () => ({ apiFetch: apiFetchMock }));

const { logout } = await import("./logout");

describe("logout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, href: "" } });
  });

  it("posts to /auth/logout and sends the browser to the login page", async () => {
    apiFetchMock.mockResolvedValue({ data: null });

    await logout();

    expect(apiFetchMock).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
    expect(window.location.href).toBe(LOGIN_PATH);
  });

  it("still redirects to login even when the logout request fails", async () => {
    apiFetchMock.mockRejectedValue(new Error("network down"));

    await logout();

    expect(window.location.href).toBe(LOGIN_PATH);
  });
});
