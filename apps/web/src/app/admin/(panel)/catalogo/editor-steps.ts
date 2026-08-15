import type { BikeBasicsValue } from "./BikeBasicsFields";
import type { ProductBasicsValue } from "./ProductBasicsSection";

/**
 * Every field `ProductEditor`'s `validate()` can report an error against.
 * Lives here (not in `ProductEditor.tsx`) because the step map below is
 * defined in terms of it and both need to agree on the same key set.
 */
export type FormErrors = Partial<Record<keyof ProductBasicsValue | keyof BikeBasicsValue | "variants", string>>;

export type EditorStepId = "basics" | "variants" | "specs" | "images" | "review";

export interface EditorStepDefinition {
  id: EditorStepId;
  label: string;
  /**
   * `FormErrors` keys this step owns — used both to partition `validate()`'s
   * output for the stepper's dots and to gate "Siguiente" in `create`. Steps
   * with no keys of their own (specs, images, review) never block advancing.
   */
  errorKeys: readonly (keyof FormErrors)[];
}

export const EDITOR_STEPS: readonly EditorStepDefinition[] = [
  {
    id: "basics",
    label: "Datos generales",
    errorKeys: ["name", "brand", "category", "description", "priceInput", "compareAtPriceInput", "shortDescription"],
  },
  { id: "variants", label: "Tallas y variantes", errorKeys: ["variants"] },
  { id: "specs", label: "Ficha técnica y resumen", errorKeys: [] },
  { id: "images", label: "Imágenes", errorKeys: [] },
  { id: "review", label: "Revisar y guardar", errorKeys: [] },
];

export function stepIndex(stepId: EditorStepId): number {
  return EDITOR_STEPS.findIndex((step) => step.id === stepId);
}

export function stepIdAt(index: number): EditorStepId {
  const clamped = Math.min(Math.max(index, 0), EDITOR_STEPS.length - 1);
  return EDITOR_STEPS[clamped]!.id;
}

/** Which step owns a given `FormErrors` key — lets the error summary jump to the right step before focusing the field itself. */
export function stepForErrorKey(key: keyof FormErrors): EditorStepId | undefined {
  return EDITOR_STEPS.find((step) => step.errorKeys.includes(key))?.id;
}

export function stepHasErrors(errors: FormErrors, stepId: EditorStepId): boolean {
  const step = EDITOR_STEPS.find((candidate) => candidate.id === stepId);
  if (!step) return false;
  return step.errorKeys.some((key) => Boolean(errors[key]));
}

/** The first step, in order, that owns a current error — where a failed `validate()` should land the admin. */
export function firstStepWithErrors(errors: FormErrors): EditorStepId | undefined {
  return EDITOR_STEPS.find((step) => stepHasErrors(errors, step.id))?.id;
}

export type EditorStepStatus = "complete" | "error" | "pending";

/**
 * `visitedSteps` is every step the admin has already passed through
 * "Siguiente" — seeded with all five in `edit`, since there's nothing to
 * "pass through" when the product already exists and every step opens
 * unlocked. The step being viewed is never reported "complete" even when
 * error-free: it's still open, not behind the admin yet.
 */
export function getStepStatus(
  stepId: EditorStepId,
  { errors, visitedSteps, currentStepId }: { errors: FormErrors; visitedSteps: ReadonlySet<EditorStepId>; currentStepId: EditorStepId },
): EditorStepStatus {
  if (stepHasErrors(errors, stepId)) return "error";
  if (stepId !== currentStepId && visitedSteps.has(stepId)) return "complete";
  return "pending";
}
