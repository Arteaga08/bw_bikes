"use client";

import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { WhatsappLogo } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { NavAccordionItem } from "@/components/storefront/NavAccordionItem";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SocialButton } from "@/components/ui/SocialButton";
import { BRAND_SOCIAL_LINKS, WHATSAPP_ADVISORY_URL } from "@/lib/brand-social";
import { cn } from "@/lib/cn";
import {
  buildAccessoryMegaMenuContent,
  buildBikeMegaMenuContent,
  buildOffersMegaMenuContent,
  type MegaMenuContent,
} from "@/lib/storefront-mega-menu";
import { isStorefrontNavItemActive, STOREFRONT_NAV_ITEMS } from "@/lib/storefront-nav";

export interface MobileMenuPanelProps {
  /** Drives both the scrim and the drawer's `translate-x` — see `MobileMenu` for why this panel is mounted (closed) ahead of the first open instead of on it. */
  open: boolean;
  onClose: () => void;
  /** Owned by `MobileMenu` so its `useFocusTrap` keeps working whether or not this chunk has loaded yet. */
  panelRef: RefObject<HTMLDivElement | null>;
  bikeCategories?: PublicCategoryTreeNode[];
  accessoryCategories?: PublicCategoryTreeNode[];
  brands?: PublicBrand[];
}

/**
 * Everything of `MobileMenu` that isn't the toggle button: the scrim, the
 * drawer panel and the accordion tree it renders.
 *
 * Split out of `MobileMenu` so it can be `next/dynamic`'d — it was the single
 * heaviest client component on *every* public route (a drawer that only ever
 * renders below `md`, and only after a tap), and it drags
 * `lib/storefront-mega-menu`, `NavAccordionItem`, `SocialButton` and the
 * brand-social table in with it. The toggle stays behind in `MobileMenu`
 * because it has to be in the bar on first paint.
 */
export function MobileMenuPanel({
  open,
  onClose,
  panelRef,
  bikeCategories = [],
  accessoryCategories = [],
  brands = [],
}: MobileMenuPanelProps) {
  const pathname = usePathname();

  const menuContentByHref: Record<string, MegaMenuContent> = {
    "/bicicletas": buildBikeMegaMenuContent(bikeCategories, brands),
    "/accesorios": buildAccessoryMegaMenuContent(accessoryCategories),
    "/ofertas": buildOffersMegaMenuContent(),
  };

  return (
    <>
      {open ? (
        <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-negro/60" />
      ) : null}

      <div
        ref={panelRef}
        id="storefront-mobile-menu"
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Menú de navegación"
        inert={!open ? true : undefined}
        className={cn(
          // `border-r`, no sombra: la separación entre capas se lee por borde y
          // fondo (DESIGN.md §4, Flat-By-Default).
          "fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-3.5rem)] flex-col",
          "border-r border-borde bg-surface px-lg pb-lg",
          // Salida más rápida que la entrada: al abrir el usuario está mirando
          // el panel llegar, al cerrar ya decidió irse y esperar es fricción.
          "transition-transform",
          open ? "translate-x-0 duration-[260ms] ease-drawer" : "-translate-x-full duration-200 ease-out-strong",
        )}
      >
        {/* Fila de cabecera, del mismo alto (64px) que la barra de navegación —
            el toggle flota encima a la izquierda (z-50, fuera de este árbol);
            este lockup ocupa el lado opuesto, el mismo par "logo ↔ cerrar" que
            la referencia de Cube, reflejado porque este drawer abre desde la
            izquierda y el suyo desde la derecha. Antes esta franja era
            padding-top vacío reservando el espacio para el toggle; ahora el
            propio lockup empuja el `<ul>` hacia abajo en el flujo normal, sin
            necesidad de un negative margin para "reocupar" el hueco. */}
        <Link
          href="/"
          aria-label="Black and White Bikes — inicio"
          className="flex h-16 shrink-0 items-center justify-end gap-xs"
        >
          {/* 20px, igualado al `text-h3` que acompaña — nunca supera la altura
              del texto (DESIGN_SYSTEM.md §5). Segunda aparición del
              rinoceronte en esta vista junto con la firma del pie; el drawer
              abierto cuenta como su propia vista, así que dos es el máximo, no
              un exceso. */}
          <Image src="/brand/rhino-dorado.svg" alt="" width={20} height={9} aria-hidden="true" />
          <span className="font-display text-h3 tracking-tight text-negro">B/W</span>
        </Link>

        {/* Sin `<nav>` envolvente: el `role="dialog"` de arriba ya está
            etiquetado "Menú de navegación", y un segundo landmark con el mismo
            nombre que el nav de escritorio produciría dos "Navegación
            principal" en el árbol de accesibilidad. */}
        <ul className="mt-md flex flex-col gap-md">
          {STOREFRONT_NAV_ITEMS.map((item, index) => {
            const isActive = isStorefrontNavItemActive(pathname, item.href);
            const itemDelay = open ? { transitionDelay: `${140 + index * 40}ms` } : undefined;

            // Los tres items llevan acordeón. Ofertas nunca depende de fetch
            // (su contenido es estático), así que nunca degrada; Bicicletas y
            // Accesorios sí caen a enlace plano si su árbol viene vacío o el
            // fetch falló — nunca un acordeón vacío.
            const menuContent = menuContentByHref[item.href];
            const hasAccordionData =
              item.href === "/ofertas" || (menuContent?.sections.some((section) => section.items.length > 0) ?? false);

            if (menuContent && hasAccordionData) {
              return (
                <li
                  key={item.href}
                  className={cn(
                    "transition-[opacity,transform] duration-200 ease-out-strong",
                    open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 delay-0",
                  )}
                  style={itemDelay}
                >
                  <NavAccordionItem
                    label={item.label}
                    href={item.href}
                    isActive={isActive}
                    sections={menuContent.sections}
                    ctaLabel={menuContent.ctaLabel}
                    currentPathname={pathname}
                  />
                </li>
              );
            }

            return (
              <li
                key={item.href}
                className={cn(
                  "transition-[opacity,transform] duration-200 ease-out-strong",
                  // El stagger solo corre al abrir: escalonar la salida
                  // dejaría el último enlace visible sobre un panel que ya se
                  // fue. Al cerrar todos salen a la vez, sin delay.
                  open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 delay-0",
                )}
                style={itemDelay}
              >
                {/* Always `tone="neutral"`: the drawer's own surface is solid white regardless of the navbar's transparent/solid state above it. */}
                <ButtonLink
                  href={item.href}
                  variant="text"
                  tone="neutral"
                  active={isActive}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* `text-h2` en un span hijo, no en el `<a>`: `text`'s base
                      classes ya fijan `text-ui` ahí y dos utilidades de
                      font-size sin prefijo sobre el mismo elemento se
                      resuelven por orden de CSS generado (ver `lib/cn.ts`). */}
                  <span className="text-h2">{item.label}</span>
                </ButtonLink>
              </li>
            );
          })}
        </ul>

        {/* `mt-auto` empuja el remate al pie: el menú respira arriba y la marca
            cierra abajo, en vez de un bloque de contenido flotando a media
            altura con espacio muerto debajo. */}
        <div className="mt-auto flex flex-col gap-lg border-t border-borde pt-lg">
          {/* Único elemento dorado del panel — One Accent Rule (DESIGN.md §2).
              `<a>` plano con `buttonClasses()`, no `ButtonLink`: esto sale de la
              app, y un `next/link` haría prefetch de un origen de terceros. Es
              el mismo criterio que ya aplica `SocialButton`. */}
          <a
            href={WHATSAPP_ADVISORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClasses({ variant: "primary", size: "md" }), "w-full")}
          >
            <WhatsappLogo aria-hidden="true" size={18} />
            Asesoría por WhatsApp
          </a>

          <ul className="flex items-center justify-center gap-md">
            {BRAND_SOCIAL_LINKS.map((link) => (
              <li key={link.network}>
                <SocialButton network={link.network} href={link.href} tone="neutral" size="icon-lg" />
              </li>
            ))}
          </ul>

          {/* Firma de marca: segunda y última aparición del rinoceronte en esta
              vista (la primera es el lockup de la cabecera) — 16px, dorado,
              junto a un label, dentro del rango 12–28px y en uno de los usos
              que el spec permite (DESIGN_SYSTEM.md §5). No es decoración
              suelta ni marca de agua. */}
          <p className="flex items-center justify-center gap-sm text-eyebrow uppercase text-grafito">
            <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
            Black and White Bikes
          </p>
        </div>
      </div>
    </>
  );
}
