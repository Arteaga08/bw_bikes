"use client";

import type { AccountDTO, SavedAddress } from "@bw-bikes/shared";
import { useState } from "react";
import { BillingCard } from "@/components/checkout/BillingCard";
import { CheckoutGuard } from "@/components/checkout/CheckoutGuard";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { ShippingAddressCard } from "@/components/checkout/ShippingAddressCard";

export interface ShippingStepViewProps {
  account: AccountDTO;
}

/**
 * Composes the three accordion cards (Envío, Facturación, and the still-
 * disabled Pago placeholder — C1-checkout-datos.md §0) with the sticky
 * summary. `addresses` lives here, not inside `ShippingAddressCard`, so a
 * newly created or promoted address is visible immediately if the customer
 * reopens the card without a page reload.
 */
export function ShippingStepView({ account }: ShippingStepViewProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(account.addresses);

  return (
    <div className="mx-auto max-w-[68rem] px-lg py-xl pb-3xl">
      <CheckoutGuard
        steps={
          <>
            <ShippingAddressCard
              addresses={addresses}
              onAddressesChange={setAddresses}
              profile={{ firstName: account.firstName, lastName: account.lastName, phone: account.phone }}
            />
            <BillingCard initialBillingInfo={account.billingInfo} />
            <section className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-xl opacity-45">
              <h2 className="font-display text-h4 text-negro">Pago</h2>
              <p className="font-body text-caption text-grafito">Se habilita al continuar.</p>
            </section>
          </>
        }
        summary={<CheckoutSummary />}
      />
    </div>
  );
}
