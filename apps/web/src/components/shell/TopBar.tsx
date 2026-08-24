"use client";

import type { AuthUser, OperationalAlerts } from "@bw-bikes/shared";
import { CaretLeft, List, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { getOperationalAlerts } from "@/lib/api/admin-stats";
import { logout } from "@/lib/auth/logout";
import { buildCrumbs } from "./Breadcrumbs";
import { useMobileNav } from "./MobileNavContext";
import { NotificationsPopover } from "./NotificationsPopover";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
const ALERTS_POLL_INTERVAL_MS = 60_000;

export interface TopBarProps {
  user: AuthUser;
  /**
   * Seeded from `(panel)/layout.tsx`'s own server-side fetch of the exact
   * same `/admin/stats/alerts` payload — without this, every route (Inicio
   * included, where `page.tsx` *also* fetches it server-side for
   * `QuickLinks`/`OperationsStrip`) paid a second, client-only round trip on
   * mount just to fill in this bell. `null` (the default) falls back to the
   * old mount-time fetch, for any caller that doesn't have a value handy.
   */
  initialAlerts?: OperationalAlerts | null;
}

/** Falls back to the email's first letter — `firstName`/`lastName` are required and trimmed server-side, but never trust that blindly for display. */
function getInitials(user: AuthUser): string {
  const initials = `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase();
  return initials || user.email.charAt(0).toUpperCase();
}

/**
 * Greeting + date + mobile hamburger, from `md:` up. Below `md`, `Breadcrumbs`
 * is hidden (DASHBOARD_GUIDELINES.md's mobile drawer note extended here: one
 * chrome band, not two) and this bar carries the route context instead — a
 * "‹ parent" link derived from the same `buildCrumbs` Breadcrumbs uses, so the
 * two never disagree about the current path's parent.
 *
 * The notification bell opens `NotificationsPopover`: alert categories
 * grouped by their own color, not a flat mixed list. M11 rejected exactly
 * the flat-list version of this (`docs/MILESTONES.md`) for making distinct
 * alerts indistinguishable — this one reuses `OperationsStrip`'s own
 * per-category classification (`buildAlertDescriptors`) instead of
 * inventing a second one, which is the difference that makes reopening this
 * a considered choice rather than repeating the same mistake.
 */
export function TopBar({ user, initialAlerts = null }: TopBarProps) {
  const { open, toggleNav } = useMobileNav();
  const pathname = usePathname();
  const today = DATE_FORMATTER.format(new Date());
  const [alerts, setAlerts] = useState<OperationalAlerts | null>(initialAlerts);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      getOperationalAlerts()
        .then((result) => {
          if (cancelled) return;
          setAlerts(result);
        })
        .catch(() => {
          // Silent — a secondary shell widget isn't worth a toast on a
          // transient failure; a real session loss is already handled
          // globally by apiFetch's refresh/redirect.
        });
    }

    // Only the *first* load is conditional — `initialAlerts` is read once,
    // at mount, to decide whether the layout already handed us fresh data;
    // the poll below always runs regardless, so this bell still catches up
    // to anything that changed since.
    if (initialAlerts === null) load();
    const interval = setInterval(load, ALERTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAlerts is intentionally read once, at mount
  }, []);

  const crumbs = buildCrumbs(pathname);
  const parentCrumb = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-md border-b border-borde bg-surface px-md sm:px-lg">
      <div className="flex min-w-0 items-center gap-sm">
        {/* `icon-lg` is the 44px square this used to hand-roll — chrome that
            has to stay reachable with a thumb, unlike the 36px row actions. */}
        <Button
          variant="bare"
          size="icon-lg"
          onClick={toggleNav}
          aria-expanded={open}
          aria-controls="panel-sidebar"
          aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
          iconLeft={open ? <X /> : <List />}
          className="-ml-sm shrink-0 md:hidden"
        />

        {parentCrumb ? (
          <Link
            href={parentCrumb.href}
            className="flex min-w-0 items-center gap-xs font-ui text-ui text-negro md:hidden"
          >
            <CaretLeft size={16} aria-hidden="true" className="shrink-0 text-grafito" />
            <span className="truncate">{parentCrumb.label}</span>
          </Link>
        ) : (
          <p className="truncate font-ui text-ui text-negro md:hidden">Hola de nuevo</p>
        )}

        {/* Second place the rhino appears — a deliberate 2026-08-20 exception to
            `handoff/DESIGN_SYSTEM.md` §5's "single non-functional place, never
            repeated as UI chrome" rule (previously only the login screen). */}
        <div className="hidden min-w-0 flex-col md:flex">
          <div className="flex min-w-0 items-center gap-xs">
            <Image src="/brand/rhino-dorado.svg" alt="" width={20} height={20} className="shrink-0" />
            <p className="truncate font-display text-h3 text-negro">Hola de nuevo</p>
          </div>
          <p className="font-body text-caption text-grafito capitalize">{today}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-xs">
        <p className="hidden font-body text-caption text-grafito capitalize sm:block md:hidden">{today}</p>
        <div aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-borde md:block" />
        <NotificationsPopover alerts={alerts} />
        <Menu
          ariaLabel="Cuenta"
          trigger={
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-negro font-ui text-caption text-blanco"
            >
              {getInitials(user)}
            </span>
          }
          header={
            <div className="flex flex-col gap-0.5">
              <p className="truncate font-ui text-ui text-negro">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate font-body text-caption text-grafito">{user.email}</p>
              <p className="font-ui text-caption text-grafito uppercase">{user.role}</p>
            </div>
          }
          items={[{ label: "Cerrar sesión", onClick: logout }]}
        />
      </div>
    </header>
  );
}
