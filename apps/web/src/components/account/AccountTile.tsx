import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";

export interface AccountTileProps {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * One widget in `AccountHub`'s mobile grid: icon block, an inset divider,
 * then the label — the geometry of Specialized's `/myaccount` reference
 * (`docs/DESIGN_REFERENCES/m13-cuenta/`), rebuilt entirely from this
 * project's own tokens (flat surface, hairline border, no shadow).
 *
 * Not a `StatCard`: that component's contract is label/value telemetry and
 * it never navigates. This is plain navigation dressed as a tile, so it's a
 * `Link`, not a button.
 *
 * Every class here is owned once — `cn`'s `lib/cn.ts` is a bare join with no
 * `tailwind-merge`, so a caller-supplied `className` could collide with a
 * class already set here instead of overriding it (see `Button.tsx`). No
 * `className` prop is exposed for that reason.
 */
export function AccountTile({ href, label, icon: TileIcon }: AccountTileProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center rounded-card border border-borde bg-surface text-center transition-colors duration-150 hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
    >
      <span className="flex items-center justify-center py-xl text-negro">
        <TileIcon size={28} weight="regular" aria-hidden="true" />
      </span>
      <span className="w-full px-lg">
        <span className="block h-px w-full bg-borde" />
      </span>
      <span className="px-md py-lg font-ui text-ui text-negro">{label}</span>
    </Link>
  );
}
