import { Heart, MapPin, Package, Ruler, User } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface AccountNavItem {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * Shared by `AccountSidebar` (desktop rail) and `AccountHub` (the mobile
 * widget grid at `/mi-cuenta`) — one source for the account section list so
 * the two never drift. Perfil points at `/mi-cuenta/perfil`, not the account
 * root: the root is the hub itself.
 */
export const ACCOUNT_NAV_ITEMS: readonly AccountNavItem[] = [
  { href: "/mi-cuenta/perfil", label: "Perfil", icon: User },
  { href: "/mi-cuenta/direcciones", label: "Libreta de Direcciones", icon: MapPin },
  { href: "/mi-cuenta/pedidos", label: "Historial de pedidos", icon: Package },
  { href: "/mi-cuenta/mis-tallas", label: "Mis tallas", icon: Ruler },
  { href: "/mi-cuenta/guardados", label: "Guardado para más tarde", icon: Heart },
];
