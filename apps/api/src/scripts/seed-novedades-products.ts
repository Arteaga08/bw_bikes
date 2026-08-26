import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Accessory, AccessoryCategory, Bike, BikeCategory, Brand } from "../models/index.js";
import { slugify } from "../utils/index.js";

/**
 * Seeds 10 catalog products (5 bikes, 5 accessories) for M12 entrega 5
 * ("Novedades") — Manuel's ask: real brand/category/size/color data wired
 * up so he only has to open each one in the admin, drop a photo in and flip
 * the "Marcar como novedad" toggle.
 *
 * Reuses the existing catalog wherever it already covers what a product
 * needs (brands, bike categories, `BikeSizeTemplate`/`ColorTemplate` values)
 * — no fixtures invented for those. The one gap: only one `AccessoryCategory`
 * existed ("Cascos"), too thin for 5 varied accessories, so this also
 * creates four more real categories (`upsertCategory` below) the same way
 * the admin's own "Nueva categoría" flow would.
 *
 * Idempotent by slug — safe to re-run; an existing product/category is left
 * untouched rather than duplicated or overwritten (so it never clobbers a
 * photo/isNewArrival Manuel already set by hand).
 *
 *   pnpm --filter @bw-bikes/api seed:novedades-products
 *
 * Bypasses `bikeService`/`accessoryService` on purpose, same as
 * `seed-batch-orders.ts`'s own catalog helper: those require an
 * `ActorContext` (an admin session id) for the audit log, which a script
 * run outside HTTP doesn't have. No inventory is seeded either — this is
 * about the catalog rail, not stock; every variant is `on_request` so
 * nothing here claims stock that doesn't exist.
 */

const COLORS = ["Negro Azulado", "Rosa Pasion", "Rojo Viper", "Negro Trek"] as const;

async function requireBrand(slug: string): Promise<{ id: string; name: string }> {
  const brand = await Brand.findOne({ slug }).exec();
  if (!brand) throw new Error(`[seed-novedades-products] Brand "${slug}" not found — seed it from the admin first.`);
  return { id: String(brand._id), name: brand.name };
}

async function requireBikeCategory(slug: string): Promise<{ id: string; usesSizes: boolean }> {
  const category = await BikeCategory.findOne({ slug }).exec();
  if (!category) {
    throw new Error(`[seed-novedades-products] BikeCategory "${slug}" not found — seed it from the admin first.`);
  }
  return { id: String(category._id), usesSizes: category.usesSizes };
}

/** Creates the accessory category if it doesn't exist yet — same shape `CategoryFormModal` posts. */
async function upsertAccessoryCategory(name: string, usesSizes: boolean): Promise<string> {
  const slug = slugify(name);
  const existing = await AccessoryCategory.findOne({ slug }).exec();
  if (existing) return String(existing._id);

  const created = await AccessoryCategory.create({ name, slug, usesSizes, order: 0 });
  logger.info(`[seed-novedades-products] Created accessory category "${name}".`);
  return String(created._id);
}

interface BikeSeed {
  name: string;
  brandSlug: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  skuPrefix: string;
  sizes: readonly string[];
}

interface AccessorySeed {
  name: string;
  brandSlug: string;
  categoryName: string;
  categoryUsesSizes: boolean;
  description: string;
  priceCents: number;
  skuPrefix: string;
}

const BIKE_SEEDS: BikeSeed[] = [
  {
    name: "Orbea Orca M30",
    brandSlug: "orbea",
    categorySlug: "ruta",
    shortDescription: "Bici de ruta de carbono, ligera y rígida para rodar rápido en asfalto.",
    description:
      "Cuadro de carbono de altas prestaciones pensado para el ciclista que compite o entrena en serio. " +
      "Geometría agresiva, transmisión precisa y un peso que se nota en cada subida.",
    priceCents: 8_999_900,
    skuPrefix: "BK-ORCA-M30",
    sizes: ["M4", "M", "L"],
  },
  {
    name: "Cube Attain SL",
    brandSlug: "cube",
    categorySlug: "bicicleta-gravel",
    shortDescription: "Gravel versátil para asfalto y terracería, lista para la aventura de fin de semana.",
    description:
      "Cuadro de aluminio ligero con geometría relajada y llantas de mayor volumen para absorber terreno " +
      "irregular sin perder eficiencia en tramos de asfalto. Frenos de disco hidráulicos de serie.",
    priceCents: 3_499_900,
    skuPrefix: "BK-ATTAIN-SL",
    sizes: [],
  },
  {
    name: "Specialized Rockhopper Comp",
    brandSlug: "specialized",
    categorySlug: "bicicleta-de-montana",
    shortDescription: "Montañera de entrada a media gama, confiable en cualquier sendero.",
    description:
      "Cuadro de aluminio A1 Premium con horquilla de suspensión de 100mm de recorrido. La opción clásica " +
      "para quien empieza en montaña y quiere una bici que no lo limite mientras mejora su técnica.",
    priceCents: 2_199_900,
    skuPrefix: "BK-ROCKHOPPER",
    sizes: [],
  },
  {
    name: "Cannolade Quick CX 3",
    brandSlug: "cannolade",
    categorySlug: "bicicleta-active",
    shortDescription: "Híbrida urbana ágil, pensada para el trayecto diario y el ejercicio entre semana.",
    description:
      "Geometría cómoda tipo fitness con neumáticos rápidos para asfalto. Portaequipaje y guardafangos " +
      "listos para instalar — la bici pensada para ir y volver del trabajo sin drama.",
    priceCents: 1_799_900,
    skuPrefix: "BK-QUICKCX",
    sizes: ["M", "L"],
  },
  {
    name: "Trek Verve+ 2",
    brandSlug: "trek",
    categorySlug: "bicicletas-electricas",
    shortDescription: "Híbrida eléctrica con motor de asistencia, ideal para trayectos largos sin llegar cansado.",
    description:
      "Motor Bosch de asistencia al pedaleo y batería integrada en el cuadro para hasta 80km de autonomía. " +
      "Posición de manejo erguida y componentes pensados para uso urbano diario.",
    priceCents: 5_299_900,
    skuPrefix: "BK-VERVE-PLUS2",
    sizes: [],
  },
];

const ACCESSORY_SEEDS: AccessorySeed[] = [
  {
    name: "Bomba de piso Track Pump",
    brandSlug: "specialized",
    categoryName: "Bombas de aire",
    categoryUsesSizes: false,
    description: "Bomba de piso con manómetro de fácil lectura y cabezal reversible para válvulas Presta y Schrader.",
    priceCents: 89_900,
    skuPrefix: "AC-TRACKPUMP",
  },
  {
    name: "Botella Purist 24oz",
    brandSlug: "specialized",
    categoryName: "Botellas",
    categoryUsesSizes: false,
    description: "Botella de 710ml con tecnología antisarro que evita el sabor a plástico incluso después de meses de uso.",
    priceCents: 24_900,
    skuPrefix: "AC-PURIST24",
  },
  {
    name: "Luz delantera Blaze 1000",
    brandSlug: "trek",
    categoryName: "Luces",
    categoryUsesSizes: false,
    description: "Luz delantera recargable por USB-C, 1000 lúmenes, cinco modos de intensidad para ciudad o carretera.",
    priceCents: 129_900,
    skuPrefix: "AC-BLAZE1000",
  },
  {
    name: "Candado plegable FoldLite 6",
    brandSlug: "trek",
    categoryName: "Candados",
    categoryUsesSizes: false,
    description: "Candado plegable de acero endurecido, 6 eslabones, con funda para montar en el cuadro.",
    priceCents: 99_900,
    skuPrefix: "AC-FOLDLITE6",
  },
  {
    name: "Casco Aeroshell Pro",
    brandSlug: "cube",
    categoryName: "Cascos",
    categoryUsesSizes: true,
    description: "Casco de ruta aerodinámico con sistema de ajuste giratorio y 18 entradas de ventilación.",
    priceCents: 179_900,
    skuPrefix: "AC-AEROSHELL",
  },
];

function pickColor(index: number): string {
  return COLORS[index % COLORS.length]!;
}

async function seedBike(seed: BikeSeed): Promise<void> {
  const slug = slugify(seed.name);
  const existing = await Bike.findOne({ slug }).exec();
  if (existing) {
    logger.info(`[seed-novedades-products] Bike "${seed.name}" already exists, skipping.`);
    return;
  }

  const brand = await requireBrand(seed.brandSlug);
  const category = await requireBikeCategory(seed.categorySlug);

  const variants =
    seed.sizes.length > 0
      ? seed.sizes.map((size, index) => ({
          sku: `${seed.skuPrefix}-${size}`,
          size,
          color: pickColor(index),
          fulfillmentMode: "on_request" as const,
          isActive: true,
        }))
      : [
          { sku: `${seed.skuPrefix}-A`, color: pickColor(0), fulfillmentMode: "on_request" as const, isActive: true },
          { sku: `${seed.skuPrefix}-B`, color: pickColor(1), fulfillmentMode: "on_request" as const, isActive: true },
        ];

  await Bike.create({
    name: seed.name,
    slug,
    brand: brand.id,
    category: category.id,
    shortDescription: seed.shortDescription,
    description: seed.description,
    price: seed.priceCents,
    variants,
    summary: [],
    specGroups: [],
    gallery: [],
    badges: [],
    isNewArrival: false,
    isActive: true,
  });
  logger.info(`[seed-novedades-products] Created bike "${seed.name}" (${brand.name}).`);
}

async function seedAccessory(seed: AccessorySeed): Promise<void> {
  const slug = slugify(seed.name);
  const existing = await Accessory.findOne({ slug }).exec();
  if (existing) {
    logger.info(`[seed-novedades-products] Accessory "${seed.name}" already exists, skipping.`);
    return;
  }

  const brand = await requireBrand(seed.brandSlug);
  const categoryId = await upsertAccessoryCategory(seed.categoryName, seed.categoryUsesSizes);

  const variants = [
    { sku: `${seed.skuPrefix}-A`, color: pickColor(0), fulfillmentMode: "on_request" as const, isActive: true },
    { sku: `${seed.skuPrefix}-B`, color: pickColor(1), fulfillmentMode: "on_request" as const, isActive: true },
  ];

  await Accessory.create({
    name: seed.name,
    slug,
    brand: brand.id,
    category: categoryId,
    description: seed.description,
    price: seed.priceCents,
    variants,
    specGroups: [],
    gallery: [],
    badges: [],
    isNewArrival: false,
    isActive: true,
  });
  logger.info(`[seed-novedades-products] Created accessory "${seed.name}" (${brand.name}).`);
}

async function run(): Promise<void> {
  await connectDb();
  try {
    for (const seed of BIKE_SEEDS) await seedBike(seed);
    for (const seed of ACCESSORY_SEEDS) await seedAccessory(seed);
    logger.info("[seed-novedades-products] Done.");
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[seed-novedades-products] Failed.");
  process.exit(1);
});
