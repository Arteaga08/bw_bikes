import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

export interface HeroControlsProps {
  total: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Bottom-left carousel chrome — progress dashes, "n | total" counter, and
 * ‹ › arrows, matching the reference (assos.com/int). Every control is a
 * real `<button>` with its own `aria-label`, never a bare `div` with a click
 * handler — the dashes double as direct-jump controls, not just a status
 * readout.
 */
export function HeroControls({ total, activeIndex, onSelect, onPrev, onNext }: HeroControlsProps) {
  return (
    <div className="absolute bottom-lg right-lg z-10 flex items-center gap-md text-blanco sm:right-2xl">
      <div className="flex gap-xs" role="group" aria-label="Ir a un slide">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Slide ${index + 1} de ${total}`}
            aria-current={index === activeIndex}
            onClick={() => onSelect(index)}
            className="h-[2px] w-8 rounded-full bg-blanco/40 transition-colors focus-visible:outline-3 focus-visible:outline-dorado focus-visible:outline-offset-4 aria-[current=true]:bg-dorado"
          />
        ))}
      </div>

      <p className="font-ui text-ui text-blanco/80" aria-hidden="true">
        {activeIndex + 1} | {total}
      </p>

      <div className="flex gap-xs">
        <button
          type="button"
          aria-label="Slide anterior"
          onClick={onPrev}
          className="flex h-8 w-8 items-center justify-center rounded-control text-blanco hover:text-dorado focus-visible:outline-3 focus-visible:outline-dorado focus-visible:outline-offset-2"
        >
          <CaretLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Siguiente slide"
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-control text-blanco hover:text-dorado focus-visible:outline-3 focus-visible:outline-dorado focus-visible:outline-offset-2"
        >
          <CaretRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
