"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

interface MobileNavContextValue {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/**
 * Drawer state for the mobile Sidebar (DASHBOARD_GUIDELINES.md §1–2). Closes
 * itself on every route change so navigating from the drawer doesn't leave
 * it open over the new page.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // React's "adjust state when a prop changes" pattern (state set during
  // render, not inside an Effect — react-hooks/set-state-in-effect): closing
  // the drawer is a direct consequence of the pathname changing, not a sync
  // with an external system, so it belongs in render, not in a useEffect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const openNav = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);
  const toggleNav = useCallback(() => setOpen((current) => !current), []);

  const value = useMemo(() => ({ open, openNav, closeNav, toggleNav }), [open, openNav, closeNav, toggleNav]);

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error("useMobileNav debe usarse dentro de un MobileNavProvider.");
  }
  return ctx;
}
