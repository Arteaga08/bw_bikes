import { formatCurrencyCents } from "@/lib/format";

/**
 * The catalog filter sidebar's state, mirrored 1:1 onto the URL's query
 * string (`useCatalogFilters`, `apps/web/src/hooks/use-catalog-filters.ts`).
 * Pure and dependency-free beyond `formatCurrencyCents` — no `@/lib/api/*`
 * import here, so this runs in vitest's `node` project, not `jsdom`.
 *
 * `categories` carries Mongo ObjectIds, not slugs — the backend's `category`
 * filter (`publicProductListQuerySchema`) takes an id list
 * (`objectIdList`), unlike `brand`, which travels as a slug list. A
 * component building the "Categoría"/"Grupo" checkboxes must read
 * `category.id`, never `category.slug`, or the filter silently matches
 * nothing (`buildFilter`'s "no match ⇒ empty `$in`" rule).
 */
export interface CatalogFilterState {
  categories: string[];
  brands: string[];
  sizes: string[];
  colors: string[];
  /** Integer cents, same unit the backend's `minPrice`/`maxPrice` expect. */
  minPrice: number | undefined;
  maxPrice: number | undefined;
  isNewArrival: boolean;
  isCustomerFavorite: boolean;
  /** Keyed by the spec-group's canonical label ("Material") — each entry is that label's selected values, OR'd together. Only labels an admin turned on with `isFilterable` ever appear here (see `PublicCatalogFilterOptions.specs`). */
  specs: Record<string, string[]>;
  sort: string | undefined;
}

export const DEFAULT_FILTER_STATE: CatalogFilterState = {
  categories: [],
  brands: [],
  sizes: [],
  colors: [],
  minPrice: undefined,
  maxPrice: undefined,
  isNewArrival: false,
  isCustomerFavorite: false,
  specs: {},
  sort: undefined,
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePriceParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** One `?spec=Material:Carbono|Aluminio` item → `["Material", ["Carbono","Aluminio"]]` — the same `label:value1|value2` shape the API's `spec` query param parses (`product.service.ts`'s `buildFilter`). Malformed items (no `:`, empty label, no values) are dropped rather than surfaced as a broken filter. */
function parseSpecParam(item: string): [string, string[]] | null {
  const separatorIndex = item.indexOf(":");
  if (separatorIndex <= 0) return null;
  const label = item.slice(0, separatorIndex).trim();
  const values = item
    .slice(separatorIndex + 1)
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  return label && values.length > 0 ? [label, values] : null;
}

function parseSpecs(params: URLSearchParams): Record<string, string[]> {
  const specs: Record<string, string[]> = {};
  for (const item of params.getAll("spec")) {
    const parsed = parseSpecParam(item);
    if (parsed) specs[parsed[0]] = parsed[1];
  }
  return specs;
}

/** Tolerant of garbage: an unparseable price or a stray param just drops out, never throws — a shopper editing the URL by hand should see a plain catalog, not an error page. */
export function parseFilterState(params: URLSearchParams): CatalogFilterState {
  return {
    categories: parseList(params.get("category")),
    brands: parseList(params.get("brand")),
    sizes: parseList(params.get("size")),
    colors: parseList(params.get("color")),
    minPrice: parsePriceParam(params.get("minPrice")),
    maxPrice: parsePriceParam(params.get("maxPrice")),
    isNewArrival: params.get("isNewArrival") === "true",
    isCustomerFavorite: params.get("isCustomerFavorite") === "true",
    specs: parseSpecs(params),
    sort: params.get("sort") ?? undefined,
  };
}

/** The shape Next hands a Server Component's `searchParams` prop — a plain object, scalar or array per key, never a `URLSearchParams`. */
export type NextSearchParams = Record<string, string | string[] | undefined>;

function searchParamsToURLSearchParams(searchParams: NextSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    // `spec` (and any future repeatable param) arrives as a real array here
    // — `.append()` for each entry, not `.set()`, or every value but the
    // last would be silently dropped.
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
  }
  return params;
}

/**
 * `parseFilterState`'s server-side counterpart — same parsing, starting
 * from a Server Component's `searchParams` prop instead of the client's
 * `useSearchParams()`. Both a catalog index page and its `[slug]` sibling
 * call this once, after `await`ing the promised prop.
 */
export function parseFilterStateFromSearchParams(searchParams: NextSearchParams): CatalogFilterState {
  return parseFilterState(searchParamsToURLSearchParams(searchParams));
}

function serializeList(values: string[]): string | undefined {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(",") : undefined;
}

/** Fixed key order so two equal states always produce the same query string — otherwise `router.replace` could churn the URL (and re-render listeners) on a round trip that changed nothing. */
const PARAM_ORDER = [
  "category",
  "brand",
  "size",
  "color",
  "minPrice",
  "maxPrice",
  "isNewArrival",
  "isCustomerFavorite",
  "sort",
] as const;

export function serializeFilterState(state: CatalogFilterState): URLSearchParams {
  const values: Record<(typeof PARAM_ORDER)[number], string | undefined> = {
    category: serializeList(state.categories),
    brand: serializeList(state.brands),
    size: serializeList(state.sizes),
    color: serializeList(state.colors),
    minPrice: state.minPrice !== undefined ? String(state.minPrice) : undefined,
    maxPrice: state.maxPrice !== undefined ? String(state.maxPrice) : undefined,
    isNewArrival: state.isNewArrival ? "true" : undefined,
    isCustomerFavorite: state.isCustomerFavorite ? "true" : undefined,
    sort: state.sort ?? undefined,
  };

  const params = new URLSearchParams();
  for (const key of PARAM_ORDER) {
    const value = values[key];
    if (value !== undefined) params.set(key, value);
  }

  // `spec` repeats (one label per occurrence, same shape the API reads), so
  // it can't share the single-value `.set()` loop above. Labels are sorted
  // alphabetically — insertion order into `state.specs` depends on which
  // group a shopper happened to open first, and the query string shouldn't.
  for (const label of Object.keys(state.specs).sort()) {
    const cleanedValues = state.specs[label]!.map((value) => value.trim()).filter(Boolean);
    if (cleanedValues.length > 0) params.append("spec", `${label}:${cleanedValues.join("|")}`);
  }

  return params;
}

export function countActiveFilters(state: CatalogFilterState): number {
  let count = state.categories.length + state.brands.length + state.sizes.length + state.colors.length;
  for (const values of Object.values(state.specs)) count += values.length;
  if (state.minPrice !== undefined || state.maxPrice !== undefined) count += 1;
  if (state.isNewArrival) count += 1;
  if (state.isCustomerFavorite) count += 1;
  return count;
}

/** Whole-peso input (the sidebar's "Desde"/"Hasta" fields never ask for centavos) → integer cents, or `undefined` for empty/invalid. */
export function pesosInputToCents(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  const pesos = Number.parseInt(trimmed, 10);
  return Number.isFinite(pesos) && pesos >= 0 ? pesos * 100 : undefined;
}

/** Integer cents → a whole-peso string for an input's value. The inverse of `pesosInputToCents`. */
export function centsToPesosInput(cents: number | undefined): string {
  return cents === undefined ? "" : String(Math.round(cents / 100));
}

export interface FilterChip {
  /** Stable and unique per active filter — `CatalogFilterChips` keys its remove buttons by this. */
  key: string;
  label: string;
}

export interface FilterChipContext {
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ slug: string; name: string }>;
}

/** A category or brand chip falls back to the raw id/slug when the lookup list hasn't loaded it (e.g. a stale bookmarked URL) — better an unfamiliar-looking chip than a blank one. */
export function toFilterChips(state: CatalogFilterState, context: FilterChipContext): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const id of state.categories) {
    const category = context.categories.find((candidate) => candidate.id === id);
    chips.push({ key: `category:${id}`, label: category?.name ?? id });
  }
  for (const slug of state.brands) {
    const brand = context.brands.find((candidate) => candidate.slug === slug);
    chips.push({ key: `brand:${slug}`, label: brand?.name ?? slug });
  }
  for (const size of state.sizes) {
    chips.push({ key: `size:${size}`, label: `Talla ${size}` });
  }
  for (const color of state.colors) {
    chips.push({ key: `color:${color}`, label: color });
  }
  for (const [label, values] of Object.entries(state.specs)) {
    for (const value of values) {
      chips.push({ key: `spec:${label}:${value}`, label: `${label}: ${value}` });
    }
  }
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    const min = state.minPrice !== undefined ? formatCurrencyCents(state.minPrice) : null;
    const max = state.maxPrice !== undefined ? formatCurrencyCents(state.maxPrice) : null;
    const label = min && max ? `${min} – ${max}` : min ? `Desde ${min}` : `Hasta ${max}`;
    chips.push({ key: "price", label });
  }
  if (state.isNewArrival) chips.push({ key: "isNewArrival", label: "Novedades" });
  if (state.isCustomerFavorite) chips.push({ key: "isCustomerFavorite", label: "Favoritas de los ciclistas" });

  return chips;
}

/**
 * The inverse of a `toFilterChips` entry — turns one chip's `key` back into
 * the state mutation that removes it. Shared by `CatalogFilterSidebar` and
 * `CatalogFilterDrawer` so a chip's "×" behaves identically in both, rather
 * than each re-deriving its own key-parsing logic.
 */
export function removeFilterChip(state: CatalogFilterState, key: string): CatalogFilterState {
  if (key === "price") return { ...state, minPrice: undefined, maxPrice: undefined };
  if (key === "isNewArrival") return { ...state, isNewArrival: false };
  if (key === "isCustomerFavorite") return { ...state, isCustomerFavorite: false };

  const [kind, ...rest] = key.split(":");

  if (kind === "category") {
    const id = rest.join(":");
    return { ...state, categories: state.categories.filter((value) => value !== id) };
  }
  if (kind === "brand") {
    const slug = rest.join(":");
    return { ...state, brands: state.brands.filter((value) => value !== slug) };
  }
  if (kind === "size") {
    const value = rest.join(":");
    return { ...state, sizes: state.sizes.filter((candidate) => candidate !== value) };
  }
  if (kind === "color") {
    const value = rest.join(":");
    return { ...state, colors: state.colors.filter((candidate) => candidate !== value) };
  }
  if (kind === "spec") {
    const [label, value] = rest;
    if (label === undefined || value === undefined) return state;
    const remaining = (state.specs[label] ?? []).filter((candidate) => candidate !== value);
    const nextSpecs = { ...state.specs };
    if (remaining.length > 0) nextSpecs[label] = remaining;
    else delete nextSpecs[label];
    return { ...state, specs: nextSpecs };
  }

  // An unrecognized key (a chip from a future filter kind this build
  // doesn't know about) is left alone rather than guessed at.
  return state;
}
