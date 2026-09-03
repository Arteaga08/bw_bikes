import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Bike, InventoryItem } from "../models/index.js";

/**
 * Content backfill for "Cannolade Quick CX 3", same job as
 * `backfill-trek-verve-plus2.ts` (that script's header explains the pattern
 * and is the reference the rest of the catalog's fichas should copy):
 * `seed-novedades-products.ts` created this bike with `summary: []`,
 * `specGroups: []` and both variants `on_request`, no stock. Manuel asked to
 * fill it in with the same ficha técnica / resumen / variantes-con-stock
 * shape Trek Verve+ 2 already has.
 *
 * No `usesSizes` flip needed here — unlike Rockhopper Comp, this bike's
 * category ("Bicicleta Active") was already seeded with `usesSizes: true`
 * and its two variants already carry a `size` (M/L), so only fulfillment
 * mode and stock change alongside the ficha/resumen.
 *
 * Both variants flip from `on_request` to `in_stock` and get a matching
 * `InventoryItem` row — "con stock" was the explicit ask.
 *
 * Idempotent: re-running overwrites the same fields with the same values
 * and upserts the same `onHand` on the same SKUs, never duplicates.
 * Bypasses `bikeService`/`inventoryService` on purpose, same reasoning as
 * `seed-novedades-products.ts` — no `ActorContext` outside HTTP.
 *
 *   pnpm --filter @bw-bikes/api exec tsx src/scripts/backfill-cannolade-quick-cx3.ts
 */

const BIKE_SLUG = "cannolade-quick-cx-3";

const STOCK: Record<string, number> = {
  "BK-QUICKCX-M": 10,
  "BK-QUICKCX-L": 7,
};

async function run(): Promise<void> {
  await connectDb();
  try {
    const bike = await Bike.findOne({ slug: BIKE_SLUG }).exec();
    if (!bike) throw new Error(`Bike "${BIKE_SLUG}" not found.`);

    for (const variant of bike.variants) {
      variant.fulfillmentMode = "in_stock";
    }

    bike.summary = [
      { label: "Uso", value: "Urbano / fitness diario", order: 0 },
      { label: "Cuadro", value: "Aluminio ligero", order: 1 },
      { label: "Frenos", value: "Mecánicos de disco", order: 2 },
      { label: "Transmisión", value: "Shimano Altus, 21 vel.", order: 3 },
      { label: "Peso", value: "Aprox. 12.8 kg", order: 4 },
    ];

    bike.specGroups = [
      {
        title: "Cuadro",
        order: 0,
        visible: true,
        fields: [
          { label: "Cuadro", value: "Aluminio ligero, geometría fitness cómoda", order: 0, visible: true },
          { label: "Horquilla", value: "Rígida, aluminio con ojillos para portaequipaje", order: 1, visible: true },
        ],
      },
      {
        title: "Frenos",
        order: 1,
        visible: true,
        fields: [{ label: "Frenos", value: "Mecánicos de disco", order: 0, visible: true }],
      },
      {
        title: "Transmisión",
        order: 2,
        visible: true,
        fields: [
          { label: "Transmisión", value: "Shimano Altus, 21 velocidades (3x7)", order: 0, visible: true },
          { label: "Cambios", value: "Shimano Tourney (delantero), Altus (trasero)", order: 1, visible: true },
        ],
      },
      {
        title: "Ruedas",
        order: 3,
        visible: true,
        fields: [{ label: "Ruedas", value: "700c x 35c, neumáticos de rodamiento rápido", order: 0, visible: true }],
      },
      {
        title: "Accesorios",
        order: 4,
        visible: true,
        fields: [
          { label: "Portaequipaje", value: "Preinstalado, compatible con alforjas traseras", order: 0, visible: true },
          { label: "Guardafangos", value: "Puntos de anclaje listos para instalar", order: 1, visible: true },
        ],
      },
      {
        title: "Peso",
        order: 5,
        visible: true,
        fields: [{ label: "Peso", value: "Aprox. 12.8 kg", order: 0, visible: true }],
      },
    ];

    await bike.save();
    logger.info(`[backfill-cannolade-quick-cx3] Updated "${bike.name}": resumen, ficha técnica y modo de surtido.`);

    for (const variant of bike.variants) {
      const onHand = STOCK[variant.sku];
      if (onHand === undefined) continue;

      await InventoryItem.findOneAndUpdate(
        { itemType: "bike", itemId: bike._id, sku: variant.sku },
        { $setOnInsert: { itemType: "bike", itemId: bike._id, sku: variant.sku }, $set: { onHand } },
        { upsert: true },
      ).exec();
      logger.info(`[backfill-cannolade-quick-cx3] Stock set for "${variant.sku}": onHand=${onHand}.`);
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[backfill-cannolade-quick-cx3] Failed.");
  process.exit(1);
});
