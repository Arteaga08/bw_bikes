import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Bike, BikeCategory, InventoryItem } from "../models/index.js";

/**
 * Content backfill for "Specialized Rockhopper Comp", same job as
 * `backfill-trek-verve-plus2.ts` (that script's header explains the pattern
 * and is the reference the rest of the catalog's fichas should copy):
 * `seed-novedades-products.ts` created this bike with `summary: []`,
 * `specGroups: []` and both variants `on_request`, no stock. Manuel asked to
 * fill it in with the same ficha técnica / resumen / variantes-con-stock
 * shape Trek Verve+ 2 already has.
 *
 * Same category-wide `usesSizes` flip as the Trek script and for the same
 * reason: `BikeCategory("Bicicleta de Montaña").usesSizes` was seeded
 * `false`, which hides the talla column in the admin's `VariantsEditor` and
 * the storefront PDP's `ProductInfo`. Real Rockhopper Comp bikes ship in
 * frame sizes, so this is the correct category-wide default, not a
 * one-product special case — no other bike in the catalog uses this
 * category yet, so nothing else is affected today.
 *
 * Both variants flip from `on_request` to `in_stock` and get a matching
 * `InventoryItem` row — "con stock" was the explicit ask, unlike Trek
 * Verve+2 (which deliberately kept one variant `on_request` and left two of
 * its three SKUs stockless).
 *
 * Idempotent: re-running overwrites the same fields with the same values
 * (variant sizes, summary, specGroups) and upserts the same `onHand` on the
 * same SKUs, never duplicates. Bypasses `bikeService`/`inventoryService` on
 * purpose, same reasoning as `seed-novedades-products.ts` — no
 * `ActorContext` outside HTTP.
 *
 *   pnpm --filter @bw-bikes/api exec tsx src/scripts/backfill-specialized-rockhopper-comp.ts
 */

const BIKE_SLUG = "specialized-rockhopper-comp";
const CATEGORY_SLUG = "bicicleta-de-montana";

const SIZES: Record<string, string> = {
  "Negro Azulado": "S",
  "Rosa Pasion": "L",
};

const STOCK: Record<string, number> = {
  "BK-ROCKHOPPER-A": 9,
  "BK-ROCKHOPPER-B": 6,
};

async function run(): Promise<void> {
  await connectDb();
  try {
    const category = await BikeCategory.findOne({ slug: CATEGORY_SLUG }).exec();
    if (!category) throw new Error(`BikeCategory "${CATEGORY_SLUG}" not found.`);
    if (!category.usesSizes) {
      category.usesSizes = true;
      await category.save();
      logger.info(`[backfill-rockhopper-comp] "${category.name}" now usesSizes.`);
    }

    const bike = await Bike.findOne({ slug: BIKE_SLUG }).exec();
    if (!bike) throw new Error(`Bike "${BIKE_SLUG}" not found.`);

    for (const variant of bike.variants) {
      const size = variant.color ? SIZES[variant.color] : undefined;
      if (size) variant.size = size;
      variant.fulfillmentMode = "in_stock";
    }

    bike.summary = [
      { label: "Uso", value: "Montaña / sendero", order: 0 },
      { label: "Cuadro", value: "Aluminio A1 Premium", order: 1 },
      { label: "Suspensión", value: "Horquilla, 100 mm de recorrido", order: 2 },
      { label: "Transmisión", value: "Shimano Altus, 9 vel.", order: 3 },
      { label: "Peso", value: "Aprox. 14.2 kg", order: 4 },
    ];

    bike.specGroups = [
      {
        title: "Cuadro",
        order: 0,
        visible: true,
        fields: [
          { label: "Cuadro", value: "Aluminio A1 Premium, geometría trail moderna", order: 0, visible: true },
          { label: "Horquilla", value: "SR Suntour XCT, 100 mm de recorrido", order: 1, visible: true },
        ],
      },
      {
        title: "Frenos",
        order: 1,
        visible: true,
        fields: [{ label: "Frenos", value: "Hidráulicos de disco", order: 0, visible: true }],
      },
      {
        title: "Transmisión",
        order: 2,
        visible: true,
        fields: [
          { label: "Transmisión", value: "Shimano Altus, 9 velocidades", order: 0, visible: true },
          { label: "Cambio trasero", value: "Shimano Altus RD-M2000", order: 1, visible: true },
        ],
      },
      {
        title: "Ruedas",
        order: 3,
        visible: true,
        fields: [{ label: "Ruedas", value: "29\" x 2.3\", doble pared", order: 0, visible: true }],
      },
      {
        title: "Cockpit",
        order: 4,
        visible: true,
        fields: [
          { label: "Manubrio", value: "Aluminio, riser 720 mm", order: 0, visible: true },
          { label: "Tija", value: "Aluminio, 30.9 mm", order: 1, visible: true },
        ],
      },
      {
        title: "Peso",
        order: 5,
        visible: true,
        fields: [{ label: "Peso", value: "Aprox. 14.2 kg", order: 0, visible: true }],
      },
    ];

    await bike.save();
    logger.info(`[backfill-rockhopper-comp] Updated "${bike.name}": tallas, resumen, ficha técnica y modo de surtido.`);

    for (const variant of bike.variants) {
      const onHand = STOCK[variant.sku];
      if (onHand === undefined) continue;

      await InventoryItem.findOneAndUpdate(
        { itemType: "bike", itemId: bike._id, sku: variant.sku },
        { $setOnInsert: { itemType: "bike", itemId: bike._id, sku: variant.sku }, $set: { onHand } },
        { upsert: true },
      ).exec();
      logger.info(`[backfill-rockhopper-comp] Stock set for "${variant.sku}": onHand=${onHand}.`);
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[backfill-rockhopper-comp] Failed.");
  process.exit(1);
});
