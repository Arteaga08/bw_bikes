"use client";

import { X } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { Button, type ButtonSize, type ButtonTone } from "@/components/ui/Button";

export interface CloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Defaults to "Cerrar" — override with the thing being closed ("Cerrar panel", "Cerrar notificación") so a screen reader hearing it out of context still knows. */
  "aria-label"?: string;
  /** `icon-sm` (20px) for a close tucked inside a chip; `icon-lg` (44px) for a standalone one that needs a full touch target. */
  size?: Extract<ButtonSize, "icon-sm" | "icon" | "icon-lg">;
  /** `inverse` for a close control sitting on `overlay` (a dark modal or toast). */
  tone?: Extract<ButtonTone, "neutral" | "inverse">;
}

/**
 * The one dismiss control. Before M10.5 there were three: `SlideOver` used a
 * `text-h3` "×" glyph, `Toast` used a `text-ui` one, and
 * `RelatedAccessoriesPicker` used a literal `×` character — three sizes, three
 * hit areas, none of them the Phosphor `X` the rest of the panel draws.
 *
 * Always `bare`: a dismiss is the least important control on whatever surface
 * it sits on, and a bordered box in the corner of every panel and toast reads
 * louder than the content it's closing.
 */
export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(
  { "aria-label": ariaLabel = "Cerrar", size = "icon", tone = "neutral", ...props },
  ref,
) {
  return <Button ref={ref} variant="bare" size={size} tone={tone} aria-label={ariaLabel} iconLeft={<X />} {...props} />;
});
