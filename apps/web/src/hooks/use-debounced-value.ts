import { useEffect, useState } from "react";

/**
 * Delays a fast-changing value (keystrokes) so a consumer that fetches on
 * every change — `BadgesView`/`SpecTemplatesView`'s `effectiveParams` — only
 * fires once typing pauses, instead of once per letter. The input stays
 * controlled by the *live* value; only what feeds the request is delayed.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
