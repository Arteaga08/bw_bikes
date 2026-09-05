"use client";

import type { CustomerFit } from "@bw-bikes/shared";
import { useEffect, useState } from "react";
import { getAccount } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

/**
 * The signed-in customer's saved fit (A4: altura + estilo), fetched
 * client-side so the bike PDP that reads it (`ProductInfo`) doesn't need
 * `cookies()` — that was the one uncached fetch keeping
 * `bicicletas/producto/[slug]` off ISR (M-optimización).
 *
 * `enabled` lets the caller skip the request entirely for a page that has no
 * use for it (an accessory PDP, or a bike category with no size guide) —
 * same gate `ProductInfo` already applied to the recommendation itself.
 *
 * Deliberately returns `undefined` on any failure, same as `ApiError`
 * handling elsewhere on this page: an anonymous visitor (401) and a
 * transient network error both just mean "no recommendation to show," never
 * a broken PDP or a redirect away from it — `unauthorizedRedirectPath: null`
 * is what stops the anonymous case from sending the visitor to `/ingresar`.
 */
export function useCustomerFit(enabled: boolean): CustomerFit | undefined {
  const [fit, setFit] = useState<CustomerFit | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    getAccount({ unauthorizedRedirectPath: null })
      .then((account) => {
        if (active) setFit(account.fit);
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError)) throw error;
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return fit;
}
