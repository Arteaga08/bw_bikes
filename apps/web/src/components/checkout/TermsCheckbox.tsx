"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/Checkbox";

export interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * The legal-consent gate ahead of "Pagar" (M13-checkout-redesign, mirrors the
 * Términos/Privacidad checkbox in the Specialized reference). `/terminos` and
 * `/privacidad` carry placeholder copy today — see
 * `pendiente-texto-legal-terminos-privacidad` — but the checkbox and its
 * server-side record (`termsAcceptedAt` on the order) don't need to wait on
 * that text landing. Lives inside `PaymentCard`, directly under the card
 * fields — unchecking it disables "Pagar" rather than surfacing an error, so
 * there's no error state to render here.
 */
export function TermsCheckbox({ checked, onChange }: TermsCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      label={
        <span>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className="text-negro underline underline-offset-2">
            Términos de Uso
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className="text-negro underline underline-offset-2">
            Política de Privacidad
          </Link>
          .
        </span>
      }
    />
  );
}
