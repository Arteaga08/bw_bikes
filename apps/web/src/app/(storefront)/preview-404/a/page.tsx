import type { Metadata } from "next";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "404 — Mockup A · Embestida",
  robots: { index: false, follow: false },
};

/**
 * Mockup A — "Embestida". Light, restrained, asymmetric split.
 * Temporary preview route — delete once a direction is chosen and its
 * content moves into `(storefront)/not-found.tsx`.
 */
export default function Preview404A() {
  return (
    <div className="grid min-h-[70dvh] grid-cols-1 items-center gap-2xl px-lg py-3xl lg:grid-cols-[1.1fr_1fr] lg:px-2xl">
      <div className="flex flex-col items-start gap-lg">
        <p className="font-ui text-eyebrow text-grafito">Error 404</p>
        <h1 className="font-display text-[clamp(4.5rem,14vw,9rem)] leading-[0.9] tracking-[-0.02em] text-negro">404</h1>
        <p className="max-w-[42ch] font-body text-body-l text-grafito">
          No encontramos esta página. Puede que el enlace esté roto o que la hayamos movido.
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

      <div className="hidden justify-end overflow-hidden lg:flex" aria-hidden="true">
        <RhinoMark className="h-auto w-[36vw] max-w-[520px] translate-x-16" />
      </div>
    </div>
  );
}
