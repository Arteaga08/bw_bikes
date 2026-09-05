"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useCart } from "./CartProvider";

const CartDrawer = dynamic(() => import("./CartDrawer").then((mod) => mod.CartDrawer), { ssr: false });

export interface CartDrawerMountProps {
  /** Read server-side (`cloudinaryCloudName()`) in the layout and threaded down — see `CartLineItem`. */
  cloudName: string;
}

/**
 * Keeps `CartDrawer` (and with it `SlideOver`, `CartLineItem` and the focus
 * trap) out of the initial bundle of every public route, loading it the first
 * time the drawer opens — the same latch `CommandPaletteWrapper` uses in the
 * admin shell.
 *
 * On-demand rather than idle-mounted (`MobileMenu`'s approach) because
 * `SlideOver` renders `null` while closed: there is no entry transition that
 * a late mount could swallow, so there's nothing to gain by downloading the
 * chunk before it's needed.
 *
 * The wrapper exists at all because `(storefront)/layout.tsx` is a Server
 * Component, and a `next/dynamic` call there wouldn't code-split
 * (`next/dist/docs/01-app/02-guides/lazy-loading.md`); `ssr: false` isn't
 * even allowed. The `useCart` subscription has to sit on the client side of
 * the boundary too.
 */
export function CartDrawerMount({ cloudName }: CartDrawerMountProps) {
  const { drawerOpen } = useCart();
  const [everOpened, setEverOpened] = useState(false);

  // Latches true the first time the drawer opens and never resets — a
  // guarded render-time update (react-hooks/set-state-in-effect), not an
  // Effect: there's no external system to synchronize with here.
  if (drawerOpen && !everOpened) {
    setEverOpened(true);
  }

  if (!everOpened) return null;

  return <CartDrawer cloudName={cloudName} />;
}
