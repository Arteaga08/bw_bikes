import { describe, expect, it } from "vitest";
import {
  centsToPesosInput,
  countActiveFilters,
  DEFAULT_FILTER_STATE,
  parseFilterState,
  parseFilterStateFromSearchParams,
  pesosInputToCents,
  removeFilterChip,
  serializeFilterState,
  toFilterChips,
  type CatalogFilterState,
} from "./storefront-catalog-filters";

describe("parseFilterState", () => {
  it("returns the empty state for an empty query string", () => {
    expect(parseFilterState(new URLSearchParams())).toEqual(DEFAULT_FILTER_STATE);
  });

  it("splits comma-separated multi-select params into lists", () => {
    const state = parseFilterState(new URLSearchParams("brand=specialized,canyon&size=M,L,XL&color=Negro"));
    expect(state.brands).toEqual(["specialized", "canyon"]);
    expect(state.sizes).toEqual(["M", "L", "XL"]);
    expect(state.colors).toEqual(["Negro"]);
  });

  it("keeps a single value from the mega-menu's ?brand=<slug> links working unchanged", () => {
    expect(parseFilterState(new URLSearchParams("brand=trek")).brands).toEqual(["trek"]);
  });

  it("parses category as a list of ids, independent from brand's slugs", () => {
    const state = parseFilterState(new URLSearchParams("category=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012"));
    expect(state.categories).toEqual(["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]);
  });

  it("parses minPrice/maxPrice as integer cents", () => {
    const state = parseFilterState(new URLSearchParams("minPrice=100000&maxPrice=500000"));
    expect(state.minPrice).toBe(100_000);
    expect(state.maxPrice).toBe(500_000);
  });

  it("parses the boolean flags only from the literal string 'true'", () => {
    expect(parseFilterState(new URLSearchParams("isNewArrival=true")).isNewArrival).toBe(true);
    expect(parseFilterState(new URLSearchParams("isNewArrival=false")).isNewArrival).toBe(false);
    expect(parseFilterState(new URLSearchParams("isNewArrival=1")).isNewArrival).toBe(false);
  });

  it("is tolerant of garbage instead of throwing", () => {
    const state = parseFilterState(new URLSearchParams("minPrice=not-a-number&brand=,,,&category="));
    expect(state.minPrice).toBeUndefined();
    expect(state.brands).toEqual([]);
    expect(state.categories).toEqual([]);
  });

  it("parses repeated spec params into a label → values record, same shape the API reads", () => {
    const params = new URLSearchParams();
    params.append("spec", "Material:Carbono|Aluminio");
    params.append("spec", "Frenos:Disco");
    expect(parseFilterState(params).specs).toEqual({ Material: ["Carbono", "Aluminio"], Frenos: ["Disco"] });
  });

  it("drops a malformed spec item instead of throwing", () => {
    const params = new URLSearchParams();
    params.append("spec", "no-colon-here");
    params.append("spec", ":Carbono");
    params.append("spec", "Material:");
    expect(parseFilterState(params).specs).toEqual({});
  });
});

describe("parseFilterStateFromSearchParams", () => {
  it("parses a Server Component's plain-object searchParams the same way parseFilterState reads a URLSearchParams", () => {
    const fromObject = parseFilterStateFromSearchParams({ brand: "specialized,canyon", minPrice: "100000" });
    const fromParams = parseFilterState(new URLSearchParams("brand=specialized,canyon&minPrice=100000"));
    expect(fromObject).toEqual(fromParams);
  });

  it("appends every entry of an array value instead of keeping only the last", () => {
    const state = parseFilterStateFromSearchParams({ spec: ["Material:Carbono", "Frenos:Disco"] });
    expect(state.specs).toEqual({ Material: ["Carbono"], Frenos: ["Disco"] });
  });

  it("skips an undefined key rather than stringifying it", () => {
    const state = parseFilterStateFromSearchParams({ brand: undefined, size: "M" });
    expect(state.brands).toEqual([]);
    expect(state.sizes).toEqual(["M"]);
  });
});

describe("serializeFilterState", () => {
  it("produces an empty query string for the default state", () => {
    expect(serializeFilterState(DEFAULT_FILTER_STATE).toString()).toBe("");
  });

  it("omits empty lists and undefined fields, keeping only what's set", () => {
    const state: CatalogFilterState = { ...DEFAULT_FILTER_STATE, brands: ["specialized"], minPrice: 100_000 };
    const params = serializeFilterState(state);
    expect(params.get("brand")).toBe("specialized");
    expect(params.get("minPrice")).toBe("100000");
    expect(params.has("category")).toBe(false);
    expect(params.has("maxPrice")).toBe(false);
  });

  it("round-trips through parseFilterState unchanged", () => {
    const state: CatalogFilterState = {
      categories: ["507f1f77bcf86cd799439011"],
      brands: ["specialized", "canyon"],
      sizes: ["M", "L"],
      colors: ["Negro"],
      minPrice: 100_000,
      maxPrice: 500_000,
      isNewArrival: true,
      isCustomerFavorite: false,
      specs: { Material: ["Carbono", "Aluminio"], Frenos: ["Disco"] },
      sort: "-price",
    };
    expect(parseFilterState(serializeFilterState(state))).toEqual(state);
  });

  it("produces the same query string regardless of which fields were set first — stable key order", () => {
    const a = serializeFilterState({ ...DEFAULT_FILTER_STATE, brands: ["trek"], sizes: ["M"] });
    const b = serializeFilterState({ ...DEFAULT_FILTER_STATE, sizes: ["M"], brands: ["trek"] });
    expect(a.toString()).toBe(b.toString());
  });

  it("sorts spec labels alphabetically regardless of insertion order — the URL never depends on which group a shopper opened first", () => {
    const a = serializeFilterState({ ...DEFAULT_FILTER_STATE, specs: { Peso: ["9kg"], Material: ["Carbono"] } });
    const b = serializeFilterState({ ...DEFAULT_FILTER_STATE, specs: { Material: ["Carbono"], Peso: ["9kg"] } });
    expect(a.toString()).toBe(b.toString());
    expect(a.getAll("spec")).toEqual(["Material:Carbono", "Peso:9kg"]);
  });

  it("omits a spec label whose values are all blank", () => {
    const params = serializeFilterState({ ...DEFAULT_FILTER_STATE, specs: { Material: ["  ", ""] } });
    expect(params.has("spec")).toBe(false);
  });
});

describe("countActiveFilters", () => {
  it("is zero for the default state", () => {
    expect(countActiveFilters(DEFAULT_FILTER_STATE)).toBe(0);
  });

  it("counts each selected value in a multi-select list separately", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTER_STATE, brands: ["a", "b"], sizes: ["M"] })).toBe(3);
  });

  it("counts a price range (min, max, or both) as exactly one active filter", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTER_STATE, minPrice: 1000 })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_FILTER_STATE, minPrice: 1000, maxPrice: 2000 })).toBe(1);
  });

  it("counts each active boolean flag", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTER_STATE, isNewArrival: true, isCustomerFavorite: true })).toBe(2);
  });

  it("counts every selected value across every spec label", () => {
    const state = { ...DEFAULT_FILTER_STATE, specs: { Material: ["Carbono", "Aluminio"], Frenos: ["Disco"] } };
    expect(countActiveFilters(state)).toBe(3);
  });
});

describe("pesosInputToCents / centsToPesosInput", () => {
  it("converts a whole-peso input to integer cents", () => {
    expect(pesosInputToCents("1000")).toBe(100_000);
  });

  it("returns undefined for empty or invalid input", () => {
    expect(pesosInputToCents("")).toBeUndefined();
    expect(pesosInputToCents("   ")).toBeUndefined();
    expect(pesosInputToCents("abc")).toBeUndefined();
    expect(pesosInputToCents("-50")).toBeUndefined();
  });

  it("round-trips back to the same whole-peso string", () => {
    expect(centsToPesosInput(pesosInputToCents("2500"))).toBe("2500");
  });

  it("renders undefined cents as an empty string", () => {
    expect(centsToPesosInput(undefined)).toBe("");
  });
});

describe("toFilterChips", () => {
  const context = {
    categories: [{ id: "cat-1", name: "Montaña" }],
    brands: [{ slug: "specialized", name: "Specialized" }],
  };

  it("returns no chips for the default state", () => {
    expect(toFilterChips(DEFAULT_FILTER_STATE, context)).toEqual([]);
  });

  it("resolves a category id and a brand slug to their display names", () => {
    const chips = toFilterChips({ ...DEFAULT_FILTER_STATE, categories: ["cat-1"], brands: ["specialized"] }, context);
    expect(chips).toEqual([
      { key: "category:cat-1", label: "Montaña" },
      { key: "brand:specialized", label: "Specialized" },
    ]);
  });

  it("falls back to the raw id/slug when the lookup list doesn't have it yet", () => {
    const chips = toFilterChips({ ...DEFAULT_FILTER_STATE, categories: ["cat-unknown"] }, context);
    expect(chips).toEqual([{ key: "category:cat-unknown", label: "cat-unknown" }]);
  });

  it("formats a price range chip from both bounds, or just one", () => {
    expect(toFilterChips({ ...DEFAULT_FILTER_STATE, minPrice: 100_000, maxPrice: 500_000 }, context)).toEqual([
      { key: "price", label: "$1,000.00 – $5,000.00" },
    ]);
    expect(toFilterChips({ ...DEFAULT_FILTER_STATE, minPrice: 100_000 }, context)).toEqual([
      { key: "price", label: "Desde $1,000.00" },
    ]);
    expect(toFilterChips({ ...DEFAULT_FILTER_STATE, maxPrice: 500_000 }, context)).toEqual([
      { key: "price", label: "Hasta $5,000.00" },
    ]);
  });

  it("adds a chip for each active boolean flag", () => {
    const chips = toFilterChips({ ...DEFAULT_FILTER_STATE, isNewArrival: true, isCustomerFavorite: true }, context);
    expect(chips).toEqual([
      { key: "isNewArrival", label: "Novedades" },
      { key: "isCustomerFavorite", label: "Favoritas de los ciclistas" },
    ]);
  });

  it("adds one chip per selected spec value, labeled 'Label: value'", () => {
    const chips = toFilterChips({ ...DEFAULT_FILTER_STATE, specs: { Material: ["Carbono", "Aluminio"] } }, context);
    expect(chips).toEqual([
      { key: "spec:Material:Carbono", label: "Material: Carbono" },
      { key: "spec:Material:Aluminio", label: "Material: Aluminio" },
    ]);
  });
});

describe("removeFilterChip", () => {
  it("removes one value from a multi-select list, leaving the rest", () => {
    const state = { ...DEFAULT_FILTER_STATE, brands: ["specialized", "canyon"] };
    expect(removeFilterChip(state, "brand:specialized").brands).toEqual(["canyon"]);
  });

  it("clears both price bounds together, since they're one chip", () => {
    const state = { ...DEFAULT_FILTER_STATE, minPrice: 1000, maxPrice: 2000 };
    const next = removeFilterChip(state, "price");
    expect(next.minPrice).toBeUndefined();
    expect(next.maxPrice).toBeUndefined();
  });

  it("turns off exactly one boolean flag", () => {
    const state = { ...DEFAULT_FILTER_STATE, isNewArrival: true, isCustomerFavorite: true };
    const next = removeFilterChip(state, "isNewArrival");
    expect(next.isNewArrival).toBe(false);
    expect(next.isCustomerFavorite).toBe(true);
  });

  it("removes one spec value, dropping the label entirely once its last value is gone", () => {
    const state = { ...DEFAULT_FILTER_STATE, specs: { Material: ["Carbono", "Aluminio"] } };
    const afterOne = removeFilterChip(state, "spec:Material:Carbono");
    expect(afterOne.specs).toEqual({ Material: ["Aluminio"] });

    const afterBoth = removeFilterChip(afterOne, "spec:Material:Aluminio");
    expect(afterBoth.specs).toEqual({});
  });

  it("leaves the state untouched for a key it doesn't recognize", () => {
    const state = { ...DEFAULT_FILTER_STATE, brands: ["specialized"] };
    expect(removeFilterChip(state, "unknown:thing")).toEqual(state);
  });

  it("composes with toFilterChips: removing every chip returns to the default state", () => {
    const state: CatalogFilterState = {
      categories: ["cat-1"],
      brands: ["specialized"],
      sizes: ["M"],
      colors: ["Negro"],
      minPrice: 1000,
      maxPrice: 2000,
      isNewArrival: true,
      isCustomerFavorite: true,
      specs: { Material: ["Carbono"] },
      sort: undefined,
    };
    const context = { categories: [{ id: "cat-1", name: "Montaña" }], brands: [{ slug: "specialized", name: "Specialized" }] };
    const finalState = toFilterChips(state, context).reduce((acc, chip) => removeFilterChip(acc, chip.key), state);
    expect(finalState).toEqual(DEFAULT_FILTER_STATE);
  });
});
