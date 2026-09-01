"use client";

import { SignOut } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAV_ITEMS } from "@/components/account/nav-items";
import { Button } from "@/components/ui/Button";
import { logout } from "@/lib/auth/logout";
import { cn } from "@/lib/cn";

export interface AccountSidebarProps {
  user: { firstName: string; lastName: string };
}

/** Every entry matches by prefix — same reasoning as the admin `Sidebar`. */
function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed left column on `md` and up, over the gray `inset` surface (the
 * reference's sidebar chrome, never its visual style). Below `md`, account
 * navigation lives in `AccountHub` (the widget grid at `/mi-cuenta`)
 * instead — this rail renders nothing there.
 */
export function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block md:min-h-full md:w-60 md:shrink-0 md:border-r md:border-borde md:bg-inset">
      <div className="px-xl pt-2xl">
        {/* Firma de marca del shell de cuenta (referencia visual de Manuel:
            el wordmark de Specialized arriba a la izquierda de su sidebar,
            2026-09-01) — dorado por decisión explícita de Manuel, el mismo
            acento que usa el resto del sitio sobre fondos claros. */}
        <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={10} className="mb-sm" />
        <p className="font-ui text-caption text-grafito uppercase">Mi Cuenta</p>
        <p className="font-display text-h3 text-negro">
          {user.firstName} {user.lastName}
        </p>
      </div>

      <nav aria-label="Navegación de cuenta" className="flex flex-col gap-sm px-md pb-xl">
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-sm whitespace-nowrap rounded-control border-l-2 px-md py-sm font-ui text-ui transition-colors duration-150",
                isActive ? "border-dorado bg-dorado/10 text-negro" : "border-transparent text-grafito hover:bg-surface hover:text-negro",
              )}
            >
              <Icon size={18} weight="regular" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-borde px-md py-lg">
        <Button variant="text" tone="neutral" onClick={logout} iconLeft={<SignOut />}>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
