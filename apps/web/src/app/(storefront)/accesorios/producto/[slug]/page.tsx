import type { PublicAccessory } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/products/ProductDetail";
import { ApiError } from "@/lib/api/error";
import {
  buildColorSwatchIndex,
  findCategoryAncestry,
  getPublicAccessoryBySlug,
  getPublicAccessoryCategoryTree,
  getPublicColorSwatches,
} from "@/lib/api/public-catalog";

interface AccesorioProductoPageProps {
  params: Promise<{ slug: string }>;
}

/** Same degrade-to-`undefined`-then-`notFound()` contract `findCategoryNode` established for the category pages. */
async function loadAccessory(slug: string): Promise<PublicAccessory | undefined> {
  try {
    return await getPublicAccessoryBySlug(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return undefined;
  }
}

export async function generateMetadata({ params }: AccesorioProductoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const accessory = await loadAccessory(slug);
  if (!accessory) return { title: "Accesorio" };
  return {
    // El layout raíz ya agrega "· Black and White Bikes" vía su `template`.
    title: accessory.name,
    description: accessory.description,
  };
}

export default async function AccesorioProductoPage({ params }: AccesorioProductoPageProps) {
  const { slug } = await params;
  const [accessory, colorSwatches, categoryTree] = await Promise.all([
    loadAccessory(slug),
    getPublicColorSwatches("accessory").catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
    getPublicAccessoryCategoryTree().catch((error: unknown) => {
      if (!(error instanceof ApiError)) throw error;
      return [];
    }),
  ]);
  if (!accessory) notFound();

  const breadcrumbs = [
    ...findCategoryAncestry(categoryTree, accessory.category.id).map((category) => ({
      label: category.name,
      href: `/accesorios/${category.slug}`,
    })),
    { label: accessory.name },
  ];

  return (
    <ProductDetail
      product={accessory}
      itemType="accessory"
      colorSwatchIndex={buildColorSwatchIndex(colorSwatches)}
      breadcrumbs={breadcrumbs}
    />
  );
}
