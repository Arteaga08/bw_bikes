import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { hankenGrotesk } from "./fonts";
import "./globals.css";

/**
 * Public-site default — the storefront (`(storefront)/layout.tsx`) is the
 * only route tree that inherits this without overriding it. The admin panel
 * defines its own, more specific `metadata` (`admin/(panel)/layout.tsx`,
 * `admin: { index: false }`), so it never shows this description.
 */
export const metadata: Metadata = {
  title: { default: "Black and White Bikes", template: "%s · Black and White Bikes" },
  description: "Bicicletas de alto rendimiento — catálogo, pedidos y todo lo que necesitas saber sobre tu bici.",
};

/** `viewportFit: "cover"` habilita `env(safe-area-inset-*)` (Toast, drawers) en dispositivos con notch. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={hankenGrotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
