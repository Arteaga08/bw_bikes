import type { PublicCartLine } from "@bw-bikes/shared";

export interface CartLineStatus {
  tone: "error" | "warning";
  message: string;
}

/**
 * Translates a non-purchasable line into what `CartLineItem` shows —
 * **never a number** (`B-carrito.md` §6). The backend's own
 * `unavailableReason` is already number-free for "agotado" and for an
 * archived/removed product, so those render verbatim; only the
 * `"Solo quedan N unidades disponibles."` case (produced when
 * `0 < available < qty`) is rewritten here, into a message that tells the
 * shopper to act without saying how many units justify it. The backend string
 * itself is untouched — the admin panel still needs the real count.
 */
const PARTIAL_STOCK_PATTERN = /^Solo quedan \d+ unidades? disponibles?\.$/;

export function cartLineStatus(line: PublicCartLine): CartLineStatus | null {
  if (line.isPurchasable) return null;

  const reason = line.unavailableReason ?? "Este producto ya no está disponible.";
  const tone = reason === "Este producto está agotado." ? "warning" : "error";
  const message = PARTIAL_STOCK_PATTERN.test(reason) ? "Ajusta la cantidad para continuar." : reason;

  return { tone, message };
}
