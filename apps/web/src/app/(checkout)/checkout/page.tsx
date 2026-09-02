import { redirect } from "next/navigation";

/** `/checkout` bare is a URL people type or bookmark — it always means "start the flow". */
export default function CheckoutIndexPage() {
  redirect("/checkout/envio");
}
