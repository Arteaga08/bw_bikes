import { apiFetch } from "../api/client";
import { LOGIN_PATH } from "../config";

/**
 * Client-side counterpart to `session.ts` (server-only, `next/headers`).
 * Ends the session and always leaves via `LOGIN_PATH`, even if the network
 * call fails — a dead cookie server-side is still a dead session locally.
 * Shared by `Sidebar`'s drawer logout and `TopBar`'s account menu so the two
 * can't drift apart on this.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // A dead network or an already-expired session still means "leave" —
    // never block the redirect on the request succeeding.
  } finally {
    window.location.href = LOGIN_PATH;
  }
}
