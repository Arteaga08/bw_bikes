import type { Metadata } from "next";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "Verificar correo",
  robots: { index: false, follow: false },
};

export default function VerificarCorreoPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-card rounded-card-lg border border-borde bg-surface p-xl">
        <h1 className="mb-lg font-display text-h2 text-negro">Verificar correo</h1>
        <VerifyEmailClient />
      </div>
    </main>
  );
}
