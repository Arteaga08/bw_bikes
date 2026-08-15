"use client";

import { Button } from "@/components/ui/Button";

export interface EditorFooterProps {
  mode: "create" | "edit";
  entityLabel: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
  errorCount: number;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

/**
 * The sticky bottom bar. `create` gates progress on validation: "Siguiente"
 * only turns primary once there's somewhere to go, and "Crear …" only
 * appears on the last step, after every step has been walked through. `edit`
 * has nothing to gate — every step is already unlocked (`EditorStepper`) —
 * so "Guardar cambios" stays primary and available from any step, with
 * "Atrás"/"Siguiente" as plain secondary controls for browsing between them.
 */
export function EditorFooter({
  mode,
  entityLabel,
  isFirstStep,
  isLastStep,
  submitting,
  errorCount,
  onCancel,
  onBack,
  onNext,
  onSubmit,
}: EditorFooterProps) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-md border-t border-borde bg-base p-md sm:p-lg">
      {errorCount > 0 ? (
        <p className="font-ui text-caption text-estado-error">
          {errorCount === 1 ? "1 campo por corregir" : `${errorCount} campos por corregir`}
        </p>
      ) : (
        <span />
      )}
      <div className="flex gap-sm">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        {!isFirstStep ? (
          <Button variant="secondary" onClick={onBack}>
            Atrás
          </Button>
        ) : null}
        {mode === "create" ? (
          isLastStep ? (
            <Button variant="primary" loading={submitting} onClick={onSubmit}>
              {`Crear ${entityLabel.toLowerCase()}`}
            </Button>
          ) : (
            <Button variant="primary" onClick={onNext}>
              Siguiente
            </Button>
          )
        ) : (
          <>
            {!isLastStep ? (
              <Button variant="secondary" onClick={onNext}>
                Siguiente
              </Button>
            ) : null}
            <Button variant="primary" loading={submitting} onClick={onSubmit}>
              Guardar cambios
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
