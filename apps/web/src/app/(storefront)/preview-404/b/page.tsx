import type { Metadata } from "next";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "404 — Mockup B · Fuera de pista",
  robots: { index: false, follow: false },
};

/**
 * Mockup B — "Fuera de pista". Dark (overlay), the rhino charged straight
 * through the page and cracked it; the mark's own gold is the only accent
 * against the hairline cracks.
 * Temporary preview route — delete once a direction is chosen and its
 * content moves into `(storefront)/not-found.tsx`.
 */
export default function Preview404B() {
  return (
    <section className="relative overflow-hidden bg-overlay py-3xl lg:py-[7rem]">
      <div className="grid min-h-[64dvh] grid-cols-1 items-center gap-2xl px-lg lg:grid-cols-[1fr_0.9fr] lg:px-2xl">
        <div className="flex flex-col items-start gap-lg">
          <p className="font-ui text-h3 tracking-[3px] text-blanco/60">Error 404</p>
          <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.02em] text-blanco">
            Te saliste del camino.
          </h1>
          <p className="max-w-[42ch] font-body text-body-l text-blanco/70">
            La página que buscas no existe o cambió de dirección. Vuelve a terreno conocido.
          </p>
          <div className="flex flex-wrap items-center gap-md">
            <ButtonLink href="/" variant="primary">
              Ir al inicio
            </ButtonLink>
            <ButtonLink href="/bicicletas" variant="ghost" tone="inverse">
              Ver bicicletas
            </ButtonLink>
          </div>
        </div>

        <div className="relative flex items-center justify-center lg:justify-end" aria-hidden="true">
          <svg viewBox="0 0 400 300" className="pointer-events-none absolute h-[80%] w-[80%] rhino-crack-line" fill="none">
            <line x1="20" y1="30" x2="220" y2="150" stroke="var(--color-blanco)" strokeOpacity="0.12" strokeWidth="2" />
            <line x1="220" y1="150" x2="380" y2="270" stroke="var(--color-blanco)" strokeOpacity="0.12" strokeWidth="2" />
          </svg>
          <RhinoMark className="relative h-auto w-[70vw] max-w-[440px] rhino-charge-in" />
        </div>
      </div>

      <style>{`
        @keyframes rhino-charge-in {
          from { opacity: 0; transform: translateX(3rem) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        .rhino-charge-in {
          animation: rhino-charge-in 600ms var(--ease-out-strong) both;
        }
        .rhino-crack-line {
          animation: rhino-charge-in 600ms var(--ease-out-strong) 120ms both;
        }
      `}</style>
    </section>
  );
}
