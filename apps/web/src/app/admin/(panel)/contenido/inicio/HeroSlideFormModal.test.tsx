import type { AdminHeroSlide, HeroCtaTargetType } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ComboboxOption } from "@/components/ui/Combobox";
import { HeroSlideFormModal } from "./HeroSlideFormModal";

const EMPTY_CATALOG_OPTIONS: Record<Exclude<HeroCtaTargetType, "url">, ComboboxOption[]> = {
  bike: [],
  bikeCategory: [],
  accessory: [],
  accessoryCategory: [],
};

function makeSlide(overrides: Partial<AdminHeroSlide> = {}): AdminHeroSlide {
  return {
    id: "slide-1",
    focalPoint: "center",
    title: "Rhino Race",
    ctas: [{ label: "Ver bici", target: { type: "url", url: "/bicicletas" }, href: "/bicicletas", isBroken: false }],
    order: 0,
    isActive: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  // Same reasoning as `CategoryFormModal.test.tsx`: jsdom has no Blob URL API,
  // and `ImageField`'s deferred mode needs it to preview a picked file.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("HeroSlideFormModal", () => {
  it("starts with exactly one required CTA and no way to remove it", () => {
    render(
      <ToastProvider>
        <HeroSlideFormModal
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          catalogOptionsByType={EMPTY_CATALOG_OPTIONS}
        />
      </ToastProvider>,
    );

    expect(screen.getByText("Botón 1 (obligatorio)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("lets the admin add a second CTA and remove it again", () => {
    render(
      <ToastProvider>
        <HeroSlideFormModal
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          catalogOptionsByType={EMPTY_CATALOG_OPTIONS}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar un segundo botón" }));
    expect(screen.getByText("Botón 2 (opcional)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar un segundo botón" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(screen.queryByText("Botón 2 (opcional)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar un segundo botón" })).toBeInTheDocument();
  });

  it("refuses to save without a title", () => {
    const onCreate = vi.fn();
    render(
      <ToastProvider>
        <HeroSlideFormModal
          onClose={vi.fn()}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          catalogOptionsByType={EMPTY_CATALOG_OPTIONS}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("El título es obligatorio.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("editing an existing slide shows the API's resolved CTA state", () => {
    render(
      <ToastProvider>
        <HeroSlideFormModal
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          initial={makeSlide()}
          catalogOptionsByType={EMPTY_CATALOG_OPTIONS}
        />
      </ToastProvider>,
    );

    expect(screen.getByDisplayValue("Rhino Race")).toBeInTheDocument();
    expect(screen.getByText("Va a: /bicicletas")).toBeInTheDocument();
  });
});
