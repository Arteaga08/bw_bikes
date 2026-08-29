import { CreditCard, LockSimple } from "@phosphor-icons/react/ssr";

/**
 * Card only, deliberately — matches `stripe.provider.ts`'s own "Card only"
 * comment (manual capture, the mechanism the whole payment milestone exists
 * for, is a card-network feature; OXXO/SPEI can't hold funds for later
 * capture). Reads as a quiet trust footnote below the CTA, not a feature
 * list copied wholesale from a competitor's PDP that would depict a
 * capability this store doesn't have.
 */
export function PaymentMethodsBlock() {
  return (
    <div className="mt-md border-t border-borde pt-md">
      <div className="flex items-center gap-xs text-grafito">
        <LockSimple aria-hidden="true" size={16} />
        <span className="font-ui text-ui">Pago seguro con tarjeta</span>
      </div>
      <div className="mt-xs flex items-center gap-xs text-grafito">
        <CreditCard aria-hidden="true" size={20} />
        <span className="font-body text-caption">Visa · Mastercard · American Express</span>
      </div>
    </div>
  );
}
