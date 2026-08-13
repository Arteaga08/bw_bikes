import type { AdminBadge, AdminBike, AdminBrand, SpecTemplate } from "@bw-bikes/shared";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { ProductEditor } from "../../ProductEditor";

export default async function EditarBicicletaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let treeResult: Awaited<ReturnType<typeof serverApiFetch<{ tree: CategoryTreeNode[] }>>>;
  let brandsResult: Awaited<ReturnType<typeof serverApiFetch<{ brands: AdminBrand[] }>>>;
  let badgesResult: Awaited<ReturnType<typeof serverApiFetch<{ badges: AdminBadge[] }>>>;
  let templatesResult: Awaited<ReturnType<typeof serverApiFetch<{ templates: SpecTemplate[] }>>>;
  let bikeResult: Awaited<ReturnType<typeof serverApiFetch<{ bike: AdminBike }>>>;
  try {
    [treeResult, brandsResult, badgesResult, templatesResult, bikeResult] = await Promise.all([
      serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree"),
      serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
      // Unfiltered, unlike the create page: an already-assigned badge that's
      // since been deactivated must still show, so it can be removed
      // deliberately instead of just vanishing from the picker.
      serverApiFetch<{ badges: AdminBadge[] }>("/admin/badges?limit=100&sort=order"),
      serverApiFetch<{ templates: SpecTemplate[] }>("/admin/spec-templates?isActive=true&limit=100&sort=title"),
      serverApiFetch<{ bike: AdminBike }>(`/admin/bikes/${id}`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 404) notFound();
    throw error;
  }

  const bike = bikeResult.data.bike;

  return (
    <>
      <PageHeader title={bike.name} subtitle="Datos generales, variantes, ficha técnica, galería y accesorios sugeridos." />
      <ProductEditor
        kind="bike"
        mode="edit"
        productId={bike.id}
        initialProduct={bike}
        categoryTree={treeResult.data.tree}
        brands={brandsResult.data.brands}
        availableBadges={badgesResult.data.badges}
        specTemplates={templatesResult.data.templates}
        listPath="/admin/catalogo/bicicletas"
      />
    </>
  );
}
