import type { AccountDTO, CustomerFit, PublicBike } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/products/ProductDetail";
import { serverApiFetch } from "@/lib/api/server";
import { ApiError } from "@/lib/api/error";
import {
  buildColorSwatchIndex,
  findCategoryAncestry,
  getPublicBikeBySlug,
  getPublicBikeCategoryTree,
  getPublicBikeSizeGuide,
  getPublicColorSwatches,
} from "@/lib/api/public-catalog";
import { ACCESS_TOKEN_COOKIE } from "@/lib/config";

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

/**
 * The signed-in customer's saved fit (A4), for the size preselection below.
 * No session cookie at all → skip the call entirely (the common case, an
 * anonymous visitor). A cookie present but rejected by the API degrades to
 * `undefined` the same way the size guide/category tree already do — a
 * stale or expired cookie on the storefront just means no preselection, not
 * a broken PDP.
 */
async function loadCustomerFit(): Promise<CustomerFit | undefined> {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_TOKEN_COOKIE)) return undefined;
  try {
    const { data } = await serverApiFetch<{ account: AccountDTO }>("/account", undefined, {
      unauthorizedRedirectPath: null,
    });
    return data.account.fit;
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
  const [bike, bikeColorSwatches, accessoryColorSwatches, fit] = await Promise.all([
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
    loadCustomerFit(),
  ]);
  if (!bike) notFound();

  // Needs `bike.category.id`, so it can't join the `Promise.all` above — it
  // only knows what to fetch once the bike itself has resolved. Degrades to
  // `[]` the same way the color-swatch reads do: a size guide that fails to
  // load just means the "¿Cuál es mi talla?"/"Guía de tallas" links don't
  // render, not a broken PDP.
  const [sizeGuide, categoryTree] = await Promise.all([
    getPublicBikeSizeGuide(bike.category.id).catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicBikeCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
  ]);
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
      colorSwatchIndex={buildColorSwatchIndex([...bikeColorSwatches, ...accessoryColorSwatches])}
      sizeGuide={sizeGuide}
      breadcrumbs={breadcrumbs}
      fit={fit}
    />
  );
}
