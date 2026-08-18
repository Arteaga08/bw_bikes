import type { AdminAccessory, AdminBadge, AdminBrand, SizeTemplate, SpecTemplate } from "@bw-bikes/shared";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { ProductEditor } from "../../ProductEditor";

export default async function EditarAccesorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let treeResult: Awaited<ReturnType<typeof serverApiFetch<{ tree: CategoryTreeNode[] }>>>;
  let brandsResult: Awaited<ReturnType<typeof serverApiFetch<{ brands: AdminBrand[] }>>>;
  let badgesResult: Awaited<ReturnType<typeof serverApiFetch<{ badges: AdminBadge[] }>>>;
  let templatesResult: Awaited<ReturnType<typeof serverApiFetch<{ templates: SpecTemplate[] }>>>;
  let sizeTemplatesResult: Awaited<ReturnType<typeof serverApiFetch<{ sizeTemplates: SizeTemplate[] }>>>;
  let accessoryResult: Awaited<ReturnType<typeof serverApiFetch<{ accessory: AdminAccessory }>>>;
  try {
    [treeResult, brandsResult, badgesResult, templatesResult, sizeTemplatesResult, accessoryResult] = await Promise.all([
      serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree"),
      serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
      serverApiFetch<{ badges: AdminBadge[] }>("/admin/badges?limit=100&sort=order"),
      serverApiFetch<{ templates: SpecTemplate[] }>("/admin/spec-templates?isActive=true&limit=100&sort=title"),
      serverApiFetch<{ sizeTemplates: SizeTemplate[] }>("/admin/accessory-size-templates?isActive=true&limit=100&sort=order"),
      serverApiFetch<{ accessory: AdminAccessory }>(`/admin/accessories/${id}`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 404) notFound();
    throw error;
  }

  const accessory = accessoryResult.data.accessory;

  return (
    <>
      <PageHeader title={accessory.name} subtitle="Datos generales, variantes, ficha técnica y galería." />
      <ProductEditor
        kind="accessory"
        mode="edit"
        productId={accessory.id}
        initialProduct={accessory}
        categoryTree={treeResult.data.tree}
        brands={brandsResult.data.brands}
        availableBadges={badgesResult.data.badges}
        specTemplates={templatesResult.data.templates}
        sizeTemplates={sizeTemplatesResult.data.sizeTemplates}
        listPath="/admin/catalogo/accesorios"
      />
    </>
  );
}
