import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default function RecuperarContrasenaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-card rounded-card-lg border border-borde bg-surface p-xl">
        <h1 className="mb-lg font-display text-h2 text-negro">Recuperar contraseña</h1>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
