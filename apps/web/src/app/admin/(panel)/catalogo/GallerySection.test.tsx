import type { ProductImage } from "@bw-bikes/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/error";
import { GallerySection, type StagedGalleryFile } from "./GallerySection";

function makeImage(publicId: string): ProductImage {
  return { publicId, url: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`, width: 800, height: 800, order: 0 };
}

function makeFile(name = "foto.png", sizeBytes = 1024): File {
  const file = new File(["x".repeat(sizeBytes)], name, { type: "image/png" });
  return file;
}

function renderWithToast(children: React.ReactElement) {
  return render(<ToastProvider>{children}</ToastProvider>);
}

beforeEach(() => {
  // jsdom doesn't implement the Blob URL API — `deferred` mode needs it to
  // preview a file the admin just picked. Patched in place (not via
  // `vi.stubGlobal`) so the real `URL` constructor `next/image` relies on
  // elsewhere keeps working. Same pattern as `CategoryFormModal.test.tsx`.
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:staged-${counter++}`);
  URL.revokeObjectURL = vi.fn();
});

describe("GallerySection — immediate mode", () => {
  it("uploads dropped files and reports them through onChange", async () => {
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue([makeImage("a")]);

    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[]}
        onChange={onChange}
        onUpload={onUpload}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith([makeImage("a")]);
  });

  it("rejects a file over 5 MB before ever calling onUpload", async () => {
    const onUpload = vi.fn();
    renderWithToast(
      <GallerySection mode="immediate" gallery={[]} onChange={vi.fn()} onUpload={onUpload} onRemove={vi.fn()} onReorder={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Subir imágenes"), {
      target: { files: [makeFile("grande.png", 6 * 1024 * 1024)] },
    });

    expect(await screen.findByText("Una imagen no se pudo agregar")).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("removes an image through onRemove", async () => {
    const onChange = vi.fn();
    const onRemove = vi.fn().mockResolvedValue([]);
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[makeImage("a")]}
        onChange={onChange}
        onUpload={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar imagen" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("a"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("reorders through onReorder when the 'mover después' arrow is used", async () => {
    const onChange = vi.fn();
    const onReorder = vi.fn().mockResolvedValue([makeImage("b"), makeImage("a")]);
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[makeImage("a"), makeImage("b")]}
        onChange={onChange}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onReorder={onReorder}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Mover después" })[0]!);

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(["b", "a"]));
    expect(onChange).toHaveBeenCalledWith([makeImage("b"), makeImage("a")]);
  });

  it("never renders a color selector when availableColors/onColorChange aren't supplied", () => {
    renderWithToast(
      <GallerySection mode="immediate" gallery={[makeImage("a")]} onChange={vi.fn()} onUpload={vi.fn()} onRemove={vi.fn()} onReorder={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Color")).not.toBeInTheDocument();
  });

  it("shows the cover badge only on the first image", () => {
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[makeImage("a"), makeImage("b")]}
        onChange={vi.fn()}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Portada")).toHaveLength(1);
  });
});

describe("GallerySection — color tagging (immediate mode only)", () => {
  it("offers the product's variant colors as options, defaulting to 'Sin asignar'", () => {
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[makeImage("a")]}
        onChange={vi.fn()}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        availableColors={["Negro", "Azul"]}
        onColorChange={vi.fn()}
      />,
    );

    const select = screen.getByLabelText("Color") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Sin asignar", "Negro", "Azul"]);
  });

  it("calls onColorChange with the selected color and applies the result through onChange", async () => {
    const onChange = vi.fn();
    const onColorChange = vi.fn().mockResolvedValue([{ ...makeImage("a"), color: "Negro" }]);
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[makeImage("a")]}
        onChange={onChange}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        availableColors={["Negro", "Azul"]}
        onColorChange={onColorChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "Negro" } });

    await waitFor(() => expect(onColorChange).toHaveBeenCalledWith("a", "Negro"));
    expect(onChange).toHaveBeenCalledWith([{ ...makeImage("a"), color: "Negro" }]);
  });

  it("keeps a tagged color visible and flags it even after it's no longer among the product's variant colors", () => {
    renderWithToast(
      <GallerySection
        mode="immediate"
        gallery={[{ ...makeImage("a"), color: "Verde" }]}
        onChange={vi.fn()}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        availableColors={["Negro"]}
        onColorChange={vi.fn()}
      />,
    );

    const select = screen.getByLabelText("Color") as HTMLSelectElement;
    expect(select.value).toBe("Verde");
    expect(screen.getByText("Este color ya no está en las variantes.")).toBeInTheDocument();
  });

  describe("cap of 2 photos per color", () => {
    it("blocks tagging a 3rd card with a color that already has 2, without calling onColorChange", async () => {
      const onChange = vi.fn();
      const onColorChange = vi.fn();
      renderWithToast(
        <GallerySection
          mode="immediate"
          gallery={[
            { ...makeImage("a"), color: "Negro" },
            { ...makeImage("b"), color: "Negro" },
            makeImage("c"),
          ]}
          onChange={onChange}
          onUpload={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          availableColors={["Negro"]}
          onColorChange={onColorChange}
        />,
      );

      const selects = screen.getAllByLabelText("Color") as HTMLSelectElement[];
      fireEvent.change(selects[2]!, { target: { value: "Negro" } });

      expect(await screen.findByText("No se pudo actualizar el color")).toBeInTheDocument();
      expect(onColorChange).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("allows tagging when the target color currently has exactly 1 card", async () => {
      const onColorChange = vi.fn().mockResolvedValue([]);
      renderWithToast(
        <GallerySection
          mode="immediate"
          gallery={[{ ...makeImage("a"), color: "Negro" }, makeImage("b")]}
          onChange={vi.fn()}
          onUpload={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          availableColors={["Negro"]}
          onColorChange={onColorChange}
        />,
      );

      const selects = screen.getAllByLabelText("Color") as HTMLSelectElement[];
      fireEvent.change(selects[1]!, { target: { value: "Negro" } });

      await waitFor(() => expect(onColorChange).toHaveBeenCalledWith("b", "Negro"));
    });

    it("doesn't count the card's own current color against itself when retagging to the same color", async () => {
      const onColorChange = vi.fn().mockResolvedValue([]);
      renderWithToast(
        <GallerySection
          mode="immediate"
          gallery={[
            { ...makeImage("a"), color: "Negro" },
            { ...makeImage("b"), color: "Negro" },
          ]}
          onChange={vi.fn()}
          onUpload={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          availableColors={["Negro"]}
          onColorChange={onColorChange}
        />,
      );

      const selects = screen.getAllByLabelText("Color") as HTMLSelectElement[];
      // Re-selecting "Negro" on a card that already carries "Negro" isn't a 3rd — it's the same 2.
      fireEvent.change(selects[0]!, { target: { value: "Negro" } });

      await waitFor(() => expect(onColorChange).toHaveBeenCalledWith("a", "Negro"));
    });
  });
});

describe("GallerySection — deferred mode", () => {
  it("stages dropped files locally instead of uploading, with no productId involved", () => {
    const onChange = vi.fn();
    renderWithToast(<GallerySection mode="deferred" staged={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile("a.png")] } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const staged = onChange.mock.calls[0]![0] as StagedGalleryFile[];
    expect(staged).toHaveLength(1);
    expect(staged[0]!.file.name).toBe("a.png");
    expect(staged[0]!.previewUrl).toMatch(/^blob:/);
  });

  it("appends to whatever was already staged instead of replacing it", () => {
    const existing: StagedGalleryFile = { id: "s1", file: makeFile("first.png"), previewUrl: "blob:staged-0" };
    const onChange = vi.fn();
    renderWithToast(<GallerySection mode="deferred" staged={[existing]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile("second.png")] } });

    const staged = onChange.mock.calls[0]![0] as StagedGalleryFile[];
    expect(staged.map((item) => item.file.name)).toEqual(["first.png", "second.png"]);
  });

  it("removes a staged file locally and revokes its object URL", () => {
    const staged: StagedGalleryFile[] = [
      { id: "s1", file: makeFile("a.png"), previewUrl: "blob:staged-0" },
      { id: "s2", file: makeFile("b.png"), previewUrl: "blob:staged-1" },
    ];
    const onChange = vi.fn();
    renderWithToast(<GallerySection mode="deferred" staged={staged} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar imagen" })[0]!);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:staged-0");
    expect(onChange).toHaveBeenCalledWith([staged[1]]);
  });

  it("reorders staged files locally, with no network call", () => {
    const staged: StagedGalleryFile[] = [
      { id: "s1", file: makeFile("a.png"), previewUrl: "blob:staged-0" },
      { id: "s2", file: makeFile("b.png"), previewUrl: "blob:staged-1" },
    ];
    const onChange = vi.fn();
    renderWithToast(<GallerySection mode="deferred" staged={staged} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Mover después" })[0]!);

    expect(onChange).toHaveBeenCalledWith([staged[1], staged[0]]);
  });

  it("respects the 15-image cap against the staged count, not a server-known count", () => {
    const staged: StagedGalleryFile[] = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      file: makeFile(`${i}.png`),
      previewUrl: `blob:staged-${i}`,
    }));
    renderWithToast(<GallerySection mode="deferred" staged={staged} onChange={vi.fn()} />);

    expect(screen.getByText("Alcanzaste el máximo de 15 imágenes")).toBeInTheDocument();
    expect(screen.getByLabelText("Subir imágenes")).toBeDisabled();
  });
});

describe("GallerySection — upload failure", () => {
  it("reports a specific error instead of silently losing the picked files", async () => {
    const onUpload = vi.fn().mockRejectedValue(new ApiError("Cloudinary no respondió.", 502));
    renderWithToast(
      <GallerySection mode="immediate" gallery={[]} onChange={vi.fn()} onUpload={onUpload} onRemove={vi.fn()} onReorder={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

    expect(await screen.findByText("No se pudieron subir las imágenes")).toBeInTheDocument();
    expect(await screen.findByText("Cloudinary no respondió.")).toBeInTheDocument();
  });
});
