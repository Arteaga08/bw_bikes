"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ACCOUNT_PATH } from "@/lib/config";

/**
 * Mobile-only "back to the hub" link at the top of every account sub-page.
 * `AccountSidebar` (the only account navigation below `md`, before this
 * milestone) is now desktop-only, so without this a sub-page would leave a
 * mobile visitor with no way back except the browser's own back button.
 * Renders nothing on the hub itself — there is nowhere further back to go.
 */
export function AccountBackLink() {
  const pathname = usePathname();

  if (pathname === ACCOUNT_PATH) {
    return null;
  }

  return (
    <ButtonLink href={ACCOUNT_PATH} variant="text" tone="neutral" iconLeft={<ArrowLeft />} className="mb-md md:hidden">
      Mi Cuenta
    </ButtonLink>
  );
}
