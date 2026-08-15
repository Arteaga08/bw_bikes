"use client";

import { CaretLeft, List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { buildCrumbs } from "./Breadcrumbs";
import { useMobileNav } from "./MobileNavContext";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

/**
 * Greeting + date + mobile hamburger, from `md:` up. Below `md`, `Breadcrumbs`
 * is hidden (DASHBOARD_GUIDELINES.md's mobile drawer note extended here: one
 * chrome band, not two) and this bar carries the route context instead — a
 * "‹ parent" link derived from the same `buildCrumbs` Breadcrumbs uses, so the
 * two never disagree about the current path's parent.
 *
 * Deliberately no notification bell yet: DASHBOARD_GUIDELINES.md §2 pairs it
 * with polling admin stats (`/admin/stats/overview`'s alerts), which is M11's
 * analytics panel, not shell chrome — wiring it here would be a feature this
 * milestone didn't ask for, built against data M8 has no page for yet.
 */
export function TopBar() {
  const { open, toggleNav } = useMobileNav();
  const pathname = usePathname();
  const today = DATE_FORMATTER.format(new Date());

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

        <p className="hidden truncate font-ui text-ui text-negro md:block">Hola de nuevo</p>
      </div>
      <p className="hidden shrink-0 font-body text-caption text-grafito capitalize sm:block">{today}</p>
    </header>
  );
}
