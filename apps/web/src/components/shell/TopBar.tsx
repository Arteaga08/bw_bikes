"use client";

import { List } from "@phosphor-icons/react";
import { useMobileNav } from "./MobileNavContext";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

/**
 * Greeting + date + mobile hamburger. Deliberately no notification bell yet:
 * DASHBOARD_GUIDELINES.md §2 pairs it with polling admin stats
 * (`/admin/stats/overview`'s alerts), which is M11's analytics panel, not
 * shell chrome — wiring it here would be a feature this milestone didn't
 * ask for, built against data M8 has no page for yet.
 */
export function TopBar() {
  const { toggleNav } = useMobileNav();
  const today = DATE_FORMATTER.format(new Date());

  return (
    <header className="flex h-16 items-center justify-between border-b border-borde bg-surface px-lg">
      <div className="flex items-center gap-md">
        <button
          type="button"
          onClick={toggleNav}
          aria-label="Abrir navegación"
          className="text-negro md:hidden"
        >
          <List size={22} aria-hidden="true" />
        </button>
        <p className="font-ui text-ui text-negro">Hola de nuevo</p>
      </div>
      <p className="font-body text-caption text-grafito capitalize">{today}</p>
    </header>
  );
}
