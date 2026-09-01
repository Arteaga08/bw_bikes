import { ShoppingCart } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";

export function CartEmpty() {
  return (
    <EmptyState
      icon={<ShoppingCart size={32} weight="regular" />}
      title="Tu carrito está vacío"
      description="Explora el catálogo y encuentra tu próxima bici o accesorio."
      action={
        <ButtonLink href="/bicicletas" variant="primary" size="md">
          Ir al catálogo
        </ButtonLink>
      }
    />
  );
}
