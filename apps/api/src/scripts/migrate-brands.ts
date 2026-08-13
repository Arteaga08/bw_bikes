import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Brand, MAX_BRAND_NAME_LENGTH } from "../models/index.js";
import { slugify } from "../utils/index.js";

/**
 * One-time migration: `Bike.brand`/`Accessory.brand` used to be a free-text
 * string; this milestone turns it into a reference to the new `Brand`
 * collection. Idempotent — safe to run again against an already-migrated
 * database (it just does nothing on the second pass).
 *
 *   pnpm --filter @bw-bikes/api migrate:brands
 *
 * Reads through the **raw driver collections**, not the `Bike`/`Accessory`
 * Mongoose models: those models now declare `brand` as an `ObjectId`, so
 * hydrating a pre-migration document (where `brand` is still a string) through
 * them would throw a cast error before this script ever got to fix it. The
 * raw collection has no schema to fight.
 */

interface LegacyProduct {
  _id: mongoose.Types.ObjectId;
  brand: unknown;
}

async function assignUniqueSlug(name: string, taken: Set<string>): Promise<string> {
  const base = slugify(name) || "marca";
  let candidate = base;
  let suffix = 1;
  while (taken.has(candidate) || (await Brand.exists({ slug: candidate }))) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  taken.add(candidate);
  return candidate;
}

/** Every distinct, non-empty string `brand` value still sitting in a collection — `null` once every document already carries an `ObjectId`. */
async function collectLegacyBrandNames(collectionName: string): Promise<Set<string>> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active MongoDB connection.");

  const docs = await db.collection<LegacyProduct>(collectionName).find({}, { projection: { brand: 1 } }).toArray();

  const names = new Set<string>();
  for (const doc of docs) {
    if (typeof doc.brand === "string" && doc.brand.trim()) {
      names.add(doc.brand.trim());
    }
  }
  return names;
}

async function migrateCollection(collectionName: string, brandIdByName: Map<string, mongoose.Types.ObjectId>): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active MongoDB connection.");
  const collection = db.collection<LegacyProduct>(collectionName);

  let migrated = 0;
  for (const [name, brandId] of brandIdByName) {
    const result = await collection.updateMany({ brand: name }, { $set: { brand: brandId } });
    migrated += result.modifiedCount;
  }
  return migrated;
}

async function run(): Promise<void> {
  await connectDb();
  try {
    const [bikeNames, accessoryNames] = await Promise.all([
      collectLegacyBrandNames("bikes"),
      collectLegacyBrandNames("accessories"),
    ]);
    const allNames = new Set<string>([...bikeNames, ...accessoryNames]);

    if (allNames.size === 0) {
      logger.info("[migrate-brands] No legacy string brands found — nothing to migrate.");
      return;
    }

    const existingBrands = await Brand.find({ name: { $in: [...allNames] } }).exec();
    const brandIdByName = new Map<string, mongoose.Types.ObjectId>();
    for (const brand of existingBrands) brandIdByName.set(brand.name, brand._id);

    const takenSlugs = new Set<string>((await Brand.find({}, "slug").exec()).map((b) => b.slug));

    for (const name of allNames) {
      if (brandIdByName.has(name)) continue; // Idempotent: a brand with this exact name already exists.

      const truncatedName = name.slice(0, MAX_BRAND_NAME_LENGTH);
      const slug = await assignUniqueSlug(truncatedName, takenSlugs);
      const brand = await Brand.create({ name: truncatedName, slug });
      brandIdByName.set(name, brand._id);
      logger.info(`[migrate-brands] Created brand "${truncatedName}" (${slug}).`);
    }

    const [bikesMigrated, accessoriesMigrated] = await Promise.all([
      migrateCollection("bikes", brandIdByName),
      migrateCollection("accessories", brandIdByName),
    ]);

    logger.info(
      `[migrate-brands] Done. ${brandIdByName.size} brand(s) resolved, ${bikesMigrated} bike(s) and ${accessoriesMigrated} accessory(ies) updated.`,
    );
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[migrate-brands] Migration failed.");
  process.exit(1);
});
