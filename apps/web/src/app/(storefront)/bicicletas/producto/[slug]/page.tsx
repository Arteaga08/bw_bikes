import type { PublicBike } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/products/ProductDetail";
import { ApiError } from "@/lib/api/error";
import { buildColorSwatchIndex, getPublicBikeBySlug, getPublicColorSwatches } from "@/lib/api/public-catalog";

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
  const [bike, bikeColorSwatches, accessoryColorSwatches] = await Promise.all([
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
  ]);
  if (!bike) notFound();

  return (
    <ProductDetail product={bike} colorSwatchIndex={buildColorSwatchIndex([...bikeColorSwatches, ...accessoryColorSwatches])} />
  );
}
