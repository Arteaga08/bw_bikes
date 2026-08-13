import { redirect } from "next/navigation";

/**
 * Bikes and accessories each got their own route in M10.1
 * (`/admin/catalogo/bicicletas`, `/admin/catalogo/accesorios`), reached from
 * their own sidebar sections — there's no longer a combined catalog screen to
 * land on. This keeps `/admin/catalogo` (old bookmarks, the sidebar's own
 * former destination) from 404ing.
 */
export default function CatalogoPage() {
  redirect("/admin/catalogo/bicicletas");
}
