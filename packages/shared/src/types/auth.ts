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
 * BACKEND_SECURITY_GUIDELINES.md §10). M2 only produces entries for
 * privileged-account events — there are no other admin-facing resources
 * yet to audit.
 */
export type AuditAction = "admin.login" | "admin.two_factor_enrolled" | "admin.two_factor_disabled";
