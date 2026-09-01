import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { DireccionesView } from "./DireccionesView";

export const metadata: Metadata = { title: "Direcciones" };

export default async function DireccionesPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return <DireccionesView initialAddresses={data.account.addresses} initialBillingInfo={data.account.billingInfo} />;
}
