import Image from "next/image";
import type { ReactNode } from "react";
import { PromoBannerCopy } from "@/components/storefront/shared/PromoBannerCopy";
import { cn } from "@/lib/cn";

/** Which edge the copy block anchors to from `sm` up. Below `sm` it always stacks under the photo. */
export type PromoBannerAlign = "left" | "right";

export interface PromoBannerAction {
  label: string;
  href: string;
  variant: "primary" | "ghost";
}

export interface PromoBannerProps {
  image: { url: string; alt?: string };
  title: string;
  eyebrow?: string;
  /** Rendered before the eyebrow text. Optional because DESIGN_SYSTEM.md §5.1 caps the home at two rhinos — only the section that owns one passes it. */
  eyebrowIcon?: ReactNode;
  subtitle?: string;
  actions: PromoBannerAction[];
  align?: PromoBannerAlign;
}

/**
 * Full-bleed photo with overlaid copy — the home's spotlight banner grammar,
 * extracted from `HomeBikeOfMonthBanner` (M12) when a second section needed
 * the identical layout mirrored. Same grammar as `HomeCategoryCtaTile`
 * (which itself borrows `HeroSlideMedia`/`HeroSlideContent`'s), but taller,
 * since this is a single spotlight rather than one of a pair of tiles, and
 * with buttons instead of a bare title.
 *
 * Two layouts, one markup. From `sm` up it's the overlay: the photo fills a
 * 16/9 frame and the copy sits on top of it, held readable by the two scrims.
 * Below `sm` the copy drops **out** of the photo and stacks under it on solid
 * `negro`, and the frame widens to 4/3. The reason is the crop:
 * `object-cover` into the old `aspect-square` frame scaled a landscape bike
 * shot to fill the height and cut both ends off it (caught on an iPhone 14
 * Pro Max, 430px). A wider frame keeps the bike whole, and once the copy is
 * no longer competing with it for that vertical space there's room for it —
 * unlike a focal point, this doesn't ask the admin to pick which end of the
 * bike to lose.
 *
 * `align` mirrors the whole overlay, not just the text: the side scrim, the
 * mobile crop's focal point and the copy's own alignment all flip together.
 * Flipping only one of them is what makes a mirrored banner look wrong —
 * light copy over the bright end of a photo, or a scrim darkening the empty
 * side.
 */
export function PromoBanner({
  image,
  title,
  eyebrow,
  eyebrowIcon,
  subtitle,
  actions,
  align = "left",
}: PromoBannerProps) {
  const isRight = align === "right";

  return (
    // `bg-negro` sostiene el bloque de texto apilado en móvil; en `sm` la foto
    // lo tapa por completo y solo se ve mientras la imagen decodifica.
    <div className="relative w-full bg-negro sm:aspect-[16/9]">
      {/* En flujo y 4/3 en móvil; absoluto y a pantalla completa desde `sm`. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:absolute sm:inset-0 sm:aspect-auto">
        <Image
          src={image.url}
          alt={image.alt ?? title}
          fill
          sizes="100vw"
          loading="lazy"
          // El encuadre móvil se aleja del lado donde vivirá el texto en desktop,
          // para que el recorte 4/3 conserve la bici y no el fondo vacío.
          className={cn(
            "object-cover sm:object-center",
            isRight ? "object-[20%_center]" : "object-[80%_center]",
          )}
        />
        {/* Ambos scrims son cosa del overlay: en móvil el texto ya vive fuera de
            la foto, así que oscurecerla ahí solo la ensuciaría sin ganar nada. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-gradient-to-t from-negro/80 via-negro/10 to-transparent sm:block"
        />
        {/* Scrim lateral: la foto puede ser clara justo donde cae el texto — el
            hero resuelve el mismo caso con este segundo gradiente. Nace en el
            borde que sostiene la copia, así que se voltea con `align`. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 hidden via-negro/10 to-transparent sm:block",
            isRight ? "bg-gradient-to-l from-negro/70" : "bg-gradient-to-r from-negro/70",
          )}
        />
      </div>

      {/* Mismo riel que `HeroCarousel`: inset fluido y asimétrico, para que esta
          sección arranque en la misma columna que el hero de arriba. En móvil es
          un bloque en flujo debajo de la foto; desde `sm` vuelve a anclarse al
          pie de la imagen. */}
      <div
        className={cn(
          "relative px-lg py-xl sm:absolute sm:inset-x-0 sm:bottom-0 sm:pt-0 sm:pb-[5.5rem]",
          isRight
            ? "sm:pl-xl sm:pr-[clamp(2rem,8vw,8rem)]"
            : "sm:pr-xl sm:pl-[clamp(2rem,8vw,8rem)]",
        )}
      >
        {/* `max-w-[34rem]` arbitrario, nunca `max-w-lg`: Tailwind v4 resuelve
            `max-w-{key}` contra `--spacing-{key}` antes que contra
            `--container-{key}` (ver la advertencia en `globals.css`). */}
        <PromoBannerCopy
          title={title}
          {...(eyebrow ? { eyebrow } : {})}
          eyebrowIcon={eyebrowIcon}
          {...(subtitle ? { subtitle } : {})}
          actions={actions}
          isRight={isRight}
        />
      </div>
    </div>
  );
}
