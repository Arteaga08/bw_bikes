import Link from "next/link";
import { cn } from "@/lib/cn";

export interface WordmarkProps {
  /** `inverse` is for the footer's `overlay` (#0A0A0A) background — the storefront's other dark surface (entrega #10). */
  tone?: "neutral" | "inverse";
}

/** "B/W" wordmark, linking home. Pantalla 01 of the mockup renders it as plain bold text, not the PNG lockup in `brand-assets/` (that one carries the full "BLACK AND WHITE BIKES" name and is sized for the splash screen, not a 64px nav bar). */
export function Wordmark({ tone = "neutral" }: WordmarkProps) {
  return (
    <Link
      href="/"
      aria-label="Black and White Bikes — inicio"
      className={cn("font-display text-h3 tracking-tight", tone === "inverse" ? "text-blanco" : "text-negro")}
    >
      B/W
    </Link>
  );
}
