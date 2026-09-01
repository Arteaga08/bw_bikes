import type { BillingInfo } from "./billing.js";
import type { ItemType, PublicAccessory, PublicBike } from "./catalog.js";
import type { MexicanState } from "./shipping.js";

/**
 * The customer account (`GET /api/v1/account`, M13). A2 fills only the
 * profile fields below; A3–A5 extend this same shape with addresses, billing
 * info, fit, and wishlist as each is built — the DTO is defined complete
 * from the start so those entregas only add fields, never reshape this one.
 */
export interface AccountDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  city?: string;
  addresses: SavedAddress[];
  billingInfo?: BillingInfo;
  fit?: CustomerFit;
  /**
   * Just the count, not the hydrated list (A5-guardados.md): resolving every
   * saved product against the live catalog is worth paying for only on
   * `GET /account/wishlist`, not on every `GET /account` read.
   */
  wishlistCount: number;
}

export interface UpdateAccountProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthDate?: string;
  city?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * One entry in the customer's address book (`User.addresses`, A3). Same
 * fields as `ShippingAddress` plus `label` and `isDefault` — see
 * `apps/api/src/models/schemas/saved-address.schema.ts` for why this is a
 * separate schema rather than a reuse of `ShippingAddress` directly.
 */
export interface SavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  recipientName: string;
  phone: string;
  street: string;
  interiorNumber?: string;
  neighborhood: string;
  city: string;
  state: MexicanState;
  postalCode: string;
  country: "MX";
  references?: string;
}

export type SaveAddressInput = Omit<SavedAddress, "id" | "isDefault">;

/**
 * How a shopper prefers to ride — mirrors `RideStyle` in
 * `apps/web/src/lib/size-recommendation.ts` (structurally identical, kept as
 * a separate literal so the API layer never imports from `apps/web`).
 */
export const RIDE_STYLE_VALUES = ["comfortable", "balanced", "performance"] as const;
export type RideStyle = (typeof RIDE_STYLE_VALUES)[number];

/** Equipment size categories a customer can save (A4). Values in English, labels in Spanish for the UI. */
export const GEAR_SIZE_CATEGORIES = [
  "helmet",
  "handlebar_width",
  "saddle_width",
  "shorts",
  "top",
  "bottom",
  "gloves",
] as const;
export type GearSizeCategory = (typeof GEAR_SIZE_CATEGORIES)[number];

export const GEAR_SIZE_CATEGORY_LABELS: Record<GearSizeCategory, string> = {
  helmet: "Cascos",
  handlebar_width: "Ancho del manubrio",
  saddle_width: "Ancho del sillín",
  shorts: "Shorts",
  top: "Partes superiores",
  bottom: "Partes inferiores",
  gloves: "Guantes",
};

export const MAX_GEAR_SIZES = GEAR_SIZE_CATEGORIES.length;

/** One saved equipment size — `value` is free text since each category has its own sizing convention ("M", "42", "54cm"). */
export interface GearSize {
  category: GearSizeCategory;
  value: string;
}

/**
 * The customer's fit profile (`User.fit`, A4): height + ride style, used to
 * preselect a bike's size on the PDP via `recommendSize`, plus saved
 * equipment sizes.
 */
export interface CustomerFit {
  heightCm?: number;
  rideStyle?: RideStyle;
  gearSizes: GearSize[];
}

export type UpdateFitInput = Partial<CustomerFit>;

/** Cap on `User.wishlist` (A5-guardados.md), same reasoning as `MAX_SAVED_ADDRESSES`: a short list only its owner ever reads, not a reason for pagination. */
export const MAX_WISHLIST_ITEMS = 50;

/** One saved product reference (`User.wishlist`, A5) — stores only what's needed to look the product up again; price and name are re-resolved on every read, never persisted here (see `WishlistEntry`). */
export interface WishlistItem {
  itemType: ItemType;
  itemId: string;
  addedAt: string;
}

export type AddWishlistItemInput = Pick<WishlistItem, "itemType" | "itemId">;

/**
 * `GET /account/wishlist`'s hydrated view of one `WishlistItem` — the product
 * is re-resolved against the live catalog on every read (A5-guardados.md), so
 * a saved product never just disappears: an archived one comes back with
 * `isAvailable: false` and its last-known `product` data instead, and the
 * client decides whether to remove it. `product` is only absent for an
 * `itemId` that no longer resolves to any document at all.
 */
export interface WishlistEntry extends WishlistItem {
  isAvailable: boolean;
  product?: PublicBike | PublicAccessory;
}
