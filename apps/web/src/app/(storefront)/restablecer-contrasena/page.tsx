import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
  robots: { index: false, follow: false },
};

export default function RestablecerContrasenaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-card rounded-card-lg border border-borde bg-surface p-xl">
        <h1 className="mb-lg font-display text-h2 text-negro">Restablecer contraseña</h1>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
