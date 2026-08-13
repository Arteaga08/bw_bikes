"use client";

import type { AuthUser } from "@bw-bikes/shared";
import { SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMediaQuery } from "@/hooks/use-media-query";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LOGIN_PATH } from "@/lib/config";
import { NAV_SECTIONS } from "@/lib/nav";
import { useMobileNav } from "./MobileNavContext";

export interface SidebarProps {
  user: AuthUser;
}

/**
 * `/admin` only matches itself — otherwise Inicio would stay active on every
 * route, since every admin path starts with `/admin`. Every other item
 * matches by prefix so a sub-route (`/admin/catalogo/bicicletas/nueva`, the
 * edit route with its `[id]`) still marks its parent list item as current —
 * M10's first pass used plain equality here, so nothing lit up once you left
 * the list itself.
 */
function isItemActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed ~240px on desktop; becomes an off-canvas drawer on mobile
 * (DASHBOARD_GUIDELINES.md §1–2), controlled by `MobileNavContext` — closes
 * itself on route change. The overlay layer of the brand system
 * (`bg-negro`, DESIGN_SYSTEM.md §1's "nav" usage of black) with the item
 * marker as the shell's one dorado element per view.
 *
 * Below `md` the drawer is a real dialog (FRONTEND_GUIDELINES.md §5:
 * `role="dialog"`, `aria-modal`, focus trap, `Escape` to close) sharing
 * `useFocusTrap` with `Modal`/`SlideOver` so the three can't drift apart on
 * the part that matters. `md:` and up it's permanent navigation, not a
 * dialog — the ARIA attributes and trap only apply while `open` is true,
 * which under `md` never happens.
 */
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { open, closeNav } = useMobileNav();
  const asideRef = useRef<HTMLElement>(null);
  // Tailwind's `md` breakpoint is 768px — "below md" is its exact complement.
  const isBelowMd = useMediaQuery("(max-width: 767px)");

  useFocusTrap(asideRef, open);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeNav();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeNav]);

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
        ref={asideRef}
        id="panel-sidebar"
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Navegación principal"
        // `inert` only while the drawer is closed AND we're below `md` — `md:`
        // up it's static navigation and must stay interactive regardless of
        // `open`. Real `inert` (not just visual translate) keeps a closed
        // drawer out of Tab order and the accessibility tree.
        inert={isBelowMd && !open ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-negro text-blanco transition-transform duration-150",
          "md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center px-lg">
          <span className="font-display text-h3 text-blanco">Black &amp; White</span>
        </div>

        <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto px-sm py-md">
          <ul className="flex flex-col gap-lg">
            {NAV_SECTIONS.map((section) => (
              <li key={section.title}>
                <p className="px-md pb-xs font-ui text-caption text-blanco/40 uppercase">{section.title}</p>
                <ul className="flex flex-col gap-xs">
                  {section.items.map((item) => {
                    const isActive = isItemActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center gap-sm rounded-control border-l-2 px-md py-sm font-ui text-ui transition-colors duration-150 md:min-h-0",
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
              </li>
            ))}
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
