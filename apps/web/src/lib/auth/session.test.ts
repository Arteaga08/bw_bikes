import type { AuthUser } from "@bw-bikes/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock, serverApiFetchMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  serverApiFetchMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("../api/server", () => ({ serverApiFetch: serverApiFetchMock }));

const { requireAdminSession } = await import("./session");

function fakeCookieStore(hasAccessToken: boolean) {
  return { get: vi.fn(() => (hasAccessToken ? { name: "bw_access", value: "token" } : undefined)) };
}

function fakeUser(role: AuthUser["role"]): AuthUser {
  return {
    id: "u1",
    email: "admin@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    role,
    emailVerified: true,
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
  };
}

describe("requireAdminSession", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    serverApiFetchMock.mockReset();
    cookiesMock.mockReset();
  });

  it("redirects to login when there is no access-token cookie", async () => {
    cookiesMock.mockResolvedValue(fakeCookieStore(false));

    await expect(requireAdminSession()).rejects.toThrow("REDIRECT:/admin/login");
    expect(serverApiFetchMock).not.toHaveBeenCalled();
  });

  it("redirects to login when /auth/me rejects (expired/invalid session)", async () => {
    cookiesMock.mockResolvedValue(fakeCookieStore(true));
    serverApiFetchMock.mockRejectedValue(new Error("401"));

    await expect(requireAdminSession()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("redirects to login when the API is unreachable, never surfaces a 500", async () => {
    cookiesMock.mockResolvedValue(fakeCookieStore(true));
    serverApiFetchMock.mockRejectedValue(new Error("network down"));

    await expect(requireAdminSession()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("redirects a validly logged-in customer to sin-acceso, not login", async () => {
    cookiesMock.mockResolvedValue(fakeCookieStore(true));
    serverApiFetchMock.mockResolvedValue({ data: { user: fakeUser("customer") } });

    await expect(requireAdminSession()).rejects.toThrow("REDIRECT:/admin/sin-acceso");
  });

  it("returns the user for admin and superadmin roles", async () => {
    cookiesMock.mockResolvedValue(fakeCookieStore(true));

    const admin = fakeUser("admin");
    serverApiFetchMock.mockResolvedValue({ data: { user: admin } });
    await expect(requireAdminSession()).resolves.toEqual(admin);

    const superadmin = fakeUser("superadmin");
    serverApiFetchMock.mockResolvedValue({ data: { user: superadmin } });
    await expect(requireAdminSession()).resolves.toEqual(superadmin);
  });
});
