import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  robots: { index: false, follow: false },
};

// Contenido placeholder — pendiente de revisión legal real antes de
// publicar. Ver memoria "pendiente-texto-legal-terminos-privacidad".
export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-180 px-lg py-3xl">
      <h1 className="mb-lg font-display text-h2 text-negro">Aviso de privacidad</h1>
      <p className="mb-md font-body text-caption text-grafito">Última actualización: pendiente</p>

      <div className="flex flex-col gap-md font-body text-body text-grafito">
        <p>
          En Black and White Bikes ("B/W", "nosotros") protegemos los datos personales que nos compartes al crear una
          cuenta, realizar una compra o contactarnos. Este aviso explica qué datos recopilamos y cómo los usamos.
        </p>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">1. Datos que recopilamos</h2>
          <p>
            Nombre, correo electrónico, dirección de envío y datos de contacto que proporcionas al crear tu cuenta o
            realizar un pedido.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">2. Uso de tus datos</h2>
          <p>
            Usamos tus datos para procesar pedidos, gestionar tu cuenta, enviarte notificaciones sobre tus compras y
            responder a tus solicitudes de soporte.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">3. Con quién compartimos tus datos</h2>
          <p>
            Compartimos datos únicamente con proveedores necesarios para operar el sitio (procesamiento de pagos,
            envío de correos transaccionales, mensajería), nunca con fines publicitarios de terceros.
          </p>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="font-display text-h3 text-negro">4. Tus derechos</h2>
          <p>
            Puedes solicitar acceso, corrección o eliminación de tus datos personales en cualquier momento desde tu
            cuenta o contactándonos directamente.
          </p>
        </section>

        <p className="text-caption">¿Dudas sobre este aviso? Contáctanos desde la sección de ayuda del sitio.</p>
      </div>
    </main>
  );
}
