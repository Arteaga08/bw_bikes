"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useId, useRef } from "react";
import { NavMegaMenuPanel } from "@/components/storefront/mega-menu/NavMegaMenuPanel";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { MegaMenuGroup } from "@/hooks/use-mega-menu-group";
import { cn } from "@/lib/cn";
import type { MegaMenuContent } from "@/lib/storefront-mega-menu";

export interface NavMegaMenuItemProps {
  label: string;
  href: string;
  isActive: boolean;
  tone: ButtonTone;
  content: MegaMenuContent;
  group: MegaMenuGroup;
}

/**
 * One `<li>` of the desktop nav: a disclosure trigger — `Button
 * variant="text"`, the same grammar the plain links used before, so the
 * grow-from-center underline and `active` "you are here" pin survive the
 * move from `<a>` to `<button>` — plus a floating panel.
 *
 * Reuses the disclosure contract `NavAccordionItem` already established for
 * the mobile drawer (`aria-expanded`/`aria-controls`, `inert` while closed)
 * instead of `components/ui/Menu.tsx`'s `role="menu"`: that semantics is for
 * action menus with roving-tabindex, not navigation with plain links.
 *
 * The panel lives as a DOM child of this `<li>` even though it renders
 * `fixed` elsewhere on screen — `mouseenter`/`mouseleave` on this `<li>` only
 * ever see one subtree, so `group.scheduleClose`'s grace period is what
 * actually carries the pointer across the visual gap, not DOM containment
 * alone.
 *
 * `inert` alone does not hide content — it only pulls it out of the tab
 * order and the accessibility tree, so a `fixed` panel left mounted while
 * collapsed stayed visually on screen (all three panels stacked on top of
 * each other at all times). The panel is only mounted at all while
 * `isExpanded`; the wrapper `id` stays so `aria-controls` always resolves to
 * something, even an empty one, while collapsed.
 */
export function NavMegaMenuItem({ label, href, isActive, tone, content, group }: NavMegaMenuItemProps) {
  const panelId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const isExpanded = group.openHref === href;

  useClickOutside(itemRef, () => {
    if (isExpanded) group.closeNow();
  });

  useEffect(() => {
    if (!isExpanded) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      group.closeNow();
      itemRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, group]);

  return (
    <li ref={itemRef} className="relative" onMouseEnter={() => group.openWithIntent(href)} onMouseLeave={() => group.scheduleClose()}>
      <Button
        variant="text"
        tone={tone}
        active={isActive || isExpanded}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => (isExpanded ? group.closeNow() : group.openNow(href))}
        iconRight={<CaretDown className={cn("transition-transform duration-150 ease-out-strong", isExpanded && "rotate-180")} />}
      >
        <span className="text-h3">{label}</span>
      </Button>

      <div id={panelId}>{isExpanded ? <NavMegaMenuPanel content={content} onNavigate={group.closeNow} /> : null}</div>
    </li>
  );
}
