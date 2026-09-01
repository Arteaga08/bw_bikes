import type { Metadata } from "next";
import Image from "next/image";
import { CustomerLoginForm } from "./CustomerLoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default function IngresarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-card rounded-card-lg border border-borde bg-surface p-xl">
        <Image src="/brand/rhino-dorado.svg" alt="" width={40} height={17} className="mx-auto mb-sm" />
        <h1 className="mb-lg text-center font-display text-h2 text-negro">Iniciar sesión</h1>
        <CustomerLoginForm />
      </div>
    </main>
  );
}
