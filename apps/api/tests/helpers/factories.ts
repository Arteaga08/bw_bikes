import type { UserRole } from "@bw-bikes/shared";
import { Bike, BikeCategory, type IBike, type ICategory, type IUser, User } from "../../src/models/index.js";

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

/**
 * Seeds a bike category straight against the model. Used when a test needs a
 * *precondition* rather than to exercise category creation — the CRUD itself
 * is tested through the API in catalog-categories.test.ts.
 */
export function createBikeCategoryDoc(overrides: Partial<Pick<ICategory, "name" | "slug" | "isActive">> = {}) {
  const suffix = Math.random().toString(16).slice(2, 8);
  return BikeCategory.create({
    name: overrides.name ?? "Montaña",
    slug: overrides.slug ?? `montana-${suffix}`,
    isActive: overrides.isActive ?? true,
  });
}

/**
 * Bulk-seeds bikes for pagination assertions. Prices ascend by index so a test
 * can also assert ordering without a second fixture.
 */
export async function seedBikes(count: number, categoryId: unknown): Promise<IBike[]> {
  const docs = Array.from({ length: count }, (_, index) => ({
    name: `Bici ${String(index).padStart(2, "0")}`,
    slug: `bici-${String(index).padStart(2, "0")}`,
    brand: index % 2 === 0 ? "Specialized" : "Canyon",
    category: categoryId,
    shortDescription: "Bici de prueba",
    description: "Descripción de prueba",
    price: 10_000_00 + index * 1_000_00,
    brakeType: "hydraulic_disc",
    variants: [{ sku: `BK-${String(index).padStart(3, "0")}`, size: "M", fulfillmentMode: "in_stock", isActive: true }],
  }));

  return Bike.insertMany(docs) as unknown as Promise<IBike[]>;
}
