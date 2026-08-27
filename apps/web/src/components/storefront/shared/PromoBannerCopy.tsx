"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import type { PromoBannerAction } from "@/components/storefront/shared/PromoBanner";

export interface PromoBannerCopyProps {
  title: string;
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  subtitle?: string;
  actions: PromoBannerAction[];
  isRight: boolean;
}

/**
 * Client half of `PromoBanner`: only this piece needs a ref, so only this
 * piece pays for hydration — the photo, scrims and outer layout stay server
 * rendered.
 *
 * A lone action has no sibling to size against, so instead of a fixed width
 * (the `actions.length > 1` pair still gets one, `sm:w-[24rem]`) it's
 * measured off the rendered copy block above it — whatever width the CMS
 * title/subtitle actually settled into after `text-balance` wrapped it,
 * since that can't be known from CSS alone. `ResizeObserver` re-measures on
 * font load and viewport resize, not just on mount.
 */
export function PromoBannerCopy({ title, eyebrow, eyebrowIcon, subtitle, actions, isRight }: PromoBannerCopyProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [matchedWidth, setMatchedWidth] = useState<number>();
  const singleAction = actions.length === 1;

  useLayoutEffect(() => {
    if (!singleAction || !textRef.current) return;

    const el = textRef.current;
    // `el.getBoundingClientRect()` mide la caja, no el texto: el wrapper se
    // estira al ancho disponible sin importar en cuántas líneas balanceó
    // `text-balance` el texto adentro — daría el mismo ancho de siempre, no
    // el real. Un `Range` sobre CADA nodo de texto sí devuelve un rect por
    // línea ya wrappeada; hay que ir nodo de texto por nodo de texto (no
    // `range.selectNodeContents(el)` completo) porque de lo contrario el
    // range también reporta la caja entera de cada hijo en bloque (el `p`
    // del eyebrow, el propio `h2`) como si fuera una línea más.
    // Debajo de `sm` la copia se apila a ancho completo (ver el comentario
    // sobre el crop 4/3 en `PromoBanner`) — el botón debe seguir esa misma
    // convención de CTA a todo el ancho, no el match con el texto que solo
    // aplica al layout de overlay desktop.
    const desktopQuery = window.matchMedia("(min-width: 640px)");

    const measure = () => {
      if (!desktopQuery.matches) {
        setMatchedWidth(undefined);
        return;
      }

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let widestLine = 0;
      let node = walker.nextNode();
      while (node) {
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > widestLine) widestLine = rect.width;
        }
        node = walker.nextNode();
      }
      if (widestLine > 0) setMatchedWidth(widestLine);
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [singleAction, title, subtitle]);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-sm text-blanco sm:max-w-[34rem]",
        isRight && "sm:ml-auto sm:items-end sm:text-right",
      )}
    >
      <div ref={textRef} className="flex flex-col gap-sm">
        {eyebrow ? (
          <p
            className={cn(
              "flex items-center gap-xs font-ui text-eyebrow uppercase text-blanco/80",
              isRight && "sm:justify-end",
            )}
          >
            {eyebrowIcon}
            {eyebrow}
          </p>
        ) : null}

        <h2 className="text-balance font-display text-h2 font-extrabold uppercase leading-[1.05] text-blanco sm:text-h1">
          {title}
        </h2>

        {subtitle ? <p className="mt-sm font-body text-body-l text-blanco/70">{subtitle}</p> : null}
      </div>

      {actions.length > 0 ? (
        <div
          className={cn("mt-sm grid gap-sm", actions.length > 1 && "auto-cols-fr grid-flow-col sm:w-[24rem]")}
          style={singleAction && matchedWidth ? { width: matchedWidth } : undefined}
        >
          {actions.map((action) => (
            <ButtonLink
              key={`${action.href}-${action.label}`}
              href={action.href}
              variant={action.variant}
              {...(action.variant === "ghost" ? { tone: "inverse" as const } : {})}
            >
              {action.label}
            </ButtonLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
