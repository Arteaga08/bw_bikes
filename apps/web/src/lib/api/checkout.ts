import type { CheckoutResult, PublicOrder } from "@bw-bikes/shared";
import { apiFetch } from "./client";

/**
 * `unauthorizedRedirectPath: null`, same reasoning as `lib/api/cart.ts`'s
 * `ANONYMOUS` constant: a 401 here must resolve to a catchable `ApiError`,
 * never bounce the customer to `/admin/login`. `getOrderByNumber` polls
 * repeatedly from `/gracias/[orderNumber]`, so this matters in practice even
 * though `createOrder` only ever runs after `(checkout)/layout.tsx`'s own
 * session guard already passed.
 */
const CUSTOMER = { unauthorizedRedirectPath: null } as const;

/**
 * `POST /orders` (C2-checkout-pago.md §2, §4). `idempotencyKey` is omitted
 * from the request entirely when absent — the backend treats a missing
 * header as "no idempotency", not as an empty string to match against.
 */
export async function createOrder(idempotencyKey?: string): Promise<CheckoutResult> {
  const { data } = await apiFetch<CheckoutResult>(
    "/orders",
    {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    },
    CUSTOMER,
  );
  return data;
}

export async function getOrderByNumber(orderNumber: string): Promise<PublicOrder> {
  const { data } = await apiFetch<{ order: PublicOrder }>(`/orders/number/${orderNumber}`, undefined, CUSTOMER);
  return data.order;
}
