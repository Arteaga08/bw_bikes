import type { PublicBike } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/products/ProductDetail";
import { ApiError } from "@/lib/api/error";
import {
  buildColorSwatchIndex,
  findCategoryAncestry,
  getPublicBikeBySlug,
  getPublicBikeCategoryTree,
  getPublicBikeSizeGuide,
  getPublicColorSwatches,
} from "@/lib/api/public-catalog";

interface BicicletaProductoPageProps {
  params: Promise<{ slug: string }>;
}

/** Same degrade-to-`undefined`-then-`notFound()` contract `findCategoryNode` established for the category pages. */
async function loadBike(slug: string): Promise<PublicBike | undefined> {
  try {
    return await getPublicBikeBySlug(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return undefined;
  }
}

export async function generateMetadata({ params }: BicicletaProductoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bike = await loadBike(slug);
  if (!bike) return { title: "Bicicleta" };
  return {
    // El layout raíz ya agrega "· Black and White Bikes" vía su `template`.
    title: bike.name,
    description: bike.shortDescription || bike.description,
  };
}

export default async function BicicletaProductoPage({ params }: BicicletaProductoPageProps) {
  const { slug } = await params;
  // `getPublicBikeCategoryTree` doesn't depend on `bike` at all — it used to
  // wait for a second `Promise.all` below (alongside `getPublicBikeSizeGuide`,
  // which genuinely does need `bike.category.id`) for no reason. Customer
  // fit (A4) no longer lives here either — `ProductInfo` fetches it
  // client-side (M-optimización) via `useCustomerFit`, which is what makes
  // this page cacheable now: the `cookies()` read was the one uncached fetch
  // in the whole public catalog.
  const [bike, bikeColorSwatches, accessoryColorSwatches, categoryTree] = await Promise.all([
    loadBike(slug),
    getPublicColorSwatches("bike").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    // The buy box's own selector only ever needs `bike`-scoped swatches, but
    // `RelatedAccessories` renders color dots for the curated cross-sell,
    // whose colors may not appear among any active bike — a merged index
    // covers both without threading a second map down.
    getPublicColorSwatches("accessory").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicBikeCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
  ]);
  if (!bike) notFound();

  // Needs `bike.category.id`, so it can't join the `Promise.all` above — it
  // only knows what to fetch once the bike itself has resolved. Degrades to
  // `[]` the same way the color-swatch reads do: a size guide that fails to
  // load just means the "¿Cuál es mi talla?"/"Guía de tallas" links don't
  // render, not a broken PDP.
  const sizeGuide = await getPublicBikeSizeGuide(bike.category.id).catch((error: unknown) => {
    if (!(error instanceof ApiError)) throw error;
    return [];
  });
  const breadcrumbs = [
    ...findCategoryAncestry(categoryTree, bike.category.id).map((category) => ({
      label: category.name,
      href: `/bicicletas/${category.slug}`,
    })),
    { label: bike.name },
  ];

  return (
    <ProductDetail
      product={bike}
      itemType="bike"
      colorSwatchIndex={buildColorSwatchIndex([...bikeColorSwatches, ...accessoryColorSwatches])}
      sizeGuide={sizeGuide}
      breadcrumbs={breadcrumbs}
    />
  );
}
