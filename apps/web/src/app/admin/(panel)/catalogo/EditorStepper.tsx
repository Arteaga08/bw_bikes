"use client";

import { Check, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { EDITOR_STEPS, type EditorStepId, type EditorStepStatus, type FormErrors, getStepStatus, stepIndex } from "./editor-steps";

export interface EditorStepperProps {
  currentStepId: EditorStepId;
  errors: FormErrors;
  visitedSteps: ReadonlySet<EditorStepId>;
  mode: "create" | "edit";
  onSelect: (stepId: EditorStepId) => void;
}

/** `edit` unlocks every step up front; `create` only lets the admin jump to a step already passed through "Siguiente" (or back to the current one). */
function isClickable(stepId: EditorStepId, mode: "create" | "edit", visitedSteps: ReadonlySet<EditorStepId>): boolean {
  return mode === "edit" || visitedSteps.has(stepId);
}

const DOT_CLASSES: Record<EditorStepStatus, string> = {
  complete: "border-negro bg-negro text-white",
  error: "border-estado-error bg-estado-error-soft text-estado-error",
  pending: "border-borde bg-surface text-grafito",
};

/**
 * The pasos progress bar — horizontal and clickable on desktop, "Paso N de
 * 5" plus dots on mobile. Deliberately not `Tabs` (`Tabs.tsx:26-30`, which is
 * for swapping content in place): a stepper carries per-step completion
 * state and gated forward navigation that tabs semantics don't model.
 */
export function EditorStepper({ currentStepId, errors, visitedSteps, mode, onSelect }: EditorStepperProps) {
  const currentIndex = stepIndex(currentStepId);
  const currentStep = EDITOR_STEPS[currentIndex];

  return (
    <nav aria-label="Progreso del formulario">
      <ol className="hidden sm:flex sm:items-start">
        {EDITOR_STEPS.map((step, index) => {
          const status = getStepStatus(step.id, { errors, visitedSteps, currentStepId });
          const current = step.id === currentStepId;
          const clickable = isClickable(step.id, mode, visitedSteps);

          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-1 items-center",
                index > 0 && "before:mx-sm before:h-px before:flex-1 before:bg-borde before:content-['']",
              )}
            >
              <button
                type="button"
                disabled={!clickable}
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className={cn(
                  "flex shrink-0 items-center gap-sm rounded-card px-sm py-xs text-left",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
                  clickable ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-ui text-caption",
                    current ? "border-negro bg-negro text-white" : DOT_CLASSES[status],
                  )}
                >
                  {status === "complete" ? (
                    <Check aria-hidden="true" size={14} weight="bold" />
                  ) : status === "error" ? (
                    <Warning aria-hidden="true" size={14} weight="fill" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={cn("font-ui text-caption whitespace-nowrap", current ? "text-negro" : "text-grafito")}>
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-sm sm:hidden">
        <p className="font-ui text-caption text-grafito">
          Paso {currentIndex + 1} de {EDITOR_STEPS.length} · {currentStep?.label}
        </p>
        <div className="flex gap-xs" aria-hidden="true">
          {EDITOR_STEPS.map((step) => {
            const status = getStepStatus(step.id, { errors, visitedSteps, currentStepId });
            const current = step.id === currentStepId;
            return (
              <span
                key={step.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  current ? "bg-negro" : status === "error" ? "bg-estado-error" : status === "complete" ? "bg-negro/40" : "bg-borde",
                )}
              />
            );
          })}
        </div>
      </div>
    </nav>
  );
}
