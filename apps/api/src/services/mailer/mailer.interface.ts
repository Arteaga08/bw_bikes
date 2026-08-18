/**
 * Narrow interface for transactional email — auth's `services` never touch
 * a concrete provider SDK directly (BACKEND_ARCHITECTURE_GUIDELINES.md,
 * "Integraciones externas con múltiples proveedores"). M7 registers this
 * behind a factory selected by env config; the real Resend adapter landed
 * ahead of M15, at the owner's request. Neither requires touching the code
 * that calls `Mailer` methods.
 */
export interface Mailer {
  sendVerificationEmail(params: { to: string; firstName: string; verifyUrl: string }): Promise<void>;
  sendPasswordResetEmail(params: { to: string; firstName: string; resetUrl: string }): Promise<void>;
  /** Fires once per order, only on the `processing` → `shipped` transition — a tracking correction afterward does not re-notify. See `order.service.ts`'s `recordShipment`. */
  sendShipmentNotification(params: {
    to: string;
    firstName: string;
    orderNumber: string;
    carrierName: string;
    trackingNumber: string;
    trackingUrl: string;
  }): Promise<void>;
}
