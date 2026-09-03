import type { SaveAddressInput } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { validateAddress } from "./AddressFields";

const VALID: SaveAddressInput = {
  label: "Casa",
  firstName: "Ana",
  lastName: "Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

describe("validateAddress", () => {
  it("passes a fully valid address", () => {
    expect(validateAddress(VALID)).toEqual({});
  });

  it("requires the label by default", () => {
    expect(validateAddress({ ...VALID, label: "" })).toHaveProperty("label");
  });

  it("skips the label check when requireLabel is false", () => {
    expect(validateAddress({ ...VALID, label: "" }, { requireLabel: false })).not.toHaveProperty("label");
  });

  it("rejects a phone that isn't exactly 10 digits", () => {
    expect(validateAddress({ ...VALID, phone: "12345" })).toHaveProperty("phone");
  });

  it("rejects a postal code that isn't exactly 5 digits", () => {
    expect(validateAddress({ ...VALID, postalCode: "123" })).toHaveProperty("postalCode");
  });
});
