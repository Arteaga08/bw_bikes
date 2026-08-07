import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

/**
 * The one place in the entire admin registry where the rhino appears
 * (handoff/DESIGN_SYSTEM.md §5: "reserved to a single non-functional place,
 * e.g. the login screen, never repeated as a UI element"). Nowhere else
 * under `/admin` uses it — the panel itself is chrome-only for this mark.
 */
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base p-lg">
      <div className="w-full max-w-sm rounded-card-lg border border-borde bg-surface p-xl">
        <div className="mb-lg flex items-center gap-xs">
          <Image src="/brand/rhino-negro.svg" alt="" width={16} height={16} priority />
          <span className="font-ui text-eyebrow text-grafito uppercase">Black and White Bikes</span>
        </div>
        <h1 className="mb-lg font-display text-h2 text-negro">Panel de administración</h1>
        <LoginForm />
      </div>
    </main>
  );
}
