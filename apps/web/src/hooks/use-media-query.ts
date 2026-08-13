"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * `matchMedia`-backed breakpoint check, SSR-safe (server snapshot is `false`
 * — avoids a hydration mismatch since the server can't know the client's
 * viewport). Used where a CSS-only `md:` utility isn't enough because the
 * decision needs to reach a DOM property, not a class — e.g. `Sidebar`'s
 * `inert` attribute, which must never apply on desktop even while the mobile
 * drawer is closed.
 *
 * `useSyncExternalStore`, not `useState` + `useEffect`: `matchMedia` is
 * exactly the external, subscribable store this hook exists for, and reading
 * the snapshot directly avoids the extra render an effect-driven `setState`
 * on mount would cause.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
