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
