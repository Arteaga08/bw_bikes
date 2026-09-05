"use client";

import type { ProductImage } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ProductGalleryDots } from "./ProductGalleryDots";

/**
 * Only ever rendered once a tile is clicked (`lightboxIndex !== null`), and
 * it already mounts straight into its open state today — there is no entry
 * transition for a late mount to swallow, so this loads purely on demand.
 */
const ProductGalleryLightbox = dynamic(
  () => import("./ProductGalleryLightbox").then((mod) => mod.ProductGalleryLightbox),
  { ssr: false },
);

export interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

/** Las dos primeras ocupan la fila completa del bento; el resto, media fila. */
const LARGE_TILE_COUNT = 2;
/** Fotos visibles en el bento antes de "Ver más". No aplica al carrusel móvil, que las muestra todas. */
const COLLAPSED_TILE_COUNT = 4;

const LARGE_TILE_SIZES = "(max-width: 1024px) 100vw, 50vw";
const SMALL_TILE_SIZES = "(max-width: 1024px) 100vw, 25vw";

/**
 * Marco 16:9 en el carrusel móvil, cuadrado en el bento de escritorio.
 *
 * Mismo ratio que specialized.com/mx: una foto de producto es apaisada — una
 * bici siempre — así que un marco más bajo no la muestra más chica, la
 * muestra sin el margen blanco que un marco cuadrado o 4:3 le agrega arriba y
 * abajo. En móvil ese alto liberado vale doble, porque el carrusel va pegado
 * bajo el navbar y lo que ocupa se lo quita al carril de compra que pasa por
 * debajo (precio, talla, CTA).
 *
 * En escritorio se queda cuadrado: ahí el bento no compite con nada por el
 * alto y la retícula de cuatro fotos se lee mejor con celdas regulares.
 */
const TILE_ASPECT = "aspect-video lg:aspect-square";

/**
 * `bg-blanco`, matching the studio backdrop baked into every gallery asset
 * at upload (`whitenStudioBackground`, apps/api) — same reasoning as
 * `CatalogProductCard`'s own photo frame. `border-borde` is what actually
 * separates one photo from the next: the frame color matches the page
 * behind it, so without a persistent hairline the only separation signal
 * was the gap — and that gap is intentionally narrow between the two large
 * tiles. Manuel's call after comparing four live mockups (hairline /
 * background-step / rule+caption / spacing-only), 2026-08-28.
 *
 * Clickable — opens `ProductGalleryLightbox` at this tile's position in the
 * full (unfiltered by `expanded`) `sorted` list, so the viewer can arrow
 * through every photo regardless of whether it's currently on screen.
 *
 * `w-full shrink-0 snap-start` es lo que lo convierte en diapositiva bajo
 * `lg`; en el bento esas tres clases son inertes (en un grid no hay flex
 * shrink que evitar y no hay scroll donde encajar).
 */
function GalleryTile({
  image,
  alt,
  priority,
  sizes,
  className,
  onOpen,
}: {
  image: ProductImage;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ampliar foto: ${alt}`}
      className={`relative ${TILE_ASPECT} w-full shrink-0 snap-start overflow-hidden rounded-card border border-borde bg-blanco focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado ${className ?? ""}`}
    >
      <Image
        src={image.url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-contain"
      />
    </button>
  );
}

/**
 * Una sola lista de fotos con dos mecánicas, conmutadas por CSS en `lg`:
 *
 * - **Bajo `lg` — carrusel.** Una foto por pantalla (`w-full shrink-0`),
 *   scroll horizontal nativo con `snap-x snap-mandatory`, y `ProductGalleryDots`
 *   debajo. Reemplaza al bento apilado que teníamos aquí: en un teléfono,
 *   cuatro fotos cuadradas a ancho completo empujaban el precio, la talla y el
 *   CTA muy por debajo del pliegue. Decisión de Manuel, 2026-08-31, contra la
 *   PDP móvil de specialized.com/mx. (Reemplaza la nota previa de esta misma
 *   función, que declaraba "sin carrusel" con la referencia de escritorio en
 *   mente; en escritorio esa decisión sigue vigente y es el bento de abajo.)
 * - **Desde `lg` — bento.** 2 fotos grandes a fila completa (`lg:col-span-2`)
 *   apiladas con `gap-y-xs` (el hairline de cada tile es lo que las separa,
 *   no el espacio en blanco), luego las demás de a 2 por fila con `gap-x-md`,
 *   más generoso porque ahí sí compiten por el mismo ancho de columna.
 *
 * Un solo DOM para las dos, no dos galerías con `lg:hidden`/`hidden lg:block`:
 * eso duplicaría cada `next/image`, duplicaría descargas y crearía dos
 * candidatos de LCP. La contrapartida es que las fotos más allá de la cuarta
 * están siempre montadas y el "Ver más" del bento solo les quita `lg:hidden`
 * — en móvil el carrusel las muestra todas, que es justo lo que se quiere.
 *
 * `overflow-y-hidden` junto a `overflow-x-auto` es obligatorio, no decorativo:
 * por la spec de CSS Overflow, un `overflow-x` distinto de `visible` con el
 * `overflow-y` en su default `visible` computa ese `visible` a `auto`, y el
 * track se vuelve también un contenedor de scroll vertical que atrapa la rueda
 * del mouse en vez de dejarla burbujear a la página (mismo razonamiento que
 * `ScrollRail`).
 *
 * Menos de 4 fotos: se muestran solo las que existan, sin slots vacíos ni
 * placeholders. Sin fotos, un marco neutro (un producto recién creado y sin
 * fotografiar todavía no debe tumbar la página).
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const sorted = useMemo(() => [...images].sort((a, b) => a.order - b.order), [images]);

  /**
   * Distancia entre el inicio de una diapositiva y la siguiente: el ancho del
   * track más el `gap`. Se mide en el DOM en vez de asumir el valor del token
   * para que un cambio de `gap-md` no desincronice los dots en silencio.
   * Cae al ancho del track cuando hay una sola foto (no hay segunda que medir).
   */
  const readSlideStep = useCallback((track: HTMLDivElement): number => {
    const [first, second] = track.children;
    if (first instanceof HTMLElement && second instanceof HTMLElement) {
      return second.offsetLeft - first.offsetLeft;
    }
    return track.clientWidth;
  }, []);

  const syncActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const step = readSlideStep(track);
    if (step <= 0) return;
    setActiveIndex(Math.round(track.scrollLeft / step));
  }, [readSlideStep]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    syncActiveIndex();
    track.addEventListener("scroll", syncActiveIndex, { passive: true });

    // Girar el teléfono o cruzar el breakpoint cambia el ancho de diapositiva
    // sin disparar un solo evento `scroll`, así que el índice se recalcularía
    // contra un `step` viejo.
    const resizeObserver = new ResizeObserver(syncActiveIndex);
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener("scroll", syncActiveIndex);
      resizeObserver.disconnect();
    };
  }, [syncActiveIndex]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollTo({
        left: index * readSlideStep(track),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion, readSlideStep],
  );

  const [firstImage] = sorted;
  if (!firstImage) {
    return <div className={`${TILE_ASPECT} w-full rounded-card border border-borde bg-blanco`} aria-hidden="true" />;
  }

  const extraCount = Math.max(sorted.length - COLLAPSED_TILE_COUNT, 0);

  return (
    <div>
      <div
        ref={trackRef}
        role="group"
        aria-label={`Fotos de ${productName}`}
        className="flex gap-md overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-2 lg:gap-x-md lg:gap-y-xs lg:snap-none lg:overflow-visible"
      >
        {sorted.map((image, index) => {
          const isLarge = index < LARGE_TILE_COUNT;
          const isExtra = index >= COLLAPSED_TILE_COUNT;
          return (
            <GalleryTile
              key={image.publicId}
              image={image}
              alt={image.alt ?? productName}
              priority={index === 0}
              sizes={isLarge ? LARGE_TILE_SIZES : SMALL_TILE_SIZES}
              className={`${isLarge ? "lg:col-span-2" : ""} ${isExtra && !expanded ? "lg:hidden" : ""}`}
              onOpen={() => setLightboxIndex(index)}
            />
          );
        })}
      </div>

      <ProductGalleryDots count={sorted.length} activeIndex={activeIndex} onSelect={scrollToIndex} />

      {extraCount > 0 ? (
        // El `div` envuelve al botón en vez de pasarle `hidden lg:block` por
        // `className`: sin `tailwind-merge`, esa clase pelearía por `display`
        // contra la propia del componente y ganaría por orden de CSS, no por
        // intención (ver la nota de `buttonClasses`).
        <div className="mt-md hidden lg:block">
          <Button variant="ghost" size="md" className="w-full" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Ver menos" : `Ver más (+${extraCount})`}
          </Button>
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <ProductGalleryLightbox
          images={sorted}
          index={lightboxIndex}
          productName={productName}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}
