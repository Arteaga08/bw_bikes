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
// scoping) needs it present even though no test asserts on a real
// breakpoint change; without this stub the hook throws on mount.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
