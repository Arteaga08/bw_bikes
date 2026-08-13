import type { BadgeVariant } from "@bw-bikes/shared";

/** Fake data for the M10.5 mockups — never real product/category data, never sent anywhere. */

export interface MockProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  priceCents: number;
  variantCount: number;
  status: "active" | "archived";
  badge?: { label: string; variant: BadgeVariant };
}

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "1",
    name: "S-Works Tarmac SL9",
    brand: "Specialized",
    category: "Ruta · Endurance",
    priceCents: 28_800_000,
    variantCount: 4,
    status: "active",
    badge: { label: "Novedades", variant: "accent" },
  },
  {
    id: "2",
    name: "Tarmac SL8",
    brand: "Orbea",
    category: "Ruta",
    priceCents: 19_999_900,
    variantCount: 1,
    status: "archived",
  },
  {
    id: "3",
    name: "Domane SL5",
    brand: "Trek",
    category: "Ruta",
    priceCents: 8_999_900,
    variantCount: 3,
    status: "active",
    badge: { label: "Best seller", variant: "accent" },
  },
];

export interface MockCategoryNode {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export const MOCK_CATEGORY_TREE: MockCategoryNode[] = [
  {
    id: "cat-ruta",
    name: "Ruta",
    children: [
      { id: "cat-ruta-endurance", name: "Endurance" },
      { id: "cat-ruta-aero", name: "Aero" },
    ],
  },
  {
    id: "cat-mtb",
    name: "Montaña",
    children: [
      { id: "cat-mtb-trail", name: "Trail" },
      { id: "cat-mtb-enduro", name: "Enduro" },
      { id: "cat-mtb-xc", name: "Cross-country" },
    ],
  },
  {
    id: "cat-urbana",
    name: "Urbana",
    children: [],
  },
];

export interface MockSpecTemplateRow {
  id: string;
  title: string;
  fieldCount: number;
  source: "manual" | "auto";
  isActive: boolean;
}

export const MOCK_SPEC_TEMPLATES: MockSpecTemplateRow[] = [
  { id: "1", title: "Especificaciones técnicas", fieldCount: 3, source: "manual", isActive: true },
  { id: "2", title: "Geometría", fieldCount: 6, source: "auto", isActive: true },
];
