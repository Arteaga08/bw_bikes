"use client";

import dynamic from "next/dynamic";
import { useIdleMount } from "@/hooks/use-idle-mount";

const ComparisonTray = dynamic(() => import("./ComparisonTray").then((mod) => mod.ComparisonTray), { ssr: false });

/**
 * Client boundary that keeps `ComparisonTray` out of every public route's
 * initial bundle. `(storefront)/layout.tsx` is a Server Component, where
 * `next/dynamic` doesn't code-split and `ssr: false` isn't allowed at all
 * (`next/dist/docs/01-app/02-guides/lazy-loading.md`), so the dynamic import
 * has to happen on this side of the boundary.
 *
 * Idle-mounted, **not** gated on `entries.length > 0`: the tray is written to
 * be always mounted precisely so its `translate-y` transition has a closed
 * state to animate from (see its own doc comment). Mounting it only once a
 * bike is selected would make its first paint the open state, and the bar
 * would appear instead of sliding up.
 *
 * The tray reads nothing here — it subscribes to `ComparisonProvider` itself
 * and decides its own visibility, including hiding on `/comparar`.
 */
export function ComparisonTrayMount() {
  const [mounted] = useIdleMount();

  if (!mounted) return null;

  return <ComparisonTray />;
}
