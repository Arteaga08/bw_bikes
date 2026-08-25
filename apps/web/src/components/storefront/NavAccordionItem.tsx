"use client";

import type { PublicCategory, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";

export interface NavAccordionItemProps {
  label: string;
  href: string;
  isActive: boolean;
  categories: PublicCategoryTreeNode[];
  currentPathname: string;
}

/**
 * A nav row that expands in place instead of navigating — the mobile
 * drawer's version of `Cube`'s "Bicicletas ⌄" row. Built for one caller
 * today (`MobileMenu`'s "Bicicletas" item, gated on real category data), but
 * shaped generically because "Accesorios" gets the identical treatment the
 * moment a second entrega asks for it — same public `/tree` endpoint shape,
 * same component.
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
export function NavAccordionItem({ label, href, isActive, categories, currentPathname }: NavAccordionItemProps) {
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
          <ul className="flex flex-col gap-xs py-sm pl-md">
            <li>
              {/* La única fila del acordeón que navega al padre directamente —
                  sin esto, "ver todas" desaparecería detrás del toggle. */}
              <ButtonLink href={href} variant="text" tone="neutral" active={isActive && currentPathname === href}>
                <span className="text-body-l">Ver todas</span>
              </ButtonLink>
            </li>
            {categories.map((category) => (
              <NavAccordionSubLink key={category.id} category={category} parentHref={href} currentPathname={currentPathname} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function NavAccordionSubLink({
  category,
  parentHref,
  currentPathname,
}: {
  category: PublicCategory;
  parentHref: string;
  currentPathname: string;
}) {
  // `/bicicletas/:slug`, mirroring the public `/bike-categories/:slug` route
  // shape — the same "404 until the route ships" precedent `storefront-nav.ts`
  // already documents for `/bicicletas` itself.
  const categoryHref = `${parentHref}/${category.slug}`;
  const isActive = currentPathname === categoryHref || currentPathname.startsWith(`${categoryHref}/`);

  return (
    <li>
      <ButtonLink href={categoryHref} variant="text" tone="neutral" active={isActive} aria-current={isActive ? "page" : undefined}>
        <span className="text-body-l">{category.name}</span>
      </ButtonLink>
    </li>
  );
}
