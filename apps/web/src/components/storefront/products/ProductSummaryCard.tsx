import type { SummaryRow } from "@bw-bikes/shared";
import { ArrowDown } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { PRODUCT_SPECS_ANCHOR } from "./product-anchors";

export interface ProductSummaryCardProps {
  rows: SummaryRow[];
  /**
   * Si hay una ficha técnica a la que enlazar. Sin ella, "Ver todas las
   * especificaciones ↓" apuntaría a una sección que `ProductSpecSheet` no
   * llegó a renderizar — el mismo ancla-rota que este enlace tuvo antes de
   * que esa sección existiera, solo que ahora por falta de datos en vez de
   * por falta de componente.
   */
  hasSpecSheet: boolean;
}

/**
 * Los renglones que la tarjeta realmente pinta, en orden. Exportada porque
 * `ProductOverview` necesita saber *antes* de renderizar si va a haber
 * tarjeta: un componente que devuelve `null` sigue siendo un elemento JSX
 * verdadero para quien lo crea, así que el layout no puede decidirse mirando
 * `<ProductSummaryCard />`.
 *
 * Un renglón con `label` o `value` en blanco se descarta en vez de pintarse
 * vacío: `SummaryRow` no tiene bandera `visible` propia (a diferencia de
 * `SpecField`), así que dejarlo a medias es la única forma que tiene el admin
 * de dejar uno sin terminar.
 */
export function visibleSummaryRows(rows: SummaryRow[]): SummaryRow[] {
  return rows
    .filter((row) => row.label.trim() !== "" && row.value.trim() !== "")
    .sort((a, b) => a.order - b.order);
}

/**
 * La tarjeta "En pocas palabras": el resumen curado a mano que el admin
 * escribe en `SummaryEditor`, hasta `MAX_SUMMARY_ROWS` (6) renglones.
 *
 * **Sin filete bajo cada renglón.** Un hairline por fila es el reflejo
 * automático para una ficha de specs y satura una tarjeta de seis renglones;
 * aquí los pares se agrupan por proximidad (label de 11px pegado a su valor
 * de 16px, 24px de aire entre pares) y las dos únicas reglas horizontales son
 * estructurales: bajo el encabezado y sobre el enlace. Es la misma consigna
 * del sistema — "jerarquía por espacio y contraste, nunca por adorno"
 * (`handoff/DESIGN_SYSTEM.md` §1).
 *
 * Bikes only by data — `summary` lives on `PublicBike`, never on
 * `PublicAccessory` — so it returns `null` on an empty list rather than
 * leaving an empty card behind; `ProductOverview` uses `visibleSummaryRows`
 * to collapse to a single column in that case.
 */
export function ProductSummaryCard({ rows, hasSpecSheet }: ProductSummaryCardProps) {
  const visibleRows = visibleSummaryRows(rows);

  if (visibleRows.length === 0) return null;

  return (
    <aside className="rounded-card bg-inset p-lg sm:p-xl">
      {/*
        El rinoceronte al lado del H3, 16px dorado: la misma firma y el mismo
        tamaño que `ProductInfo` usa junto al eyebrow de marca y que lleva
        cada `CatalogProductCard`, para que las dos marcas de la ficha se lean
        como hermanas y no como dos tratamientos distintos.
      */}
      <div className="flex items-center gap-sm border-b border-borde pb-md">
        <Image src="/brand/rhino-dorado.svg" alt="" aria-hidden="true" width={16} height={7} className="shrink-0" />
        <h3 className="font-display text-h3 text-negro">En pocas palabras</h3>
      </div>

      <dl className="mt-lg grid gap-lg">
        {visibleRows.map((row) => (
          <div key={`${row.order}-${row.label}`}>
            <dt className="font-body text-eyebrow uppercase text-grafito">{row.label}</dt>
            <dd className="mt-xs font-body text-body-l text-negro">{row.value}</dd>
          </div>
        ))}
      </dl>

      {hasSpecSheet ? (
        <a
          href={`#${PRODUCT_SPECS_ANCHOR}`}
          className="group mt-xl flex items-center gap-xs border-t border-borde pt-md font-ui text-ui text-negro transition-colors duration-150 hover:text-grafito"
        >
          Ver todas las especificaciones
          {/* La flecha baja 2px al hover: señala hacia dónde lleva el enlace, no es adorno. */}
          <ArrowDown
            size={14}
            weight="regular"
            aria-hidden="true"
            className="shrink-0 transition-transform duration-150 group-hover:translate-y-[2px]"
          />
        </a>
      ) : null}
    </aside>
  );
}
