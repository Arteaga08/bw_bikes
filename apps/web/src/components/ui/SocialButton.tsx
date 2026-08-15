"use client";

import { FacebookLogo, InstagramLogo, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { buttonClasses, type ButtonSize, type ButtonTone } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type SocialNetwork = "instagram" | "facebook" | "whatsapp" | "youtube";

/**
 * Label and glyph per network. The label is what a screen reader announces —
 * the icon alone is meaningless without it, and "link" or "social" would be
 * worse than nothing on a row of four identical-sounding controls.
 */
const NETWORKS: Record<SocialNetwork, { label: string; Glyph: Icon }> = {
  instagram: { label: "Instagram", Glyph: InstagramLogo },
  facebook: { label: "Facebook", Glyph: FacebookLogo },
  whatsapp: { label: "WhatsApp", Glyph: WhatsappLogo },
  youtube: { label: "YouTube", Glyph: YoutubeLogo },
};

export interface SocialButtonProps {
  network: SocialNetwork;
  href: string;
  /** `inverse` (the default) for the footer over `overlay`; `neutral` on a light surface. */
  tone?: Extract<ButtonTone, "neutral" | "inverse">;
  size?: Extract<ButtonSize, "icon" | "icon-lg">;
  className?: string;
}

/**
 * Icon-only link to an external profile.
 *
 * The one storefront-specific control built ahead of M12, because unlike
 * "Agregar al carrito" or "Ir a pagar" — which are a `Button` with a different
 * label — it carries requirements that composition doesn't give you for free:
 * `rel="noopener noreferrer"` on a `target="_blank"` link (without `noopener`
 * the opened page gets a handle on this one through `window.opener`), and an
 * accessible name for a control that has no text.
 *
 * Not a `ButtonLink`: this leaves the app, so it is a plain `<a>` rather than a
 * `next/link` that would prefetch a third-party origin.
 */
export function SocialButton({ network, href, tone = "inverse", size = "icon", className }: SocialButtonProps) {
  const { label, Glyph } = NETWORKS[network];

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(buttonClasses({ variant: "bare", size, tone }), className)}
    >
      <Glyph aria-hidden="true" size={16} />
    </a>
  );
}
