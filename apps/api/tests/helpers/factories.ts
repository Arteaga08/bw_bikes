import type { FulfillmentMode, ItemType, UserRole } from "@bw-bikes/shared";
import { Types } from "mongoose";
import {
  Accessory,
  AccessoryCategory,
  Bike,
  BikeCategory,
  type IAccessory,
  type IBike,
  type ICategory,
  type IInventoryItem,
  type IUser,
  InventoryItem,
  User,
} from "../../src/models/index.js";

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

/**
 * Seeds an inventory row straight against the model. Reservation tests care
 * about the counters, not about how the row got there — the admin creation
 * flow (which does validate the SKU against the catalog) is exercised through
 * the API in inventory-admin.test.ts.
 */
export function createInventoryItemDoc(
  overrides: {
    itemType?: ItemType;
    itemId?: Types.ObjectId;
    sku?: string;
    onHand?: number;
    reserved?: number;
  } = {},
): Promise<IInventoryItem> {
  return InventoryItem.create({
    itemType: overrides.itemType ?? "bike",
    itemId: overrides.itemId ?? new Types.ObjectId(),
    sku: overrides.sku ?? "BK-TEST-M",
    onHand: overrides.onHand ?? 0,
    reserved: overrides.reserved ?? 0,
  });
}

/**
 * Seeds a bike with a single variant and returns the ids the transactional
 * layer references (`{ itemId, sku }`). Used by tests that need a *real*
 * catalog entry behind an inventory row, which is what the admin creation
 * endpoint validates against.
 */
export async function seedBikeWithVariant(
  overrides: {
    sku?: string;
    fulfillmentMode?: FulfillmentMode;
    price?: number;
    variantPrice?: number;
    variantActive?: boolean;
    isActive?: boolean;
    withGallery?: boolean;
  } = {},
): Promise<{ bike: IBike; itemId: string; sku: string }> {
  const category = await createBikeCategoryDoc();
  const sku = overrides.sku ?? "BK-STOCK-M";
  const suffix = Math.random().toString(16).slice(2, 8);

  const bike = await Bike.create({
    name: `Bici de inventario ${suffix}`,
    slug: `bici-inventario-${suffix}`,
    brand: "Specialized",
    category: category._id,
    shortDescription: "Bici de prueba",
    description: "Descripción de prueba",
    price: overrides.price ?? 19_999_900,
    brakeType: "hydraulic_disc",
    isActive: overrides.isActive ?? true,
    ...(overrides.isActive === false ? { archivedAt: new Date() } : {}),
    variants: [
      {
        sku,
        size: "M",
        fulfillmentMode: overrides.fulfillmentMode ?? "in_stock",
        isActive: overrides.variantActive ?? true,
        ...(overrides.variantPrice !== undefined ? { price: overrides.variantPrice } : {}),
      },
    ],
    ...(overrides.withGallery
      ? {
          // Out of order on purpose: the snapshot must pick image `order: 0`,
          // not simply the first element of the array.
          gallery: [
            { publicId: `bw/second-${suffix}`, url: "https://example.test/2.jpg", width: 1200, height: 800, order: 1 },
            { publicId: `bw/primary-${suffix}`, url: "https://example.test/1.jpg", width: 1200, height: 800, order: 0 },
          ],
        }
      : {}),
  });

  return { bike, itemId: String(bike._id), sku };
}

/**
 * The accessory-side twin of `seedBikeWithVariant`. Needed because the mixed
 * cart — the rule that defines this milestone — requires one line from each
 * catalog, and the two are genuinely separate collections.
 */
export async function seedAccessoryWithVariant(
  overrides: {
    sku?: string;
    fulfillmentMode?: FulfillmentMode;
    price?: number;
    variantPrice?: number;
    variantActive?: boolean;
    isActive?: boolean;
  } = {},
): Promise<{ accessory: IAccessory; itemId: string; sku: string }> {
  const suffix = Math.random().toString(16).slice(2, 8);
  const category = await AccessoryCategory.create({ name: "Cascos", slug: `cascos-${suffix}`, isActive: true });
  const sku = overrides.sku ?? "AC-STOCK-U";

  const accessory = await Accessory.create({
    name: `Casco de prueba ${suffix}`,
    slug: `casco-prueba-${suffix}`,
    brand: "Giro",
    category: category._id,
    description: "Descripción de prueba",
    price: overrides.price ?? 4_500_00,
    isActive: overrides.isActive ?? true,
    ...(overrides.isActive === false ? { archivedAt: new Date() } : {}),
    variants: [
      {
        sku,
        size: "U",
        fulfillmentMode: overrides.fulfillmentMode ?? "in_stock",
        isActive: overrides.variantActive ?? true,
        ...(overrides.variantPrice !== undefined ? { price: overrides.variantPrice } : {}),
      },
    ],
  });

  return { accessory, itemId: String(accessory._id), sku };
}
