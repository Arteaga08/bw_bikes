"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ACCOUNT_PROFILE_PATH } from "@/lib/config";

/**
 * `AccountHub` (the widget grid at `/mi-cuenta`) is mobile-only — `md:hidden`
 * hides it by CSS on desktop, so this component exists only to send a
 * desktop visitor somewhere with content: `/mi-cuenta/perfil`.
 *
 * `useMediaQuery`'s server snapshot is `false` (see its own doc comment), so
 * SSR always renders as if mobile; there is no wrong flash of hub content on
 * desktop because the hub is already hidden by `md:hidden` from the first
 * paint — this only fires the navigation once the client confirms the
 * viewport. `replace`, not `push`: landing on the hub before bouncing to
 * Perfil should not leave a back-button stop.
 */
export function AccountHubDesktopRedirect() {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (isDesktop) {
      router.replace(ACCOUNT_PROFILE_PATH);
    }
  }, [isDesktop, router]);

  return null;
}
