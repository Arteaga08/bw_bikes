import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CategoriesView } from "../CategoriesView";

export default async function CategoriasBicicletasPage() {
  const { data } = await serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree");

  return (
    <>
      <PageHeader title="Categorías de bicicletas" subtitle="Jerarquía de hasta dos niveles, independiente del árbol de accesorios." />
      <CategoriesView kind="bike" initialTree={data.tree} />
    </>
  );
}
