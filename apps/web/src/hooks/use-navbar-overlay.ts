"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Routes whose first section wants the navbar to start transparent over it.
 * Today only the home's hero (M12 entrega 2) asks for this; a page not in
 * this list never even queries the DOM for a marked element — see the early
 * return below.
 */
export const NAVBAR_OVERLAY_ROUTES: readonly string[] = ["/"];

/** Matches `Navbar`'s own height (`h-16` = 64px) — the band the observed element has to clear before the bar turns solid. */
const NAVBAR_HEIGHT_PX = 64;

const OVERLAY_MARKER_SELECTOR = "[data-navbar-overlay]";

/**
 * Whether the navbar should render transparent (`true`, sitting over a hero)
 * or solid (`false`, over ordinary page content). Contract: a page opts in by
 * marking its own overlay-worthy element with `data-navbar-overlay` — nothing
 * else needs configuring, and a page with no such element (or not even in
 * `NAVBAR_OVERLAY_ROUTES`) always gets a solid bar.
 *
 * `IntersectionObserver`, not a scroll listener: the browser does the work
 * off the main thread, and there's nothing to measure by hand. `rootMargin`
 * shrinks the viewport's top edge down by the navbar's own height, so
 * "intersecting" means "the marked element still reaches under the bar" —
 * the moment it scrolls fully past that band, the observer reports it gone
 * and the bar goes solid.
 */
export function useNavbarOverlay(): boolean {
  const pathname = usePathname();
  const routeWantsOverlay = NAVBAR_OVERLAY_ROUTES.includes(pathname);

  // Read once per mount from the pathname the server already rendered for —
  // this is what lets the very first paint come out correct (transparent bar
  // over the hero, solid everywhere else) instead of flashing solid-then-
  // transparent while the observer spins up.
  const [overlay, setOverlay] = useState(routeWantsOverlay);

  // A client-side navigation doesn't remount this hook, so the state above
  // only reflects the *first* route this component ever saw. Resetting here
  // — during render, not inside a `useEffect` — is the same pattern
  // `MobileMenu` uses to close on navigation: a `useEffect` reset would still
  // paint one stale frame (a transparent bar surviving into a page with no
  // hero) before catching up.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (overlay !== routeWantsOverlay) setOverlay(routeWantsOverlay);
  }

  useEffect(() => {
    if (!routeWantsOverlay) return;

    const target = document.querySelector(OVERLAY_MARKER_SELECTOR);
    if (!target) {
      // Correcting the optimistic initial guess here is a real synchronize-
      // with-the-DOM concern (there's no prop/state this could derive from
      // during render — it needs the committed DOM), but calling `setOverlay`
      // directly at the top of the effect body is exactly what
      // `react-hooks/set-state-in-effect` flags. `queueMicrotask` moves it
      // out of the synchronous effect body — the same "subscribe, don't call
      // setState from the body itself" shape the IntersectionObserver branch
      // below already has, just for the should-never-happen case where a
      // route claims `NAVBAR_OVERLAY_ROUTES` without shipping the marked
      // element that's supposed to come with it. `cancelled` guards against
      // the (rare, but real) unmount-before-microtask-runs race.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setOverlay(false);
      });
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setOverlay(entry?.isIntersecting ?? false),
      { rootMargin: `-${NAVBAR_HEIGHT_PX}px 0px 0px 0px` },
    );
    observer.observe(target);
    return () => observer.disconnect();
    // `pathname` (not just `routeWantsOverlay`) is a real dependency: two
    // different overlay routes would otherwise reuse a stale observer
    // pointed at the previous page's marked element.
  }, [routeWantsOverlay, pathname]);

  return overlay;
}
