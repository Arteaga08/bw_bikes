import type {
  AdminInventoryItem,
  AdminInventoryProductCounts,
  AdminInventoryProductDetail,
  AdminInventoryProductRow,
  InventorySummary,
  ItemType,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

export interface AdminInventoryListParams {
  page?: number;
  limit?: number;
  /** Whitelisted by the backend to `createdAt` | `sku` | `onHand` | `available`, `-` prefix for descending. */
  sort?: string;
  itemType?: ItemType;
  itemId?: string;
  /** A root category id — the backend requires `itemType` alongside it, since bikes and accessories are two independent trees. */
  category?: string;
  stock?: "low" | "out";
  /** Matches SKU only — `listItems` doesn't search by product name. For a name/brand/SKU search, use `listAdminInventoryProducts` instead. */
  search?: string;
}

/**
 * Builds the querystring from an explicit whitelist and drops empty values —
 * never forwards the caller's full filter-state object. Mirrors
 * `inventoryListQuerySchema` (`apps/api/src/validators/inventory.validator.ts`).
 */
function buildInventoryListQuery(params: AdminInventoryListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.itemType) entries.push(["itemType", params.itemType]);
  if (params.itemId) entries.push(["itemId", params.itemId]);
  if (params.category) entries.push(["category", params.category]);
  if (params.stock) entries.push(["stock", params.stock]);
  if (params.search) entries.push(["search", params.search]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export function listAdminInventory(
  params: AdminInventoryListParams,
): Promise<ParsedResponse<{ items: AdminInventoryItem[] }>> {
  return apiFetch<{ items: AdminInventoryItem[] }>(`/admin/inventory${buildInventoryListQuery(params)}`);
}

/** The category-band rollups for `/admin/inventario`'s Zona 2 — total/out/low per root, without fetching every row. */
export async function getAdminInventorySummary(): Promise<InventorySummary> {
  const { data } = await apiFetch<{ summary: InventorySummary }>("/admin/inventory/summary");
  return data.summary;
}

export async function getAdminInventoryItem(id: string): Promise<AdminInventoryItem> {
  const { data } = await apiFetch<{ item: AdminInventoryItem }>(`/admin/inventory/${id}`);
  return data.item;
}

/** Mirrors `createInventoryItemSchema` — a new row for a variant that doesn't have one yet. */
export interface CreateInventoryItemInput {
  itemType: ItemType;
  itemId: string;
  sku: string;
  onHand?: number;
  lowStockThreshold?: number;
}

export async function createAdminInventoryItem(input: CreateInventoryItemInput): Promise<AdminInventoryItem> {
  const { data } = await apiFetch<{ item: AdminInventoryItem }>("/admin/inventory", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.item;
}

/**
 * Mirrors `adjustStockSchema`'s `.xor("onHand","delta")` — exactly one of
 * the two, never both, never neither. The caller enforces the same rule in
 * the form before this is ever called.
 */
export type AdjustStockInput = ({ onHand: number; delta?: never } | { delta: number; onHand?: never }) & {
  reason?: string;
};

export async function adjustAdminInventoryStock(id: string, input: AdjustStockInput): Promise<AdminInventoryItem> {
  const { data } = await apiFetch<{ item: AdminInventoryItem }>(`/admin/inventory/${id}/stock`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.item;
}

export interface AdminInventoryProductListParams {
  page?: number;
  limit?: number;
  /** Whitelisted by the backend to `name` | `totalAvailable` | `createdAt`, `-` prefix for descending. */
  sort?: string;
  itemType: ItemType;
  /** A root category id — includes its child categories. */
  category?: string;
  /** A brand's `slug`, never a raw id or free text. */
  brand?: string;
  stock?: "low" | "out";
  /** Matches product name, brand name, or SKU. */
  search?: string;
}

/**
 * Builds the querystring from an explicit whitelist and drops empty values —
 * never forwards the caller's full filter-state object. Mirrors
 * `inventoryProductListQuerySchema` (`apps/api/src/validators/inventory.validator.ts`).
 */
function buildInventoryProductListQuery(params: AdminInventoryProductListParams): string {
  const entries: Array<[string, string]> = [["itemType", params.itemType]];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.category) entries.push(["category", params.category]);
  if (params.brand) entries.push(["brand", params.brand]);
  if (params.stock) entries.push(["stock", params.stock]);
  if (params.search) entries.push(["search", params.search]);

  return `?${new URLSearchParams(entries).toString()}`;
}

/** The product-first list `/admin/inventario` renders — one row per product, never per SKU. */
export function listAdminInventoryProducts(
  params: AdminInventoryProductListParams,
): Promise<ParsedResponse<{ products: AdminInventoryProductRow[]; counts: AdminInventoryProductCounts }>> {
  return apiFetch<{ products: AdminInventoryProductRow[]; counts: AdminInventoryProductCounts }>(
    `/admin/inventory/products${buildInventoryProductListQuery(params)}`,
  );
}

/** Every active variant of one product, including the ones with no inventory row yet — what the product modal renders. */
export async function getAdminInventoryProductDetail(
  itemType: ItemType,
  itemId: string,
): Promise<AdminInventoryProductDetail> {
  const { data } = await apiFetch<{ product: AdminInventoryProductDetail }>(
    `/admin/inventory/products/${itemId}?${new URLSearchParams({ itemType }).toString()}`,
  );
  return data.product;
}
