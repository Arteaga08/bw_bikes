"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Hover-intent delay before a panel opens on its own — long enough to survive a mouse passing over the trigger on the way to the logo. */
const OPEN_INTENT_DELAY_MS = 150;
/** Grace period after `mouseleave` before the group actually closes — long enough to cross the (contiguous, `fixed`-positioned) gap from trigger to panel. */
const CLOSE_GRACE_MS = 200;

export interface MegaMenuGroup {
  /** `href` of the item whose panel is open, or `null` when the group is fully closed. */
  openHref: string | null;
  /** Hover entry point: opens after `OPEN_INTENT_DELAY_MS`, unless another panel is already open — then the switch is instant. */
  openWithIntent: (href: string) => void;
  /** Click/keyboard entry point: opens immediately, no delay. */
  openNow: (href: string) => void;
  /** `mouseleave` entry point: closes after `CLOSE_GRACE_MS` unless `cancelClose` fires first. */
  scheduleClose: () => void;
  cancelClose: () => void;
  /** Escape/click-outside entry point: closes immediately. */
  closeNow: () => void;
}

/**
 * Shared "which panel is open" state for the desktop mega-menu
 * (`StorefrontNavLinks` → one instance → every `NavMegaMenuItem`). A single
 * source of truth, not per-item local state, is what guarantees only one
 * panel is ever open at a time — the same invariant the rhinoceronte budget
 * in `storefront-mega-menu.ts`'s callers leans on (never more than one
 * mega-menu photo visible at once).
 *
 * Pulled out of the component so the hover-intent/close-grace timing is
 * testable with fake timers without a DOM tree in the way.
 */
export function useMegaMenuGroup(): MegaMenuGroup {
  const [openHref, setOpenHref] = useState<string | null>(null);
  const openHrefRef = useRef<string | null>(null);
  useEffect(() => {
    openHrefRef.current = openHref;
  }, [openHref]);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openNow = useCallback(
    (href: string) => {
      clearOpenTimer();
      clearCloseTimer();
      setOpenHref(href);
    },
    [clearCloseTimer, clearOpenTimer],
  );

  const openWithIntent = useCallback(
    (href: string) => {
      clearCloseTimer();
      if (openHrefRef.current !== null && openHrefRef.current !== href) {
        openNow(href);
        return;
      }
      if (openHrefRef.current === href) return;

      clearOpenTimer();
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        setOpenHref(href);
      }, OPEN_INTENT_DELAY_MS);
    },
    [clearCloseTimer, clearOpenTimer, openNow],
  );

  const closeNow = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    setOpenHref(null);
  }, [clearCloseTimer, clearOpenTimer]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpenHref(null);
    }, CLOSE_GRACE_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  const cancelClose = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  return { openHref, openWithIntent, openNow, scheduleClose, cancelClose, closeNow };
}
