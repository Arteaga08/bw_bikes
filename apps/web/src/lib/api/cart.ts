import type { BillingInfo, ItemType, PublicCart, ShippingAddress } from "@bw-bikes/shared";
import { apiFetch } from "./client";

/**
 * Every call here passes `unauthorizedRedirectPath: null` — the cart mounts on
 * every storefront page via `CartProvider`, so an anonymous visitor's 401 must
 * resolve to a catchable `ApiError` (read as `status: "anonymous"`), never
 * bounce them to `/admin/login` (B-carrito.md §2).
 */
const ANONYMOUS = { unauthorizedRedirectPath: null } as const;

export async function getCart(): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>("/cart", undefined, ANONYMOUS);
  return data.cart;
}

export async function addCartLine(itemType: ItemType, itemId: string, sku: string, qty: number): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/lines",
    { method: "POST", body: JSON.stringify({ itemType, itemId, sku, qty }) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function updateCartLine(itemType: ItemType, sku: string, qty: number): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    `/cart/lines/${itemType}/${sku}`,
    { method: "PATCH", body: JSON.stringify({ qty }) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function removeCartLine(itemType: ItemType, sku: string): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(`/cart/lines/${itemType}/${sku}`, { method: "DELETE" }, ANONYMOUS);
  return data.cart;
}

export async function clearCart(): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>("/cart", { method: "DELETE" }, ANONYMOUS);
  return data.cart;
}

export async function applyCartCoupon(code: string): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/coupon",
    { method: "POST", body: JSON.stringify({ code }) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function removeCartCoupon(): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>("/cart/coupon", { method: "DELETE" }, ANONYMOUS);
  return data.cart;
}

export async function setCartShippingAddress(address: ShippingAddress): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/shipping-address",
    { method: "PUT", body: JSON.stringify(address) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function setCartBillingInfo(billingInfo: BillingInfo): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>(
    "/cart/billing-info",
    { method: "PUT", body: JSON.stringify(billingInfo) },
    ANONYMOUS,
  );
  return data.cart;
}

export async function removeCartBillingInfo(): Promise<PublicCart> {
  const { data } = await apiFetch<{ cart: PublicCart }>("/cart/billing-info", { method: "DELETE" }, ANONYMOUS);
  return data.cart;
}
