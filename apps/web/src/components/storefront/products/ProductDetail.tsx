import type { CustomerFit, PublicAccessory, PublicBike, PublicSizeGuideEntry } from "@bw-bikes/shared";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { HomeBikeOfMonth } from "@/components/storefront/bike-of-month/HomeBikeOfMonth";
import { ProductBreadcrumbs, type ProductBreadcrumb } from "./ProductBreadcrumbs";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductOverview } from "./ProductOverview";
import { ProductSpecSheet } from "./ProductSpecSheet";
import { HomeBestSellingAccessories } from "./HomeBestSellingAccessories";
import { HomeNewProducts } from "./HomeNewProducts";

export interface ProductDetailProps {
  product: PublicBike | PublicAccessory;
  colorSwatchIndex: Map<string, PublicColorSwatch>;
  /** Bikes only — the accessory PDP never passes this, and `ProductInfo` treats an empty guide as "no data yet", not an error. */
  sizeGuide?: PublicSizeGuideEntry[];
  /** Categoría → subcategoría → producto, resuelto en la página vía `findCategoryAncestry`. Vacío si el árbol de categorías no cargó. */
  breadcrumbs?: ProductBreadcrumb[];
  /** El fit guardado del cliente (A4), si tiene sesión — ver `ProductInfoProps.fit`. */
  fit?: CustomerFit;
}

/**
 * La PDP completa. En escritorio, dos zonas apiladas verticalmente:
 *
 * 1. Una rejilla de dos columnas y dos filas — galería arriba a la izquierda,
 *    sección editorial (`ProductOverview`) debajo de ella, y el carril de
 *    compra ocupando ambas filas a la derecha.
 * 2. `ProductSpecSheet`, a todo lo ancho, fuera de esa rejilla — la ficha
 *    técnica no comparte columna con nada más, igual que en la referencia que
 *    Manuel trajo (Specialized/Cannondale). Esto significa que el carril de
 *    compra deja de estar pegado (`sticky`) una vez que el visitante llega a
 *    la ficha: es la contrapartida esperada de sacarla de la rejilla.
 *
 * El `lg:row-span-2` del carril es lo que lo mantiene pegajoso a lo largo de
 * las dos filas de la rejilla: un ítem `sticky` solo puede desplazarse dentro
 * de su área de rejilla, así que dejándolo en la fila 1 el carril se soltaría
 * justo al entrar la descripción. `top-16` es la altura del navbar fijo — la
 * convención única del repo para "pegado bajo la barra", igual que
 * `CatalogFilterSidebar`/`CatalogFilterDrawer`. `lg:items-start` on the grid
 * itself keeps the galería/overview column from stretching to match a taller
 * carril de compra — without it, CSS Grid's default `stretch` grows the
 * shorter non-spanning cells to fill the row track, leaving blank space
 * below their actual content.
 *
 * Bajo `lg` no hay lugar para dos columnas y los tres bloques de la rejilla
 * caen en el orden del DOM: fotos → carril de compra → descripción, que es
 * justo el orden que se quiere en móvil, sin necesidad de reordenar con
 * `order-*`. La ficha técnica sigue después, en el flujo normal.
 *
 * En móvil el que se queda pegado es el carrusel de fotos, no el carril:
 * `sticky top-16` bajo `lg`, `lg:static` desde ahí (en escritorio el pegajoso
 * sigue siendo el carril de compra, que ya cubre esa necesidad). No hace falta
 * ningún cálculo para soltarlo en la ficha técnica: un elemento `sticky` solo
 * se desplaza dentro de su bloque contenedor, y el de las fotos es este mismo
 * `div` de la rejilla, cuyo fondo termina justo donde empieza
 * `ProductSpecSheet`.
 *
 * Las tres clases que lo acompañan no son decorativas:
 * - `bg-blanco` — sin fondo propio, el carril de compra se vería a través de
 *   los huecos entre los marcos de las fotos al pasar por debajo.
 * - `z-10` — `RelatedAccessories` tiene un `relative` en la miniatura de cada
 *   accesorio; como está después en el árbol, sin este `z-10` esas miniaturas
 *   se pintarían encima de la foto pegajosa. Crea un contexto de apilamiento,
 *   y por eso `ProductGalleryLightbox` se monta en un portal (ver su nota).
 * - `pb-sm` — un respiro entre el borde inferior de los dots y el contenido
 *   que se desliza por debajo; el corte a ras leía como recorte, no como capa.
 *
 * Las tres secciones tras la ficha técnica (`HomeBestSellingAccessories`,
 * `HomeBikeOfMonth`, `HomeNewProducts`) son las mismas del home, sin envoltura
 * — van fuera del `div` con padding lateral a propósito, porque `PromoBanner`
 * y `ScrollRail` ya traen su propio espaciado interno pensado para ir de
 * extremo a extremo, igual que en el home.
 */
export function ProductDetail({ product, colorSwatchIndex, sizeGuide = [], breadcrumbs = [], fit }: ProductDetailProps) {
  return (
    <>
      <div className="bg-blanco px-lg pt-md pb-2xl sm:px-[clamp(2rem,8vw,8rem)]">
        <ProductBreadcrumbs crumbs={breadcrumbs} />
        <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-xl">
          <div className="sticky top-16 z-10 bg-blanco pb-sm lg:static lg:z-auto lg:col-start-1 lg:row-start-1 lg:pb-0">
            <ProductGallery images={product.gallery} productName={product.name} />
          </div>

          <div className="mt-lg lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
            <ProductInfo product={product} colorSwatchIndex={colorSwatchIndex} sizeGuide={sizeGuide} fit={fit} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2">
            <ProductOverview product={product} />
          </div>
        </div>

        <ProductSpecSheet product={product} />
      </div>

      <HomeBestSellingAccessories />
      <HomeBikeOfMonth />
      <HomeNewProducts />
    </>
  );
}
