import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { AccountHub } from "@/components/account/AccountHub";
import { AccountHubDesktopRedirect } from "@/components/account/AccountHubDesktopRedirect";
import { serverApiFetch } from "@/lib/api/server";

// Overrides the layout's `template: "%s · Mi Cuenta"` — this *is* Mi Cuenta,
// not a section of it, so the templated form would read "Mi Cuenta · Mi
// Cuenta".
export const metadata: Metadata = { title: { absolute: "Mi Cuenta" } };

/**
 * The account root: a mobile widget grid (`AccountHub`) replacing the old
 * horizontally-scrolling nav strip. Desktop never sees it —
 * `AccountHubDesktopRedirect` bounces straight to `/mi-cuenta/perfil`, where
 * the two-column shell's sidebar already puts every section one click away.
 */
export default async function MiCuentaPage() {
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");
  return (
    <>
      <AccountHub user={data.account} />
      <AccountHubDesktopRedirect />
    </>
  );
}
