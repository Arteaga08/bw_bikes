import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { ShippingStepView } from "./ShippingStepView";

export const metadata: Metadata = {
  title: "Envío",
  robots: { index: false, follow: false },
};

/**
 * The session guard already ran in `(checkout)/layout.tsx` — this only
 * fetches the account once, server-side, so `ShippingStepView` can prefill
 * without its own client round-trip (same reasoning `mi-cuenta`'s pages use).
 */
export default async function CheckoutShippingPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return <ShippingStepView account={data.account} />;
}
