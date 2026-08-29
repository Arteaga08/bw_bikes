import type { PublicAccessory, PublicBike } from "@bw-bikes/shared";
import { PRODUCT_OVERVIEW_ANCHOR } from "./product-anchors";
import { stripBrandFromName } from "./product-name";
import { ProductSummaryCard, visibleSummaryRows } from "./ProductSummaryCard";

export interface ProductOverviewProps {
  product: PublicBike | PublicAccessory;
}

const TITLE_ID = `${PRODUCT_OVERVIEW_ANCHOR}-titulo`;

/**
 * La sección editorial bajo la galería: título y descripción completa a la
 * izquierda, la tarjeta "En pocas palabras" a la derecha. Es el texto largo
 * de la ficha — el carril lateral solo muestra el teaser recortado y manda
 * aquí. Server component: no hay nada interactivo.
 *
 * **Escalones de tamaño, de arriba abajo:** el nombre del producto vive dos
 * veces en la misma pantalla (el H1 del carril y este H2), así que no pueden
 * pesar igual. El carril se queda con `text-h2` (30px/800) como título
 * dominante de la página y este baja a `text-h3` (20px/500), el mismo peldaño
 * que el "En pocas palabras" de la tarjeta: los dos se leen como encabezados
 * de sección hermanos, no como un segundo título compitiendo con el primero.
 * De ahí para abajo, 16px para la descripción y 11px para los labels de la
 * tarjeta — cada salto por encima de 1.25×.
 *
 * El `shortDescription` **no se repite aquí**: es exactamente la misma cadena
 * que el carril ya muestra a unos centímetros, y verla dos veces se lee como
 * un copiar y pegar. El papel de "resumen" en esta sección lo cumple la
 * tarjeta, que es literalmente el campo `summary`.
 *
 * `scroll-mt-16` porque el navbar es `fixed ... h-16` (`Navbar.tsx`): sin ese
 * margen de scroll, saltar desde "Leer más" deja el título tapado debajo de
 * la barra. Misma convención `top-16`/`h-16` que ya usan `ProductDetail` y
 * `CatalogFilterSidebar`.
 *
 * Los accesorios no tienen `summary` (`PublicAccessory` es solo
 * `PublicProductBase`), así que su sección degrada sola a una columna con
 * título y descripción — de ahí que la rejilla de dos columnas se aplique
 * solo cuando hay tarjeta que poner en la segunda.
 */
export function ProductOverview({ product }: ProductOverviewProps) {
  const summaryRows = "summary" in product ? visibleSummaryRows(product.summary) : [];
  const hasSummary = summaryRows.length > 0;

  return (
    <section
      id={PRODUCT_OVERVIEW_ANCHOR}
      aria-labelledby={TITLE_ID}
      className={
        hasSummary
          ? "mt-2xl scroll-mt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-2xl"
          : "mt-2xl scroll-mt-16"
      }
    >
      <div>
        <h2 id={TITLE_ID} className="font-display text-h3 text-negro">
          {stripBrandFromName(product.name, product.brand.name)}
        </h2>

        {/*
          `description` es texto plano: no hay pipeline de rich text en ningún
          punto del modelo, así que los saltos de línea manuales se respetan
          con `whitespace-pre-line` y nunca se renderiza como HTML. El tope de
          68ch mantiene la medida de lectura aunque la columna crezca en
          pantallas anchas.
        */}
        <p className="mt-md max-w-[68ch] whitespace-pre-line font-body text-body-l text-grafito">
          {product.description}
        </p>
      </div>

      {hasSummary ? (
        <div className="mt-xl lg:mt-0">
          <ProductSummaryCard rows={summaryRows} hasSpecSheet={product.specGroups.length > 0} />
        </div>
      ) : null}
    </section>
  );
}
