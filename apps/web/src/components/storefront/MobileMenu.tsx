"use client";

import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { WhatsappLogo } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MenuToggleIcon } from "@/components/storefront/MenuToggleIcon";
import { NavAccordionItem } from "@/components/storefront/NavAccordionItem";
import { Button, buttonClasses, type ButtonTone } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SocialButton } from "@/components/ui/SocialButton";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BRAND_SOCIAL_LINKS, WHATSAPP_ADVISORY_URL } from "@/lib/brand-social";
import { cn } from "@/lib/cn";
import {
  buildAccessoryMegaMenuContent,
  buildBikeMegaMenuContent,
  buildOffersMegaMenuContent,
  type MegaMenuContent,
} from "@/lib/storefront-mega-menu";
import {
  isStorefrontNavItemActive,
  STOREFRONT_NAV_ITEMS,
} from "@/lib/storefront-nav";

export interface MobileMenuProps {
  /** Follows the navbar's own transparent/solid state — only the toggle button (sitting in the bar itself) needs this; the drawer panel is always a solid white surface regardless. */
  tone: ButtonTone;
  /** Root bike categories with their children resolved — drives the "Bicicletas" accordion. Empty (the default) degrades that item to a plain link, the same as any other nav item. */
  bikeCategories?: PublicCategoryTreeNode[];
  /** Same shape, accessory catalog — drives the "Accesorios" accordion. */
  accessoryCategories?: PublicCategoryTreeNode[];
  /** Active brands — feeds Bicicletas' "Comprar por marca" sub-list. */
  brands?: PublicBrand[];
}

/**
 * Off-canvas drawer for the three nav items, below `md` — the storefront's
 * own copy of `Sidebar`'s mobile pattern (focus trap, `Escape` to close,
 * scroll lock, `inert` while closed). No `MobileNavContext` here on
 * purpose: nothing else in this shell needs to know the drawer's open
 * state, unlike the admin panel where `TopBar` and `Sidebar` both react to
 * it. If a later entrega adds something that must close this drawer from
 * outside, lift the state into a context then — not before.
 *
 * `isBelowMd` (not a bare `md:hidden` wrapper) is what `Sidebar` uses to
 * scope its own `inert`, for the same reason here: without it, opening the
 * drawer on mobile and then resizing to desktop would leave `open` (and the
 * body scroll lock) stuck true with no visible way to close it, since the
 * toggle button itself would be CSS-hidden at that width.
 *
 * Enters from the **left**: the toggle button now lives in the navbar's
 * left column (alongside where the desktop nav sits), so the drawer opens
 * from the same edge it's triggered from.
 *
 * ## Apilamiento
 *
 * El toggle, el scrim y el panel son hermanos dentro del contexto de
 * apilamiento que crea el `<header>` (posicionado y con `z-30`), así que sus
 * z-index se resuelven entre ellos y ninguno puede escaparse por encima o por
 * debajo del header. El orden es scrim (30) → panel (40) → **toggle (50)**, y
 * ese último escalón es el que arregla el bug que motivó este rediseño: con el
 * toggle en `z-auto`, el panel se pintaba encima y tapaba la ✕ por completo.
 * El drawer se veía sin ningún control de cierre visible aunque el icono sí
 * estuviera renderizado.
 *
 * Dejar el toggle por encima también es lo que permite que sea *un solo*
 * elemento el que se transforma de ☰ a ✕ en su sitio. La alternativa —un
 * botón en la barra y otro dentro del panel— serían dos nodos distintos entre
 * los que no hay animación posible, solo un corte.
 */
export function MobileMenu({ tone, bikeCategories = [], accessoryCategories = [], brands = [] }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const menuContentByHref: Record<string, MegaMenuContent> = {
    "/bicicletas": buildBikeMegaMenuContent(bikeCategories, brands),
    "/accesorios": buildAccessoryMegaMenuContent(accessoryCategories),
    "/ofertas": buildOffersMegaMenuContent(),
  };
  // Tailwind's `md` breakpoint is 768px — "below md" is its exact complement.
  const isBelowMd = useMediaQuery("(max-width: 767px)");
  const isOpen = open && isBelowMd;

  // El toggle vive fuera del panel (tiene que seguir visible con el drawer
  // cerrado), así que se pasa explícitamente a la trampa de foco: sin eso, Tab
  // daría vueltas entre los enlaces sin llegar nunca a la ✕.
  useFocusTrap(panelRef, isOpen, toggleRef);

  // Closing on navigation is a direct consequence of the pathname changing,
  // not a sync with an external system — the same "adjust state during
  // render" pattern `MobileNavProvider` uses, not a `useEffect`.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <Button
        ref={toggleRef}
        variant="bare"
        // Con el drawer abierto el fondo detrás del botón es la superficie
        // blanca del panel, no el hero: un glifo `inverse` (blanco) sería
        // invisible justo cuando más se necesita.
        tone={isOpen ? "neutral" : tone}
        size="icon-lg"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="storefront-mobile-menu"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        className="relative z-50 hover:!text-dorado"
      >
        <MenuToggleIcon open={isOpen} />
      </Button>

      {isOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-negro/60"
        />
      ) : null}

      <div
        ref={panelRef}
        id="storefront-mobile-menu"
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="Menú de navegación"
        inert={!isOpen ? true : undefined}
        className={cn(
          // `border-r`, no sombra: la separación entre capas se lee por borde y
          // fondo (DESIGN.md §4, Flat-By-Default).
          "fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-3.5rem)] flex-col",
          "border-r border-borde bg-surface px-lg pb-lg",
          // Salida más rápida que la entrada: al abrir el usuario está mirando
          // el panel llegar, al cerrar ya decidió irse y esperar es fricción.
          "transition-transform",
          isOpen ? "translate-x-0 duration-[260ms] ease-drawer" : "-translate-x-full duration-200 ease-out-strong",
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
            const itemDelay = isOpen ? { transitionDelay: `${140 + index * 40}ms` } : undefined;

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
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 delay-0",
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
                  isOpen ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 delay-0",
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
    </div>
  );
}
