import type { Metadata } from "next";
import type { ReactNode } from "react";
import { hankenGrotesk } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Black and White Bikes",
  description: "Panel administrativo de Black and White Bikes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={hankenGrotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
