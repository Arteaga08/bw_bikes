import { Check } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

export type CheckoutStepId = "contacto" | "envio" | "pago";

export interface CheckoutStepperProps {
  current: CheckoutStepId;
  /** Steps considered done — always a prefix of `STEPS` before `current` in practice, but not enforced here. */
  completed: CheckoutStepId[];
}

const STEPS: { id: CheckoutStepId; label: string }[] = [
  { id: "contacto", label: "Contacto" },
  { id: "envio", label: "Envío" },
  { id: "pago", label: "Pago" },
];

/**
 * The 3-step progress indicator at the top of `/checkout/envio` (M13-checkout-
 * redesign, Mockup 2 "Audaz"; M-checkout-una-pagina folded the old
 * `/checkout/pago` route in here too). All three steps live on this one route
 * as independently self-contained accordion cards, so `current`/`completed`
 * are derived straight from account/cart data the page already has (see
 * `ShippingStepView`), not from any cross-route state.
 */
export function CheckoutStepper({ current, completed }: CheckoutStepperProps) {
  return (
    <div className="mb-xl flex items-center" role="list" aria-label="Progreso del checkout">
      {STEPS.map((step, index) => {
        const isDone = completed.includes(step.id);
        const isActive = step.id === current;
        const state = isDone ? "done" : isActive ? "active" : "pending";

        return (
          <div key={step.id} className="flex flex-1 items-center last:flex-none">
            <div role="listitem" className="flex items-center gap-sm">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-display text-body-l font-extrabold",
                  state === "done" && "border-negro bg-negro text-blanco",
                  state === "active" && "border-dorado bg-dorado text-negro",
                  state === "pending" && "border-borde bg-surface text-grafito",
                )}
              >
                {isDone ? <Check size={16} weight="bold" /> : index + 1}
              </span>
              <span
                className={cn(
                  "font-ui text-ui whitespace-nowrap",
                  isActive && "border-b-2 border-dorado pb-xs font-extrabold text-negro",
                  isDone && "font-extrabold text-negro",
                  state === "pending" && "text-grafito",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className={cn("mx-md h-0.5 flex-1", isDone ? "bg-negro" : "bg-borde")} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
