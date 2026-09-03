import type { AdminAccessory, AdminBike, AdminBrand, ColorTemplate } from "@bw-bikes/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/error";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

const {
  replaceMock,
  refreshMock,
  pushMock,
  updateMock,
  createMock,
  replaceSpecGroupsMock,
  uploadGalleryMock,
  updateGalleryImageColorMock,
  updateBikeMock,
  createBikeMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  pushMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  replaceSpecGroupsMock: vi.fn(),
  uploadGalleryMock: vi.fn(),
  updateGalleryImageColorMock: vi.fn(),
  updateBikeMock: vi.fn(),
  createBikeMock: vi.fn(),
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
    updateGalleryImageColor: updateGalleryImageColorMock,
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
  adminBikesApi: {
    update: updateBikeMock,
    create: createBikeMock,
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

const colorTemplate: ColorTemplate = {
  id: "color-1",
  value: "Negro",
  hex: "#0A0A0A",
  secondaryHex: null,
  source: "manual",
  order: 0,
  isActive: true,
};

const categoryTree: CategoryTreeNode[] = [
  {
    id: "cat-1",
    name: "Ruta",
    slug: "ruta",
    parent: null,
    order: 0,
    usesSizes: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
  },
  {
    id: "cat-2",
    name: "Bombas de aire",
    slug: "bombas-de-aire",
    parent: null,
    order: 1,
    usesSizes: false,
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
  category: { id: "cat-1", name: "Ruta", slug: "ruta", parent: null, order: 0, usesSizes: true },
  badges: [],
  description: "Casco aerodinámico de fibra de carbono.",
  price: 199_990,
  currency: "MXN",
  variants: [],
  specGroups: [
    { title: "Materiales", order: 0, visible: true, fields: [{ label: "Peso", value: "220 g", order: 0, visible: true }] },
  ],
  gallery: [],
  isNewArrival: false,
  isCustomerFavorite: false,
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
        colorTemplates={[colorTemplate]}
        listPath="/admin/catalogo/accesorios"
        {...props}
      />
    </ToastProvider>,
  );
}

const bike: AdminBike = {
  id: "bike-1",
  name: "Tarmac SL8",
  slug: "tarmac-sl8",
  brand: { id: "brand-1", name: "Canyon", slug: "canyon", order: 0 },
  category: { id: "cat-1", name: "Ruta", slug: "ruta", parent: null, order: 0, usesSizes: true },
  badges: [],
  shortDescription: "Bici de ruta de alto rendimiento.",
  description: "Cuadro de carbono, geometría Rider-First.",
  price: 19_999_900,
  currency: "MXN",
  variants: [],
  summary: [],
  specGroups: [],
  relatedAccessories: [],
  gallery: [],
  isNewArrival: false,
  isCustomerFavorite: false,
  isActive: true,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderBikeEditor(props: Partial<React.ComponentProps<typeof ProductEditor>> = {}) {
  return render(
    <ToastProvider>
      <ProductEditor
        kind="bike"
        mode="edit"
        productId="bike-1"
        initialProduct={bike}
        categoryTree={categoryTree}
        brands={[brand]}
        availableBadges={[]}
        specTemplates={[]}
        sizeTemplates={[]}
        colorTemplates={[colorTemplate]}
        listPath="/admin/catalogo/bicicletas"
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

  it("computes the SKU and includes initialStock for a brand-new variant added mid-edit", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(accessory);
    replaceSpecGroupsMock.mockResolvedValue(accessory.specGroups);

    renderEditor();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Tallas y variantes" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nueva talla"), "54");
    await user.click(screen.getByRole("button", { name: "Agregar talla" }));

    await user.selectOptions(screen.getByLabelText("Color"), "Negro");
    expect((screen.getByLabelText("SKU") as HTMLInputElement).value).toBe("CAN-CASAER-54-NEG");

    await user.type(screen.getByLabelText("Stock inicial"), "5");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock).toHaveBeenCalledWith(
      "acc-1",
      expect.objectContaining({
        variants: expect.arrayContaining([
          expect.objectContaining({ sku: "CAN-CASAER-54-NEG", size: "54", color: "Negro", initialStock: 5 }),
        ]),
      }),
    );
  });

  it("offers the product's variant colors when tagging a gallery photo, and applies the saved result", async () => {
    const user = userEvent.setup();
    const taggedAccessory: AdminAccessory = {
      ...accessory,
      variants: [
        {
          sku: "ACC-A",
          size: "U",
          color: "Negro",
          fulfillmentMode: "in_stock",
          isActive: true,
        },
      ],
      gallery: [
        { publicId: "p1", url: "https://res.cloudinary.com/demo/image/upload/p1.jpg", width: 800, height: 800, order: 0 },
      ],
    };
    updateGalleryImageColorMock.mockResolvedValue([{ ...taggedAccessory.gallery[0]!, color: "Negro" }]);

    renderEditor({ initialProduct: taggedAccessory });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // `GallerySection` is code-split (`next/dynamic`, Sesión 2 de la
    // auditoría de rendimiento) — it mounts asynchronously after the
    // navigation that first reveals it, so this needs `findBy`, not `getBy`.
    const colorSelect = (await screen.findByLabelText("Color")) as HTMLSelectElement;
    expect(Array.from(colorSelect.options).map((option) => option.textContent)).toEqual(["Sin asignar", "Negro"]);

    await user.selectOptions(colorSelect, "Negro");

    await waitFor(() => expect(updateGalleryImageColorMock).toHaveBeenCalledWith("acc-1", "p1", "Negro"));
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

  it("hides SizePicker and shows 'Agregar variante' when the selected category doesn't use sizes", async () => {
    const user = userEvent.setup();
    const sizelessAccessory: AdminAccessory = {
      ...accessory,
      category: { ...accessory.category, id: "cat-2", usesSizes: false },
    };

    renderEditor({ initialProduct: sizelessAccessory });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByRole("heading", { name: "Tallas y variantes" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tallas del producto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar variante" })).toBeInTheDocument();
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

    // Same async-mount reasoning as the "Color" select above.
    fireEvent.change(await screen.findByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

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

    // Same async-mount reasoning as the "Color" select above.
    fireEvent.change(await screen.findByLabelText("Subir imágenes"), { target: { files: [makeFile()] } });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Crear accesorio" }));

    expect(await screen.findByText("Se guardó el producto, pero no las imágenes")).toBeInTheDocument();
    // The create itself still succeeded — the admin lands on the saved product.
    expect(replaceMock).toHaveBeenCalledWith("/admin/catalogo/accesorios/acc-new");
  });
});


describe("ProductEditor — bike-only modelYear field", () => {
  beforeEach(() => {
    updateBikeMock.mockReset();
    createBikeMock.mockReset();
  });

  it("hydrates the field from the persisted bike", () => {
    renderBikeEditor({ initialProduct: { ...bike, modelYear: 2025 } });
    expect((screen.getByLabelText("Año del modelo") as HTMLInputElement).value).toBe("2025");
  });

  it("leaves the field blank for a bike with no modelYear on file", () => {
    renderBikeEditor();
    expect((screen.getByLabelText("Año del modelo") as HTMLInputElement).value).toBe("");
  });

  it("saves a typed modelYear as a number on the update payload", async () => {
    const user = userEvent.setup();
    updateBikeMock.mockResolvedValue(bike);

    renderBikeEditor();
    await user.type(screen.getByLabelText("Año del modelo"), "2026");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updateBikeMock).toHaveBeenCalled());
    expect(updateBikeMock).toHaveBeenCalledWith("bike-1", expect.objectContaining({ modelYear: 2026 }));
  });

  it("omits modelYear from the payload when the field is left blank", async () => {
    const user = userEvent.setup();
    updateBikeMock.mockResolvedValue(bike);

    renderBikeEditor();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updateBikeMock).toHaveBeenCalled());
    const payload = updateBikeMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("modelYear");
  });

  it("rejects an out-of-range modelYear and never calls update", async () => {
    const user = userEvent.setup();

    renderBikeEditor();
    await user.type(screen.getByLabelText("Año del modelo"), "1800");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    // The message shows up twice by design — inline under the field and again
    // as a jump link in `ErrorSummary` — so this asserts on the inline copy
    // specifically via its element type, the same `<p>` `Input` renders.
    expect(await screen.findByText("El año debe ser un número entero entre 1990 y 2100.", { selector: "p" })).toBeInTheDocument();
    expect(updateBikeMock).not.toHaveBeenCalled();
  });
});
