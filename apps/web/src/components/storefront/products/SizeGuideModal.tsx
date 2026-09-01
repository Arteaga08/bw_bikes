"use client";

import type { PublicSizeGuideEntry } from "@bw-bikes/shared";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { RIDE_STYLES } from "@/lib/ride-styles";
import { recommendSize, type RideStyle } from "@/lib/size-recommendation";
import type { SizeOption } from "./SizeSelector";

export type SizeGuideTab = "finder" | "guide";

export interface SizeGuideModalProps {
  open: boolean;
  tab: SizeGuideTab;
  onTabChange: (tab: SizeGuideTab) => void;
  sizeGuide: PublicSizeGuideEntry[];
  sizeOptions: SizeOption[];
  onClose: () => void;
  onSelectSize: (size: string) => void;
  /** The customer's saved `fit.heightCm` (A4), if any — the wizard starts from it instead of `DEFAULT_HEIGHT_CM`. */
  initialHeightCm?: number;
}

const MIN_HEIGHT_CM = 140;
const MAX_HEIGHT_CM = 210;
const DEFAULT_HEIGHT_CM = 170;
const TOTAL_STEPS = 3;

type FinderStep = 1 | 2 | 3;

function RhinoMark() {
  return <Image src="/brand/rhino-dorado.svg" alt="" aria-hidden="true" width={16} height={7} />;
}

/** Sizes not offered on this product at all (no variant of that value, in any color) read differently from one that's simply sold out — the shopper needs to know which case they're looking at. */
function availabilityFor(value: string, sizeOptions: SizeOption[]): { label: string; isAvailable: boolean } {
  const match = sizeOptions.find((option) => option.value === value);
  if (!match) return { label: "No disponible en este modelo", isAvailable: false };
  return match.available ? { label: "Disponible", isAvailable: true } : { label: "Agotada", isAvailable: false };
}

/**
 * "¿Cuál es mi talla?" + "Guía de tallas" in one overlay — two tabs over the
 * same `sizeGuide` data (Manuel's call, 2026-08-31: it's the same table
 * either way, no reason to split it into two components). Mechanics copy
 * `CatalogFilterDrawer.tsx`, the storefront's own overlay precedent, not
 * `ui/Modal` (admin-only, unmounts on close, no animation): panel stays
 * mounted with `inert` while closed so the slide has something to animate,
 * `useFocusTrap` + Escape + body scroll lock, faster exit than entry.
 *
 * Below `sm` it rises as a bottom sheet (thumb-reachable, same reasoning as
 * the filter drawer); `sm` and up it's a centered card, because unlike the
 * filter drawer this dialog is deep enough (a 3-step wizard) to want the
 * full vertical room a bottom sheet's `max-h` caps away.
 */
export function SizeGuideModal({
  open,
  tab,
  onTabChange,
  sizeGuide,
  sizeOptions,
  onClose,
  onSelectSize,
  initialHeightCm,
}: SizeGuideModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const finderPanelId = useId();
  const guidePanelId = useId();
  const isBelowSm = useMediaQuery("(max-width: 639px)");

  const [step, setStep] = useState<FinderStep>(1);
  const [heightCm, setHeightCm] = useState(initialHeightCm ?? DEFAULT_HEIGHT_CM);
  const [style, setStyle] = useState<RideStyle>("balanced");
  const [chosenSize, setChosenSize] = useState<string | undefined>(undefined);

  useFocusTrap(panelRef, open);

  // Every reopen starts the wizard over — a stale "step 3" from a previous
  // visit showing a recommendation for a height the shopper never re-entered
  // this time would be actively misleading, not a convenience. Adjusted
  // during render (React's own pattern for "reset state when a prop
  // changes"), not in an effect — an effect here would commit the closed
  // frame first and only reset on the render after, one extra flash of
  // stale content before the panel finishes sliding out.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStep(1);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const recommendation = recommendSize(sizeGuide, heightCm, style);
  const candidates = recommendation
    ? [recommendation.primary, recommendation.secondary].filter((value): value is string => Boolean(value))
    : [];

  function goToStep(next: FinderStep): void {
    if (next === 3) {
      setChosenSize(recommendation?.primary);
    }
    setStep(next);
  }

  function handleConfirm(): void {
    if (!chosenSize) return;
    onSelectSize(chosenSize);
    onClose();
  }

  const sortedGuide = [...sizeGuide].sort((a, b) => a.minHeightCm - b.minHeightCm);

  return (
    <>
      {open ? (
        <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-50 bg-negro/60" />
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open || undefined}
        aria-labelledby={titleId}
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-card-lg border-t border-borde bg-surface",
          "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85vh] sm:w-full sm:max-w-dialog-lg sm:rounded-card-lg sm:border",
          "transition-transform",
          open
            ? "translate-y-0 duration-[260ms] ease-drawer"
            : isBelowSm
              ? "translate-y-full duration-200 ease-out-strong"
              : "translate-y-8 opacity-0 duration-200 ease-out-strong",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-sm px-lg pt-lg">
          <h2 id={titleId} className="font-display text-h3 text-negro">
            Talla
          </h2>
          <CloseButton onClick={onClose} aria-label="Cerrar guía de tallas" className="-mr-xs -mt-xs shrink-0" />
        </div>

        <div className="mt-md shrink-0 px-lg">
          <TabList label="Talla">
            <Tab selected={tab === "finder"} onSelect={() => onTabChange("finder")} id={`${finderPanelId}-tab`} panelId={finderPanelId}>
              ¿Cuál es mi talla?
            </Tab>
            <Tab selected={tab === "guide"} onSelect={() => onTabChange("guide")} id={`${guidePanelId}-tab`} panelId={guidePanelId}>
              Guía de tallas
            </Tab>
          </TabList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-lg pb-lg pt-lg">
          {tab === "finder" ? (
            <div id={finderPanelId} role="tabpanel" aria-labelledby={`${finderPanelId}-tab`}>
              {sizeGuide.length === 0 ? (
                <p className="font-body text-body text-grafito">
                  Todavía no tenemos suficientes datos para recomendarte una talla en este modelo.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-sm">
                    <div className="h-1 flex-1 rounded-full bg-inset">
                      <div
                        className="h-full rounded-full bg-dorado transition-[width] duration-200 ease-out-strong"
                        style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-body text-eyebrow uppercase text-grafito">
                      Paso {step} de {TOTAL_STEPS}
                    </span>
                  </div>

                  {step === 1 ? (
                    <div className="mt-xl flex flex-col items-center gap-lg py-lg text-center">
                      <label htmlFor="size-finder-height" className="font-ui text-ui text-grafito">
                        Tu estatura
                      </label>
                      <div className="flex items-baseline gap-xs">
                        <input
                          id="size-finder-height"
                          type="number"
                          inputMode="numeric"
                          min={MIN_HEIGHT_CM}
                          max={MAX_HEIGHT_CM}
                          value={heightCm}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) setHeightCm(Math.min(MAX_HEIGHT_CM, Math.max(MIN_HEIGHT_CM, next)));
                          }}
                          className="w-32 border-b-2 border-borde bg-transparent text-center font-display text-h1 text-negro focus-visible:border-negro focus-visible:outline-none"
                        />
                        <span className="font-ui text-ui text-grafito">cm</span>
                      </div>
                      <input
                        type="range"
                        min={MIN_HEIGHT_CM}
                        max={MAX_HEIGHT_CM}
                        value={heightCm}
                        onChange={(event) => setHeightCm(Number(event.target.value))}
                        aria-label="Tu estatura, en centímetros"
                        className="w-full max-w-64 accent-negro"
                      />
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="mt-xl flex flex-col gap-sm py-lg">
                      <span className="font-ui text-ui text-grafito">¿Cómo prefieres rodar?</span>
                      <div role="radiogroup" aria-label="¿Cómo prefieres rodar?" className="flex flex-col gap-sm">
                        {RIDE_STYLES.map((option) => {
                          const isSelected = option.value === style;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setStyle(option.value)}
                              className={cn(
                                "rounded-control border px-md py-sm text-left transition-colors duration-150",
                                isSelected ? "border-negro bg-negro text-blanco" : "border-borde text-negro hover:border-negro",
                              )}
                            >
                              <span className="font-ui text-ui">{option.label}</span>
                              <p className={cn("mt-xs font-body text-caption", isSelected ? "text-blanco/70" : "text-grafito")}>
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {step === 3 && recommendation ? (
                    <div className="mt-xl flex flex-col items-center gap-lg py-lg text-center">
                      <RhinoMark />
                      <div>
                        <p className="font-ui text-ui text-grafito">Talla recomendada</p>
                        <p className="mt-xs font-display text-display text-negro">{recommendation.primary}</p>
                      </div>

                      {candidates.length > 1 ? (
                        <>
                          <div role="radiogroup" aria-label="Talla" className="flex flex-wrap justify-center gap-sm">
                            {candidates.map((value) => {
                              const isSelected = value === chosenSize;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  onClick={() => setChosenSize(value)}
                                  className={cn(
                                    "flex h-11 min-w-11 items-center justify-center rounded-control border px-xs font-ui text-ui transition-colors duration-150",
                                    isSelected ? "border-negro bg-negro text-blanco" : "border-borde text-negro hover:border-negro",
                                  )}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                          <p className="font-body text-caption text-grafito">
                            Dos tallas se ajustan a tu estatura — la elección final depende de tu preferencia.
                          </p>
                        </>
                      ) : null}

                      {chosenSize && !availabilityFor(chosenSize, sizeOptions).isAvailable ? (
                        <p className="font-body text-caption text-estado-advertencia">
                          {availabilityFor(chosenSize, sizeOptions).label} en este color.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-xl flex items-center justify-between gap-sm border-t border-borde pt-lg">
                    {step > 1 ? (
                      <Button variant="text" onClick={() => goToStep((step - 1) as FinderStep)}>
                        Atrás
                      </Button>
                    ) : (
                      <span />
                    )}
                    {step < 3 ? (
                      <Button variant="primary" onClick={() => goToStep((step + 1) as FinderStep)}>
                        Siguiente
                      </Button>
                    ) : (
                      <Button variant="primary" disabled={!chosenSize} onClick={handleConfirm}>
                        Seleccionar talla
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div id={guidePanelId} role="tabpanel" aria-labelledby={`${guidePanelId}-tab`}>
              {sizeGuide.length === 0 ? (
                <p className="font-body text-body text-grafito">Todavía no hay una guía de tallas para este modelo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-borde">
                        <th scope="col" className="py-sm pr-md font-ui text-ui text-grafito">
                          Talla
                        </th>
                        <th scope="col" className="py-sm pr-md font-ui text-ui text-grafito">
                          Estatura
                        </th>
                        <th scope="col" className="py-sm font-ui text-ui text-grafito">
                          Disponibilidad
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGuide.map((entry) => {
                        const availability = availabilityFor(entry.value, sizeOptions);
                        return (
                          <tr key={entry.value} className="border-b border-borde last:border-b-0">
                            <td className="py-sm pr-md font-ui text-ui text-negro">{entry.value}</td>
                            <td className="py-sm pr-md font-body text-body text-negro">
                              {entry.minHeightCm}–{entry.maxHeightCm} cm
                            </td>
                            <td
                              className={cn(
                                "py-sm font-body text-body",
                                availability.isAvailable ? "text-estado-exito" : "text-grafito",
                              )}
                            >
                              {availability.label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
