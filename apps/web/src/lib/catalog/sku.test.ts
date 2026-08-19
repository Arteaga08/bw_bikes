import { describe, expect, it } from "vitest";
import { buildSkuBase, ensureUniqueSku } from "./sku";

describe("buildSkuBase", () => {
  it("joins brand, model, size and color into an uppercase dash-separated SKU", () => {
    expect(buildSkuBase("Trek", "Domane SL 5", "54", "Negro")).toBe("TRE-DOMSL5-54-NEG");
  });

  it("folds Spanish accents and ñ instead of dropping the letter", () => {
    expect(buildSkuBase("Bianchi", "Montaña Pro", "M", "Ñandú")).toBe("BIA-MONPRO-M-NAN");
  });

  it("drops a leading product-name word that duplicates the brand", () => {
    expect(buildSkuBase("Trek", "Trek Domane SL 5", "54", "Negro")).toBe("TRE-DOMSL5-54-NEG");
  });

  it("keeps short words (<=2 chars) whole instead of truncating them", () => {
    expect(buildSkuBase("Shimano", "XT M8100", "L", "Plata")).toBe("SHI-XTM81-L-PLA");
  });

  it("omits the size token when size is blank", () => {
    expect(buildSkuBase("Trek", "Domane SL 5", "", "Negro")).toBe("TRE-DOMSL5-NEG");
  });

  it("omits the color token when color is blank", () => {
    expect(buildSkuBase("Trek", "Domane SL 5", "54", "")).toBe("TRE-DOMSL5-54");
  });

  it("omits both size and color when both are blank", () => {
    expect(buildSkuBase("Trek", "Domane SL 5", "", "")).toBe("TRE-DOMSL5");
  });

  it("truncates the final SKU to 40 characters", () => {
    const result = buildSkuBase(
      "Marca Con Nombre Larguisimo",
      "Modelo Con Nombre Tambien Muy Largo",
      "Extra Grande",
      "Azul Marino Especial",
    );
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it("never ends with a trailing hyphen after truncation", () => {
    const result = buildSkuBase(
      "Marca Con Nombre Larguisimo",
      "Modelo Con Nombre Tambien Muy Largo",
      "Extra Grande",
      "Azul Marino Especial",
    );
    expect(result.endsWith("-")).toBe(false);
  });
});

describe("ensureUniqueSku", () => {
  it("returns the base unchanged when it isn't taken", () => {
    expect(ensureUniqueSku("TRE-DOM-54-NEG", new Set())).toBe("TRE-DOM-54-NEG");
  });

  it("appends -2 when the base is already taken", () => {
    expect(ensureUniqueSku("TRE-DOM-54-NEG", new Set(["TRE-DOM-54-NEG"]))).toBe("TRE-DOM-54-NEG-2");
  });

  it("keeps incrementing the suffix until a free SKU is found", () => {
    const taken = new Set(["TRE-DOM-54-NEG", "TRE-DOM-54-NEG-2", "TRE-DOM-54-NEG-3"]);
    expect(ensureUniqueSku("TRE-DOM-54-NEG", taken)).toBe("TRE-DOM-54-NEG-4");
  });

  it("returns an empty base unchanged", () => {
    expect(ensureUniqueSku("", new Set(["ANYTHING"]))).toBe("");
  });
});
