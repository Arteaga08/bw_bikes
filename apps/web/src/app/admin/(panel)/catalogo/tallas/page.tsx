import { redirect } from "next/navigation";

/**
 * Same reasoning as `/admin/catalogo/categorias`: the two size catalogs each
 * get their own route (`/admin/catalogo/tallas/bicicletas`,
 * `/admin/catalogo/tallas/accesorios`), reached from the sidebar. This keeps
 * a bare `/admin/catalogo/tallas` visit from 404ing.
 */
export default function TallasPage() {
  redirect("/admin/catalogo/tallas/bicicletas");
}
