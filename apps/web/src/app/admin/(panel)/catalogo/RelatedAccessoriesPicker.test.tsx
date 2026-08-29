import type { AdminAccessory } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock("@/lib/api/admin-catalog", () => ({
  adminAccessoriesApi: { list: listMock },
}));

const { RelatedAccessoriesPicker } = await import("./RelatedAccessoriesPicker");

const categoryTree: CategoryTreeNode[] = [
  {
    id: "cat-cascos",
    name: "Cascos",
    slug: "cascos",
    parent: null,
    order: 0,
    usesSizes: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
  },
  {
    id: "cat-luces",
    name: "Luces",
    slug: "luces",
    parent: null,
    order: 1,
    usesSizes: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
  },
];

function buildAccessory(overrides: Partial<AdminAccessory>): AdminAccessory {
  return {
    id: "acc-1",
    name: "Casco Aero",
    slug: "casco-aero",
    brand: { id: "brand-1", name: "Canyon", slug: "canyon", order: 0 },
    category: { id: "cat-cascos", name: "Cascos", slug: "cascos", parent: null, order: 0, usesSizes: false },
    badges: [],
    description: "Casco aerodinámico de fibra de carbono.",
    price: 199_990,
    currency: "MXN",
    variants: [],
    specGroups: [],
    gallery: [],
    isNewArrival: false,
    isCustomerFavorite: false,
    isActive: true,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const cascoAero = buildAccessory({ id: "acc-1", name: "Casco Aero" });
const timbreBell = buildAccessory({
  id: "acc-2",
  name: "Timbre Bell",
  category: { id: "cat-luces", name: "Luces", slug: "luces", parent: null, order: 1, usesSizes: false },
});

function renderPicker(props: Partial<Parameters<typeof RelatedAccessoriesPicker>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <ToastProvider>
      <RelatedAccessoriesPicker selected={[]} onChange={onChange} categoryTree={categoryTree} {...props} />
    </ToastProvider>,
  );
  return { onChange };
}

beforeEach(() => {
  listMock.mockReset();
  listMock.mockResolvedValue({ data: [] });
});

describe("RelatedAccessoriesPicker", () => {
  it("renders one accordion section per category and none expanded initially", () => {
    renderPicker();

    expect(screen.getByRole("button", { name: "Cascos" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Luces" })).toHaveAttribute("aria-expanded", "false");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lazily fetches a category's accessories on first expand and caches them", async () => {
    listMock.mockResolvedValueOnce({ data: [cascoAero] });
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: "Cascos" }));

    expect(listMock).toHaveBeenCalledWith({ category: "cat-cascos", limit: 50 });
    await waitFor(() => expect(screen.getByText("Casco Aero")).toBeInTheDocument());

    // Collapse then re-expand — the cached result renders without a second fetch.
    await user.click(screen.getByRole("button", { name: "Cascos" }));
    await user.click(screen.getByRole("button", { name: "Cascos" }));
    expect(screen.getByText("Casco Aero")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("searches live as the admin types, without a search button", async () => {
    listMock.mockResolvedValueOnce({ data: [timbreBell] });
    const user = userEvent.setup();
    renderPicker();

    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar accesorio"), "timbre");

    await waitFor(() => expect(listMock).toHaveBeenCalledWith({ search: "timbre", limit: 10 }));
    await waitFor(() => expect(screen.getByText("Timbre Bell")).toBeInTheDocument());
    // Search results show the category, since they're not already grouped under one.
    expect(screen.getByText("Luces")).toBeInTheDocument();
    // The category accordion is hidden while a search is active.
    expect(screen.queryByRole("button", { name: "Cascos" })).not.toBeInTheDocument();
  });

  it("adds an accessory found via search and lets it be removed as a chip", async () => {
    listMock.mockResolvedValueOnce({ data: [cascoAero] });
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(screen.getByLabelText("Buscar accesorio"), "casco");
    await waitFor(() => expect(screen.getByText("Casco Aero")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Agregar" }));
    expect(onChange).toHaveBeenCalledWith([cascoAero]);
  });

  it("disables adding once MAX_RELATED_ACCESSORIES is reached", async () => {
    listMock.mockResolvedValueOnce({ data: [cascoAero] });
    const user = userEvent.setup();
    const twelveOthers = Array.from({ length: 12 }, (_, index) => buildAccessory({ id: `filler-${index}`, name: `Relleno ${index}` }));
    renderPicker({ selected: twelveOthers });

    await user.type(screen.getByLabelText("Buscar accesorio"), "casco");
    await waitFor(() => expect(screen.getByText("Casco Aero")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Agregar" })).toBeDisabled();
  });

  it("removes a selected accessory when its chip's close button is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ selected: [cascoAero] });

    await user.click(screen.getByRole("button", { name: "Quitar Casco Aero" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
