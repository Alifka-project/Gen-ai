// lib/ai/identity-verifier.ts
// Deterministic identity verification. Runs AFTER the AI returns + evidence
// guards have applied, and produces an "identity_verification" block that
// answers: "is the photographed product the same item the customer purchased?"
//
// Three checks:
//  (1) Serial 3-way match — form_serial vs invoice_serial vs photo_serial
//  (2) Customer-name match — form_customerName vs invoice extracted_fields.customer_name
//  (3) Product match — observed_product vs catalogue entry for case.productModel

import type { AiAnalysisJson, IdentityVerification } from "./schema";
import { findProduct, type CatalogueProduct } from "@/lib/catalogue";

const SERIAL_NORMALIZE_RE = /[^A-Z0-9]/g;
function normSerial(s: string | null | undefined): string {
  if (!s) return "";
  return s.toUpperCase().replace(SERIAL_NORMALIZE_RE, "");
}

/** Levenshtein-distance-based similarity ratio in [0, 100]. */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const A = a.toLowerCase().trim();
  const B = b.toLowerCase().trim();
  if (A === B) return 100;
  const m = A.length;
  const n = B.length;
  // Small bound: prevent O(m*n) on huge strings.
  if (Math.max(m, n) > 200) return A.includes(B) || B.includes(A) ? 80 : 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const dist = dp[m][n];
  return Math.round((1 - dist / Math.max(m, n)) * 100);
}

/** Map a catalogue product into the three observed_product fields the AI
 *  produces, so we can compare apples to apples. */
function describeCatalogueProduct(p: CatalogueProduct): {
  brand: string;
  type: string;
  capacityKg: string;
} {
  const typeMap: Record<string, string> = {
    front_load_washer: "front-load washer",
    top_load_washer: "top-load washer",
    semi_automatic_washer: "semi-automatic washer",
    dryer: "dryer",
    washer_dryer_combo: "washer-dryer combo",
  };
  return {
    brand: p.brand,
    type: typeMap[p.category] ?? p.category,
    capacityKg: p.capacityKg,
  };
}

export type IdentityVerifierInput = {
  analysis: AiAnalysisJson;
  formSerial: string | null;
  formCustomerName: string;
  productModel: string;
  /** EXIF from the FIRST attached image (orchestrator extracts this). */
  exif?: IdentityVerification["exif"];
};

/**
 * Compute identity_verification. Pure function — given the same inputs
 * always returns the same output. No AI calls here.
 */
export function verifyIdentity(input: IdentityVerifierInput): IdentityVerification {
  const issues: string[] = [];

  // ── 1. Serial 3-way match ────────────────────────────────────────────
  const formSerial = input.formSerial;
  const invoiceSerial = input.analysis.document_analysis.extracted_fields.serial_number;
  const photoSerial = input.analysis.visual_analysis.serial_number_text;

  const sources = [formSerial, invoiceSerial, photoSerial]
    .map((s) => normSerial(s))
    .filter(Boolean);
  const distinctNormalized = new Set(sources);

  let serialMatch: IdentityVerification["serial_match"];
  if (sources.length === 0) {
    serialMatch = "insufficient_data";
    issues.push("No serial number available from any source (form, invoice, photo).");
  } else if (sources.length === 1) {
    serialMatch = "insufficient_data";
    // Add a softer note rather than a hard issue.
  } else if (distinctNormalized.size === 1) {
    serialMatch = "match";
  } else {
    // Two or more sources, and they differ — check partial overlap.
    const arr = Array.from(distinctNormalized);
    const partial = arr.some((a) =>
      arr.some((b) => a !== b && (a.includes(b) || b.includes(a)))
    );
    if (partial) {
      serialMatch = "partial_match";
      issues.push(
        `Serial partial match across sources: ${formSerial ? `form="${formSerial}"` : ""} ${invoiceSerial ? `invoice="${invoiceSerial}"` : ""} ${photoSerial ? `photo="${photoSerial}"` : ""}`.trim()
      );
    } else {
      serialMatch = "mismatch";
      issues.push(
        `Serial MISMATCH across sources: ${formSerial ? `form="${formSerial}"` : ""} ${invoiceSerial ? `invoice="${invoiceSerial}"` : ""} ${photoSerial ? `photo="${photoSerial}"` : ""}`.trim()
      );
    }
  }

  // ── 2. Customer-name match ────────────────────────────────────────────
  const invoiceName = input.analysis.document_analysis.extracted_fields.customer_name;
  const nameSim = invoiceName
    ? stringSimilarity(input.formCustomerName, invoiceName)
    : 0;
  const customerNameMatch = {
    form_name: input.formCustomerName,
    invoice_name: invoiceName,
    matches: invoiceName ? nameSim >= 80 : true, // no invoice → no mismatch
    similarity: invoiceName ? nameSim : 100,
  };
  if (invoiceName && nameSim < 80) {
    issues.push(
      `Customer name on invoice ("${invoiceName}") does not match intake form ("${input.formCustomerName}") — similarity ${nameSim}%.`
    );
  }

  // ── 3. Product match (photo vs catalogue) ─────────────────────────────
  const catalogueProduct = findProduct(input.productModel);
  const expected = catalogueProduct
    ? describeCatalogueProduct(catalogueProduct)
    : { brand: "unknown", type: "unknown", capacityKg: "unknown" };

  const observed = input.analysis.visual_analysis.observed_product;
  const obsBrand = observed.brand;
  const obsType = observed.product_type;
  const obsCapacity = observed.approximate_capacity_kg;

  const brandMatches = obsBrand
    ? obsBrand.toLowerCase().includes(expected.brand.toLowerCase()) ||
      expected.brand.toLowerCase().includes(obsBrand.toLowerCase())
    : true; // no observation → don't flag a mismatch
  const typeMatches = obsType
    ? stringSimilarity(obsType, expected.type) >= 70
    : true;
  const capacityMatches = obsCapacity
    ? stringSimilarity(obsCapacity, expected.capacityKg) >= 70 ||
      expected.capacityKg.split("/").some((c) => obsCapacity.includes(c.trim()))
    : true;
  const overallMatch = brandMatches && typeMatches && capacityMatches;

  if (obsBrand && !brandMatches) {
    issues.push(
      `Photographed product brand ("${obsBrand}") does not match the catalogue entry ("${expected.brand}").`
    );
  }
  if (obsType && !typeMatches) {
    issues.push(
      `Photographed product type ("${obsType}") does not match the catalogue entry ("${expected.type}").`
    );
  }
  if (obsCapacity && !capacityMatches) {
    issues.push(
      `Photographed capacity ("${obsCapacity} kg") does not match the catalogue entry ("${expected.capacityKg} kg").`
    );
  }

  // ── 4. Overall verdict + score ────────────────────────────────────────
  let identity_score = 50; // baseline = unknown
  let identity_verified = false;

  if (serialMatch === "match") identity_score += 30;
  else if (serialMatch === "partial_match") identity_score += 5;
  else if (serialMatch === "mismatch") identity_score -= 30;

  if (overallMatch && (obsBrand || obsType || obsCapacity)) identity_score += 15;
  else if (!overallMatch) identity_score -= 25;

  if (customerNameMatch.matches) identity_score += 5;
  else identity_score -= 15;

  identity_score = Math.max(0, Math.min(100, identity_score));

  // VERIFIED only when serial actually matches AND product matches AND name
  // is OK. Insufficient data ≠ verified.
  identity_verified =
    serialMatch === "match" && overallMatch && customerNameMatch.matches;

  return {
    form_serial: formSerial,
    invoice_serial: invoiceSerial,
    photo_serial: photoSerial,
    serial_match: serialMatch,
    serial_sources_count: sources.length,
    customer_name_match: customerNameMatch,
    product_match: {
      expected_brand: expected.brand,
      expected_type: expected.type,
      expected_capacity_kg: expected.capacityKg,
      observed_brand: obsBrand,
      observed_type: obsType,
      observed_capacity_kg: obsCapacity,
      brand_matches: brandMatches,
      type_matches: typeMatches,
      capacity_matches: capacityMatches,
      overall_match: overallMatch,
    },
    exif: input.exif ?? null,
    identity_verified,
    identity_issues: issues,
    identity_score,
  };
}
