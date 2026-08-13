import type { AdminBadge, AdminBrand, SpecTemplate } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ProductEditor } from "../../ProductEditor";

export default async function NuevoAccesorioPage() {
  const [treeResult, brandsResult, badgesResult, templatesResult] = await Promise.all([
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree"),
    serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
    serverApiFetch<{ badges: AdminBadge[] }>("/admin/badges?isActive=true&limit=100&sort=order"),
    serverApiFetch<{ templates: SpecTemplate[] }>("/admin/spec-templates?isActive=true&limit=100&sort=title"),
  ]);

  return (
    <>
      <PageHeader title="Nuevo accesorio" subtitle="Datos generales, variantes y ficha técnica. La galería se habilita al guardar." />
      <ProductEditor
        kind="accessory"
        mode="create"
        categoryTree={treeResult.data.tree}
        brands={brandsResult.data.brands}
        availableBadges={badgesResult.data.badges}
        specTemplates={templatesResult.data.templates}
        listPath="/admin/catalogo/accesorios"
      />
    </>
  );
}
