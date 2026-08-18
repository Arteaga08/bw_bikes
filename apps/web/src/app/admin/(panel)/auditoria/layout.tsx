import type { ReactNode } from "react";
import { requireSuperadminSession } from "@/lib/auth/session";

/**
 * Cosmetic gate — the real barrier is the API's `restrictTo("superadmin")`
 * on `GET /admin/audit-logs`. This exists only so an `admin` who guesses the
 * URL (or clicks a stale bookmark from when they were promoted, then
 * demoted) lands on `/admin/sin-acceso` instead of a page that renders and
 * then fails every request.
 */
export default async function AuditoriaLayout({ children }: { children: ReactNode }) {
  await requireSuperadminSession();
  return children;
}
