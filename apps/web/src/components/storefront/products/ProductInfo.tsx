"use client";

import type { ProductVariant, PublicAccessory, PublicBike } from "@bw-bikes/shared";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { ColorSwatchSelector } from "./ColorSwatchSelector";
import { PaymentMethodsBlock } from "./PaymentMethodsBlock";
import { ProductDescriptionTeaser } from "./ProductDescriptionTeaser";
import { ProductPrice } from "./ProductPrice";
import { stripBrandFromName } from "./product-name";
import { RelatedAccessories } from "./RelatedAccessories";
import { SizeSelector } from "./SizeSelector";

export interface ProductInfoProps {
  product: PublicBike | PublicAccessory;
  /** Product `color` names → their template's hex, built once per page — same map `CatalogProductCard` reads. */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

function normalizeColorKey(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

function RhinoMark() {
  return <Image src="/brand/rhino-dorado.svg" alt="" aria-hidden="true" width={16} height={7} className="shrink-0" />;
}

/** First-appearance-order unique color names across the product's active variants. */
function extractColors(variants: ProductVariant[]): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const variant of variants) {
    if (!variant.color || seen.has(variant.color)) continue;
    seen.add(variant.color);
    colors.push(variant.color);
  }
  return colors;
}

/** Same shape, for `talla`. */
function extractSizes(variants: ProductVariant[]): string[] {
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const variant of variants) {
    if (!variant.size || seen.has(variant.size)) continue;
    seen.add(variant.size);
    sizes.push(variant.size);
  }
  return sizes;
}

/**
 * The variant matching the current picks. A variant that doesn't carry a
 * given axis (no `color`, or no `size` on a category that doesn't use them)
 * is treated as matching that axis unconditionally — the axis simply isn't
 * part of what distinguishes it.
 */
function findMatchingVariant(
  variants: ProductVariant[],
  selectedColor: string | undefined,
  selectedSize: string | undefined,
): ProductVariant | undefined {
  return variants.find((variant) => {
    if (variant.color !== undefined && variant.color !== selectedColor) return false;
    if (variant.size !== undefined && variant.size !== selectedSize) return false;
    return true;
  });
}

/**
 * Badge/marca/nombre/precio + los selectores de color y talla + el CTA y el
 * bloque de pago — todo el carril lateral de la PDP. Cliente porque necesita
 * el estado de la selección de variante (color/talla), que es local: nada
 * hoy consume un link compartible a "este color, esta talla" (no hay
 * carrito para agregar un SKU específico todavía), así que no vive en la
 * URL como los filtros del catálogo.
 */
export function ProductInfo({ product, colorSwatchIndex }: ProductInfoProps) {
  const activeVariants = useMemo(() => product.variants.filter((variant) => variant.isActive), [product.variants]);
  const colors = useMemo(() => extractColors(activeVariants), [activeVariants]);
  const usesSizes = product.category.usesSizes;
  const sizes = useMemo(() => (usesSizes ? extractSizes(activeVariants) : []), [activeVariants, usesSizes]);

  const [selectedColor, setSelectedColor] = useState<string | undefined>(colors[0]);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);

  const colorOptions = colors.map((value) => {
    const swatch = colorSwatchIndex.get(normalizeColorKey(value));
    return { value, hex: swatch?.hex ?? null, secondaryHex: swatch?.secondaryHex ?? null };
  });

  const sizeOptions = sizes.map((value) => ({
    value,
    available: activeVariants.some(
      (variant) => variant.size === value && (variant.color === undefined || variant.color === selectedColor),
    ),
  }));

  const selectedVariant = findMatchingVariant(activeVariants, selectedColor, selectedSize);

  return (
    <div>
      {product.badges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-xs">
          {product.badges.map((badge) => (
            <Badge key={badge.id} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className={product.badges.length > 0 ? "mt-md flex items-center gap-xs" : "flex items-center gap-xs"}>
        <RhinoMark />
        <p className="font-body text-eyebrow uppercase text-grafito">{product.brand.name}</p>
      </div>

      <h1 className="mt-xs font-display text-h2 text-negro">{stripBrandFromName(product.name, product.brand.name)}</h1>

      <div className="mt-sm">
        <ProductPrice basePrice={product.price} compareAtPrice={product.compareAtPrice} selectedVariant={selectedVariant} />
      </div>

      <div className="mt-lg border-t border-borde pt-lg">
        <ProductDescriptionTeaser
          shortDescription={"shortDescription" in product ? product.shortDescription : undefined}
          description={product.description}
        />
      </div>

      {colorOptions.length > 0 ? (
        <div className="mt-lg border-t border-borde pt-lg">
          <ColorSwatchSelector colors={colorOptions} selected={selectedColor} onSelect={setSelectedColor} />
        </div>
      ) : null}

      {sizeOptions.length > 0 ? (
        <div className="mt-xl">
          <SizeSelector sizes={sizeOptions} selected={selectedSize} onSelect={setSelectedSize} />
        </div>
      ) : null}

      <Button variant="primary" size="md" disabled title="Disponible próximamente" className="mt-lg w-full">
        Comprar
      </Button>

      <PaymentMethodsBlock />

      {"relatedAccessories" in product ? (
        <RelatedAccessories accessories={product.relatedAccessories} colorSwatchIndex={colorSwatchIndex} />
      ) : null}
    </div>
  );
}
