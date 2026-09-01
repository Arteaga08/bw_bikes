import Image from "next/image";

/**
 * The brand's actual rhino mark (`/public/brand/rhino-dorado.svg`,
 * `handoff/DESIGN_SYSTEM.md` §5.2) at hero scale instead of the 12px
 * footer signature it normally appears at. Same asset, same fixed gold
 * fill — the mark is never recolored, on this page or anywhere else it
 * appears.
 */
export function RhinoMark({ className }: { className?: string }) {
  return <Image src="/brand/rhino-dorado.svg" alt="" aria-hidden="true" width={308} height={132} className={className} />;
}
