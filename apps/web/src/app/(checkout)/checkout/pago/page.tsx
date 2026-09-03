import { redirect } from "next/navigation";

/**
 * `/checkout/pago` used to be its own step; Pago is now the third accordion
 * card on `/checkout/envio` (M-checkout-una-pagina). Kept as a redirect, not
 * deleted, for whatever still links or bookmarks the old URL.
 */
export default function CheckoutPaymentPage() {
  redirect("/checkout/envio");
}
