import { loadStripe } from "@stripe/stripe-js";
import { stripePublishableKey } from "@/lib/config";

/**
 * Loaded once at module scope, never inside a component — recreating this
 * promise on every render remounts Stripe's card iframe (C2-checkout-pago.md
 * §1), which loses whatever the customer already typed and can retrigger a
 * visible flash on every keystroke-driven re-render upstream.
 */
export const stripePromise = loadStripe(stripePublishableKey());
