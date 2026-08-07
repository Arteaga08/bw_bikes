import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { CommandPaletteWrapper } from "@/components/shell/CommandPaletteWrapper";
import { MobileNavProvider } from "@/components/shell/MobileNavContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { SkipLink } from "@/components/shell/SkipLink";
import { TopBar } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { requireAdminSession } from "@/lib/auth/session";

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

  return (
    <ToastProvider>
      <MobileNavProvider>
        <SkipLink />
        <div className="flex h-dvh bg-base">
          <Sidebar user={user} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <Breadcrumbs />
            <main id="panel-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
              {children}
            </main>
          </div>
        </div>
        <CommandPaletteWrapper />
      </MobileNavProvider>
    </ToastProvider>
  );
}
