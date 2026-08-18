import type { AuthUser } from "@bw-bikes/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverApiFetch } from "../api/server";
import { ACCESS_TOKEN_COOKIE, FORBIDDEN_PATH, LOGIN_PATH } from "../config";

/**
 * The admin-panel route guard (DASHBOARD_GUIDELINES.md §1,
 * FRONTEND_GUIDELINES.md §2). Called once, server-side, from
 * `admin/(panel)/layout.tsx` — every route under the panel inherits it.
 *
 * Three checks, in order, each a hard `redirect`:
 *  1. No access-token cookie at all → don't even bother calling the API.
 *  2. Cookie present but the API rejects it (expired, tampered, revoked
 *     session, or the API is unreachable) → same redirect. A cookie
 *     existing proves nothing by itself; only `/auth/me` answering 200 does.
 *  3. Session valid but the account isn't `admin`/`superadmin` (e.g. a
 *     `customer` who is validly logged in on the storefront) → a distinct
 *     "no access" page, not the login screen — they don't need to log in
 *     again, they need a different account.
 *
 * IMPORTANT: `redirect()` works by throwing a Next.js control-flow
 * exception. The `try/catch` below wraps only the `serverApiFetch` call —
 * never a `redirect()` call — so that exception is never accidentally
 * swallowed.
 */
export async function requireAdminSession(): Promise<AuthUser> {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_TOKEN_COOKIE)) {
    redirect(LOGIN_PATH);
  }

  let user: AuthUser;
  try {
    const { data } = await serverApiFetch<{ user: AuthUser }>("/auth/me");
    user = data.user;
  } catch {
    redirect(LOGIN_PATH);
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    redirect(FORBIDDEN_PATH);
  }

  return user;
}

/**
 * The audit viewer's route guard (M11) — same three checks as
 * `requireAdminSession`, plus a fourth: the session must be `superadmin`,
 * not merely `admin`. This is cosmetic, not the real barrier: the API's
 * `GET /admin/audit-logs` is itself `restrictTo("superadmin")`, so a request
 * that somehow reached this page without going through here would still get
 * a 403 from the server. This exists only so an `admin` who guesses the URL
 * gets the same "sin acceso" page as every other unauthorized route, instead
 * of a raw fetch failure.
 */
export async function requireSuperadminSession(): Promise<AuthUser> {
  const user = await requireAdminSession();

  if (user.role !== "superadmin") {
    redirect(FORBIDDEN_PATH);
  }

  return user;
}
