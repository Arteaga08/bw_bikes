"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab inside `containerRef` while `active` is true (modals,
 * slide-overs, the command palette — DASHBOARD_GUIDELINES.md §8). On
 * activation, focus moves into the container; on deactivation, focus
 * returns to whatever triggered it, never left dangling on `<body>`.
 *
 * `extraRef` adds one element *outside* the container to the cycle, for the
 * case where a dialog's own close control can't live inside it. The
 * storefront's `MobileMenu` is that case: its toggle has to stay visible in
 * the navbar while the drawer is closed, so it can't be a child of a panel
 * that slides off-screen — and without this, the ✕ would be unreachable by
 * keyboard.
 *
 * It is placed by actual DOM position, not assumed to go last: the trap only
 * catches Tab at the boundary where `document.activeElement` matches its own
 * `first`/`last`, which the *browser's* native tab order has to agree with or
 * the boundary check silently never fires and focus walks straight out of
 * the trap. `MobileMenu` renders its toggle *before* the drawer markup, so in
 * DOM (and tab) order it is first, not last — verified against a real
 * browser via Playwright, where an array that assumed "extra is last"
 * produced exactly that leak (Tab from the final drawer link escaped to the
 * wordmark behind it instead of wrapping to the toggle).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  extraRef?: RefObject<HTMLElement | null>,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      const inside = Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      const extra = extraRef?.current;
      if (!extra?.isConnected) return inside;

      // `offsetParent` is null for `position: fixed`, so the same visibility
      // filter can't be reused for `extra` — `isConnected` is the check that
      // holds regardless of how the caller positions its close control.
      //
      // `compareDocumentPosition` decides which end of the array `extra`
      // belongs on, matching the real DOM (and thus real Tab) order instead
      // of assuming a fixed side.
      const precedes = Boolean(
        container!.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      return precedes ? [extra, ...inside] : [...inside, extra];
    }

    const initialFocusable = getFocusable();
    (initialFocusable[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [active, containerRef, extraRef]);
}
