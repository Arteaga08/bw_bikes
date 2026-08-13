import { redirect } from "next/navigation";

/**
 * Same reasoning as `/admin/catalogo`: the two trees each got their own route
 * in M10.1 (`/admin/catalogo/categorias/bicicletas`,
 * `/admin/catalogo/categorias/accesorios`), reached from the sidebar. This
 * keeps a bare `/admin/catalogo/categorias` visit from 404ing.
 */
export default function CategoriasPage() {
  redirect("/admin/catalogo/categorias/bicicletas");
}
