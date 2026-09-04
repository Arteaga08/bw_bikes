"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import type { MegaMenuSection } from "@/lib/storefront-mega-menu";

export interface NavAccordionItemProps {
  label: string;
  href: string;
  isActive: boolean;
  /** `[]` renders the CTA row alone, no sub-list — the "Ofertas" case. */
  sections: MegaMenuSection[];
  /** Defaults to "Ver todas" — Ofertas passes its own ("Rebajas de bicis y accesorios"). */
  ctaLabel?: string;
  currentPathname: string;
}

/**
 * A nav row that expands in place instead of navigating — the mobile
 * drawer's version of `Cube`'s "Bicicletas ⌄" row. Now shared by all three
 * nav items (Bicicletas, Accesorios, Ofertas), each passing its own
 * `sections`/`ctaLabel` from `lib/storefront-mega-menu.ts` — the same
 * builders the desktop mega-menu (`NavMegaMenuPanel`) consumes, so neither
 * surface can drift from the other on what it shows or where a link goes.
 *
 * `sections.length`:
 * - `2` (Bicicletas: categorías + marcas) — each section renders its own
 *   `title` as a non-interactive label before its list.
 * - `1` (Accesorios) — no title rendered, identical to the original
 *   single-list layout.
 * - `0` (Ofertas) — no sub-list at all, just the CTA row. The caret/expand
 *   affordance stays for grammar consistency across the three, even though
 *   opening it only reveals one row.
 *
 * **`grid-template-rows`, not `height`** (per the brand motion guidance:
 * animate `grid-template-rows` for collapsing sections, not `height`) — `0fr`
 * collapsed, `1fr` expanded, on a wrapper whose only child is
 * `overflow-hidden`. This is the trick that animates to/from `auto` height
 * without measuring the content in JS: `1fr` of a single-row grid always
 * equals the content's natural height.
 *
 * **`inert` while collapsed**, the same device `MobileMenu`'s own panel uses
 * for the same reason: `grid-template-rows: 0fr` hides the sub-list visually
 * but doesn't remove its links from the DOM, so without `inert` Tab would
 * walk through invisible category links between "Bicicletas" and
 * "Accesorios".
 */
export function NavAccordionItem({ label, href, isActive, sections, ctaLabel = "Ver todas", currentPathname }: NavAccordionItemProps) {
  // Starts open when the visitor is already inside this section — arriving on
  // `/bicicletas/carretera` and finding "Bicicletas" collapsed would hide the
  // very breadcrumb that explains where they are.
  const [expanded, setExpanded] = useState(isActive);
  const panelId = `${href.replace(/\//g, "")}-subcategorias`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-sm py-1 text-left text-negro"
      >
        <span className="text-h2">{label}</span>
        <CaretDown
          aria-hidden="true"
          size={20}
          className={cn("shrink-0 transition-transform duration-200 ease-out-strong", expanded && "rotate-180")}
        />
      </button>

      <div
        id={panelId}
        inert={!expanded ? true : undefined}
        className="grid transition-[grid-template-rows] duration-200 ease-out-strong"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-lg py-sm pl-md">
            <ul>
              <li>
                {/* La única fila del acordeón que navega al padre directamente —
                    sin esto, "ver todas" desaparecería detrás del toggle. */}
                <ButtonLink href={href} variant="text" tone="neutral" active={isActive && currentPathname === href}>
                  <span className="text-body-l">{ctaLabel}</span>
                </ButtonLink>
              </li>
            </ul>

            {sections
              .filter((section) => section.items.length > 0)
              .map((section, index) => (
              <div key={section.title ?? index}>
                {section.title ? <p className="mb-xs text-eyebrow uppercase text-grafito">{section.title}</p> : null}
                <ul className="flex flex-col gap-xs">
                  {section.items.map((item) => {
                    const itemIsActive = currentPathname === item.href;
                    return (
                      <li key={item.id}>
                        <ButtonLink
                          href={item.href}
                          variant="text"
                          tone="neutral"
                          active={itemIsActive}
                          aria-current={itemIsActive ? "page" : undefined}
                        >
                          <span className="text-body-l">{item.name}</span>
                        </ButtonLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
