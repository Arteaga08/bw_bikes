import type { PublicAccessory, PublicBike } from "@bw-bikes/shared";
import { stripBrandFromName } from "./product-name";
import { PRODUCT_SPECS_ANCHOR } from "./product-anchors";
import { ProductDisclosure } from "./ProductDisclosure";
import { ProductGeometryImage } from "./ProductGeometryImage";
import { ProductSpecGroups } from "./ProductSpecGroups";

export interface ProductSpecSheetProps {
  product: PublicBike | PublicAccessory;
}

/**
 * La ficha técnica completa: bajo el Resumen, a todo lo ancho de la página
 * (fuera de la rejilla de dos columnas que el carril de compra comparte con
 * la galería/overview) — es el mismo criterio de la referencia que Manuel
 * trajo (Specialized/Cannondale), donde la ficha ya no comparte columna con
 * nada más.
 *
 * Dos filas hermanas, sin un h2 contenedor por encima: "Especificaciones
 * técnicas" (los `specGroups` libres que el admin arma por producto) y
 * "Geometría" (`bike.geometryImage`, subida desde `ProductEditor` pero nunca
 * antes pintada en la tienda). Cada una es su propio encabezado — así lee la
 * referencia y así lo pide `ProductDisclosure`.
 *
 * `PRODUCT_SPECS_ANCHOR` es el destino de "Ver todas las especificaciones ↓"
 * en `ProductSummaryCard`: antes de este componente ese enlace no llevaba a
 * ningún lado (ver el doc comment de `product-anchors.ts`). `openOnHash`
 * hace que la fila se abra sola cuando se llega por ese enlace, en vez de
 * dejar al visitante frente a un título cerrado.
 *
 * Server component — `specGroups` nunca cruza al bundle del cliente. Solo
 * `ProductDisclosure` es `"use client"`, y recibe el contenido ya renderizado
 * como `children`.
 */
export function ProductSpecSheet({ product }: ProductSpecSheetProps) {
  const specGroups = product.specGroups;
  const hasSpecs = specGroups.length > 0;
  const geometryImage = "geometryImage" in product ? product.geometryImage : undefined;

  if (!hasSpecs && !geometryImage) return null;

  return (
    <section id={PRODUCT_SPECS_ANCHOR} aria-label="Ficha técnica" className="mt-2xl scroll-mt-16 border-t border-borde">
      {hasSpecs ? (
        <ProductDisclosure title="Especificaciones técnicas" openOnHash={PRODUCT_SPECS_ANCHOR}>
          <ProductSpecGroups groups={specGroups} />
        </ProductDisclosure>
      ) : null}

      {geometryImage ? (
        <ProductDisclosure title="Geometría">
          <ProductGeometryImage image={geometryImage} productName={stripBrandFromName(product.name, product.brand.name)} />
        </ProductDisclosure>
      ) : null}
    </section>
  );
}
