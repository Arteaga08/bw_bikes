/**
 * Explicit, single lifecycle enum for an Order. Every transition is verified
 * server-side (apps/api/src/services/order.service.ts) — never inferred from
 * other fields, never skipped.
 *
 *   pending_payment ──► authorized ──► awaiting_supplier_confirmation ──► paid ──► processing ──► shipped ──► delivered
 *          │                                    │
 *          │ (all lines in_stock, captured immediately)
 *          └────────────────────────────────────┴──► paid ──► processing ──► shipped ──► delivered
 *
 *   authorized / awaiting_supplier_confirmation ──► cancelled (admin rejects, or authorization expires)
 *   paid ──► refunded (post-payment refund/dispute resolution)
 */
export type OrderStatus =
  | "pending_payment"
  | "authorized"
  | "awaiting_supplier_confirmation"
  | "authorization_expired"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";
