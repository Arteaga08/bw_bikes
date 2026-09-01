import { User } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { loginHref } from "@/lib/auth/customer-redirect";

export function CartUnauthenticated() {
  return (
    <EmptyState
      icon={<User size={32} weight="regular" />}
      title="Inicia sesión para ver tu carrito"
      description="Tu carrito se guarda en tu cuenta, así que necesitas iniciar sesión para verlo y editarlo."
      action={
        <ButtonLink href={loginHref("/carrito")} variant="primary" size="md">
          Iniciar sesión
        </ButtonLink>
      }
    />
  );
}
