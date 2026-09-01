"use client";

import { SignOut } from "@phosphor-icons/react";
import Image from "next/image";
import { AccountTile } from "@/components/account/AccountTile";
import { ACCOUNT_NAV_ITEMS } from "@/components/account/nav-items";
import { Button } from "@/components/ui/Button";
import { logout } from "@/lib/auth/logout";

export interface AccountHubProps {
  user: { firstName: string; lastName: string };
}

/**
 * Mobile-only landing screen at `/mi-cuenta`: the widget grid from
 * Specialized's `/myaccount` reference (information architecture only, per
 * `docs/m13/00-CONTEXTO.md` §"Referencia de diseño") replacing the
 * horizontally-scrolling nav strip `AccountSidebar` used to render below
 * `md`. `md:hidden` — desktop keeps the two-column shell and never sees
 * this; `AccountHubDesktopRedirect` sends a desktop visitor to
 * `/mi-cuenta/perfil` instead.
 */
export function AccountHub({ user }: AccountHubProps) {
  return (
    <div className="flex flex-col gap-lg md:hidden">
      <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={10} />

      <div className="flex items-center justify-between gap-sm">
        <p className="font-ui text-eyebrow text-grafito uppercase">Mi Cuenta</p>
        <Button variant="text" tone="neutral" onClick={logout} iconLeft={<SignOut />}>
          Cerrar sesión
        </Button>
      </div>

      <p className="font-display text-h2 text-negro">
        {user.firstName} {user.lastName}
      </p>

      <div className="grid grid-cols-2 gap-md">
        {ACCOUNT_NAV_ITEMS.map((item) => (
          <AccountTile key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </div>
    </div>
  );
}
