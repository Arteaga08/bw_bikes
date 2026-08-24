import type { Metadata } from "next";
import type { OperationalAlerts } from "@bw-bikes/shared";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { CommandPaletteWrapper } from "@/components/shell/CommandPaletteWrapper";
import { MobileNavProvider } from "@/components/shell/MobileNavContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { SkipLink } from "@/components/shell/SkipLink";
import { TopBar } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { unstable_rethrow } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { serverApiFetch } from "@/lib/api/server";

// Never indexed — this is an internal operations panel, not public content
// (DASHBOARD_GUIDELINES.md §1).
export const metadata: Metadata = {
  title: { default: "Panel de administración", template: "%s · Black and White Bikes" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/**
 * Everything under `(panel)` is guarded by `requireAdminSession()` — a
 * server-side check against the real API, not just cookie presence
 * (FRONTEND_GUIDELINES.md §2). `admin/login` and `admin/sin-acceso` live
 * outside this group deliberately, so neither redirect target sits behind
 * the guard it's redirecting away from.
 */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminSession();

  // Seeds `TopBar`'s notification bell so it renders with real counts on
  // the very first paint of *every* route, not just after its own
  // mount-time client fetch resolves. Best-effort: a failure here just
  // falls back to `TopBar`'s own client-side fetch (its default behavior
  // when `initialAlerts` is `null`) — a transient alerts-endpoint hiccup
  // shouldn't take the whole panel down.
  let initialAlerts: OperationalAlerts | null = null;
  try {
    const { data } = await serverApiFetch<{ alerts: OperationalAlerts }>("/admin/stats/alerts");
    initialAlerts = data.alerts;
  } catch (error) {
    // `serverApiFetch` itself calls Next's `redirect()` on a 401 — that
    // throws a framework control-flow error that must propagate, never be
    // swallowed as "the fetch failed". `unstable_rethrow` re-throws exactly
    // that class of error (redirect/notFound/...) and falls through to here
    // only for a genuine failure, which is the one case `initialAlerts`
    // should stay `null` for.
    unstable_rethrow(error);
  }

  return (
    <ToastProvider>
      <MobileNavProvider>
        <SkipLink />
        <div className="flex h-dvh overflow-hidden bg-base">
          <Sidebar user={user} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TopBar user={user} initialAlerts={initialAlerts} />
            <Breadcrumbs />
            <main
              id="panel-content"
              tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
            >
              {children}
            </main>
          </div>
        </div>
        <CommandPaletteWrapper role={user.role} />
      </MobileNavProvider>
    </ToastProvider>
  );
}
