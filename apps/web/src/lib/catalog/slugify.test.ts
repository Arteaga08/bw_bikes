import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and dash-joins a plain name", () => {
    expect(slugify("Tarmac SL8 Pro")).toBe("tarmac-sl8-pro");
  });

  it("folds Spanish accents and ñ instead of dropping the letter", () => {
    expect(slugify("Bicicletas de Montaña")).toBe("bicicletas-de-montana");
  });

  it("collapses repeated punctuation and trims leading/trailing hyphens", () => {
    expect(slugify("  ¡Edición Especial!! ")).toBe("edicion-especial");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
