"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/cn";
import { NAV_ITEMS_FLAT } from "@/lib/nav";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The heavy half of the command palette — only imported once the wrapper's
 * dynamic `import()` fires on first open (DASHBOARD_GUIDELINES.md §2).
 * Search by label + keywords; arrow keys move selection, Enter navigates,
 * Escape closes.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useFocusTrap(containerRef, open);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return NAV_ITEMS_FLAT;
    return NAV_ITEMS_FLAT.filter(
      (item) => item.label.toLowerCase().includes(term) || item.keywords.some((k) => k.includes(term)),
    );
  }, [query]);

  // Both adjustments below use React's "set state during render" pattern
  // (react-hooks/set-state-in-effect) instead of an Effect — neither
  // synchronizes with an external system, they're direct consequences of a
  // prop/state change.

  // Fresh palette every time it opens: clears whatever was typed last time.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setQuery("");
  }

  // Selection always snaps back to the top result set as the query changes.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  function go(href: string): void {
    onClose();
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target.href);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-negro/60 p-md pt-3xl"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-dialog rounded-card-lg bg-surface p-md"
      >
        <div className="flex items-center gap-sm border-b border-borde pb-sm">
          <MagnifyingGlass size={18} className="text-grafito" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sección…"
            aria-label="Buscar sección"
            className="w-full font-body text-body text-negro outline-none placeholder:text-grafito"
          />
        </div>
        <ul role="listbox" className="mt-sm flex max-h-80 flex-col gap-xs overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-sm py-md font-body text-body text-grafito">Sin resultados.</li>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => go(item.href)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-sm rounded-control px-sm py-sm text-left font-ui text-ui transition-colors duration-150",
                      index === activeIndex ? "bg-base text-negro" : "text-grafito",
                    )}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
