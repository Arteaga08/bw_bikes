/**
 * Narrow interface for transactional email — auth's `services` never touch
 * a concrete provider SDK directly (BACKEND_ARCHITECTURE_GUIDELINES.md,
 * "Integraciones externas con múltiples proveedores"). M7 registers this
 * behind a factory selected by env config; the real Resend adapter landed
 * ahead of M15, at the owner's request. Neither requires touching the code
 * that calls `Mailer` methods.
 */
/**
 * What a customer-facing order summary shows per line — the product's
 * **name**, not its SKU: a customer recognizes "Tarmac SL7 Expert", not
 * "BK-TARMAC-M". SKU stays reserved for the admin-facing alert
 * (`order.service.ts`'s `markPaid`), where it's what the warehouse pulls by.
 */
export interface OrderLineSummary {
  name: string;
  qty: number;
  size?: string;
  color?: string;
}

export interface Mailer {
  sendVerificationEmail(params: { to: string; firstName: string; verifyUrl: string }): Promise<void>;
  sendPasswordResetEmail(params: { to: string; firstName: string; resetUrl: string }): Promise<void>;
  /**
   * Fires once per order, only on the `processing` → `shipped` transition —
   * a tracking correction afterward does not re-notify. Carries `lines` so
   * the customer sees what shipped, not just that something did. See
   * `order.service.ts`'s `recordShipment`.
   */
  sendShipmentNotification(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    carrierName: string;
    trackingNumber: string;
    trackingUrl: string;
    lines: OrderLineSummary[];
  }): Promise<void>;
  /** Fires on every real transition to `paid` — instant capture or supplier-confirmed, unlike the admin Telegram alert which only fires for the instant case. See `order.service.ts`'s `markPaid`. */
  sendOrderPaidEmail(params: { to: string; firstName: string; orderNumber: string; totalCents: number }): Promise<void>;
  /** Fires when an order enters `processing` — today only reachable via the admin bulk-status endpoint. See `order.service.ts`'s `bulkUpdateStatus`. */
  sendOrderProcessingEmail(params: { to: string; firstName: string; orderNumber: string }): Promise<void>;
  /** Fires when an order enters `delivered`. See `order.service.ts`'s `bulkUpdateStatus`. */
  sendOrderDeliveredEmail(params: { to: string; firstName: string; orderNumber: string }): Promise<void>;
  /** Fires on `markRefunded` — today only reachable through the `charge.refunded` webhook, there is no manual refund flow. */
  sendRefundConfirmedEmail(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    refundedAmountCents: number;
  }): Promise<void>;
  /** Fires on `markPaymentFailed` — informs the customer the attempt didn't go through, never mentions a refund (nothing was charged). */
  sendPaymentFailedEmail(params: { to: string; firstName: string; orderNumber: string }): Promise<void>;
  /**
   * A coupon an admin chose to send to a specific customer (M21).
   *
   * **`message` is plain text, not HTML — and that distinction is the whole
   * security story of this method.** Every other email here is composed by
   * this codebase; this is the first one a human writes. `renderTransactional
   * Email` treats its `bodyParagraphs` as already-safe HTML, so handing it an
   * admin's raw input would make the panel a stored-XSS vector aimed at the
   * shop's own customers. `coupon-campaign.service.ts` escapes it explicitly
   * before it ever reaches the template — it does not rely on
   * `sanitizeInput`, because a middleware two layers away is not where a
   * guarantee like this should live.
   */
  sendCouponEmail(params: {
    to: string;
    firstName: string;
    code: string;
    /** Optional note from the admin. Plain text — see above. */
    message?: string;
    expiresAt?: string;
    /** Ready-to-render summary of the offer ("10% de descuento", "$500 MXN de descuento"). */
    discountLabel: string;
  }): Promise<void>;
  /**
   * Second channel for an admin alert `Notifier`/Telegram already carries —
   * never the sole path to one. Generic on purpose: every admin alert reuses
   * this one method with its own subject/copy, the same way every customer
   * email reuses `renderTransactionalEmail`, rather than growing a new
   * `Mailer` method per admin event.
   */
  sendAdminAlertEmail(params: { subject: string; title: string; bodyParagraphs: string[] }): Promise<void>;
}
