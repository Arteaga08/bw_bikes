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
 * a product leaves a trace of who did what to which document.
 */
export type AuditAction =
  | "admin.login"
  | "admin.two_factor_enrolled"
  | "admin.two_factor_disabled"
  | "catalog.category_created"
  | "catalog.category_updated"
  | "catalog.category_deleted"
  | "catalog.product_created"
  | "catalog.product_updated"
  | "catalog.product_archived"
  | "catalog.product_restored"
  | "catalog.gallery_updated"
  | "catalog.spec_groups_updated";
