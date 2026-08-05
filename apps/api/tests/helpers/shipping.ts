import type { ShippingAddress } from "@bw-bikes/shared";
import type { Express } from "express";
import request from "supertest";

/** A valid address, reused everywhere a checkout test needs one on the cart. */
export function sampleShippingAddress(overrides: Partial<ShippingAddress> = {}): ShippingAddress {
  return {
    recipientName: "Ana García",
    phone: "5512345678",
    street: "Av. Reforma 123",
    neighborhood: "Juárez",
    city: "Ciudad de México",
    state: "Ciudad de México",
    postalCode: "06600",
    country: "MX",
    ...overrides,
  };
}

/**
 * Puts a shipping address on the cookie's cart. Checkout takes no body (see
 * `createOrderSchema`), so every test that reaches `POST /orders` needs this
 * first — the same way it needs a cart line.
 */
export async function setShippingAddress(
  app: Express,
  cookie: string,
  overrides: Partial<ShippingAddress> = {},
): Promise<void> {
  await request(app)
    .put("/api/v1/cart/shipping-address")
    .set("Cookie", cookie)
    .send(sampleShippingAddress(overrides));
}
