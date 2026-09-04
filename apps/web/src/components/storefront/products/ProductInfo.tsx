"use client";

import type { CustomerFit, ItemType, ProductVariant, PublicAccessory, PublicBike, PublicSizeGuideEntry } from "@bw-bikes/shared";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useVariantAvailability } from "@/hooks/use-variant-availability";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { recommendSize } from "@/lib/size-recommendation";
import { AddToCartButton } from "./AddToCartButton";
import { ColorSwatchSelector } from "./ColorSwatchSelector";
import { FulfillmentModeNotice } from "./FulfillmentModeNotice";
import { PaymentMethodsBlock } from "./PaymentMethodsBlock";
import { ProductDescriptionTeaser } from "./ProductDescriptionTeaser";
import { ProductPrice } from "./ProductPrice";
import { stripBrandFromName } from "./product-name";
import { RelatedAccessories } from "./RelatedAccessories";
import { SaveButton } from "./SaveButton";
import { SizeSelector } from "./SizeSelector";

export interface ProductInfoProps {
  product: PublicBike | PublicAccessory;
  /** Passed explicitly from the PDP page, not inferred — see `ProductDetailProps.itemType`'s own comment. */
  itemType: ItemType;
  /** Product `color` names → their template's hex, built once per page — same map `CatalogProductCard` reads. */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
  /** Bikes only — see `ProductDetailProps.sizeGuide`. */
  sizeGuide?: PublicSizeGuideEntry[];
  /** The signed-in customer's saved fit (A4), if any — `undefined` when logged out. Drives the size preselection below. */
  fit?: CustomerFit;
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
export function ProductInfo({ product, itemType, colorSwatchIndex, sizeGuide = [], fit }: ProductInfoProps) {
  const searchParams = useSearchParams();
  const { isSoldOut } = useVariantAvailability(itemType, [product.id]);

  const activeVariants = useMemo(() => product.variants.filter((variant) => variant.isActive), [product.variants]);
  const colors = useMemo(() => extractColors(activeVariants), [activeVariants]);
  const usesSizes = product.category.usesSizes;
  const sizes = useMemo(() => (usesSizes ? extractSizes(activeVariants) : []), [activeVariants, usesSizes]);

  // A return trip from `/ingresar` (`AddToCartButton`'s `?sku=…&agregar=1`
  // round trip) preselects the exact variant the shopper had picked before
  // being sent to log in, ahead of both the plain default and A4's fit
  // suggestion below.
  const returnedVariant = useMemo(() => {
    const returnedSku = searchParams.get("sku");
    if (!returnedSku) return undefined;
    return activeVariants.find((variant) => variant.sku === returnedSku);
  }, [searchParams, activeVariants]);

  const [selectedColor, setSelectedColor] = useState<string | undefined>(returnedVariant?.color ?? colors[0]);

  // A4-mis-tallas.md: preselects `selectedSize` at mount from the customer's
  // saved height/ride style, only when the recommended size both exists and
  // is available under the initially-picked color — never a size the
  // shopper can't actually buy. `suggestedSize` is kept separately (not
  // re-derived from `selectedSize` later) so the "Sugerida" note only shows
  // for as long as the preselection itself is still the active pick.
  const [suggestedSize] = useState<string | undefined>(() => {
    if (!fit?.heightCm || !fit?.rideStyle || sizeGuide.length === 0) return undefined;
    const recommendation = recommendSize(sizeGuide, fit.heightCm, fit.rideStyle);
    if (!recommendation) return undefined;
    const isAvailable = activeVariants.some(
      (variant) => variant.size === recommendation.primary && (variant.color === undefined || variant.color === colors[0]),
    );
    return isAvailable ? recommendation.primary : undefined;
  });
  const [selectedSize, setSelectedSize] = useState<string | undefined>(returnedVariant?.size ?? suggestedSize);

  const colorOptions = colors.map((value) => {
    const swatch = colorSwatchIndex.get(normalizeColorKey(value));
    return { value, hex: swatch?.hex ?? null, secondaryHex: swatch?.secondaryHex ?? null };
  });

  const sizeOptions = sizes.map((value) => {
    const variant = activeVariants.find(
      (candidate) => candidate.size === value && (candidate.color === undefined || candidate.color === selectedColor),
    );
    return { value, available: variant !== undefined && !isSoldOut(variant.sku) };
  });

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
        <p className="font-body text-eyebrow uppercase text-grafito">
          {product.brand.name}
          {/* Bike-only, optional — `PublicAccessory` never carries it, so the `in` check doubles as the type guard. */}
          {"modelYear" in product && product.modelYear ? <span> · {product.modelYear}</span> : null}
        </p>
      </div>

      <h1 className="mt-xs font-display text-h2 font-extrabold text-negro">{stripBrandFromName(product.name, product.brand.name)}</h1>

      <div className="mt-sm">
        <ProductPrice basePrice={product.price} compareAtPrice={product.compareAtPrice} selectedVariant={selectedVariant} />
      </div>

      <div className="mt-lg">
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
        <div className="mt-lg">
          <SizeSelector
            sizes={sizeOptions}
            selected={selectedSize}
            onSelect={setSelectedSize}
            sizeGuide={sizeGuide}
            initialHeightCm={fit?.heightCm}
          />
          {suggestedSize && selectedSize === suggestedSize ? (
            <p className="mt-xs font-body text-caption text-grafito">Sugerida según tu perfil · cambiar</p>
          ) : null}
        </div>
      ) : null}

      {product.model || ("modelYear" in product && product.modelYear) ? (
        <div className="mt-lg">
          <span className="font-ui text-ui text-grafito">Modelo: </span>
          <span className="font-ui text-ui text-negro">
            {[product.model, "modelYear" in product ? product.modelYear : undefined].filter(Boolean).join(" ")}
          </span>
        </div>
      ) : null}

      {selectedVariant && selectedVariant.fulfillmentMode !== "in_stock" ? (
        <FulfillmentModeNotice
          fulfillmentMode={selectedVariant.fulfillmentMode}
          preorderReleaseDate={selectedVariant.preorderReleaseDate}
        />
      ) : null}

      <div className={selectedVariant && selectedVariant.fulfillmentMode !== "in_stock" ? "mt-sm flex items-center gap-sm" : "mt-lg flex items-center gap-sm"}>
        <AddToCartButton
          itemType={itemType}
          itemId={product.id}
          sku={selectedVariant?.sku}
          isSoldOut={selectedVariant !== undefined && isSoldOut(selectedVariant.sku)}
          productName={product.name}
          className="w-full"
        />
        <SaveButton itemType={itemType} itemId={product.id} />
      </div>

      <PaymentMethodsBlock />

      {"relatedAccessories" in product ? (
        <RelatedAccessories accessories={product.relatedAccessories} colorSwatchIndex={colorSwatchIndex} />
      ) : null}
    </div>
  );
}
