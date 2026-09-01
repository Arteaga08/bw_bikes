import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
  robots: { index: false, follow: false },
};

// Contenido placeholder — pendiente de revisión legal real antes de
// publicar. Ver memoria "pendiente-texto-legal-terminos-privacidad".
export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-180 px-lg py-3xl">
      <h1 className="mb-lg font-display text-h2 text-negro">Términos de uso</h1>
      <p className="mb-md font-body text-caption text-grafito">Última actualización: pendiente</p>

      <div className="flex flex-col gap-md font-body text-body text-grafito">
        <p>
          Estos Términos de uso rigen el acceso y uso del sitio de Black and White Bikes ("B/W", "nosotros"), incluida la
          creación de cuentas, la navegación del catálogo y la realización de compras. Al crear una cuenta o usar el
          sitio, aceptas estos términos.
        </p>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">1. Cuenta de usuario</h2>
          <p>
            Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu
            cuenta. Notifícanos de inmediato si sospechas un uso no autorizado.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">2. Compras y precios</h2>
          <p>
            Los precios y la disponibilidad de los productos pueden cambiar sin previo aviso. Nos reservamos el derecho
            de cancelar pedidos ante errores evidentes de precio o inventario.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">3. Uso permitido</h2>
          <p>
            No debes usar el sitio para fines ilícitos, ni intentar vulnerar su seguridad o interferir con su
            funcionamiento normal.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">4. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos términos periódicamente. El uso continuado del sitio después de un cambio implica
            la aceptación de la versión vigente.
          </p>
        </section>

        <p className="text-caption">¿Dudas sobre estos términos? Contáctanos desde la sección de ayuda del sitio.</p>
      </div>
    </main>
  );
}
