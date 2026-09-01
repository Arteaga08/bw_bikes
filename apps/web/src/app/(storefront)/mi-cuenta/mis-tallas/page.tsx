import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { MisTallasView } from "./MisTallasView";

export const metadata: Metadata = { title: "Mis tallas" };

export default async function MisTallasPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return <MisTallasView initialFit={data.account.fit} />;
}
