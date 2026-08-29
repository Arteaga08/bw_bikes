import type { AdminBadge, AdminBrand, ColorTemplate, SizeTemplate, SpecTemplate } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ProductEditor } from "../../ProductEditor";

export default async function NuevaBicicletaPage() {
  const [
    treeResult,
    accessoryTreeResult,
    brandsResult,
    badgesResult,
    templatesResult,
    sizeTemplatesResult,
    colorTemplatesResult,
  ] = await Promise.all([
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree"),
    // Feeds `RelatedAccessoriesPicker`'s category accordion — a separate tree
    // from `treeResult` above, which is the bike's *own* category.
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree"),
    serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
    // Only active badges on create — there's nothing already assigned yet, so
    // offering an inactive one would just be a dead end.
    serverApiFetch<{ badges: AdminBadge[] }>("/admin/badges?isActive=true&limit=100&sort=order"),
    serverApiFetch<{ templates: SpecTemplate[] }>("/admin/spec-templates?isActive=true&limit=100&sort=title"),
    // Same isActive-only reasoning as badges: nothing is assigned yet.
    serverApiFetch<{ sizeTemplates: SizeTemplate[] }>("/admin/bike-size-templates?isActive=true&limit=100&sort=order"),
    // One shared catalog, unlike sizes — same endpoint the accessory editor fetches.
    serverApiFetch<{ colorTemplates: ColorTemplate[] }>("/admin/color-templates?isActive=true&limit=100&sort=order"),
  ]);

  return (
    <>
      <PageHeader title="Nueva bicicleta" subtitle="Datos generales, variantes y ficha técnica. La galería se habilita al guardar." />
      <ProductEditor
        kind="bike"
        mode="create"
        categoryTree={treeResult.data.tree}
        accessoryCategoryTree={accessoryTreeResult.data.tree}
        brands={brandsResult.data.brands}
        availableBadges={badgesResult.data.badges}
        specTemplates={templatesResult.data.templates}
        sizeTemplates={sizeTemplatesResult.data.sizeTemplates}
        colorTemplates={colorTemplatesResult.data.colorTemplates}
        listPath="/admin/catalogo/bicicletas"
      />
    </>
  );
}
