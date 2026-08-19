import { cn } from "@/lib/cn";

export interface ColorSwatchProps {
  hex: string | null;
  /** Second hex of a two-tone color — renders the circle split top/bottom instead of solid. */
  secondaryHex?: string | null;
  className?: string;
}

/**
 * Solid dot for a single hex, dashed-ring placeholder for a not-yet-set
 * color (`hex: null`, e.g. an auto-learned entry nobody has edited yet), or
 * a top/bottom split circle when `secondaryHex` is also set. Shared by
 * `ColoresView`, `ColorFormModal`/`HexPicker`, and `VariantsEditor` so the
 * three swatch renderings never drift from each other.
 */
export function ColorSwatch({ hex, secondaryHex, className }: ColorSwatchProps) {
  const style = hex
    ? secondaryHex
      ? { background: `linear-gradient(to bottom, ${hex} 50%, ${secondaryHex} 50%)` }
      : { backgroundColor: hex }
    : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-full border", hex ? "border-borde" : "border-dashed border-grafito", className)}
      style={style}
    />
  );
}
