import { ButtonLink } from "@/components/ui/ButtonLink";
import { MAX_COMPARISON_ENTRIES } from "@/components/storefront/comparison/comparison-limits";

/**
 * One placeholder column per comparison slot, derived from
 * `MAX_COMPARISON_ENTRIES` rather than hardcoded, so the preview and the
 * "hasta N bicicletas" promise in the page header can never disagree.
 */
const SLOTS = Array.from({ length: MAX_COMPARISON_ENTRIES }, (_, index) => index + 1);

/**
 * What `/comparar` renders when it has nothing to compare — reached from
 * `HomeComparatorBanner` (no query string at all) or from a shared link whose
 * slugs no longer resolve.
 *
 * Built as a preview of the result rather than a lone sentence in the middle
 * of the page: the section is full-height by design (the footer shouldn't be
 * the first thing a visitor sees here), and height has to be *earned* by
 * content, not filled by centering a paragraph in a void. The empty slots
 * mirror the real table's column structure, so the page reads as the same
 * object either way — the comparison is simply still empty.
 *
 * The slots grow into the leftover viewport height but stop at `max-h-96`;
 * past that they'd read as three enormous blank panels rather than as
 * placeholders, and the remaining space falls below the block instead.
 */
export function ComparisonEmptyState() {
  return (
    <div className="mt-2xl flex flex-1 flex-col border-t border-borde pt-xl">
      <div className="flex flex-col items-start gap-lg sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-dialog font-display text-h3 text-negro">
          Elige al menos dos bicicletas desde el catálogo para compararlas aquí.
        </p>
        <ButtonLink href="/bicicletas" variant="primary" className="shrink-0">
          Ir al catálogo
        </ButtonLink>
      </div>

      <div aria-hidden="true" className="mt-2xl grid max-h-96 min-h-40 flex-1 grid-cols-3 gap-md">
        {SLOTS.map((slot) => (
          <div key={slot} className="flex flex-col justify-end rounded-card bg-inset p-md">
            <span className="font-display text-h2 font-extrabold text-grafito/25">
              {String(slot).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-md font-body text-body text-grafito">
        Comparamos año del modelo, precio, tallas disponibles y la ficha técnica completa.
      </p>
    </div>
  );
}
