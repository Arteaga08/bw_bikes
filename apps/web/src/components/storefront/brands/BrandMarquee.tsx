"use client";

import type { PublicBrand } from "@bw-bikes/shared";
import Image from "next/image";
import { useDarkLogo } from "@/hooks/use-dark-logo";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

export interface BrandMarqueeProps {
  brands: PublicBrand[];
}

// Tres copias, no dos: con pocas marcas (el caso real al lanzar) dos copias
// no llenan el ancho de una pantalla grande, dejando un hueco visible antes
// de que el loop reinicie.
const LOOP_COPIES = 3;

interface BrandLogoProps {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Un logo, caja de tamaño fijo (no el tamaño intrínseco del asset) +
 * `object-contain` — sin esto, cada logo se veía a una escala distinta según
 * su propia relación de aspecto (el wordmark ancho de Cube vs. el cuadrado de
 * Orbea), rompiendo el ritmo de la fila.
 *
 * `useDarkLogo` decide si este logo específico necesita `invert()`: solo los
 * assets transparentes con trazo oscuro (el caso real de Trek, wordmark
 * negro sobre PNG con alfa) se invierten. Un logo opaco de color (el rojo de
 * Cannondale) nunca se toca — invertirlo cambiaría su color de marca en vez
 * de resolver contraste real. Empieza sin invertir mientras el análisis
 * corre, así que nunca hay un parpadeo de "invertido de más".
 */
function BrandLogo({ url, alt, width, height }: BrandLogoProps) {
  const isDark = useDarkLogo(url);

  return (
    <div className="group/logo relative flex h-10 w-28 items-center justify-center sm:h-12 sm:w-32">
      <Image
        src={url}
        alt={alt}
        width={width}
        height={height}
        className={cn("h-full w-full object-contain", isDark && "invert")}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-1 h-px origin-center scale-x-0 bg-dorado transition-transform duration-150 group-hover/logo:scale-x-100"
      />
    </div>
  );
}

/**
 * Client Component: el track continuo de logos de marca. Traslación CSS
 * pura (`translateX`), sin librería — mismo patrón que `--animate-hero-in`
 * en `globals.css`, no `CategoryCarousel` (ese es scroll nativo interactivo;
 * esto es una animación automática sin interacción de scroll).
 *
 * Fila editorial: hairlines verticales entre logos dan la estructura (como
 * una barra de prensa "as featured in"), color real sin filtro de marca ni
 * tarjeta — el primer intento (tarjeta blanca + grayscale) chocaba con los
 * logos reales (JPG/PNG opacos con su propio fondo sólido, ver
 * `HomeBrands.tsx`) y aplanaba cualquier asset sin canal alfa. En hover, el
 * subrayado dorado que crece desde el centro reutiliza el mismo gesto de
 * `CategoryCard` (categorías del home) para que esta sección se sienta parte
 * del mismo sistema, no un tratamiento nuevo.
 *
 * Estructura estándar de marquee accesible: una lista real (`role="list"`,
 * `aria-label`) más copias `aria-hidden="true"` que solo existen para el
 * loop visual continuo. Cada logo lleva su propio borde izquierdo (no solo
 * el primero de cada copia) para que el patrón de divisores se repita sin
 * costura visible en el punto donde una copia termina y la siguiente empieza.
 *
 * `prefers-reduced-motion`: el marquee se congela por completo (una sola
 * copia, sin clase de animación) — a diferencia del hero, acá no hay
 * contenido que se pierda al detener la animación, las copias son idénticas.
 */
export function BrandMarquee({ brands }: BrandMarqueeProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const copies = prefersReducedMotion ? 1 : LOOP_COPIES;

  return (
    <div className="group/marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
      <div
        className={
          prefersReducedMotion
            ? "flex w-max items-stretch"
            : "flex w-max items-stretch animate-brand-marquee motion-safe:group-hover/marquee:[animation-play-state:paused]"
        }
      >
        {Array.from({ length: copies }).map((_, copyIndex) => (
          <ul
            key={copyIndex}
            role="list"
            aria-label={copyIndex === 0 ? "Marcas que manejamos" : undefined}
            aria-hidden={copyIndex === 0 ? undefined : "true"}
            className="flex items-stretch"
          >
            {brands.map((brand) => {
              const logo = brand.logo;
              if (!logo) return null;
              return (
                <li
                  key={brand.id}
                  className="flex shrink-0 items-center border-l border-blanco/10 px-xl py-md sm:px-3xl"
                >
                  <BrandLogo
                    url={logo.url}
                    alt={copyIndex === 0 ? (logo.alt ?? brand.name) : ""}
                    width={logo.width}
                    height={logo.height}
                  />
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
