"use client";

import type { FulfillmentMode } from "@bw-bikes/shared";
import { WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FULFILLMENT_MODE_BADGE_VARIANTS, FULFILLMENT_MODE_LABELS } from "@/lib/catalog/labels";

export interface FulfillmentModeNoticeProps {
  fulfillmentMode: Extract<FulfillmentMode, "on_request" | "preorder">;
  preorderReleaseDate?: string;
}

/** `preorderReleaseDate` formatted long-form in Spanish, or `undefined` when absent. */
function formatReleaseDate(preorderReleaseDate: string | undefined): string | undefined {
  if (!preorderReleaseDate) return undefined;
  return new Date(preorderReleaseDate).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Why the badge alone isn't enough: "Sobre pedido"/"Preventa" name the state
 * but not its consequence — a shopper skimming the PDP can read either as a
 * synonym for "en stock" and only discover the real wait at checkout. The "!"
 * trigger opens the same `Modal` `HelpPopover` already standardizes on
 * (focus-trapped, Escape/overlay-dismissible) so the explanation doesn't
 * compete for space with the CTA row below it.
 */
export function FulfillmentModeNotice({ fulfillmentMode, preorderReleaseDate }: FulfillmentModeNoticeProps) {
  const [open, setOpen] = useState(false);
  const label = FULFILLMENT_MODE_LABELS[fulfillmentMode];
  const releaseDate = formatReleaseDate(preorderReleaseDate);

  return (
    <div className="mt-lg flex items-center gap-xs">
      <Badge variant={FULFILLMENT_MODE_BADGE_VARIANTS[fulfillmentMode]}>{label}</Badge>
      {fulfillmentMode === "preorder" && releaseDate ? (
        <p className="font-body text-caption text-grafito">Disponible aprox. {releaseDate}</p>
      ) : null}
      <Button
        variant="bare"
        size="icon-sm"
        aria-label={`¿Qué significa ${label}?`}
        onClick={() => setOpen(true)}
        iconLeft={<WarningCircle weight="fill" />}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        {fulfillmentMode === "on_request" ? (
          <p>
            Esta pieza no está en nuestro almacén en este momento: la solicitamos a fábrica en cuanto confirmas tu pedido.
            El tiempo de entrega es mayor al de un producto en stock. Nuestro equipo te contacta por correo para
            confirmar la fecha estimada apenas procesamos tu orden.
          </p>
        ) : (
          <p>
            Este modelo aún no llega a México. Al comprarlo hoy reservas tu unidad y te la enviamos en cuanto esté
            disponible{releaseDate ? `, alrededor del ${releaseDate}` : ""}. Te avisamos por correo si la fecha se mueve.
          </p>
        )}
      </Modal>
    </div>
  );
}
