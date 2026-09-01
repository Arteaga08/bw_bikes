import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = { title: "Perfil" };

export default async function MiCuentaPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return <ProfileView initialAccount={data.account} />;
}
