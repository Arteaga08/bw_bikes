"use client";

import type { UserRole } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPalette = dynamic(() => import("./CommandPalette").then((mod) => mod.CommandPalette), {
  ssr: false,
});

export interface CommandPaletteWrapperProps {
  role: UserRole;
}

/**
 * Owns the `Cmd/Ctrl+K` shortcut and the open/closed state; the palette
 * itself is only ever imported after the first open (`everOpened` gates the
 * render that triggers `dynamic`'s `import()`), so its chunk never ships in
 * the initial bundle (DASHBOARD_GUIDELINES.md §2).
 */
export function CommandPaletteWrapper({ role }: CommandPaletteWrapperProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Latches true the first time the palette opens and never resets — a
  // guarded render-time update (react-hooks/set-state-in-effect), not an
  // Effect: there's no external system to synchronize with here.
  if (open && !everOpened) {
    setEverOpened(true);
  }

  if (!everOpened) return null;

  return <CommandPalette open={open} onClose={() => setOpen(false)} role={role} />;
}
