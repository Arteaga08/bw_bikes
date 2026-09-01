import type { Metadata } from "next";
import { CustomerRegisterForm } from "./CustomerRegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false, follow: false },
};

export default function CrearCuentaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-card rounded-card-lg border border-borde bg-surface p-xl">
        <h1 className="mb-lg font-display text-h2 text-negro">Crear cuenta</h1>
        <CustomerRegisterForm />
      </div>
    </main>
  );
}
