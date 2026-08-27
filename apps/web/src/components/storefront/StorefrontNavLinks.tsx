"use client";

import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { usePathname } from "next/navigation";
import { NavMegaMenuItem } from "@/components/storefront/mega-menu/NavMegaMenuItem";
import type { ButtonTone } from "@/components/ui/Button";
import { useMegaMenuGroup } from "@/hooks/use-mega-menu-group";
import {
  buildAccessoryMegaMenuContent,
  buildBikeMegaMenuContent,
  buildOffersMegaMenuContent,
  type MegaMenuContent,
} from "@/lib/storefront-mega-menu";
import { isStorefrontNavItemActive, STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";

export interface StorefrontNavLinksProps {
  /** Follows the navbar's own transparent/solid state — `inverse` over the hero, `neutral` once scrolled. */
  tone: ButtonTone;
  bikeCategories?: PublicCategoryTreeNode[];
  accessoryCategories?: PublicCategoryTreeNode[];
  brands?: PublicBrand[];
}

/**
 * The desktop nav list (`md:` up). Each destination is a mega-menu
 * disclosure (`NavMegaMenuItem`) instead of a plain `ButtonLink` — see
 * `lib/storefront-mega-menu.ts` for what each of the three shows. `group`
 * (one `useMegaMenuGroup()` per render, shared by every item) is what
 * guarantees only one panel is open at a time.
 */
export function StorefrontNavLinks({ tone, bikeCategories = [], accessoryCategories = [], brands = [] }: StorefrontNavLinksProps) {
  const pathname = usePathname();
  const group = useMegaMenuGroup();

  const contentByHref: Record<string, MegaMenuContent> = {
    "/bicicletas": buildBikeMegaMenuContent(bikeCategories, brands),
    "/accesorios": buildAccessoryMegaMenuContent(accessoryCategories),
    "/ofertas": buildOffersMegaMenuContent(),
  };

  return (
    <ul className="flex items-center gap-xl">
      {STOREFRONT_NAV_ITEMS.map((item) => {
        const isActive = isStorefrontNavItemActive(pathname, item.href);
        const content = contentByHref[item.href];
        if (!content) return null;

        return (
          <NavMegaMenuItem
            key={item.href}
            label={item.label}
            href={item.href}
            isActive={isActive}
            tone={tone}
            content={content}
            group={group}
          />
        );
      })}
    </ul>
  );
}
