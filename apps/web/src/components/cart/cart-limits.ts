import type { PublicCartLine } from "@bw-bikes/shared";

/**
 * Mirrors `MAX_RESERVATION_QTY` (`apps/api/src/models/stock-reservation.model.ts`)
 * — the backend's own qty ceiling, independent of stock. Duplicated rather than
 * imported: the API's model constants aren't published to the web app.
 */
export const MAX_LINE_QTY = 100;

/**
 * The stepper's ceiling for one line, without ever surfacing the number that
 * produced it (`B-carrito.md` — "el storefront público nunca muestra cifras de
 * stock"). `available: null` means the line owns no stock (`on_request`/
 * `preorder`), so only the qty cap applies.
 */
export function maxQtyFor(line: PublicCartLine): number {
  return line.available === null ? MAX_LINE_QTY : Math.min(line.available, MAX_LINE_QTY);
}
