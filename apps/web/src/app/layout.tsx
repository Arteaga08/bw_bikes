import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { hankenGrotesk } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Black and White Bikes",
  description: "Panel administrativo de Black and White Bikes.",
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
