/**
 * `customer` is any storefront account. `admin` runs day-to-day operations
 * (orders, catalog, inventory); `superadmin` is the owner-level role that
 * additionally sees other admins' actions (audit trail, M11) and manages
 * admin accounts. Both admin roles require TOTP 2FA — see `protect` in the
 * API, which refuses to issue a session for either role without it enabled.
 */
export type UserRole = "customer" | "admin" | "superadmin";

/**
 * The public shape of a user, as returned by the API (`/auth/me`, register,
 * login). Deliberately excludes every secret/internal field the Mongoose
 * schema carries (password hash, token hashes, encrypted TOTP secret).
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

/**
 * Actions recorded in the append-only audit trail (see
 * BACKEND_SECURITY_GUIDELINES.md §10). M2 covered privileged-account events;
 * M3 adds catalog writes — every mutation an admin performs on a category or
 * a product leaves a trace of who did what to which document. M4 adds
 * inventory, including one action recorded with `actorType: "system"`
 * (`inventory.reservation_expired`, written by the expiry job, which has no
 * human actor).
 *
 * M5 adds orders and payments — the module where an audit gap is most
 * expensive, because every entry answers "why was this customer charged, or
 * not charged?". Several are written by jobs and by the payment webhook, which
 * likewise have no human actor: `order.authorization_expiring`,
 * `order.authorization_expired`, `order.reconciled`, and the provider-driven
 * `order.paid` / `order.refunded` / `order.disputed`.
 *
 * M6 adds fulfillment (shipping address corrections, shipment/tracking
 * capture, the bulk status update — one entry per order, never one for the
 * whole batch) and the ambassador/sponsorship application flow.
 *
 * M7 adds one action **per `Settings` section** — never a generic
 * `settings.updated` — because a section write is exactly the granularity
 * the section-scoped `$set` operates at, and the audit trail should read at
 * the same resolution as the write it records.
 *
 * M11.5 adds the two order fields the queue was missing: `priority_updated`
 * (triage, independent of the state machine) and `note_added` (append-only
 * staff notes). Both are read back by `GET /admin/orders/:id/activity`.
 */
export type AuditAction =
  | "admin.login"
  | "admin.two_factor_enrolled"
  | "admin.two_factor_disabled"
  | "catalog.category_created"
  | "catalog.category_updated"
  | "catalog.category_deleted"
  | "catalog.category_image_updated"
  | "catalog.brand_created"
  | "catalog.brand_updated"
  | "catalog.brand_deleted"
  | "catalog.brand_logo_updated"
  | "catalog.badge_created"
  | "catalog.badge_updated"
  | "catalog.badge_deleted"
  | "catalog.spec_template_created"
  | "catalog.spec_template_updated"
  | "catalog.spec_template_deleted"
  | "catalog.size_template_created"
  | "catalog.size_template_updated"
  | "catalog.size_template_deleted"
  | "catalog.product_created"
  | "catalog.product_updated"
  | "catalog.product_archived"
  | "catalog.product_restored"
  | "catalog.product_deleted"
  | "catalog.gallery_updated"
  | "catalog.geometry_image_updated"
  | "catalog.spec_groups_updated"
  | "inventory.item_created"
  | "inventory.stock_adjusted"
  | "inventory.reservation_expired"
  | "order.created"
  | "order.authorized"
  | "order.paid"
  | "order.supplier_confirmed"
  | "order.supplier_rejected"
  | "order.cancelled"
  | "order.authorization_expiring"
  | "order.authorization_expired"
  | "order.refunded"
  | "order.disputed"
  | "order.reconciled"
  | "order.shipping_address_updated"
  | "order.shipped"
  | "order.shipment_updated"
  | "order.bulk_status_updated"
  | "order.priority_updated"
  | "order.note_added"
  | "application.submitted"
  | "application.approved"
  | "application.rejected"
  | "settings.inventory_updated"
  | "settings.orders_updated"
  | "settings.pricing_updated"
  | "settings.shipping_updated"
  | "settings.applications_updated"
  | "settings.jobs_updated";
