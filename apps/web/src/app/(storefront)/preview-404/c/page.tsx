import type { Metadata } from "next";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "404 — Mockup C · Sendero",
  robots: { index: false, follow: false },
};

/**
 * Mockup C — "Sendero". Strict three-column grid, hairline dividers,
 * Swiss-precision voice instead of the asymmetric split of A or the dark
 * drama of B.
 * Temporary preview route — delete once a direction is chosen and its
 * content moves into `(storefront)/not-found.tsx`.
 */
export default function Preview404C() {
  return (
    <div className="grid min-h-[70dvh] grid-cols-1 gap-2xl px-lg py-3xl lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-borde lg:px-2xl">
      <div className="flex flex-col justify-center gap-md lg:pr-2xl">
        <p className="font-ui text-eyebrow text-grafito">Error 404</p>
        <h1 className="font-display text-[clamp(4rem,9vw,6.5rem)] leading-[0.95] tracking-[-0.02em] text-negro">404</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-md lg:px-2xl" aria-hidden="true">
        <svg viewBox="0 0 200 24" className="w-2/3 max-w-40 text-borde">
          <line x1="0" y1="12" x2="82" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          <line x1="118" y1="12" x2="200" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          <line x1="94" y1="2" x2="106" y2="22" stroke="var(--color-negro)" strokeWidth="2" strokeLinecap="round" />
          <line x1="106" y1="2" x2="94" y2="22" stroke="var(--color-negro)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <RhinoMark className="h-auto w-40" />
      </div>

      <div className="flex flex-col justify-center gap-lg lg:pl-2xl">
        <p className="max-w-[38ch] font-body text-body-l text-grafito">
          El sendero se corta aquí. Esta página no existe o cambió de lugar.
        </p>
        <div className="flex flex-wrap items-center gap-md">
          <ButtonLink href="/" variant="primary">
            Ir al inicio
          </ButtonLink>
          <ButtonLink href="/bicicletas" variant="ghost">
            Ver bicicletas
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
