// lib/catalogue.ts
// Helpers around the curated product catalogue. The catalogue is the
// authoritative list of products this platform can validate cases for —
// out-of-catalogue model codes are rejected at the API boundary.

import {
  CATALOGUE,
  CATALOGUE_VERSION,
  type CatalogueProduct,
  type ProductBrand,
  type ProductCategory,
} from "@/data/products/catalogue";

export { CATALOGUE, CATALOGUE_VERSION };
export type { CatalogueProduct, ProductBrand, ProductCategory };

const BY_CODE = new Map<string, CatalogueProduct>(
  CATALOGUE.map((p) => [p.modelCode.toUpperCase(), p])
);

/** Lookup by model code (case-insensitive). */
export function findProduct(modelCode: string): CatalogueProduct | null {
  return BY_CODE.get(modelCode.trim().toUpperCase()) ?? null;
}

/** Whether a model code is in the catalogue. */
export function isInCatalogue(modelCode: string): boolean {
  return BY_CODE.has(modelCode.trim().toUpperCase());
}

/** Group catalogue by brand for UI rendering. */
export function groupByBrand(): Record<ProductBrand, CatalogueProduct[]> {
  const out: Record<ProductBrand, CatalogueProduct[]> = {
    Bosch: [],
    Samsung: [],
  };
  for (const p of CATALOGUE) out[p.brand].push(p);
  return out;
}

/** Group catalogue by category. */
export function groupByCategory(): Record<ProductCategory, CatalogueProduct[]> {
  const out = {
    front_load_washer: [],
    top_load_washer: [],
    semi_automatic_washer: [],
    dryer: [],
    washer_dryer_combo: [],
  } as Record<ProductCategory, CatalogueProduct[]>;
  for (const p of CATALOGUE) out[p.category].push(p);
  return out;
}

/** Human-readable label for a product (used in dropdowns and case lists). */
export function productLabel(p: CatalogueProduct): string {
  return `${p.brand} ${p.modelCode} — ${p.series} (${p.capacityKg} kg)`;
}

/**
 * Estimated AED retail value for a product, falling back to a global default
 * when the model is unknown. Used by lib/cost.ts when the AI did not extract
 * product_value_aed from the invoice.
 */
export const DEFAULT_PRODUCT_VALUE_AED = 2500;
export function estimatedValueAed(modelCode: string): number {
  return findProduct(modelCode)?.estimatedValueAed ?? DEFAULT_PRODUCT_VALUE_AED;
}

/** Short product context block injected into the Gemini prompt for grounding. */
export function productContextBlock(modelCode: string): string {
  const p = findProduct(modelCode);
  if (!p) return `Product model "${modelCode}" is NOT in the company catalogue.`;
  return [
    `Brand: ${p.brand}`,
    `Model code: ${p.modelCode}`,
    `Series: ${p.series}`,
    `Category: ${p.category.replace(/_/g, " ")}`,
    `Capacity: ${p.capacityKg} kg${p.spinRpm ? ` · Spin: ${p.spinRpm} RPM` : ""}`,
    `Catalogue year: ${p.catalogueYear}`,
    `Estimated retail value (used only when invoice is missing): AED ${p.estimatedValueAed}`,
    `Highlight features: ${p.highlightFeatures.join(", ")}`,
  ].join("\n");
}

/** Pretty label for a category (used in /products page filters). */
export function categoryLabel(c: ProductCategory): string {
  switch (c) {
    case "front_load_washer":
      return "Front-load washer";
    case "top_load_washer":
      return "Top-load washer";
    case "semi_automatic_washer":
      return "Semi-automatic washer";
    case "dryer":
      return "Dryer";
    case "washer_dryer_combo":
      return "Washer-dryer combo";
  }
}
