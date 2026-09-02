"use client";

import { useEffect, useState } from "react";
import { MenuToggleIcon } from "@/components/storefront/MenuToggleIcon";

/**
 * The cart drawer's close glyph — reuses the mobile nav's ☰⇄✕ morph
 * (`MenuToggleIcon`) instead of a static Phosphor `X`, so both dismiss
 * controls read as the same motion language. `SlideOver` hard-unmounts its
 * dialog while closed, so this remounts fresh each time the drawer opens;
 * starting at `open=false` and flipping to `true` one frame later is what
 * makes the morph actually play instead of rendering the ✕ pre-drawn.
 */
export function CartDrawerCloseIcon() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return <MenuToggleIcon open={open} />;
}
