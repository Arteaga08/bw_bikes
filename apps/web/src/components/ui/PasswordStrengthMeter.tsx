import { CheckCircle, Circle } from "@phosphor-icons/react";
import { PASSWORD_REQUIREMENTS, metRequirementCount } from "@/lib/auth/password-rules";
import { cn } from "@/lib/cn";

export interface PasswordStrengthMeterProps {
  password: string;
  /** Wires the meter to the password `<input>` via `aria-describedby`. */
  id: string;
}

const TIERS = [
  { min: 0, label: "Débil", barColor: "bg-estado-error", textColor: "text-estado-error" },
  { min: 2, label: "Media", barColor: "bg-estado-advertencia", textColor: "text-estado-advertencia" },
  { min: 4, label: "Fuerte", barColor: "bg-estado-exito", textColor: "text-estado-exito" },
];

function tierFor(metCount: number) {
  return TIERS.filter((tier) => metCount >= tier.min).at(-1)!;
}

/**
 * Password *strength* indicator, not a "minimum met" progress bar — each of
 * the 4 segments reflects one of the actual required rules (length,
 * uppercase, number, special character; see `password-rules.ts`), and the bar
 * only reads as fully "safe" once every rule the backend enforces is met.
 */
export function PasswordStrengthMeter({ password, id }: PasswordStrengthMeterProps) {
  const metCount = metRequirementCount(password);
  const tier = tierFor(metCount);

  return (
    <div id={id} className="flex flex-col gap-xs">
      <div className="flex gap-1" role="presentation">
        {PASSWORD_REQUIREMENTS.map((requirement, index) => (
          <span
            key={requirement.id}
            className={cn("h-1 flex-1 rounded-full bg-inset transition-colors duration-150", index < metCount && tier.barColor)}
          />
        ))}
      </div>
      <p className={cn("font-body text-caption", password ? tier.textColor : "text-grafito")}>
        {password ? `Fortaleza: ${tier.label}` : "La contraseña debe cumplir:"}
      </p>
      <ul className="flex flex-col gap-1">
        {PASSWORD_REQUIREMENTS.map((requirement) => {
          const met = requirement.test(password);
          return (
            <li key={requirement.id} className={cn("flex items-center gap-xs font-body text-caption", met ? "text-estado-exito" : "text-grafito")}>
              {met ? (
                <CheckCircle size={14} weight="fill" aria-hidden="true" className="shrink-0" />
              ) : (
                <Circle size={14} weight="regular" aria-hidden="true" className="shrink-0" />
              )}
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
