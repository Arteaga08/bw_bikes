import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SlideOver } from "./SlideOver";

describe("SlideOver", () => {
  it("renders nothing when closed", () => {
    render(
      <SlideOver open={false} onClose={vi.fn()} title="Orden BW-2026-K7XQ2M">
        Contenido
      </SlideOver>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is an accessible dialog labelled by its title, with the subtitle rendered", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Orden BW-2026-K7XQ2M" subtitle="Pagada">
        Contenido
      </SlideOver>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Orden BW-2026-K7XQ2M");
    expect(screen.getByText("Pagada")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Orden">
        Contenido
      </SlideOver>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click but not on a click inside the panel", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Orden">
        Contenido
      </SlideOver>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    // The overlay is the dialog's parent — the only element outside the panel itself.
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the footer only when provided", () => {
    const { rerender } = render(
      <SlideOver open onClose={vi.fn()} title="Orden">
        Contenido
      </SlideOver>,
    );
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();

    rerender(
      <SlideOver open onClose={vi.fn()} title="Orden" footer={<button type="button">Confirmar</button>}>
        Contenido
      </SlideOver>,
    );
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("widens the panel via maxWidthClassName and keeps the 480px default otherwise", () => {
    const { rerender } = render(
      <SlideOver open onClose={vi.fn()} title="Orden">
        Contenido
      </SlideOver>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("max-w-[480px]");

    rerender(
      <SlideOver open onClose={vi.fn()} title="Orden" maxWidthClassName="max-w-[46rem]">
        Contenido
      </SlideOver>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("max-w-[46rem]");
    expect(screen.getByRole("dialog")).not.toHaveClass("max-w-[480px]");
  });

  it("renders headerAside next to the close button", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Orden" headerAside={<button type="button">Siguiente</button>}>
        Contenido
      </SlideOver>,
    );
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar panel" })).toBeInTheDocument();
  });

  it("traps focus inside the panel and returns it to the trigger on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <SlideOver open={open} onClose={() => setOpen(false)} title="Orden" footer={<button type="button">Cerrar</button>}>
            <button type="button">Dentro</button>
          </SlideOver>
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });
});
