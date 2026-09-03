"use client";

import type { AccountDTO, SavedAddress } from "@bw-bikes/shared";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CheckoutGuard } from "@/components/checkout/CheckoutGuard";
import { CheckoutStepper, type CheckoutStepId } from "@/components/checkout/CheckoutStepper";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { ContactCard } from "@/components/checkout/ContactCard";
import { PaymentCard } from "@/components/checkout/PaymentCard";
import { ShippingAddressCard } from "@/components/checkout/ShippingAddressCard";

export interface ShippingStepViewProps {
  account: AccountDTO;
  cloudName: string;
}

const PHONE_PATTERN = /^\d{10}$/;

function isContactComplete(account: AccountDTO): boolean {
  return Boolean(account.firstName.trim() && account.lastName.trim() && account.phone && PHONE_PATTERN.test(account.phone));
}

/**
 * Composes all three checkout accordion cards — Contacto, Envío, Pago — with
 * the sticky summary on one page and one URL (M-checkout-una-pagina folded
 * `/checkout/pago` in here so paying never navigates away mid-flow; the
 * stepper still shows 3 numbered steps, it just no longer changes route
 * between them). `account` and `addresses` both live here, not inside the
 * cards themselves, so a save in any one of them is visible immediately — to
 * the stepper above, and to the other cards — without a page reload.
 *
 * This is also the single owner of *which* step is open: the cards used to
 * each derive their own collapsed/expanded state, which let a first-time
 * customer type an address before ever confirming their contact info. Only
 * one card is open at a time now, and Envío/Pago stay locked until the step
 * before them is done.
 */
export function ShippingStepView({ account: initialAccount, cloudName }: ShippingStepViewProps) {
  const { cart } = useCart();
  const [account, setAccount] = useState<AccountDTO>(initialAccount);
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAccount.addresses);
  const [pinnedStep, setPinnedStep] = useState<CheckoutStepId | null>(null);

  const contactDone = isContactComplete(account);
  const envioDone = Boolean(cart?.shippingAddress);

  // Derived until the customer actually navigates, on purpose: `cart` arrives
  // asynchronously from `CartProvider`, so on the first render `envioDone` is
  // false even for a cart that already carries a shipping address. Deriving
  // means the open step corrects itself once the cart lands; `pinnedStep` only
  // takes over once a step is confirmed or "Editar" is pressed.
  const firstOpen: CheckoutStepId = !contactDone ? "contacto" : !envioDone ? "envio" : "pago";
  const openStep = pinnedStep ?? firstOpen;

  const completed: CheckoutStepId[] = [...(contactDone ? (["contacto"] as const) : []), ...(envioDone ? (["envio"] as const) : [])];

  return (
    <div className="mx-auto max-w-[68rem] px-lg py-xl pb-3xl">
      <CheckoutStepper current={openStep} completed={completed} />
      <CheckoutGuard
        steps={
          <>
            <ContactCard
              account={account}
              onAccountChange={setAccount}
              open={openStep === "contacto"}
              onEdit={() => setPinnedStep("contacto")}
              onDone={() => setPinnedStep("envio")}
            />
            <ShippingAddressCard
              addresses={addresses}
              onAddressesChange={setAddresses}
              profile={{ firstName: account.firstName, lastName: account.lastName, phone: account.phone }}
              initialBillingInfo={account.billingInfo}
              open={openStep === "envio"}
              locked={!contactDone}
              onEdit={() => setPinnedStep("envio")}
              onDone={() => setPinnedStep("pago")}
            />
            <PaymentCard open={openStep === "pago"} />
          </>
        }
        summary={<CheckoutSummary cloudName={cloudName} />}
      />
    </div>
  );
}
