import type { AdminAccessory, AdminBrand } from "@bw-bikes/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/error";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

const { replaceMock, refreshMock, pushMock, updateMock, createMock, replaceSpecGroupsMock, uploadGalleryMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  pushMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  replaceSpecGroupsMock: vi.fn(),
  uploadGalleryMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock, push: pushMock }),
  usePathname: () => "/admin/catalogo/accesorios/acc-1",
  // Step state lives in component state, not in a real URL — `push` is
  // mocked away, so this just needs to exist and never throw.
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/admin-catalog", () => ({
  adminAccessoriesApi: {
    update: updateMock,
    create: createMock,
    replaceSpecGroups: replaceSpecGroupsMock,
    uploadGallery: uploadGalleryMock,
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
  adminBikesApi: {
    update: vi.fn(),
    create: vi.fn(),
    replaceSpecGroups: vi.fn(),
  },
}));

const { ProductEditor } = await import("./ProductEditor");

beforeEach(() => {
  // jsdom doesn't implement the Blob URL API — the "Imágenes" step's
  // deferred `GallerySection` needs it to preview a file before the product
  // has an id. Patched in place (not via `vi.stubGlobal`) so the real `URL`
  // constructor keeps working, same pattern as `CategoryFormModal.test.tsx`.
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:staged-${counter++}`);
  URL.revokeObjectURL = vi.fn();
});

const brand: AdminBrand = {
  id: "brand-1",
  name: "Canyon",
  slug: "canyon",
  order: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const categoryTree: CategoryTreeNode[] = [
  {
    id: "cat-1",
    name: "Ruta",
    slug: "ruta",
    parent: null,
    order: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
  },
];

const accessory: AdminAccessory = {
  id: "acc-1",
  name: "Casco Aero",
  slug: "casco-aero",
  brand: { id: "brand-1", name: "Canyon", slug: "canyon", order: 0 },
  category: { id: "cat-1", name: "Ruta", slug: "ruta", parent: null, order: 0 },
  badges: [],
  description: "Casco aerodinámico de fibra de carbono.",
  price: 199_990,
  currency: "MXN",
  variants: [],
  specGroups: [
    { title: "Materiales", order: 0, visible: true, fields: [{ label: "Peso", value: "220 g", order: 0, visible: true }] },
  ],
  gallery: [],
  isActive: true,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderEditor(props: Partial<React.ComponentProps<typeof ProductEditor>> = {}) {
  return render(
    <ToastProvider>
      <ProductEditor
        kind="accessory"
        mode="edit"
        productId="acc-1"
        initialProduct={accessory}
        categoryTree={categoryTree}
        brands={[brand]}
        availableBadges={[]}
        specTemplates={[]}
        sizeTemplates={[]}
        listPath="/admin/catalogo/accesorios"
        {...props}
      />
    </ToastProvider>,
  );
}

describe("ProductEditor — unified save (edit mode)", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
  });

  it("saves the product, then the spec sheet, in that order", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(accessory);
    replaceSpecGroupsMock.mockResolvedValue(accessory.specGroups);

    renderEditor();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(replaceSpecGroupsMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith("acc-1", expect.any(Object));
    expect(replaceSpecGroupsMock).toHaveBeenCalledWith("acc-1", accessory.specGroups);

    const updateOrder = updateMock.mock.invocationCallOrder[0] as number;
    const replaceOrder = replaceSpecGroupsMock.mock.invocationCallOrder[0] as number;
    expect(updateOrder).toBeLessThan(replaceOrder);

    expect(screen.getByText("Cambios guardados")).toBeInTheDocument();
  });

  it("does not show a success toast when the product saves but the spec sheet fails", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(accessory);
    replaceSpecGroupsMock.mockRejectedValue(new ApiError("La ficha técnica no es válida.", 400));

    renderEditor();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(replaceSpecGroupsMock).toHaveBeenCalled());
    expect(screen.queryByText("Cambios guardados")).not.toBeInTheDocument();
    expect(await screen.findByText("Se guardó el producto, pero no la ficha técnica")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("never renders a separate spec-sheet save button", () => {
    renderEditor();
    expect(screen.queryByRole("button", { name: "Guardar ficha técnica" })).not.toBeInTheDocument();
  });
});

describe("ProductEditor — unified save (create mode)", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
  });

  it("sends specGroups inside a single create call and never calls replaceSpecGroups", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue({ ...accessory, id: "acc-new" });

    renderEditor({ mode: "create", productId: undefined, initialProduct: accessory });

    // `accessory` is already valid end to end, so each step's own "Siguiente"
    // passes straight through to the last step, where "Crear …" replaces it.
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole("button", { name: "Siguiente" }));
    }
    await user.click(screen.getByRole("button", { name: "Crear accesorio" }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ specGroups: accessory.specGroups }));
    expect(replaceSpecGroupsMock).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: "Guardar ficha técnica" })).not.toBeInTheDocument();
  });

  it("blocks 'Siguiente' on the first step when its required fields are empty", async () => {
    const user = userEvent.setup();
    const emptyAccessory: AdminAccessory = {
      ...accessory,
      name: "",
      description: "",
      brand: { ...accessory.brand, id: "" },
    };

    renderEditor({ mode: "create", productId: undefined, initialProduct: emptyAccessory });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText("El nombre es obligatorio.")).toBeInTheDocument();
    // Still on step 1 — "Nombre" (step 1's own field) is still in the DOM.
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("ProductEditor — validation summary", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
  });

  it("shows an error summary and moves focus to it when required fields are missing", async () => {
    const user = userEvent.setup();
    const emptyAccessory: AdminAccessory = {
      ...accessory,
      name: "",
      description: "",
      brand: { ...accessory.brand, id: "" },
    };

    renderEditor({ initialProduct: emptyAccessory });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText(/revisa \d+ campos? antes de guardar/i)).toBeInTheDocument();
    await waitFor(() => expect(summary).toHaveFocus());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("jumps to the first step with an error when 'Guardar cambios' fails from a later step", async () => {
    const user = userEvent.setup();
    const emptyAccessory: AdminAccessory = { ...accessory, name: "" };

    renderEditor({ initialProduct: emptyAccessory });

    // Edit mode never blocks "Siguiente" — walk to step 3 before saving.
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const summary = await screen.findByRole("alert");
    expect(within(summary).getByText("El nombre es obligatorio.")).toBeInTheDocument();
    // handleSubmit jumped back to step 1 — its field is back in the DOM.
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("ProductEditor — step navigation", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
  });

  it("does not block 'Siguiente' in edit mode even with invalid fields", async () => {
    const user = userEvent.setup();
    const emptyAccessory: AdminAccessory = { ...accessory, name: "" };

    renderEditor({ initialProduct: emptyAccessory });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByRole("heading", { name: "Tallas y variantes" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves back a step with 'Atrás' instead of leaving the form", async () => {
    const user = userEvent.setup();

    renderEditor();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Tallas y variantes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });
});

describe("ProductEditor — contextual help ('¿dónde sale esto?')", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
  });

  function helpButtons() {
    return screen.queryAllByRole("button", { name: /^Ayuda:/ });
  }

  it("only 'Descripción' gets a help button on 'Datos generales' — título, precio, badges and organización don't", () => {
    renderEditor();

    const buttons = helpButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Ayuda: Descripción");
  });

  it("'Tallas y variantes' carries no help button at all", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(helpButtons()).toHaveLength(0);
  });

  it("'Ficha técnica' and 'Galería' get their own help button (accessory: no Resumen/Geometría, both bike-only)", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("button", { name: "Ayuda: Ficha técnica" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("button", { name: "Ayuda: Galería" })).toBeInTheDocument();
  });
});

describe("ProductEditor — deferred gallery on create", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    pushMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
    replaceSpecGroupsMock.mockReset();
    uploadGalleryMock.mockReset();
  });

  function makeFile(name = "foto.png"): File {
    return new File(["fake-bytes"], name, { type: "image/png" });
  }

  it("uploads whatever was staged in 'Imágenes' right after the product is created", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue({ ...accessory, id: "acc-new" });
    uploadGalleryMock.mockResolvedValue([
      { publicId: "p1", url: "https://res.cloudinary.com/demo/image/upload/p1.jpg", width: 800, height: 800, order: 0 },
    ]);

    renderEditor({ mode: "create", productId: undefined, initialProduct: accessory });

    // Steps 1-2 are valid out of the box; step 3 (Ficha técnica) is skipped
    // straight through since it owns no validated field.
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Crear accesorio" }));

    await waitFor(() => expect(uploadGalleryMock).toHaveBeenCalled());
    expect(uploadGalleryMock).toHaveBeenCalledWith("acc-new", [expect.objectContaining({ name: "foto.png" })]);
  });

  it("reports a partial failure — the product is already saved — when the gallery upload fails", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue({ ...accessory, id: "acc-new" });
    uploadGalleryMock.mockRejectedValue(new ApiError("Cloudinary no respondió.", 502));

    renderEditor({ mode: "create", productId: undefined, initialProduct: accessory });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(screen.getByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Crear accesorio" }));

    expect(await screen.findByText("Se guardó el producto, pero no las imágenes")).toBeInTheDocument();
    // The create itself still succeeded — the admin lands on the saved product.
    expect(replaceMock).toHaveBeenCalledWith("/admin/catalogo/accesorios/acc-new");
  });
});
