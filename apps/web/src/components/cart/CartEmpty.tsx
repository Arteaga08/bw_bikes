import { ButtonLink } from "@/components/ui/ButtonLink";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { EmptyState } from "@/components/ui/EmptyState";

export interface CartEmptyProps {
  /** Passed by `CartDrawer` to close the drawer on navigation — the `/carrito` page usage leaves this unset, since there's no drawer to close there. */
  onNavigate?: () => void;
}

export function CartEmpty({ onNavigate }: CartEmptyProps) {
  return (
    <EmptyState
      icon={<RhinoMark className="h-8 w-auto" />}
      title="Tu carrito está vacío"
      description="Explora el catálogo y encuentra tu próxima bici o accesorio."
      action={
        <ButtonLink href="/bicicletas" variant="primary" size="md" onClick={onNavigate}>
          Ir al catálogo
        </ButtonLink>
      }
    />
  );
}
