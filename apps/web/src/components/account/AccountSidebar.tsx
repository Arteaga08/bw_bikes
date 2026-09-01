"use client";

import { Heart, MapPin, Package, Ruler, SignOut, User } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { logout } from "@/lib/auth/logout";
import { cn } from "@/lib/cn";

export interface AccountSidebarProps {
  user: { firstName: string; lastName: string };
}

const NAV_ITEMS = [
  { href: "/mi-cuenta", label: "Perfil", icon: User },
  { href: "/mi-cuenta/direcciones", label: "Libreta de Direcciones", icon: MapPin },
  { href: "/mi-cuenta/pedidos", label: "Historial de pedidos", icon: Package },
  { href: "/mi-cuenta/tallas", label: "Mis tallas", icon: Ruler },
  { href: "/mi-cuenta/guardados", label: "Guardado para más tarde", icon: Heart },
] as const;

/**
 * `/mi-cuenta` only matches itself — otherwise Perfil would stay active on
 * every sub-route. Everything else matches by prefix, same reasoning as the
 * admin `Sidebar`.
 */
function isItemActive(pathname: string, href: string): boolean {
  return href === "/mi-cuenta" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed left column on `md` and up, over the gray `inset` surface (the
 * reference's sidebar chrome, never its visual style). Below `md` it
 * collapses to a horizontally scrollable strip of the same links — the
 * pattern already used by the admin panel's `TabList`, but as real
 * navigation links rather than in-place tab panels, since these change the
 * route.
 */
export function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="border-b border-borde bg-inset md:min-h-full md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="px-lg pb-md pt-lg md:pb-lg">
        <p className="font-ui text-caption text-grafito uppercase">Mi Cuenta</p>
        <p className="font-display text-h3 text-negro">
          {user.firstName} {user.lastName}
        </p>
      </div>

      <nav
        aria-label="Navegación de cuenta"
        className="flex gap-lg overflow-x-auto px-lg pb-md md:flex-col md:gap-xs md:overflow-visible md:px-sm md:pb-lg"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-sm whitespace-nowrap border-b-2 py-sm font-ui text-ui transition-colors duration-150",
                "md:min-h-11 md:rounded-control md:border-b-0 md:border-l-2 md:px-md md:py-sm",
                isActive
                  ? "border-dorado text-negro md:border-dorado md:bg-dorado/10"
                  : "border-transparent text-grafito hover:text-negro md:hover:bg-surface",
              )}
            >
              <Icon size={18} weight="regular" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-borde px-lg py-md md:px-sm">
        <Button variant="text" tone="neutral" onClick={logout} iconLeft={<SignOut />}>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
