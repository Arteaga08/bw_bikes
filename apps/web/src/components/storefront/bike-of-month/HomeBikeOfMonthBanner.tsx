import type { PublicBikeOfMonth } from "@bw-bikes/shared";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";

export interface HomeBikeOfMonthBannerProps {
  bikeOfMonth: PublicBikeOfMonth;
}

/**
 * Full-bleed photo with overlaid text, same grammar as `HomeCategoryCtaTile`
 * (which itself borrows `HeroSlideMedia`/`HeroSlideContent`'s) — but taller,
 * since this is a single-bike spotlight rather than one of a pair of tiles,
 * and with two buttons instead of a bare title (referenced from
 * specialized.com's "Nueva Temporada" banner).
 */
export function HomeBikeOfMonthBanner({ bikeOfMonth }: HomeBikeOfMonthBannerProps) {
  return (
    <div className="relative aspect-square w-full overflow-hidden sm:aspect-[16/9]">
      <Image
        src={bikeOfMonth.image.url}
        alt={bikeOfMonth.image.alt ?? bikeOfMonth.title}
        fill
        sizes="100vw"
        loading="lazy"
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-negro/80 via-negro/10 to-transparent" />
      {/* Scrim lateral: el admin puede subir una foto clara y el texto vive a la
          izquierda — el hero resuelve el mismo caso con este segundo gradiente. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-negro/70 via-negro/10 to-transparent" />

      {/* Mismo riel que `HeroCarousel`: inset izquierdo fluido y asimétrico, para
          que esta sección arranque en la misma columna que el hero de arriba. */}
      <div className="absolute inset-x-0 bottom-0 px-lg pb-2xl sm:pr-xl sm:pb-[5.5rem] sm:pl-[clamp(2rem,8vw,8rem)]">
        {/* `max-w-[34rem]` arbitrario, nunca `max-w-lg`: Tailwind v4 resuelve
            `max-w-{key}` contra `--spacing-{key}` antes que contra
            `--container-{key}` (ver la advertencia en `globals.css`). */}
        <div className="flex w-full flex-col gap-sm text-blanco sm:max-w-[34rem]">
          {bikeOfMonth.eyebrow ? (
            <p className="flex items-center gap-xs font-ui text-eyebrow uppercase text-blanco/80">
              {/* 16x7, la razón real 308:132 del asset — un tamaño cuadrado loguea warning. */}
              <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
              {bikeOfMonth.eyebrow}
            </p>
          ) : null}

          <h2 className="text-balance font-display text-h2 font-extrabold uppercase leading-[1.05] text-blanco sm:text-h1">
            {bikeOfMonth.title}
          </h2>

          {bikeOfMonth.subtitle ? (
            <p className="mt-sm font-body text-body-l text-blanco/70">{bikeOfMonth.subtitle}</p>
          ) : null}

          <div className="mt-sm grid auto-cols-fr grid-flow-col gap-sm sm:w-[24rem]">
            <ButtonLink href={bikeOfMonth.href} variant="ghost" tone="inverse">
              Conocer más
            </ButtonLink>
            <ButtonLink href={bikeOfMonth.href} variant="primary">
              Comprar
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
