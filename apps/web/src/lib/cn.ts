/**
 * Minimal class-name joiner — filters falsy values, no dependency on
 * `clsx`/`tailwind-merge`. The component set here never needs conflict
 * resolution between two classes touching the same CSS property, so the
 * extra dependency isn't worth adding.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
