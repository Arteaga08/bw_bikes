import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Bike, BikeCategory } from "../models/index.js";

/**
 * One-off content backfill for "Trek Verve+ 2" (`seed-novedades-products.ts`
 * created it with `sizes: []`, `summary: []`, `specGroups: []` — placeholder
 * shape only, M12 entrega 5). Manuel asked to fill in what's missing after
 * noticing the admin wouldn't let him set a talla on this bike.
 *
 * That block turned out to be `BikeCategory("Bicicletas Electricas").usesSizes`,
 * seeded `false` — the admin's `VariantsEditor` only shows the talla column
 * when the product's own category has it on (`ProductEditor.tsx`), same
 * flag the storefront PDP reads (`ProductInfo.tsx`'s `usesSizes`). Real Trek
 * Verve+ bikes do ship in sizes, so this flips it on category-wide, not just
 * for this one product — every other e-bike gains the same talla UI, which
 * is the correct default for the category, not a special case.
 *
 * specGroups/summary content approximates a real Trek Verve+ 2 sheet, kept
 * consistent with the seed's own existing copy ("Motor Bosch... batería
 * integrada... 80km de autonomía") rather than a different generation's
 * specs — demo catalog, so internal consistency with what's already on the
 * PDP mattered more than chasing the exact current-year trim.
 *
 * `specGroups` is six apartados (Motor y batería, Cuadro, Frenos,
 * Transmisión, Ruedas, Peso), not the one apartado literally titled
 * "Especificaciones técnicas" this script originally wrote. That title
 * belongs to the section itself (`ProductSpecSheet.tsx`'s fixed
 * `<ProductDisclosure title="Especificaciones técnicas">`) — a group
 * reusing it duplicated the heading on the PDP and left the ficha with no
 * real categories underneath, which is what Manuel flagged comparing this
 * page against Specialized/Cannondale's. This is the reference the rest of
 * the catalog's fichas should copy.
 *
 * Idempotent: re-running overwrites the same fields with the same values,
 * never duplicates. Bypasses `bikeService` on purpose, same reasoning as
 * `seed-novedades-products.ts` — no `ActorContext` outside HTTP.
 *
 *   pnpm --filter @bw-bikes/api exec tsx src/scripts/backfill-trek-verve-plus2.ts
 */

const BIKE_SLUG = "trek-verve-2";
const CATEGORY_SLUG = "bicicletas-electricas";

const SIZES: Record<string, string> = {
  "Negro Azulado": "M",
  "Rosa Pasion": "L",
};

async function run(): Promise<void> {
  await connectDb();
  try {
    const category = await BikeCategory.findOne({ slug: CATEGORY_SLUG }).exec();
    if (!category) throw new Error(`BikeCategory "${CATEGORY_SLUG}" not found.`);
    if (!category.usesSizes) {
      category.usesSizes = true;
      await category.save();
      logger.info(`[backfill-trek-verve-plus2] "${category.name}" now usesSizes.`);
    }

    const bike = await Bike.findOne({ slug: BIKE_SLUG }).exec();
    if (!bike) throw new Error(`Bike "${BIKE_SLUG}" not found.`);

    for (const variant of bike.variants) {
      const size = variant.color ? SIZES[variant.color] : undefined;
      if (size) variant.size = size;
    }

    bike.summary = [
      { label: "Uso", value: "Urbano / trayectos largos", order: 0 },
      { label: "Motor", value: "Bosch Active Line", order: 1 },
      { label: "Autonomía", value: "Hasta 80 km", order: 2 },
      { label: "Transmisión", value: "Shimano Altus, 8 vel.", order: 3 },
      { label: "Peso", value: "Aprox. 24.5 kg", order: 4 },
    ];

    bike.specGroups = [
      {
        title: "Motor y batería",
        order: 0,
        visible: true,
        fields: [
          { label: "Motor", value: "Bosch Active Line, 250 W, 40 Nm de torque", order: 0, visible: true },
          { label: "Batería", value: "400 Wh, integrada en el cuadro (removible)", order: 1, visible: true },
          { label: "Autonomía", value: "Hasta 80 km en modo Eco", order: 2, visible: true },
          { label: "Panel de control", value: "Bosch Purion, montado en el manubrio", order: 3, visible: true },
        ],
      },
      {
        title: "Cuadro",
        order: 1,
        visible: true,
        fields: [
          { label: "Cuadro", value: "Aluminio Alpha Gold, posición de manejo erguida", order: 0, visible: true },
          { label: "Horquilla", value: "Suspensión, 50 mm de recorrido", order: 1, visible: true },
        ],
      },
      {
        title: "Frenos",
        order: 2,
        visible: true,
        fields: [{ label: "Frenos", value: "Hidráulicos de disco", order: 0, visible: true }],
      },
      {
        title: "Transmisión",
        order: 3,
        visible: true,
        fields: [{ label: "Transmisión", value: "Shimano Altus, 8 velocidades", order: 0, visible: true }],
      },
      {
        title: "Ruedas",
        order: 4,
        visible: true,
        fields: [{ label: "Ruedas", value: "27.5\" x 2.0\"", order: 0, visible: true }],
      },
      {
        title: "Peso",
        order: 5,
        visible: true,
        fields: [{ label: "Peso", value: "Aprox. 24.5 kg", order: 0, visible: true }],
      },
    ];

    await bike.save();
    logger.info(`[backfill-trek-verve-plus2] Updated "${bike.name}": tallas, resumen y ficha técnica.`);
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[backfill-trek-verve-plus2] Failed.");
  process.exit(1);
});
