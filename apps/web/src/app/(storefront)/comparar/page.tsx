import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ComparisonTable } from "@/components/storefront/comparator/ComparisonTable";
import { MAX_COMPARISON_ENTRIES, MIN_COMPARISON_ENTRIES } from "@/components/storefront/comparison/comparison-limits";
import { ApiError } from "@/lib/api/error";
import { getPublicBikeBySlug, toComparableBike, type ComparableBike } from "@/lib/api/public-catalog";
import type { NextSearchParams } from "@/lib/storefront-catalog-filters";

interface CompararPageProps {
  searchParams: Promise<NextSearchParams>;
}

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

/** Turns `?bicis=` into a validated, deduplicated, capped list of slugs — same shape whether the param arrived as one string or (someone repeated it) an array. */
function parseSlugs(raw: NextSearchParams[string]): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];

  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const candidate of value.split(",")) {
    const slug = candidate.trim();
    if (!slug || !SLUG_PATTERN.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length >= MAX_COMPARISON_ENTRIES) break;
  }
  return slugs;
}

/**
 * Loads each requested bike independently, each wrapped in its own degrade —
 * same `safe()` idiom `(storefront)/layout.tsx` already uses for its own
 * parallel reads. A dead slug (a stale link, a product archived since it was
 * shared) drops out of the comparison in silence instead of taking the
 * others down with it — the page renders whatever it could load, per
 * `MIN_COMPARISON_ENTRIES`.
 */
async function loadBikes(slugs: string[]): Promise<ComparableBike[]> {
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return toComparableBike(await getPublicBikeBySlug(slug));
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return null;
      }
    }),
  );
  return results.filter((bike): bike is ComparableBike => bike !== null);
}

export async function generateMetadata({ searchParams }: CompararPageProps): Promise<Metadata> {
  const bikes = await loadBikes(parseSlugs((await searchParams).bicis));
  if (bikes.length < MIN_COMPARISON_ENTRIES) return { title: "Comparar bicicletas" };
  return { title: bikes.map((bike) => bike.name).join(" vs. ") };
}

function RhinoMark() {
  return <Image src="/brand/rhino-negro.svg" alt="" aria-hidden="true" width={16} height={7} className="shrink-0" />;
}

/**
 * The bike comparator, rebuilt around the catalog's own "Comparar" checkbox
 * and its bottom tray (`CompareCheckbox`/`ComparisonTray`) instead of the
 * page's own pickers — the tray hands off here via `?bicis=slug-a,slug-b[,slug-c]`.
 * A page of its own rather than a home section: a side-by-side spec sheet is
 * a considered, mid-funnel task, and dropping it into the middle of the home
 * would interrupt the visitor who came to browse. The home links here
 * through `HomeComparatorBanner`, with no query string — landing on the
 * empty state below is the expected outcome from that entry point.
 *
 * Same degrade contract as every storefront section: fewer than
 * `MIN_COMPARISON_ENTRIES` bikes actually resolve (no query string, every
 * slug invalid or gone) renders an explanation rather than an error screen
 * or a comparison with an empty column.
 */
export default async function CompararPage({ searchParams }: CompararPageProps) {
  const bikes = await loadBikes(parseSlugs((await searchParams).bicis));

  return (
    <section className="bg-blanco py-3xl">
      <div className="mx-auto w-full max-w-[72rem] px-lg">
        <div className="flex items-center gap-xs">
          <RhinoMark />
          <p className="font-body text-eyebrow uppercase text-grafito">Comparador</p>
        </div>
        <h1 className="mt-xs font-display text-h2 font-extrabold uppercase text-negro sm:text-h1">
          Compara antes de decidir
        </h1>
        <p className="mt-md max-w-[34rem] font-body text-body-l text-grafito">
          Enfrenta hasta {MAX_COMPARISON_ENTRIES} bicicletas, dato por dato.
        </p>

        {bikes.length >= MIN_COMPARISON_ENTRIES ? (
          <ComparisonTable bikes={bikes} />
        ) : (
          <div className="mt-2xl">
            <p className="font-body text-body text-grafito">
              Elige al menos dos bicicletas desde el catálogo para compararlas aquí.
            </p>
            <ButtonLink href="/bicicletas" variant="primary" className="mt-md">
              Ir al catálogo
            </ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}
