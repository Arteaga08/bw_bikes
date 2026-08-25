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

/** Single currency store. The server fixes it; it never comes from a payload. */
export const CURRENCY = "MXN" as const;

/**
 * Every monetary amount in the system is an **integer number of cents** —
 * never a float. `19999900` is $199,999.00 MXN. Floats accumulate rounding
 * error across order totals and Stripe itself works in the smallest currency
 * unit, so this keeps one representation end to end.
 */
export type PriceCents = number;

/**
 * One `label: value` row inside a spec group — an *especificación* in the
 * admin's Spanish copy. Display-only, never filtered on.
 *
 * `visible` exists because a saved template is a superset: "Eléctrica" carries
 * every row an e-bike could need, and a non-electric bike has to be able to
 * turn a row off without deleting it and losing the shape for next time.
 * `value` may be empty precisely so a turned-off row doesn't have to be filled
 * in to save. The storefront renders a row only when `visible !== false` and
 * `value` is non-blank.
 */
export interface SpecField {
  label: string;
  value: string;
  order: number;
  visible: boolean;
}

/**
 * A named block of the free-form technical sheet ("Transmisión", "Cuadro"...)
 * — an *apartado* in the admin's Spanish copy. The admin builds these per
 * product with no template — see `docs/superpowers/specs/…-design.md`
 * §"Ficha técnica libre". Embedded in the product document, never its own
 * collection.
 *
 * `visible` turns off the whole block at once; same reasoning as `SpecField`'s.
 */
export interface SpecGroup {
  title: string;
  order: number;
  visible: boolean;
  fields: SpecField[];
}

/**
 * One row of a bike's "En pocas palabras" card — the short overview block the
 * PDP shows next to the marketing copy, above the full sheet.
 *
 * Deliberately **not** derived from `SpecGroup`: the summary is written by
 * hand and free to word things differently ("Transmisión: SRAM XX SL Eagle"
 * where the sheet lists shifters, derailleurs and cassette separately). The
 * trade-off the client accepted is that a value appearing in both places is
 * captured twice and has to be corrected twice.
 */
export interface SummaryRow {
  label: string;
  value: string;
  order: number;
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
  /** Optional variant-color tag (free text, matching `ProductVariant.color`) — admin-only for now. Untagged means "shown for every color" once a public gallery reads this. */
  color?: string;
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
  /**
   * Estimated availability date, meaningful only when `fulfillmentMode` is
   * `preorder`. Merchandising copy the storefront renders on the PDP, not an
   * inventory fact — a preorder holds no stock, so it has no inventory row to
   * carry the date.
   */
  preorderReleaseDate?: string;
  isActive: boolean;
  /**
   * Physical stock to seed on creation (M11) — write-only. Accepted only in a
   * `POST` create payload, and only takes effect for `fulfillmentMode:
   * "in_stock"`; `on_request`/`preorder` variants hold no stock so it is
   * silently ignored for them, same as it is on every `PATCH` update (stock
   * capture only happens once, at creation — afterward it moves through
   * `PATCH /admin/inventory/:id/stock`, which carries a reason and an audit
   * entry an initial value never needs). Never persisted on the variant
   * itself and never present on a read: the number of record afterward lives
   * on `InventoryItem.onHand`.
   */
  initialStock?: number;
}

/**
 * A category's single image (M10.2) — deliberately not `ProductImage`: a
 * category never has more than one, so there's no `order` to track. Same
 * Cloudinary-backed shape otherwise (`publicId` is the asset reference,
 * `url` the canonical delivery URL kept for convenience).
 */
export interface CategoryImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
}

/** A category node as served to the storefront. `parent` is null at the root. */
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent: string | null;
  order: number;
  /** When `false`, products in this category don't manage sizes — the admin editor skips the size picker entirely. */
  usesSizes: boolean;
  image?: CategoryImage;
}

/** A root category with its children resolved — the shape `/tree` returns. */
export interface PublicCategoryTreeNode extends PublicCategory {
  children: PublicCategory[];
}

/**
 * A brand as served to the storefront and the admin editor's picker. One
 * collection shared by both catalogs (a brand sells bikes and accessories
 * alike) — see `apps/api/src/models/brand.model.ts`. `slug` is autogenerated
 * from `name` and the one thing a product actually stores a reference by,
 * and what the admin's brand filter sends; `logo` is optional and rendered
 * attenuated (opacity/greyscale via CSS), never a second pre-dimmed asset.
 */
export interface PublicBrand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: CategoryImage;
  order: number;
}

/** The admin panel's view of a brand — same fields plus `isActive` and timestamps, same split as `AdminCategory`. */
export interface AdminBrand extends PublicBrand {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The closed set `components/ui/Badge.tsx` renders — `accent` (dorado) and
 * `unavailable` are the two DESIGN_SYSTEM.md names by spec ("Nuevo"/"E-Bike"
 * and "Agotado"); the rest are the desaturated semantic-status tokens M9–M11
 * added. A merchandising badge picks one of these, never a free hex — the
 * palette is closed by design (one dorado accent per view), so a product
 * badge is a pointer into it, not a new color.
 */
export type BadgeVariant = "accent" | "unavailable" | "exito" | "advertencia" | "error" | "neutral";

/** A merchandising badge ("Novedad", "Bestseller") as served to the storefront and the admin editor's picker. */
export interface PublicBadge {
  id: string;
  label: string;
  slug: string;
  variant: BadgeVariant;
  order: number;
}

/** The admin panel's view of a badge — same fields plus `isActive` and timestamps, same split as `AdminBrand`. */
export interface AdminBadge extends PublicBadge {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A saved shape for a `SpecGroup` — a title and its expected labels, no values. See `apps/api/src/models/spec-template.model.ts`. */
export interface SpecTemplateField {
  label: string;
  order: number;
}

/**
 * Admin-only by construction — there's no public spec-template endpoint (a
 * template only ever feeds the editor's own picker/autocomplete), so unlike
 * `PublicBrand`/`AdminBrand` this is a single shape, not a public/admin
 * split.
 */
export interface SpecTemplate {
  id: string;
  title: string;
  fields: SpecTemplateField[];
  /** `manual`: an admin created it explicitly. `auto`: learned the first time a product saved a group under this title. */
  source: "manual" | "auto";
  order: number;
  isActive: boolean;
}

/**
 * A saved size an admin can offer again on a variant's "Talla" — the
 * single-value sibling of `SpecTemplate`, same admin-only reasoning. See
 * `apps/api/src/models/size-template.model.ts`.
 */
export interface SizeTemplate {
  id: string;
  value: string;
  /** `manual`: an admin created it explicitly. `auto`: learned the first time a variant saved this size. */
  source: "manual" | "auto";
  order: number;
  isActive: boolean;
}

/** Unlike `SizeTemplate`, one shared collection across both catalogs — a color name means the same thing on a bike as on a helmet. */
export interface ColorTemplate {
  id: string;
  value: string;
  /** `#RRGGBB`, or `null` for an entry auto-learned from a variant that was never typed through the admin CRUD. */
  hex: string | null;
  /** Second hex of a two-tone swatch, rendered as a top/bottom split circle. `null` for a solid color. */
  secondaryHex: string | null;
  /** `manual`: an admin created/edited it explicitly. `auto`: learned the first time a variant saved this color. */
  source: "manual" | "auto";
  order: number;
  isActive: boolean;
}

/** Fields both public product shapes share. */
interface PublicProductBase {
  id: string;
  name: string;
  slug: string;
  brand: PublicBrand;
  category: PublicCategory;
  /** Merchandising badges curated by the admin (`Bike.badges`/`Accessory.badges`), max 3 — see `badge.model.ts`. */
  badges: PublicBadge[];
  description: string;
  price: PriceCents;
  compareAtPrice?: PriceCents;
  currency: typeof CURRENCY;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
  /**
   * The one timestamp the storefront does need: the home's "Novedades" rail
   * (M12) merges bikes and accessories into a single list and has to order the
   * result by recency, which it can't do from two separately-sorted responses
   * without a date to compare. The curation flag behind that rail
   * (`Bike.isNewArrival`) stays admin-only — the rail filters by it, never paints it.
   */
  createdAt: string;
}

/**
 * The exact shape the storefront receives for a bike. Deliberately excludes
 * internal admin fields (`isActive`, `archivedAt`, timestamps) — a field the
 * UI doesn't render but the API still sends is a data leak, not a convenience.
 */
export interface PublicBike extends PublicProductBase {
  shortDescription: string;
  /** The "En pocas palabras" card, up to `MAX_SUMMARY_ROWS`. Bikes only — an accessory has no overview block. */
  summary: SummaryRow[];
  /** The geometry chart, a single image with no rows of its own. Bikes only. */
  geometryImage?: CategoryImage;
  /** Manually curated cross-sell (`Bike.relatedAccessories`), resolved for the PDP. */
  relatedAccessories: PublicAccessory[];
}

/** The exact shape the storefront receives for an accessory. */
export type PublicAccessory = PublicProductBase;

/**
 * A category node as the admin panel sees it — same fields as `PublicCategory`
 * plus `isActive`, which the storefront tree never needs (it only ever walks
 * active categories) but the admin table must show to tell an active category
 * apart from a disabled one.
 */
export interface AdminCategory extends PublicCategory {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fields both admin product shapes share, layered on top of the storefront
 * base. Two differences from `PublicProductBase` matter:
 * - `variants` is the **full** array, not filtered to `isActive` — the admin
 *   has to be able to re-enable a variant it turned off.
 * - `isActive`/`archivedAt`/`updatedAt` are present — internal fields the
 *   storefront DTO deliberately omits, per `PublicBike`'s own doc comment.
 *   (`createdAt` is the exception: it's already on `PublicProductBase`.)
 */
interface AdminProductBase extends PublicProductBase {
  /**
   * Curation flag for the home's "Novedades" rail (M12), set by hand from the
   * product editor. Admin-only: the storefront reads it as a query filter
   * (`?isNewArrival=true`), never as a field on the response.
   */
  isNewArrival: boolean;
  isActive: boolean;
  archivedAt: string | null;
  updatedAt: string;
}

/** The exact shape the admin panel receives for a bike, unfiltered variants included. */
export interface AdminBike extends AdminProductBase {
  shortDescription: string;
  /** The "En pocas palabras" card, up to `MAX_SUMMARY_ROWS`. Bikes only, same as `PublicBike`'s. */
  summary: SummaryRow[];
  /** The geometry chart, a single image. Bikes only, same as `PublicBike`'s. */
  geometryImage?: CategoryImage;
  /** Resolved for the editor's picker — includes archived accessories still referenced, unlike the PDP's. */
  relatedAccessories: PublicAccessory[];
}

/** The exact shape the admin panel receives for an accessory. */
export type AdminAccessory = AdminProductBase;
