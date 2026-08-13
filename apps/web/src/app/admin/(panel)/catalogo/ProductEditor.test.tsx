import type { AdminAccessory, AdminBrand } from "@bw-bikes/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/error";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

const { replaceMock, refreshMock, pushMock, updateMock, createMock, replaceSpecGroupsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  pushMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  replaceSpecGroupsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock, push: pushMock }),
}));

vi.mock("@/lib/api/admin-catalog", () => ({
  adminAccessoriesApi: {
    update: updateMock,
    create: createMock,
    replaceSpecGroups: replaceSpecGroupsMock,
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
  adminBikesApi: {
    update: vi.fn(),
    create: vi.fn(),
    replaceSpecGroups: vi.fn(),
  },
}));

const { ProductEditor } = await import("./ProductEditor");

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
  specGroups: [{ title: "Materiales", order: 0, fields: [{ label: "Peso", value: "220 g", order: 0 }] }],
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
    await user.click(screen.getByRole("button", { name: "Crear accesorio" }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ specGroups: accessory.specGroups }));
    expect(replaceSpecGroupsMock).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: "Guardar ficha técnica" })).not.toBeInTheDocument();
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
});
