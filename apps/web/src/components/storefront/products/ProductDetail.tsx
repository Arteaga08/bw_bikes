import type { PublicAccessory, PublicBike } from "@bw-bikes/shared";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductOverview } from "./ProductOverview";
import { ProductSpecSheet } from "./ProductSpecSheet";

export interface ProductDetailProps {
  product: PublicBike | PublicAccessory;
  colorSwatchIndex: Map<string, PublicColorSwatch>;
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
 * `CatalogFilterSidebar`/`CatalogFilterDrawer`.
 *
 * Bajo `lg` no hay lugar para dos columnas y los tres bloques de la rejilla
 * caen en el orden del DOM: fotos → carril de compra → descripción, que es
 * justo el orden que se quiere en móvil, sin necesidad de reordenar con
 * `order-*`. La ficha técnica sigue después, en el flujo normal.
 */
export function ProductDetail({ product, colorSwatchIndex }: ProductDetailProps) {
  return (
    <div className="bg-blanco px-lg pt-md pb-2xl sm:px-[clamp(2rem,8vw,8rem)]">
      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:gap-xl lg:pt-lg">
        <div className="lg:col-start-1 lg:row-start-1">
          <ProductGallery images={product.gallery} productName={product.name} />
        </div>

        <div className="mt-lg lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
          <ProductInfo product={product} colorSwatchIndex={colorSwatchIndex} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <ProductOverview product={product} />
        </div>
      </div>

      <ProductSpecSheet product={product} />
    </div>
  );
}
