"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** Closes on a `mousedown` outside `ref`'s subtree — same pattern `Combobox` inlines, extracted here for its second caller (`Menu`). */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onOutside]);
}
