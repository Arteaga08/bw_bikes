import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LOGIN_PATH } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sin acceso",
  robots: { index: false, follow: false },
};

/**
 * Where `requireAdminSession()` sends a *validly logged-in* account that
 * isn't `admin`/`superadmin` — a `customer` browsing the storefront who
 * lands on `/admin` doesn't need to log in again, they need a different
 * account. Deliberately outside the `(panel)` route group, so it isn't
 * itself behind the guard that redirects here.
 */
export default function SinAccesoPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-md bg-base p-lg text-center">
      <h1 className="font-display text-h2 text-negro">Sin acceso</h1>
      <p className="max-w-card font-body text-body text-grafito">
        Tu cuenta no tiene permisos para entrar al panel de administración. Si crees que esto es un
        error, contacta al equipo de Black and White Bikes.
      </p>
      {/* A `ButtonLink` keeps this page a pure Server Component: the old
          `GoToLoginButton` island existed only because `Button` couldn't
          render an `<a>` and `<Link><Button/></Link>` nests two controls. */}
      <ButtonLink href={LOGIN_PATH} variant="secondary">
        Ir a iniciar sesión
      </ButtonLink>
    </main>
  );
}
