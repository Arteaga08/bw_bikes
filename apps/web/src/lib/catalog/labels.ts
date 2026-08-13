import type { FulfillmentMode } from "@bw-bikes/shared";
import type { BadgeVariant } from "@/components/ui/Badge";

/**
 * Spanish labels for `FulfillmentMode` — `Record`, not a function with a
 * `default` branch, so adding a mode without updating this map fails
 * `pnpm typecheck` instead of silently rendering `undefined` (same discipline
 * as `ORDER_STATUS_LABELS` in `lib/orders/status.ts`).
 */
export const FULFILLMENT_MODE_LABELS: Record<FulfillmentMode, string> = {
  in_stock: "En stock",
  on_request: "Sobre pedido",
  preorder: "Preventa",
};

export const ALL_FULFILLMENT_MODES = Object.keys(FULFILLMENT_MODE_LABELS) as FulfillmentMode[];

/** In stock is the money-safe state; on request/preorder both wait on a future event. */
export const FULFILLMENT_MODE_BADGE_VARIANTS: Record<FulfillmentMode, BadgeVariant> = {
  in_stock: "exito",
  on_request: "advertencia",
  preorder: "advertencia",
};
