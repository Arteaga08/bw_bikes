import { redirect } from "next/navigation";

/**
 * The storefront (M12–M14) will live here. Until then, the only visitor to
 * the root is whoever is working on the admin panel — send them straight
 * in. `(panel)/layout.tsx` decides from there whether they actually get to
 * see it.
 */
export default function RootPage(): never {
  redirect("/admin");
}
