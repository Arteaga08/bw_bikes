import type {
  AdminAccessory,
  AdminBadge,
  AdminBike,
  AdminBrand,
  AdminCategory,
  BadgeVariant,
  FulfillmentMode,
  ProductImage,
  SpecGroup,
  SpecTemplate,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

// --- Shared query builders -------------------------------------------------

export interface AdminProductListParams {
  page?: number;
  limit?: number;
  /** Whitelisted by the backend to `createdAt` | `price` | `name`, `-` prefix for descending. */
  sort?: string;
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  isActive?: boolean;
}

/**
 * Whitelist-built querystring, mirroring `adminProductListQuerySchema`
 * (`apps/api/src/validators/list-query.validator.ts`) — never the caller's
 * full filter-state object, same discipline as `admin-orders.ts`.
 */
function buildProductListQuery(params: AdminProductListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.category) entries.push(["category", params.category]);
  if (params.brand) entries.push(["brand", params.brand]);
  if (params.minPrice !== undefined) entries.push(["minPrice", String(params.minPrice)]);
  if (params.maxPrice !== undefined) entries.push(["maxPrice", String(params.maxPrice)]);
  if (params.size) entries.push(["size", params.size]);
  if (params.color) entries.push(["color", params.color]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export interface AdminCategoryListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  parent?: string | null;
  isActive?: boolean;
}

function buildCategoryListQuery(params: AdminCategoryListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.parent !== undefined) entries.push(["parent", params.parent === null ? "null" : params.parent]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

// --- Product variants & spec sheet (shared shape, sent as-is to the API) --

export interface ProductVariantInput {
  sku: string;
  size?: string;
  color?: string;
  price?: number;
  fulfillmentMode: FulfillmentMode;
  preorderReleaseDate?: string;
  isActive: boolean;
}

/** Fields both catalogs share on create/update — mirrors `productBase` in `product.validator.ts`. */
interface ProductBasicsInput {
  name: string;
  slug?: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  variants?: ProductVariantInput[];
  specGroups?: SpecGroup[];
  badges?: string[];
}

export interface BikeInput extends ProductBasicsInput {
  shortDescription: string;
  relatedAccessories?: string[];
}

export type AccessoryInput = ProductBasicsInput;

// --- Product API factory ----------------------------------------------------

interface ProductApiConfig {
  /** `bikes` | `accessories` — the admin route segment. */
  basePath: string;
  /** The key the list endpoint nests its array under (`{ bikes: [...] }`). */
  listKey: string;
  /** The key every other endpoint nests its single document under (`{ bike: {...} }`). */
  itemKey: string;
}

/**
 * One factory, instantiated once per catalog (bikes, accessories) — the two
 * share their entire endpoint surface (list/get/create/update/archive/
 * restore/spec-groups/gallery) except for three bike-only fields, which live
 * in the caller's `TInput`/`TAdmin` type parameters, not in this function.
 * Mirrors `createProductService` on the backend for the same reason.
 */
function createProductApi<TAdmin, TInput extends ProductBasicsInput>(config: ProductApiConfig) {
  const { basePath, listKey, itemKey } = config;

  async function list(params: AdminProductListParams = {}): Promise<ParsedResponse<TAdmin[]>> {
    const res = await apiFetch<Record<string, TAdmin[]>>(`${basePath}${buildProductListQuery(params)}`);
    return { data: res.data[listKey] ?? [], ...(res.meta ? { meta: res.meta } : {}) };
  }

  async function getById(id: string): Promise<TAdmin> {
    const res = await apiFetch<Record<string, TAdmin>>(`${basePath}/${id}`);
    return res.data[itemKey] as TAdmin;
  }

  async function create(input: TInput): Promise<TAdmin> {
    const res = await apiFetch<Record<string, TAdmin>>(basePath, { method: "POST", body: JSON.stringify(input) });
    return res.data[itemKey] as TAdmin;
  }

  async function update(id: string, input: Partial<TInput>): Promise<TAdmin> {
    const res = await apiFetch<Record<string, TAdmin>>(`${basePath}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return res.data[itemKey] as TAdmin;
  }

  async function archive(id: string): Promise<TAdmin> {
    const res = await apiFetch<Record<string, TAdmin>>(`${basePath}/${id}/archive`, { method: "POST" });
    return res.data[itemKey] as TAdmin;
  }

  async function restore(id: string): Promise<TAdmin> {
    const res = await apiFetch<Record<string, TAdmin>>(`${basePath}/${id}/restore`, { method: "POST" });
    return res.data[itemKey] as TAdmin;
  }

  /** Only reachable once the product is already archived — the backend enforces this, not just the UI. */
  async function remove(id: string): Promise<void> {
    await apiFetch<undefined>(`${basePath}/${id}`, { method: "DELETE" });
  }

  /**
   * One atomic replace, matching `replaceSpecGroupsSchema` — this single call
   * is what covers add/rename/reorder/delete of groups and fields alike, both
   * here and in the editor that calls it.
   */
  async function replaceSpecGroups(id: string, groups: SpecGroup[]): Promise<SpecGroup[]> {
    const res = await apiFetch<{ specGroups: SpecGroup[] }>(`${basePath}/${id}/spec-groups`, {
      method: "PUT",
      body: JSON.stringify({ groups }),
    });
    return res.data.specGroups;
  }

  /** Only reachable for a product that already exists — the endpoint requires an id. */
  async function uploadGallery(id: string, files: File[], alt?: string): Promise<ProductImage[]> {
    const formData = new FormData();
    for (const file of files) formData.append("images", file);
    if (alt) formData.append("alt", alt);

    const res = await apiFetch<{ gallery: ProductImage[] }>(`${basePath}/${id}/gallery`, {
      method: "POST",
      body: formData,
    });
    return res.data.gallery;
  }

  async function removeGalleryImage(id: string, publicId: string): Promise<ProductImage[]> {
    const res = await apiFetch<{ gallery: ProductImage[] }>(`${basePath}/${id}/gallery`, {
      method: "DELETE",
      body: JSON.stringify({ publicId }),
    });
    return res.data.gallery;
  }

  async function reorderGallery(id: string, publicIds: string[]): Promise<ProductImage[]> {
    const res = await apiFetch<{ gallery: ProductImage[] }>(`${basePath}/${id}/gallery/order`, {
      method: "PATCH",
      body: JSON.stringify({ publicIds }),
    });
    return res.data.gallery;
  }

  return {
    list,
    getById,
    create,
    update,
    archive,
    restore,
    remove,
    replaceSpecGroups,
    uploadGallery,
    removeGalleryImage,
    reorderGallery,
  };
}

export const adminBikesApi = createProductApi<AdminBike, BikeInput>({
  basePath: "/admin/bikes",
  listKey: "bikes",
  itemKey: "bike",
});

export const adminAccessoriesApi = createProductApi<AdminAccessory, AccessoryInput>({
  basePath: "/admin/accessories",
  listKey: "accessories",
  itemKey: "accessory",
});

// --- Category API factory ---------------------------------------------------

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  parent?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface CategoryTreeNode extends AdminCategory {
  children: AdminCategory[];
}

/** Same reasoning as `createProductApi` — the two category trees share 100% of their endpoint shape. */
function createCategoryApi(basePath: string) {
  async function list(params: AdminCategoryListParams = {}): Promise<ParsedResponse<AdminCategory[]>> {
    const res = await apiFetch<{ categories: AdminCategory[] }>(`${basePath}${buildCategoryListQuery(params)}`);
    return { data: res.data.categories, ...(res.meta ? { meta: res.meta } : {}) };
  }

  async function tree(): Promise<CategoryTreeNode[]> {
    const res = await apiFetch<{ tree: CategoryTreeNode[] }>(`${basePath}/tree`);
    return res.data.tree;
  }

  async function getById(id: string): Promise<AdminCategory> {
    const res = await apiFetch<{ category: AdminCategory }>(`${basePath}/${id}`);
    return res.data.category;
  }

  async function create(input: CategoryInput): Promise<AdminCategory> {
    const res = await apiFetch<{ category: AdminCategory }>(basePath, { method: "POST", body: JSON.stringify(input) });
    return res.data.category;
  }

  async function update(id: string, input: Partial<CategoryInput>): Promise<AdminCategory> {
    const res = await apiFetch<{ category: AdminCategory }>(`${basePath}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return res.data.category;
  }

  /** The backend responds 409 with the blocking counts when the category isn't empty — surfaced via `ApiError.message`. */
  async function remove(id: string): Promise<void> {
    await apiFetch<undefined>(`${basePath}/${id}`, { method: "DELETE" });
  }

  /** A category carries at most one image — same `FormData` pattern as `uploadGallery`, one file instead of many. */
  async function uploadImage(id: string, file: File, alt?: string): Promise<AdminCategory> {
    const formData = new FormData();
    formData.append("images", file);
    if (alt) formData.append("alt", alt);

    const res = await apiFetch<{ category: AdminCategory }>(`${basePath}/${id}/image`, {
      method: "POST",
      body: formData,
    });
    return res.data.category;
  }

  async function removeImage(id: string): Promise<AdminCategory> {
    const res = await apiFetch<{ category: AdminCategory }>(`${basePath}/${id}/image`, { method: "DELETE" });
    return res.data.category;
  }

  return { list, tree, getById, create, update, remove, uploadImage, removeImage };
}

export const adminBikeCategoriesApi = createCategoryApi("/admin/bike-categories");
export const adminAccessoryCategoriesApi = createCategoryApi("/admin/accessory-categories");

// --- Brand API ---------------------------------------------------------------
// One collection shared by both catalogs (see `apps/api/src/models/brand.model.ts`)
// — no tree, so this isn't a factory the way categories are.

export interface AdminBrandListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  isActive?: boolean;
}

function buildBrandListQuery(params: AdminBrandListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export interface BrandInput {
  name: string;
  slug?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

async function listBrands(params: AdminBrandListParams = {}): Promise<ParsedResponse<AdminBrand[]>> {
  const res = await apiFetch<{ brands: AdminBrand[] }>(`/admin/brands${buildBrandListQuery(params)}`);
  return { data: res.data.brands, ...(res.meta ? { meta: res.meta } : {}) };
}

async function getBrandById(id: string): Promise<AdminBrand> {
  const res = await apiFetch<{ brand: AdminBrand }>(`/admin/brands/${id}`);
  return res.data.brand;
}

async function createBrand(input: BrandInput): Promise<AdminBrand> {
  const res = await apiFetch<{ brand: AdminBrand }>("/admin/brands", { method: "POST", body: JSON.stringify(input) });
  return res.data.brand;
}

async function updateBrand(id: string, input: Partial<BrandInput>): Promise<AdminBrand> {
  const res = await apiFetch<{ brand: AdminBrand }>(`/admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data.brand;
}

/** The backend responds 409 with the blocking product count when the brand is still referenced — surfaced via `ApiError.message`. */
async function removeBrand(id: string): Promise<void> {
  await apiFetch<undefined>(`/admin/brands/${id}`, { method: "DELETE" });
}

/** A brand carries at most one logo — same `FormData` pattern as the category image. */
async function uploadBrandLogo(id: string, file: File, alt?: string): Promise<AdminBrand> {
  const formData = new FormData();
  formData.append("images", file);
  if (alt) formData.append("alt", alt);

  const res = await apiFetch<{ brand: AdminBrand }>(`/admin/brands/${id}/logo`, { method: "POST", body: formData });
  return res.data.brand;
}

async function removeBrandLogo(id: string): Promise<AdminBrand> {
  const res = await apiFetch<{ brand: AdminBrand }>(`/admin/brands/${id}/logo`, { method: "DELETE" });
  return res.data.brand;
}

export const adminBrandsApi = {
  list: listBrands,
  getById: getBrandById,
  create: createBrand,
  update: updateBrand,
  remove: removeBrand,
  uploadLogo: uploadBrandLogo,
  removeLogo: removeBrandLogo,
};

// --- Badge API -----------------------------------------------------------
// Also one collection shared by both catalogs, also no tree — same shape as
// the brand API, minus the logo (a badge is a label + a design-system
// variant, nothing to upload).

export interface AdminBadgeListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  isActive?: boolean;
}

function buildBadgeListQuery(params: AdminBadgeListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export interface BadgeInput {
  label: string;
  slug?: string;
  variant: BadgeVariant;
  order?: number;
  isActive?: boolean;
}

async function listBadges(params: AdminBadgeListParams = {}): Promise<ParsedResponse<AdminBadge[]>> {
  const res = await apiFetch<{ badges: AdminBadge[] }>(`/admin/badges${buildBadgeListQuery(params)}`);
  return { data: res.data.badges, ...(res.meta ? { meta: res.meta } : {}) };
}

async function getBadgeById(id: string): Promise<AdminBadge> {
  const res = await apiFetch<{ badge: AdminBadge }>(`/admin/badges/${id}`);
  return res.data.badge;
}

async function createBadge(input: BadgeInput): Promise<AdminBadge> {
  const res = await apiFetch<{ badge: AdminBadge }>("/admin/badges", { method: "POST", body: JSON.stringify(input) });
  return res.data.badge;
}

async function updateBadge(id: string, input: Partial<BadgeInput>): Promise<AdminBadge> {
  const res = await apiFetch<{ badge: AdminBadge }>(`/admin/badges/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data.badge;
}

/** The backend responds 409 with the blocking product count when the badge is still assigned — surfaced via `ApiError.message`. */
async function removeBadge(id: string): Promise<void> {
  await apiFetch<undefined>(`/admin/badges/${id}`, { method: "DELETE" });
}

export const adminBadgesApi = {
  list: listBadges,
  getById: getBadgeById,
  create: createBadge,
  update: updateBadge,
  remove: removeBadge,
};

// --- Spec template API -----------------------------------------------------
// Also shared, also no logo — a saved shape for a `SpecGroup` (title +
// labels, no values). Feeds the ficha técnica editor's "Aplicar plantilla"
// and its autocomplete; its own CRUD screen manages it directly.

export interface AdminSpecTemplateListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  isActive?: boolean;
}

function buildSpecTemplateListQuery(params: AdminSpecTemplateListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export interface SpecTemplateInput {
  title: string;
  fields?: Array<{ label: string; order: number }>;
  order?: number;
  isActive?: boolean;
}

async function listSpecTemplates(params: AdminSpecTemplateListParams = {}): Promise<ParsedResponse<SpecTemplate[]>> {
  const res = await apiFetch<{ templates: SpecTemplate[] }>(`/admin/spec-templates${buildSpecTemplateListQuery(params)}`);
  return { data: res.data.templates, ...(res.meta ? { meta: res.meta } : {}) };
}

async function getSpecTemplateById(id: string): Promise<SpecTemplate> {
  const res = await apiFetch<{ template: SpecTemplate }>(`/admin/spec-templates/${id}`);
  return res.data.template;
}

async function createSpecTemplate(input: SpecTemplateInput): Promise<SpecTemplate> {
  const res = await apiFetch<{ template: SpecTemplate }>("/admin/spec-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.template;
}

async function updateSpecTemplate(id: string, input: Partial<SpecTemplateInput>): Promise<SpecTemplate> {
  const res = await apiFetch<{ template: SpecTemplate }>(`/admin/spec-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data.template;
}

async function removeSpecTemplate(id: string): Promise<void> {
  await apiFetch<undefined>(`/admin/spec-templates/${id}`, { method: "DELETE" });
}

export const adminSpecTemplatesApi = {
  list: listSpecTemplates,
  getById: getSpecTemplateById,
  create: createSpecTemplate,
  update: updateSpecTemplate,
  remove: removeSpecTemplate,
};
