import type { ProductImage } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductGallery } from "./ProductGallery";

function image(order: number): ProductImage {
  return { publicId: `img-${order}`, url: `https://res.cloudinary.com/demo/image/upload/img-${order}.jpg`, width: 800, height: 800, order };
}

function images(count: number): ProductImage[] {
  return Array.from({ length: count }, (_, index) => image(index));
}

/** El tile clickeable de cada foto — un `<button>` con `aria-label` "Ampliar foto: …". */
function tiles(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /^Ampliar foto:/ });
}

/** El tile en una posición concreta. Falla ruidosamente si no existe, en vez de devolver `undefined`. */
function tileAt(index: number): HTMLElement {
  const tile = tiles()[index];
  if (!tile) throw new Error(`No hay ninguna foto en la posición ${index}`);
  return tile;
}

// jsdom no implementa `scrollTo`, que es lo que dispara el clic en un dot.
// (`ResizeObserver` y `matchMedia` ya vienen del stub compartido de
// `vitest.setup.ts`.)
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

describe("ProductGallery", () => {
  it("renders a neutral placeholder frame when the product has no photos", () => {
    render(<ProductGallery images={[]} productName="Bici" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("mounts every photo once, in `order`, whatever the viewport", () => {
    // Un solo DOM para carrusel y bento: las fotos más allá de la cuarta están
    // siempre montadas y solo se ocultan por CSS en el bento (ver más abajo).
    render(<ProductGallery images={[image(2), image(0), image(1)]} productName="Bici" />);

    const rendered = screen.getAllByRole("img");
    expect(rendered).toHaveLength(3);
    expect(rendered.map((img) => img.getAttribute("src"))).toEqual(
      ["img-0", "img-1", "img-2"].map((id) => expect.stringContaining(id)),
    );
  });

  it("gives the carousel one dot per photo", () => {
    render(<ProductGallery images={images(6)} productName="Bici" />);

    expect(screen.getAllByRole("button", { name: /^Ir a la foto/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Ir a la foto 1 de 6" })).toHaveAttribute("aria-current", "true");
  });

  it("shows no dots for a lone photo — there is nothing to navigate", () => {
    render(<ProductGallery images={[image(0)]} productName="Bici" />);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Ir a la foto/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver más/)).not.toBeInTheDocument();
  });

  it("scrolls the track to the chosen slide when a dot is clicked", () => {
    // El stub compartido de `matchMedia` responde `matches: true` a toda
    // consulta, así que por defecto el componente se cree bajo
    // `prefers-reduced-motion: reduce`. Este caso mira la mecánica; el
    // siguiente mira la animación.
    render(<ProductGallery images={images(4)} productName="Bici" />);

    fireEvent.click(screen.getByRole("button", { name: "Ir a la foto 3 de 4" }));

    // jsdom reporta 0 en toda medida de layout, así que el offset calculado es
    // 0; lo que se verifica es que el dot delega en el scroll nativo del track
    // (y no en un `window.scrollTo` ni en un cambio de estado propio).
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "auto" });
  });

  it("animates the jump only when the visitor hasn't asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query !== "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<ProductGallery images={images(4)} productName="Bici" />);
    fireEvent.click(screen.getByRole("button", { name: "Ir a la foto 3 de 4" }));

    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "smooth" });

    vi.unstubAllGlobals();
  });

  it("hides the photos past the fourth from the bento only, and reveals them with 'Ver más'", () => {
    render(<ProductGallery images={images(6)} productName="Bici" />);

    // Las 6 están montadas para el carrusel móvil; la 5ª y la 6ª salen del
    // bento por CSS, no desmontándose.
    expect(screen.getAllByRole("img")).toHaveLength(6);
    expect(tileAt(4)).toHaveClass("lg:hidden");
    expect(tileAt(5)).toHaveClass("lg:hidden");
    expect(tileAt(3)).not.toHaveClass("lg:hidden");

    fireEvent.click(screen.getByText("Ver más (+2)"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(tileAt(4)).not.toHaveClass("lg:hidden");
    expect(tileAt(5)).not.toHaveClass("lg:hidden");

    fireEvent.click(screen.getByText("Ver menos"));

    expect(tileAt(4)).toHaveClass("lg:hidden");
  });

  it("gives the first two photos the full bento row and the rest half of it", () => {
    render(<ProductGallery images={images(4)} productName="Bici" />);

    expect(tileAt(0)).toHaveClass("lg:col-span-2");
    expect(tileAt(1)).toHaveClass("lg:col-span-2");
    expect(tileAt(2)).not.toHaveClass("lg:col-span-2");
    expect(tileAt(3)).not.toHaveClass("lg:col-span-2");
  });

  it("opens the lightbox at the clicked photo's index in the full sorted list", () => {
    render(<ProductGallery images={images(6)} productName="Bici" />);

    // La 5ª foto: fuera del bento colapsado, pero siempre alcanzable desde el
    // carrusel — el lightbox debe abrirse en ella, no en la primera.
    fireEvent.click(tileAt(4));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("5 / 6")).toBeInTheDocument();
  });
});
