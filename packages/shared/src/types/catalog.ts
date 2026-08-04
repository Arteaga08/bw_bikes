/**
 * Discriminator between the two independent catalog trees (Bike vs Accessory).
 * Used by the shared transactional layer (inventory, cart, order lines) to
 * reference either catalog without merging their schemas.
 */
export type ItemType = "bike" | "accessory";

/**
 * How a product variant is fulfilled. Drives whether a purchase reserves
 * physical inventory immediately or goes through supplier confirmation
 * (manual capture) before any charge is finalized.
 */
export type FulfillmentMode = "in_stock" | "on_request" | "preorder";

/**
 * Brake type is a **first-class filter field**, not a spec-sheet entry. The
 * free-form `specGroups` are display-only (see `SpecGroup` below), so anything
 * the storefront must filter on has to live in its own typed column — this is
 * the direct consequence the client accepted when choosing a template-less
 * spec sheet. Bikes only; accessories don't have brakes.
 */
export type BrakeType = "hydraulic_disc" | "mechanical_disc" | "rim";

/** Single currency store. The server fixes it; it never comes from a payload. */
export const CURRENCY = "MXN" as const;

/**
 * Every monetary amount in the system is an **integer number of cents** —
 * never a float. `19999900` is $199,999.00 MXN. Floats accumulate rounding
 * error across order totals and Stripe itself works in the smallest currency
 * unit, so this keeps one representation end to end.
 */
export type PriceCents = number;

/** One `label: value` row inside a spec group. Display-only, never filtered on. */
export interface SpecField {
  label: string;
  value: string;
  order: number;
}

/**
 * A named block of the free-form technical sheet ("Transmisión", "Cuadro"...).
 * The admin builds these per product with no template — see
 * `docs/superpowers/specs/…-design.md` §"Ficha técnica libre". Embedded in the
 * product document, never its own collection.
 */
export interface SpecGroup {
  title: string;
  order: number;
  fields: SpecField[];
}

/**
 * A gallery image, stored as its Cloudinary `publicId` rather than a baked
 * URL — that's what lets the storefront request several widths of the same
 * original for a responsive `srcset` (see `buildImageUrl`). `url` is the
 * canonical delivery URL, kept for convenience and for consumers that don't
 * transform.
 */
export interface ProductImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
  order: number;
}

/**
 * A purchasable variant. `sku` is what the transactional layer (M4 inventory,
 * M5 cart/order lines) references together with `{ itemType, itemId }`.
 * `price` is optional and **overrides** the product-level price when present
 * (an XL frame or a limited-edition color that costs more).
 */
export interface ProductVariant {
  sku: string;
  size?: string;
  color?: string;
  price?: PriceCents;
  fulfillmentMode: FulfillmentMode;
  isActive: boolean;
}

/** A category node as served to the storefront. `parent` is null at the root. */
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent: string | null;
  order: number;
}

/** A root category with its children resolved — the shape `/tree` returns. */
export interface PublicCategoryTreeNode extends PublicCategory {
  children: PublicCategory[];
}

/** Fields both public product shapes share. */
interface PublicProductBase {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: PublicCategory;
  description: string;
  price: PriceCents;
  compareAtPrice?: PriceCents;
  currency: typeof CURRENCY;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
}

/**
 * The exact shape the storefront receives for a bike. Deliberately excludes
 * internal admin fields (`isActive`, `archivedAt`, timestamps) — a field the
 * UI doesn't render but the API still sends is a data leak, not a convenience.
 */
export interface PublicBike extends PublicProductBase {
  shortDescription: string;
  brakeType: BrakeType;
  /** Manually curated cross-sell (`Bike.relatedAccessories`), resolved for the PDP. */
  relatedAccessories: PublicAccessory[];
}

/** The exact shape the storefront receives for an accessory. */
export type PublicAccessory = PublicProductBase;
