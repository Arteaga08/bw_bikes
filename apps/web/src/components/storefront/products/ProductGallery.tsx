"use client";

import type { ProductImage } from "@bw-bikes/shared";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

const TILE_SIZES = "(max-width: 1024px) 50vw, 25vw";

/**
 * `bg-blanco`, matching the studio backdrop baked into every gallery asset
 * at upload (`whitenStudioBackground`, apps/api) — same reasoning as
 * `CatalogProductCard`'s own photo frame. `border-borde` is what actually
 * separates one photo from the next: the frame color matches the page
 * behind it, so without a persistent hairline the only separation signal
 * was the gap — and that gap is intentionally narrow between the two large
 * tiles. Manuel's call after comparing four live mockups (hairline /
 * background-step / rule+caption / spacing-only), 2026-08-28.
 */
function GalleryTile({ image, alt, priority }: { image: ProductImage; alt: string; priority?: boolean }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-card border border-borde bg-blanco">
      <Image
        src={image.url}
        alt={alt}
        fill
        sizes={TILE_SIZES}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-contain"
      />
    </div>
  );
}

/** A 2-up row, or a single full-width tile for a lone leftover — the shape shared by the small row and every expanded chunk below it. */
function TileRow({ images, productName }: { images: ProductImage[]; productName: string }) {
  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-md">
        {images.map((image) => (
          <GalleryTile key={image.publicId} image={image} alt={image.alt ?? productName} />
        ))}
      </div>
    );
  }
  const [image] = images;
  if (!image) return null;
  return <GalleryTile image={image} alt={image.alt ?? productName} />;
}

function chunkPairs(images: ProductImage[]): ProductImage[][] {
  const pairs: ProductImage[][] = [];
  for (let index = 0; index < images.length; index += 2) pairs.push(images.slice(index, index + 2));
  return pairs;
}

/**
 * 2 fotos grandes a ancho completo, apiladas (`gap-xs` — el hairline de
 * cada tile es lo que las separa, no el espacio en blanco, así que el gap
 * puede quedar angosto) — luego, si hay más, las 2 chicas lado a lado en su
 * propia fila (`gap-md`, más generoso porque ahí sí compiten por el mismo
 * ancho de columna). Sin carrusel: la referencia (Cannondale/Specialized)
 * es un bento estático, no un slider.
 *
 * Más de 4 fotos: un botón "Ver más (+N)" despliega el resto **en el mismo
 * flujo** (agrupadas de a 2, mismo tratamiento que las chicas) en vez de
 * abrir un modal, y se convierte en "Ver menos" para volver a colapsar.
 *
 * Menos de 4 fotos: se muestran solo las que existan, sin slots vacíos ni
 * placeholders. Sin fotos, un marco neutro (un producto recién creado y sin
 * fotografiar todavía no debe tumbar la página).
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...images].sort((a, b) => a.order - b.order), [images]);

  const [firstImage] = sorted;
  if (!firstImage) {
    return <div className="aspect-square w-full rounded-card border border-borde bg-blanco" aria-hidden="true" />;
  }

  const largeTiles = sorted.slice(0, 2);
  const smallTiles = sorted.slice(2, 4);
  const extraTiles = sorted.slice(4);

  return (
    <div className="flex flex-col gap-xs">
      {largeTiles.map((image, index) => (
        <GalleryTile key={image.publicId} image={image} alt={image.alt ?? productName} priority={index === 0} />
      ))}

      {smallTiles.length > 0 ? <TileRow images={smallTiles} productName={productName} /> : null}

      {expanded
        ? chunkPairs(extraTiles).map((pair, index) => (
            <TileRow key={pair[0]?.publicId ?? index} images={pair} productName={productName} />
          ))
        : null}

      {extraTiles.length > 0 ? (
        <Button variant="ghost" size="md" className="w-full" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Ver menos" : `Ver más (+${extraTiles.length})`}
        </Button>
      ) : null}
    </div>
  );
}
