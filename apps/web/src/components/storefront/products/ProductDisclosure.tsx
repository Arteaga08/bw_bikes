"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ProductDisclosureProps {
  title: string;
  /**
   * El `id` del ancla que debe abrir esta fila al llegar en la URL. Sin él, la
   * fila solo responde al clic.
   */
  openOnHash?: string;
  children: ReactNode;
}

/**
 * Una fila de la ficha técnica: título a la izquierda, chevron a la derecha, y
 * el panel que se despliega debajo. Es la primitiva de la sección — la
 * componen `ProductSpecSheet` con "Especificaciones técnicas" y "Geometría".
 *
 * **La mecánica no es nueva:** es el mismo contrato que ya usan
 * `NavAccordionItem`, `CatalogFilterGroup` y `FooterLinkColumn` — animar
 * `grid-template-rows` de `0fr` a `1fr` sobre una rejilla de una sola fila
 * cuyo único hijo es `overflow-hidden`. Eso anima hasta la altura natural del
 * contenido sin medirla en JS (`1fr` de una rejilla de una fila *es* esa
 * altura) y sin tocar `height`, que es una propiedad de layout. Con hasta 20
 * apartados × 30 campos dentro, medir en JS sería justamente lo que no
 * queremos.
 *
 * **`inert` mientras está colapsada**, por la misma razón que allá: `0fr`
 * esconde el panel a la vista pero no saca su contenido del DOM, así que sin
 * `inert` el Tab caminaría por una ficha técnica invisible entre esta fila y
 * la siguiente.
 *
 * `openOnHash` existe por el enlace "Ver todas las especificaciones" de
 * `ProductSummaryCard`: las filas arrancan cerradas, pero un enlace que
 * promete mostrar la ficha y aterriza en una fila cerrada no cumple. Se evalúa
 * al montar (llegada directa con la URL ya con hash) y en `hashchange` (clic
 * en el enlace desde la misma página).
 *
 * Límite conocido: si el visitante abre la fila desde ese enlace, la cierra y
 * vuelve a hacer clic en el mismo enlace, el hash no cambia, no hay
 * `hashchange` y la fila no se reabre — solo hace scroll. Se acepta: el enlace
 * vive muy arriba en la página y el gesto es rebuscado.
 *
 * No se copia el `useLayoutEffect` de reset que trae `CatalogFilterGroup`:
 * aquel resuelve un requisito del bfcache del catálogo (volver "atrás" debe
 * encontrar los filtros frescos) que aquí no aplica.
 */
export function ProductDisclosure({ title, openOnHash, children }: ProductDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!openOnHash) return;

    const openWhenTargeted = () => {
      if (window.location.hash === `#${openOnHash}`) setExpanded(true);
    };

    openWhenTargeted();
    window.addEventListener("hashchange", openWhenTargeted);
    return () => window.removeEventListener("hashchange", openWhenTargeted);
  }, [openOnHash]);

  return (
    <div className="border-b border-borde">
      {/*
        El botón va dentro del encabezado, no al revés: el patrón de disclosure
        pide `<h2><button></h2>` para que el título siga apareciendo en la lista
        de encabezados del lector de pantalla aunque sea interactivo.
      */}
      <h2>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-md py-lg text-left text-negro sm:py-xl"
        >
          <span className="font-display text-h2">{title}</span>
          <CaretDown
            aria-hidden="true"
            size={24}
            className={cn("shrink-0 transition-transform duration-200 ease-out-strong", expanded && "rotate-180")}
          />
        </button>
      </h2>

      <div
        id={panelId}
        inert={!expanded ? true : undefined}
        className="grid transition-[grid-template-rows] duration-200 ease-out-strong"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pb-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
