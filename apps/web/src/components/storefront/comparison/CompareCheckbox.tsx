"use client";

import type { MouseEvent } from "react";
import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { MAX_COMPARISON_ENTRIES, useComparison, type ComparisonEntry } from "./ComparisonProvider";

export interface CompareCheckboxProps {
  product: PublicProductSummary;
}

function toEntry(product: PublicProductSummary): ComparisonEntry {
  const [image] = product.gallery;
  return {
    slug: product.slug,
    name: product.name,
    brandName: product.brand.name,
    price: product.price,
    ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
  };
}

/**
 * The "Comparar" toggle at the foot of `CatalogProductCard`. Lives inside a
 * `<Link>` (the card is the whole tile), so — same contract as `SaveButton`
 * next to it — the click handler stops propagation and prevents default
 * before touching anything else, or checking the box would also navigate to
 * the PDP.
 *
 * Bikes only: `CatalogProductCard` renders both catalogs, and comparison is
 * a bike-only feature (M-comparador). Rendering `null` for an accessory
 * keeps the card itself catalog-agnostic — it doesn't need to know which
 * kind supports comparison.
 *
 * A real `role="checkbox"` rather than `ui/Checkbox` (that one assumes a
 * single, once-per-form control with a visible `<label htmlFor>`): a grid of
 * 24 cards repeats the same visible word "Comparar" 24 times, so each one
 * needs its own `aria-label` naming the product, not a label element a
 * screen reader would read as generic and indistinguishable from its
 * neighbors.
 */
export function CompareCheckbox({ product }: CompareCheckboxProps) {
  // Hooks first, unconditionally — the `kind !== "bike"` bailout below has to
  // come after every hook call or a card that flips between catalogs (it
  // doesn't today, but nothing guarantees it never will) would violate the
  // Rules of Hooks.
  const { entries, isSelected, toggle } = useComparison();

  if (product.kind !== "bike") return null;

  const selected = isSelected(product.slug);
  const atCapacity = !selected && entries.length >= MAX_COMPARISON_ENTRIES;

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    if (atCapacity) return;
    toggle(toEntry(product));
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={selected ? `Quitar ${product.name} de la comparación` : `Comparar ${product.name}`}
      disabled={atCapacity}
      title={atCapacity ? "Ya elegiste 3 bicicletas" : undefined}
      onClick={handleClick}
      className="flex items-center gap-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150 ${
          selected ? "border-dorado bg-dorado" : "border-[rgba(250,250,250,0.4)] bg-transparent"
        }`}
      >
        {selected ? (
          <svg viewBox="0 0 16 16" className="size-3 text-negro" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="font-body text-caption text-[rgba(250,250,250,0.7)]">Comparar</span>
    </button>
  );
}
