"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Upper bound for the idle wait. `requestIdleCallback`'s own `timeout` makes
 * the browser run the callback even if it never finds a genuinely idle
 * moment, so a busy page can't leave the overlay unmounted forever — and the
 * `setTimeout` fallback below uses the same number for the same reason.
 */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Defers mounting a subtree until the browser is idle, so its chunk stays out
 * of the initial parse/evaluate pass without ever making the user wait for a
 * download at the moment they interact.
 *
 * This is the counterpart to gating a `next/dynamic` component on "is it open
 * yet": that pattern is right for a modal nobody sees twice, but wrong for an
 * overlay that animates *in* from a closed state. Mounting only once `open`
 * is already `true` means the element's first paint is its open state, so the
 * CSS transition has nothing to animate from and the panel simply appears.
 * Mounting it closed during idle time keeps the entry animation intact.
 *
 * Returns the flag plus an escape hatch: a user who interacts before the
 * browser ever goes idle (a tap on the very first frame) calls `mountNow` and
 * gets the subtree immediately, at the cost of that one download.
 */
export function useIdleMount(enabled: boolean = true): [boolean, () => void] {
  const [mounted, setMounted] = useState(false);

  const mountNow = useCallback(() => setMounted(true), []);

  useEffect(() => {
    if (!enabled || mounted) return;

    // Safari only shipped `requestIdleCallback` in 16.4 — older browsers get
    // a plain timer, which defers past first paint just the same, only
    // without the "wait for a quiet moment" part.
    if (typeof window.requestIdleCallback !== "function") {
      const timeoutId = window.setTimeout(mountNow, IDLE_TIMEOUT_MS);
      return () => window.clearTimeout(timeoutId);
    }

    const handle = window.requestIdleCallback(mountNow, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }, [enabled, mounted, mountNow]);

  return [mounted, mountNow];
}
