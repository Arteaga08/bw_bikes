import localFont from "next/font/local";

/**
 * Hanken Grotesk — the single type family of the brand system
 * (handoff/DESIGN_SYSTEM.md §2). Three weights, no exceptions:
 * ExtraBold (800) for display/headlines, Medium (500) for UI/labels,
 * Regular (400) for body copy. Exposed as `--font-hanken`, consumed by
 * `globals.css`'s `@theme` block.
 */
export const hankenGrotesk = localFont({
  src: [
    { path: "./Hanken-Regular.ttf", weight: "400", style: "normal" },
    { path: "./Hanken-Medium.ttf", weight: "500", style: "normal" },
    { path: "./Hanken-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-hanken",
  display: "swap",
});
