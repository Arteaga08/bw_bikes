import type { AdminCategory } from "@bw-bikes/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { CategoryFormModal } from "./CategoryFormModal";

function makeCategory(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: "cat-1",
    name: "Montaña",
    slug: "montana",
    parent: null,
    order: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImageFile(name = "logo.png"): File {
  return new File(["fake-bytes"], name, { type: "image/png" });
}

beforeEach(() => {
  // jsdom doesn't implement the Blob URL API — `CategoryImageField`'s
  // deferred mode needs it to preview a file the admin just picked, before
  // there's a category id to upload it to. Patched in place (not via
  // `vi.stubGlobal`) so the real `URL` constructor next/image relies on
  // elsewhere keeps working.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("CategoryFormModal", () => {
  it("the image picker is available from the start, before the category is saved", () => {
    render(
      <ToastProvider>
        <CategoryFormModal
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          rootOptions={[]}
        />
      </ToastProvider>,
    );

    // No more "guarda primero" gate — the admin can pick the file immediately.
    expect(screen.queryByText("Guarda la categoría para poder subir una imagen.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Subir imagen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("creating a category with a pending image saves it and uploads the image right after", async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn().mockResolvedValue(makeCategory());
    const onUploadImage = vi
      .fn()
      .mockResolvedValue(
        makeCategory({ image: { publicId: "p1", url: "https://res.cloudinary.com/demo/image/upload/p1.jpg", width: 10, height: 10 } }),
      );
    const onChanged = vi.fn();

    render(
      <ToastProvider>
        <CategoryFormModal
          onClose={onClose}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onUploadImage={onUploadImage}
          onRemoveImage={vi.fn()}
          onChanged={onChanged}
          rootOptions={[]}
        />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Montaña" } });

    const file = makeImageFile();
    fireEvent.change(screen.getByLabelText("Subir imagen"), { target: { files: [file] } });

    // Staged locally — a "Quitar" affordance appears, nothing was uploaded yet.
    await waitFor(() => expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument());
    expect(onUploadImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onUploadImage).toHaveBeenCalledWith("cat-1", file));
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("when the image upload fails after create, the category stays saved and the field switches to immediate retry mode", async () => {
    const onCreate = vi.fn().mockResolvedValue(makeCategory());
    const onUploadImage = vi.fn().mockRejectedValue(new Error("network down"));

    render(
      <ToastProvider>
        <CategoryFormModal
          onClose={vi.fn()}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onUploadImage={onUploadImage}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          rootOptions={[]}
        />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Montaña" } });
    fireEvent.change(screen.getByLabelText("Subir imagen"), { target: { files: [makeImageFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onUploadImage).toHaveBeenCalledTimes(1));
    // The category itself was created successfully — the modal now shows the
    // immediate-mode uploader (no more "Cancelar", the category exists) so
    // the admin can retry without losing the rest of the form.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument());
    expect(screen.getByLabelText("Subir imagen")).toBeInTheDocument();
  });

  it("editing an existing category shows the immediate-mode image section", () => {
    render(
      <ToastProvider>
        <CategoryFormModal
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onUploadImage={vi.fn()}
          onRemoveImage={vi.fn()}
          onChanged={vi.fn()}
          rootOptions={[]}
          initial={makeCategory()}
        />
      </ToastProvider>,
    );

    expect(screen.getByLabelText("Subir imagen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(screen.queryByText("Guarda la categoría para poder subir una imagen.")).not.toBeInTheDocument();
  });
});
