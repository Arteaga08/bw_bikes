import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CategoriesView } from "../CategoriesView";

export default async function CategoriasAccesoriosPage() {
  const { data } = await serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree");

  return (
    <>
      <PageHeader title="Categorías de accesorios" subtitle="Jerarquía de hasta dos niveles, independiente del árbol de bicicletas." />
      <CategoriesView kind="accessory" initialTree={data.tree} />
    </>
  );
}
