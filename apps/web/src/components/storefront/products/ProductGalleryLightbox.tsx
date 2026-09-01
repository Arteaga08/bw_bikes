"use client";

import type { ProductImage } from "@bw-bikes/shared";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import type { MouseEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui/CloseButton";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export interface ProductGalleryLightboxProps {
  images: ProductImage[];
  index: number;
  productName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ZOOM_SCALE = 2.5;

/**
 * Full-screen photo viewer opened from `ProductGallery`. Click/tap the photo
 * to zoom in centered on that point, click again to zoom back out — no pan,
 * no pinch gesture of our own: mobile Safari/Chrome already pinch-zoom a
 * `position: fixed` overlay natively, so adding a synthetic one would only
 * fight the browser's.
 *
 * Same dialog mechanics as `SizeGuideModal` (focus trap, Escape, body scroll
 * lock) but full-bleed on `overlay` instead of a centered card — a photo
 * viewer has no "content" outside the image itself.
 *
 * Se monta en un portal a `document.body` porque `ProductGallery` vive dentro
 * del contenedor pegajoso de la PDP móvil, que lleva `z-10` y por lo tanto
 * crea un contexto de apilamiento: sin el portal, este `z-50` sería relativo a
 * ese contexto y el visor terminaría pintado *debajo* del navbar (`z-30`), que
 * sí está en el contexto raíz. Es el mismo problema que documenta
 * `CatalogFilterDrawer`, resuelto aquí sacando el diálogo del árbol en vez de
 * reordenar hermanos, porque el estado que lo abre es del carrusel.
 */
export function ProductGalleryLightbox({ images, index, productName, onClose, onNavigate }: ProductGalleryLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");

  const image = images[index];
  const hasMultiple = images.length > 1;

  useFocusTrap(containerRef, true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasMultiple) goTo(index - 1);
      if (event.key === "ArrowRight" && hasMultiple) goTo(index + 1);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple]);

  if (!image) return null;

  function goTo(nextIndex: number): void {
    setIsZoomed(false);
    onNavigate((nextIndex + images.length) % images.length);
  }

  function handleImageClick(event: MouseEvent<HTMLImageElement>): void {
    if (isZoomed) {
      setIsZoomed(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = ((event.clientX - rect.left) / rect.width) * 100;
    const originY = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${originX}% ${originY}%`);
    setIsZoomed(true);
  }

  function stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/95 focus:outline-none"
    >
      <h2 id={titleId} className="sr-only">
        {image.alt ?? productName}
      </h2>

      <CloseButton
        onClick={onClose}
        aria-label="Cerrar visor de fotos"
        tone="inverse"
        size="icon-lg"
        className="absolute right-md top-md z-10"
      />

      {hasMultiple ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(event) => {
              stopPropagation(event);
              goTo(index - 1);
            }}
            className="absolute left-md top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control bg-negro/85 text-blanco transition-colors duration-150 hover:bg-negro-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado"
          >
            <CaretLeft size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={(event) => {
              stopPropagation(event);
              goTo(index + 1);
            }}
            className="absolute right-md top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control bg-negro/85 text-blanco transition-colors duration-150 hover:bg-negro-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado"
          >
            <CaretRight size={20} aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-lg" onClick={stopPropagation}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary zoom scale/origin needs a plain `<img>`; `next/image`'s `fill` layout can't host a transform-origin anchored to the click point. */}
        <img
          src={image.url}
          alt={image.alt ?? productName}
          onClick={handleImageClick}
          className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out-strong"
          style={{
            transform: isZoomed ? `scale(${ZOOM_SCALE})` : "scale(1)",
            transformOrigin: zoomOrigin,
            cursor: isZoomed ? "zoom-out" : "zoom-in",
          }}
        />
      </div>

      {hasMultiple ? (
        <p className="absolute bottom-md left-1/2 -translate-x-1/2 font-body text-caption text-blanco/70">
          {index + 1} / {images.length}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
