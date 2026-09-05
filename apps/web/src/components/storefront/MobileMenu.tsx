"use client";

import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MenuToggleIcon } from "@/components/storefront/MenuToggleIcon";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useIdleMount } from "@/hooks/use-idle-mount";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The drawer itself — everything except the toggle button — loads in its own
 * chunk. `ssr: false` because it never renders on the server anyway: `isOpen`
 * depends on `useMediaQuery`, whose server snapshot is `false`.
 */
const MobileMenuPanel = dynamic(() => import("./MobileMenuPanel").then((mod) => mod.MobileMenuPanel), {
  ssr: false,
});

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
 * ## Carga diferida
 *
 * Solo el toggle viaja en el bundle inicial; `MobileMenuPanel` llega en su
 * propio chunk. **Se monta cerrado en cuanto el navegador está ocioso**
 * (`useIdleMount`), no al abrir: montarlo recién abierto haría que su primer
 * pintado *fuera* el estado abierto, dejando la transición `translate-x` sin
 * un estado del que partir — el drawer aparecería de golpe en vez de entrar
 * deslizándose. Montarlo cerrado y esperar preserva la animación intacta y
 * aun así saca ~14 KB del arranque de **todas** las rutas públicas. En
 * escritorio (`isBelowMd` falso) el chunk no se descarga nunca.
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

  // Tailwind's `md` breakpoint is 768px — "below md" is its exact complement.
  const isBelowMd = useMediaQuery("(max-width: 767px)");
  const isOpen = open && isBelowMd;

  // `mountPanelNow` cubre al usuario que toca (o tabula hasta) el botón antes
  // de que el navegador haya tenido un momento ocioso: sin él, ese primer tap
  // no tendría panel que abrir.
  const [panelMounted, mountPanelNow] = useIdleMount(isBelowMd);

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
        onClick={() => {
          mountPanelNow();
          setOpen((current) => !current);
        }}
        onFocus={mountPanelNow}
        aria-expanded={isOpen}
        aria-controls="storefront-mobile-menu"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        className="relative z-50 hover:!text-dorado"
      >
        <MenuToggleIcon open={isOpen} />
      </Button>

      {panelMounted ? (
        <MobileMenuPanel
          open={isOpen}
          onClose={() => setOpen(false)}
          panelRef={panelRef}
          bikeCategories={bikeCategories}
          accessoryCategories={accessoryCategories}
          brands={brands}
        />
      ) : null}
    </div>
  );
}
