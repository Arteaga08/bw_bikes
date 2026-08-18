/**
 * Narrow interface for an internal operational alert to the shop's own
 * team — never a customer-facing message (that's `Mailer`'s job).
 * `order-maintenance.service.ts` is the only caller in M7: it fires exactly
 * where the code already decided something needs the admin's attention
 * (`adminAlertedAt`), rather than inventing a new emission point. Behind a
 * factory (`M7`, this file's `index.ts`) selected by env config; the real
 * Telegram adapter registered ahead of M15, at the owner's request. Neither
 * change touches the caller.
 */
export interface AdminNotification {
  /** Machine-readable category, e.g. `"order.authorization_expiring"` — matches the `AuditAction` it accompanies where one exists. */
  kind: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}

export interface Notifier {
  notifyAdmin(notification: AdminNotification): Promise<void>;
}
