import type { PublicHeroSlide } from "@bw-bikes/shared";
import { publicApiFetch } from "@/lib/api/public";
import { ApiError } from "@/lib/api/error";
import { HeroCarousel } from "./HeroCarousel";

/**
 * Server Component: resolves the hero's slides and delegates to the client
 * carousel. Errors and an empty catalog both fall through to the same
 * minimal fallback — the home page must never break or go blank just
 * because the content endpoint is unreachable or nothing has been
 * published yet.
 *
 * The fallback still carries `data-navbar-overlay` and `min-h-svh`, the same
 * contract `HeroCarousel` honors — `useNavbarOverlay` doesn't know or care
 * which one rendered.
 */
export async function HomeHero() {
  let slides: PublicHeroSlide[] = [];
  try {
    const res = await publicApiFetch<{ slides: PublicHeroSlide[] }>("/content/hero-slides", {
      tags: ["hero-slides"],
    });
    slides = res.data.slides;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    slides = [];
  }

  if (slides.length === 0) {
    return (
      <div data-navbar-overlay className="flex min-h-svh items-center justify-center bg-negro px-md text-center">
        <p className="font-display text-h2 text-blanco">Black and White Bikes</p>
      </div>
    );
  }

  return <HeroCarousel slides={slides} />;
}
