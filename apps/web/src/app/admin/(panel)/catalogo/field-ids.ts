/**
 * Stable DOM ids for every field `validate()` can report an error against —
 * shared between `ProductBasicsSection`, `ProductOrganizationFields`,
 * `BikeBasicsFields` (which assign them to their inputs) and `ProductEditor`
 * (which uses the same ids to build `ErrorSummary`'s jump targets). One
 * shared map instead of three partial ones so neither side can drift.
 */
export const PRODUCT_FIELD_IDS = {
  name: "product-field-name",
  brand: "product-field-brand",
  category: "product-field-category",
  description: "product-field-description",
  priceInput: "product-field-price",
  compareAtPriceInput: "product-field-compare-price",
  shortDescription: "product-field-short-description",
  modelYear: "product-field-model-year",
} as const;
