import type { CategoryImage } from "@bw-bikes/shared";
import Image from "next/image";

export interface ProductGeometryImageProps {
  image: CategoryImage;
  productName: string;
}

/**
 * El contenido de la fila "Geometría": la tabla de medidas que el admin sube
 * como una sola imagen (`bike.geometryImage`, `ProductEditor.tsx`). Hasta
 * ahora se guardaba pero nunca se pintaba en la tienda — esta es la primera
 * vez que un visitante puede verla.
 *
 * `width`/`height` reales del asset (no `fill`): la imagen no vive en un
 * marco recortado como la galería, así que se le da su relación de aspecto
 * real para que el navegador reserve el espacio sin CLS antes de que cargue.
 * Sin `priority` — está bajo el pliegue, detrás de un acordeón que arranca
 * cerrado.
 *
 * `alt` nunca vacío: es un diagrama con datos (medidas de cuadro), no
 * decoración. Se usa el que el admin haya escrito; si no lo hizo, una
 * descripción funcional en vez de dejarlo en blanco.
 */
export function ProductGeometryImage({ image, productName }: ProductGeometryImageProps) {
  return (
    <Image
      src={image.url}
      alt={image.alt || `Tabla de geometría de ${productName}`}
      width={image.width}
      height={image.height}
      sizes="(max-width: 1024px) 100vw, 56rem"
      className="h-auto w-full max-w-[56rem]"
    />
  );
}
