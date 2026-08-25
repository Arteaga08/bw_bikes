import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react doesn't auto-register cleanup for Vitest the way
// it does for Jest — without this, every `render()` in a later `it()` piles
// its DOM on top of the previous one instead of starting fresh.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement `matchMedia` — `useMediaQuery` (Sidebar's `inert`
// scoping, `DataTable`'s desktop/mobile layout choice) needs it present even
// though most tests don't assert on a real breakpoint change; without this
// stub the hook throws on mount.
//
// Defaults to `matches: true` (desktop) — jsdom's own default viewport is
// desktop-sized, and every table-driven admin view's test was written
// against the desktop table layout (querying rows, row actions, etc. by
// role), not the `md:hidden` mobile card list. A test that specifically
// exercises the mobile layout (e.g. `DataTable.test.tsx`) overrides this
// locally rather than flipping the shared default under everyone else.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// jsdom doesn't implement `IntersectionObserver` either — `useNavbarOverlay`
// (the storefront navbar's transparent-over-hero/solid-on-scroll switch)
// needs the constructor present even for tests that never assert on a real
// intersection. Same shape as the `matchMedia` stub above: a shared default
// that a test exercising the real behavior (`use-navbar-overlay.test.tsx`)
// overrides locally with a fake it can trigger by hand.
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  class NoopIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
