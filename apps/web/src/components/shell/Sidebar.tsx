"use client";

import type { AuthUser } from "@bw-bikes/shared";
import { SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LOGIN_PATH } from "@/lib/config";
import { NAV_ITEMS } from "@/lib/nav";
import { useMobileNav } from "./MobileNavContext";

export interface SidebarProps {
  user: AuthUser;
}

/**
 * Fixed ~240px on desktop; becomes an off-canvas drawer on mobile
 * (DASHBOARD_GUIDELINES.md §1–2), controlled by `MobileNavContext` — closes
 * itself on route change. The overlay layer of the brand system
 * (`bg-negro`, DESIGN_SYSTEM.md §1's "nav" usage of black) with the item
 * marker as the shell's one dorado element per view.
 */
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { open, closeNav } = useMobileNav();

  async function handleLogout(): Promise<void> {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      window.location.href = LOGIN_PATH;
    }
  }

  return (
    <>
      {open ? (
        <div aria-hidden="true" onClick={closeNav} className="fixed inset-0 z-40 bg-negro/60 md:hidden" />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-negro text-blanco transition-transform duration-150",
          "md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center px-lg">
          <span className="font-display text-h3 text-blanco">Black &amp; White</span>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-sm py-md">
          <ul className="flex flex-col gap-xs">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-sm rounded-control border-l-2 px-md py-sm font-ui text-ui transition-colors duration-150",
                      isActive
                        ? "border-dorado bg-dorado/10 text-blanco"
                        : "border-transparent text-blanco/70 hover:bg-blanco/5 hover:text-blanco",
                    )}
                  >
                    <Icon size={18} weight="regular" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-blanco/10 px-md py-md">
          <p className="truncate font-ui text-caption text-blanco/60">{user.email}</p>
          <p className="font-ui text-caption text-blanco/40 uppercase">{user.role}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-sm flex items-center gap-xs font-ui text-ui text-blanco/70 transition-colors duration-150 hover:text-dorado"
          >
            <SignOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
