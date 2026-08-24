"use client";

import { DotsThreeVertical } from "@phosphor-icons/react";
import type { KeyboardEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "./Button";

export interface MenuItem {
  label: string;
  onClick: () => void;
}

export interface MenuProps {
  items: MenuItem[];
  /** Label for the default "···" trigger — ignored when `trigger` is passed, since that override owns its own accessible name. */
  ariaLabel?: string;
  /** Overrides the default kebab trigger — e.g. TopBar's account avatar. `Menu` still owns the click handling and ARIA wiring around it. */
  trigger?: ReactNode;
  /** Non-interactive content above the item list, inside the same floating panel — e.g. the account menu's name/email/role block. */
  header?: ReactNode;
}

/**
 * A minimal action menu — trigger + a short floating list, closing on an
 * outside click or `Escape`. The project has no floating-position library
 * (see `HelpPopover`'s own doc comment), so this anchors the same way
 * `Combobox`'s listbox does: a `relative` wrapper plus `absolute top-full`.
 *
 * Default trigger is a kebab, meant for a row action that doesn't fit beside
 * the row's other icon buttons — most rows should stay flat, not gain a menu
 * by default. `trigger`/`header` exist for the other call sites this same
 * floating-panel mechanism suits: shell chrome like an account menu, where
 * the trigger is an avatar rather than a kebab and the panel needs an
 * identity block above the actions.
 */
export function Menu({ items, ariaLabel = "Más acciones", trigger, header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {trigger ? (
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(buttonClasses({ variant: "bare", size: "icon" }), "p-0")}
        >
          {trigger}
        </button>
      ) : (
        <Button variant="bare" size="icon" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
        </Button>
      )}
      {open ? (
        <div className="absolute top-full right-0 z-10 mt-xs min-w-max rounded-card border border-borde bg-surface p-xs">
          {header ? <div className="border-b border-borde px-sm py-sm">{header}</div> : null}
          <ul role="menu">
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "w-full whitespace-nowrap rounded-control px-sm py-sm text-left font-body text-body text-negro",
                    "transition-colors duration-150 hover:bg-base",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
