import type { UserRole } from "@bw-bikes/shared";
import { type IUser, User } from "../../src/models/index.js";

/**
 * Creates a user directly against the model, bypassing the public API —
 * legitimate here because `role: "admin"` is intentionally unreachable
 * through registration (anti mass-assignment); tests need a way to get an
 * admin fixture into the DB that mirrors what `scripts/seed-admin.ts` does
 * for real deployments.
 */
export async function createUser(overrides: {
  email: string;
  password?: string;
  role?: UserRole;
  emailVerified?: boolean;
}): Promise<IUser> {
  return User.create({
    email: overrides.email,
    password: overrides.password ?? "Correct-Horse-Battery-Staple-1",
    firstName: "Test",
    lastName: "User",
    role: overrides.role ?? "customer",
    emailVerified: overrides.emailVerified ?? true,
  });
}

export function createAdminUser(overrides: { email: string; password?: string; role?: "admin" | "superadmin" }) {
  return createUser({ ...overrides, emailVerified: true });
}
