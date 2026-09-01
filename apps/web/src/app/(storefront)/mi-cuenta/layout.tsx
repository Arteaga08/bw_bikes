import type { AccountDTO } from "@bw-bikes/shared";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { serverApiFetch } from "@/lib/api/server";
import { requireCustomerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Mi Cuenta", template: "%s · Mi Cuenta" },
  robots: { index: false, follow: false },
};

/**
 * Every route under `/mi-cuenta` is guarded here — a server-side check
 * against the real API, not just cookie presence (FRONTEND_GUIDELINES.md
 * §2) — and shares the sidebar shell.
 */
export default async function MiCuentaLayout({ children }: { children: ReactNode }) {
  await requireCustomerSession("/mi-cuenta");
  const { data } = await serverApiFetch<{ account: AccountDTO }>("/account");

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col md:grid md:grid-cols-[15rem_1fr] md:items-start">
      <AccountSidebar user={data.account} />
      <div className="min-w-0 px-lg py-lg md:px-xl md:py-xl">{children}</div>
    </div>
  );
}
