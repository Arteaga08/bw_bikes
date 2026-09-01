"use client";

export interface ProductGalleryDotsProps {
  /** Total photos in the track — one dot each. */
  count: number;
  /** Zero-based index of the photo currently snapped into view. */
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Indicador de posición del carrusel de fotos, solo bajo `lg` (`lg:hidden`):
 * desde ahí la galería deja de ser un carrusel y pasa a ser el bento, donde
 * todas las fotos están a la vista y un indicador no señalaría nada.
 *
 * Barra, no círculo — el sistema es de radios casi rectos y esta es la misma
 * forma que ya usa `ScrollRailProgress` para comunicar posición en el home,
 * escalada a un segmento por foto porque aquí sí existe una "foto activa".
 *
 * Sin dorado: el acento es único por vista y en la PDP le pertenece al CTA
 * "Comprar" (DESIGN.md §2, The One Accent Rule). El contraste entre activo e
 * inactivo lo carga el negro contra su propia versión al 25%.
 *
 * El `<button>` mide 44px de alto aunque la barra visible mida 3px: el área
 * táctil es la del control, no la del pixel pintado.
 */
export function ProductGalleryDots({ count, activeIndex, onSelect }: ProductGalleryDotsProps) {
  if (count <= 1) return null;

  return (
    <div className="mt-xs flex items-center justify-center gap-xs lg:hidden">
      {Array.from({ length: count }, (_, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`Ir a la foto ${index + 1} de ${count}`}
            aria-current={isActive ? "true" : undefined}
            className="flex h-11 w-6 items-center justify-center focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado"
          >
            <span
              aria-hidden="true"
              className={`h-[3px] rounded-full transition-all duration-150 ${
                isActive ? "w-6 bg-negro" : "w-2 bg-negro/25"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
