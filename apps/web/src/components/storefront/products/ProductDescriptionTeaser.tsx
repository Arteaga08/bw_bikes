"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PRODUCT_OVERVIEW_ANCHOR } from "./product-anchors";

export interface ProductDescriptionTeaserProps {
  shortDescription?: string;
  description: string;
}

/**
 * El teaser del carril lateral. Bikes carry a purpose-written
 * `shortDescription` (≤300 chars, `bike.model.ts`); accessories only have
 * `description` — `accessory.model.ts` documents the missing field — so they
 * clamp `description` itself instead. Either way the collapsed text is never
 * sliced by character count: it's the real string, visually cut by
 * `line-clamp-3`, so it wraps at the column's actual width instead of a
 * guessed character budget.
 *
 * "Leer más" no expande aquí: el texto completo vive en `ProductOverview`,
 * bajo la galería, y el enlace baja hasta esa sección. Duplicar el texto
 * largo en el carril sería pintarlo dos veces en la misma página.
 *
 * Va en `text-body` (14px) y no en `text-body-l` (16px) a propósito: la
 * descripción completa de la sección de abajo usa 16px, así que dejar el
 * teaser un escalón más chico lo hace leer como lo que es, un adelanto, en
 * vez de como un bloque de texto del mismo rango repetido dos veces.
 *
 * El enlace solo aparece cuando hay algo más que ver: o el teaser corto
 * difiere de verdad de la descripción completa, o (caso accesorio, misma
 * cadena en ambos) el clamp está cortando líneas — medido igual que
 * `PromoBannerCopy` mide su propio texto, porque el CSS solo no puede
 * decirle a JS si `line-clamp` truncó algo.
 *
 * `description` is plain text with no rich-text pipeline anywhere in the
 * model, so manual line breaks are kept with `whitespace-pre-line` and never
 * rendered as HTML.
 */
export function ProductDescriptionTeaser({ shortDescription, description }: ProductDescriptionTeaserProps) {
  const [isClamped, setIsClamped] = useState(false);
  const collapsedRef = useRef<HTMLParagraphElement>(null);

  const collapsedText = shortDescription || description;
  const hasMoreText = collapsedText !== description;

  useLayoutEffect(() => {
    if (hasMoreText) return;
    const el = collapsedRef.current;
    if (!el) return;

    const measure = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [hasMoreText, collapsedText]);

  const hasMoreToRead = hasMoreText || isClamped;

  return (
    <div>
      <p ref={collapsedRef} className="line-clamp-3 whitespace-pre-line font-body text-body text-grafito">
        {collapsedText}
      </p>
      {hasMoreToRead ? (
        <a
          href={`#${PRODUCT_OVERVIEW_ANCHOR}`}
          className="mt-sm inline-block font-ui text-ui text-negro underline underline-offset-2 transition-colors duration-150 hover:text-grafito"
        >
          Leer más
        </a>
      ) : null}
    </div>
  );
}
